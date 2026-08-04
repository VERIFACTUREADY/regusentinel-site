import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { inviteUserSchema } from "@/lib/validations";
import { checkRoleAssignment } from "@/lib/rbac";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { PLAN_PRICING } from "@/lib/stripe";
import crypto from "crypto";

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

    // Plan-level user cap: la tabla /precios promete "Hasta N usuarios"
    // por plan. Antes de crear la membership, contamos los activos y
    // bloqueamos si ya se alcanzó el cap.
    const sub = await prisma.subscription.findUnique({
      where: { orgId: session.user.orgId },
      select: { plan: true },
    });
    const plan = sub?.plan ?? "INICIA";
    const maxUsers = PLAN_PRICING[plan].maxUsers;
    const currentMembers = await prisma.membership.count({
      where: { orgId: session.user.orgId },
    });
    if (currentMembers >= maxUsers) {
      const nextPlan = plan === "INICIA" ? "Despacho" : plan === "DESPACHO" ? "Firma" : null;
      const upgradeHint = nextPlan
        ? ` Actualiza a ${nextPlan} para añadir más miembros.`
        : "";
      return NextResponse.json(
        {
          error: `Límite de usuarios alcanzado para el plan ${PLAN_PRICING[plan].label} (${maxUsers} usuarios).${upgradeHint}`,
        },
        { status: 403 },
      );
    }

    // Check if user exists
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

    // Check existing membership
    const existing = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: session.user.orgId } },
    });
    if (existing) {
      return NextResponse.json({ error: "El usuario ya es miembro" }, { status: 400 });
    }

    await prisma.membership.create({
      data: { userId: user.id, orgId: session.user.orgId, role: data.role },
    });

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
