import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { inviteUserSchema } from "@/lib/validations";
import { checkRoleAssignment } from "@/lib/rbac";
import { sendEmail } from "@/lib/email";
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

    try {
      invitedUserId = await conReintentoDeColision(async () =>
        prisma.$transaction(async (tx) => {
          await lockOrgForLimits(session.user.orgId, tx);

          // El plan se lee DENTRO de la transacción y después del lock: leerlo
          // antes permitía invitar con el tope del plan anterior si la
          // suscripción cambiaba entre medias.
          const plan = await planOf(session.user.orgId, tx);

          const user = await tx.user.findUnique({
            where: { email: data.email },
            select: { id: true },
          });

          if (user) {
            const existing = await tx.membership.findUnique({
              where: { userId_orgId: { userId: user.id, orgId: session.user.orgId } },
            });
            if (existing) throw new InviteError("El usuario ya es miembro", 400);
          }

          const limit = await checkUserLimit(session.user.orgId, plan, tx);
          if (!limit.allowed) throw new InviteError(limit.message!, 403);

          const userId =
            user?.id ??
            (
              await tx.user.create({
                data: {
                  email: data.email,
                  name: data.email.split("@")[0] || null,
                  magicToken: crypto.randomBytes(32).toString("hex"),
                  magicTokenExp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
                },
                select: { id: true },
              })
            ).id;

          await tx.membership.create({
            data: { userId, orgId: session.user.orgId, role: data.role },
          });

          return userId;
        }),
      );
    } catch (err) {
      if (err instanceof InviteError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    // Send invite email
    try {
      await sendEmail({
        to: data.email,
        subject: "Invitacion a Heredia",
        html: `<p>Has sido invitado a unirte a Heredia.</p>
               <p>Accede con tu email: ${data.email}</p>
               <p><a href="${process.env.APP_URL}/login">Iniciar sesion</a></p>`,
      });
    } catch {
      // Email sending is best-effort
    }

    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      action: "user.invited",
      details: `${data.email} invitado como ${data.role}`,
    });

    return NextResponse.json({ userId: invitedUserId, role: data.role }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Datos invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Invite error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
