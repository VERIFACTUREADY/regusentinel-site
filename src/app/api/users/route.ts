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

    const plan = await planOf(session.user.orgId);

    // Check if user exists. El alta del usuario va fuera de la transacción a
    // propósito: es idempotente por email y no debe reintentarse si el tope
    // de plan aborta.
    let user = await prisma.user.findUnique({ where: { email: data.email } });
    const magicToken = crypto.randomBytes(32).toString("hex");

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.email.split("@")[0] || null,
          magicToken,
          magicTokenExp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    }
    const invitedUser = user;

    // Tope de usuarios del plan. Antes se contaba fuera y se creaba después:
    // dos invitaciones simultáneas leían el mismo recuento y ambas pasaban,
    // superando el tope. Ahora el recuento y la creación van en la misma
    // transacción, serializada por organización.
    try {
      await prisma.$transaction(async (tx) => {
        await lockOrgForLimits(session.user.orgId, tx);

        const existing = await tx.membership.findUnique({
          where: { userId_orgId: { userId: invitedUser.id, orgId: session.user.orgId } },
        });
        if (existing) throw new InviteError("El usuario ya es miembro", 400);

        const limit = await checkUserLimit(session.user.orgId, plan, tx);
        if (!limit.allowed) throw new InviteError(limit.message!, 403);

        await tx.membership.create({
          data: { userId: invitedUser.id, orgId: session.user.orgId, role: data.role },
        });
      });
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

    return NextResponse.json({ userId: user.id, role: data.role }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Datos invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Invite error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
