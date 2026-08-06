import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { inviteUserSchema } from "@/lib/validations";
import { checkRoleAssignment } from "@/lib/rbac";
import { sendEmail } from "@/lib/email";
import {
  tieneCredencialUtilizable,
  rotarTokenInvitacion,
  enlaceCrearContrasena,
  VALIDEZ_INVITACION_MS,
} from "@/lib/invitaciones";
import { logAudit } from "@/lib/audit";
import { checkUserLimit, planOf, lockOrgForLimits } from "@/lib/plan-limits";
import crypto from "crypto";

/** Rechazo de invitacion con codigo HTTP; aborta la transaccion. */
class InviteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "InviteError";
  }
}

/**
 * El lock por organización serializa las invitaciones de UNA organización,
 * pero la unicidad de `User.email` es global: dos organizaciones distintas
 * invitando al mismo email a la vez pueden intentar crear la misma fila y una
 * de las dos recibirá P2002. En PostgreSQL un error aborta la transacción
 * entera, así que la única salida correcta es reintentarla: al reintentar, el
 * `findUnique` ya encuentra al usuario creado por la otra petición y sólo se
 * añade la membresía.
 */
async function conReintentoDeColision<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== "P2002") throw err;
    return await fn();
  }
}

export async function GET(_req: NextRequest) {
  const auth = await requireOrgPermission("org.members");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const members = await prisma.membership.findMany({
    where: { orgId: session.user.orgId },
    include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
  });

  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgPermission("org.members.invite");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  try {
    const body = await req.json();
    const data = inviteUserSchema.parse(body);

    // Sólo un OWNER puede incorporar a otro OWNER. `org.members.invite` lo
    // tiene también MANAGER, así que sin esto un MANAGER podía crear un OWNER
    // nuevo (y entrar con él) para saltarse sus propias restricciones.
    const denial = checkRoleAssignment({
      actorRole: auth.session.role,
      actorUserId: auth.session.userId,
      targetUserId: "", // invitación: todavía no hay miembro destino
      targetRole: data.role,
    });
    if (denial) {
      return NextResponse.json({ error: denial }, { status: 403 });
    }

    // TODO EL ALTA VA EN UNA SOLA TRANSACCIÓN.
    //
    // Antes el `User` se creaba FUERA de la transacción, con el comentario de
    // que era "idempotente por email". No lo era en la práctica: si el tope de
    // usuarios del plan abortaba la transacción posterior, la cuenta ya había
    // quedado creada en la base con un `magicToken` válido siete días y sin
    // ninguna membresía. Es decir, una invitación rechazada dejaba una
    // credencial de acceso viva a nombre de alguien que nunca fue admitido.
    // Repetir la llamada creaba tokens nuevos indefinidamente.
    //
    // Ahora, dentro de la misma transacción y **después** de tomar el lock:
    // se lee el plan, se comprueba la membresía previa, se comprueba el tope,
    // y sólo entonces se crea usuario y membresía. Si algo falla, no queda
    // nada escrito.
    let invitedUserId = "";
    let tokenInvitacion: string | null = null;

    try {
      const alta = await conReintentoDeColision(async () =>
        prisma.$transaction(async (tx) => {
          await lockOrgForLimits(session.user.orgId, tx);

          // El plan se lee DENTRO de la transacción y después del lock: leerlo
          // antes permitía invitar con el tope del plan anterior si la
          // suscripción cambiaba entre medias.
          const plan = await planOf(session.user.orgId, tx);

          const user = await tx.user.findUnique({
            where: { email: data.email },
            // `passwordHash` hace falta para saber si la credencial sirve.
            select: { id: true, passwordHash: true },
          });

          if (user) {
            const existing = await tx.membership.findUnique({
              where: { userId_orgId: { userId: user.id, orgId: session.user.orgId } },
            });
            if (existing) throw new InviteError("El usuario ya es miembro", 400);
          }

          const limit = await checkUserLimit(session.user.orgId, plan, tx);
          if (!limit.allowed) throw new InviteError(limit.message!, 403);

          /*
           * El token es lo que permite al invitado ELEGIR su contrasena.
           *
           * La condicion NO es "el usuario es nuevo", que era el error
           * anterior. Es "no tiene una credencial utilizable". Alguien que ya
           * existe en la base de datos porque le invitaron antes y nunca entro
           * sigue sin contrasena: si no se le emite token, se le da de alta en
           * la organizacion y se queda fuera para siempre.
           */
          let tokenInvitacion: string | null = null;
          let caduca = new Date(Date.now() + VALIDEZ_INVITACION_MS);

          let userId: string;
          if (user) {
            userId = user.id;
            if (!tieneCredencialUtilizable(user)) {
              const emitido = await rotarTokenInvitacion(tx, userId);
              tokenInvitacion = emitido.token;
              caduca = emitido.expira;
            }
          } else {
            userId = (
              await tx.user.create({
                data: {
                  email: data.email,
                  name: data.email.split("@")[0] || null,
                },
                select: { id: true },
              })
            ).id;
            const emitido = await rotarTokenInvitacion(tx, userId);
            tokenInvitacion = emitido.token;
            caduca = emitido.expira;
          }

          await tx.membership.create({
            data: { userId, orgId: session.user.orgId, role: data.role },
          });

          /*
           * La invitacion queda registrada con su estado. Reinvitar reutiliza
           * la fila —hay un unico indice por (orgId, email)— porque una segunda
           * invitacion al mismo correo no es un hecho nuevo, es el mismo que
           * vuelve a intentarse.
           */
          await tx.invitation.upsert({
            where: { orgId_email: { orgId: session.user.orgId, email: data.email } },
            create: {
              orgId: session.user.orgId,
              email: data.email,
              role: data.role,
              status: tokenInvitacion ? "PENDING" : "ACCEPTED",
              invitedById: session.user.id,
              expiresAt: caduca,
              acceptedAt: tokenInvitacion ? null : new Date(),
              lastSentAt: new Date(),
            },
            update: {
              role: data.role,
              status: tokenInvitacion ? "PENDING" : "ACCEPTED",
              invitedById: session.user.id,
              expiresAt: caduca,
              acceptedAt: tokenInvitacion ? null : new Date(),
              revokedAt: null,
              lastSentAt: new Date(),
            },
          });

          return { userId, tokenInvitacion };
        }),
      );
      invitedUserId = alta.userId;
      tokenInvitacion = alta.tokenInvitacion;
    } catch (err) {
      if (err instanceof InviteError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    /*
     * EL CORREO DE INVITACION
     * -----------------------
     * Antes decia "Accede con tu email" y enlazaba a /login. Para alguien
     * recien creado eso es un callejon sin salida: no tiene contrasena, y el
     * `magicToken` que se le habia generado no se le enviaba a ninguna parte.
     * La invitacion se registraba como enviada y la persona no podia entrar.
     *
     * Ahora el alta nueva recibe el enlace que le permite elegir contrasena
     * —el mismo mecanismo que la recuperacion, que ya existia— y quien ya
     * tenia cuenta recibe simplemente el aviso de que se le ha dado acceso.
     */
    const enlace = tokenInvitacion
      ? enlaceCrearContrasena(tokenInvitacion)
      : `${process.env.APP_URL}/login`;

    let correoEnviado = false;
    let motivoFallo: string | null = null;
    try {
      await sendEmail({
        to: data.email,
        subject: "Invitacion a Heredia",
        html: tokenInvitacion
          ? `<p>Te han invitado a unirte a Heredia.</p>
             <p>Para entrar, elige tu contrasena:</p>
             <p><a href="${enlace}">Crear mi contrasena</a></p>
             <p>El enlace caduca en 7 dias. Si caduca, pide que te reenvien la invitacion.</p>`
          : `<p>Te han dado acceso a una organizacion en Heredia.</p>
             <p>Entra con tu cuenta habitual:</p>
             <p><a href="${enlace}">Iniciar sesion</a></p>`,
      });
      correoEnviado = true;
    } catch (err) {
      /*
       * NO se traga el fallo.
       *
       * Antes este catch estaba vacio con el comentario "best-effort" y el
       * endpoint respondia 201, asi que la interfaz decia "Invitacion enviada"
       * aunque el servidor de correo estuviera caido. El administrador se
       * quedaba esperando a alguien que nunca iba a recibir nada.
       *
       * El alta SI es correcta —la membresia esta creada— asi que no se
       * devuelve un error: se devuelve la verdad, `emailSent: false`, y la
       * interfaz lo dice y ofrece reenviar.
       */
      motivoFallo = err instanceof Error ? err.message : "error desconocido";
      console.error("[invitacion] no se ha podido enviar el correo:", motivoFallo);
    }

    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      action: "user.invited",
      details:
        `${data.email} invitado como ${data.role}` +
        (correoEnviado ? "" : ` — EL CORREO NO SE PUDO ENVIAR (${motivoFallo})`),
    });

    return NextResponse.json(
      {
        userId: invitedUserId,
        role: data.role,
        emailSent: correoEnviado,
        // El token NO se devuelve nunca: entregarselo a quien invita le daria
        // poder para fijar la contrasena de la cuenta de otra persona.
        needsPasswordSetup: tokenInvitacion !== null,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Datos invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Invite error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
