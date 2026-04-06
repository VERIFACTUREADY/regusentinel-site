import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { inviteUserSchema } from "@/lib/validations";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "org.members")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const members = await prisma.membership.findMany({
    where: { orgId: session.user.orgId },
    include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
  });

  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "org.members.invite")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = inviteUserSchema.parse(body);

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email: data.email } });
    const magicToken = crypto.randomBytes(32).toString("hex");

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name || null,
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
      data: { userId: user.id, orgId: session.user.orgId, role: data.role as any },
    });

    // Send invite email
    try {
      await sendEmail({
        to: data.email,
        subject: "Invitacion a BARITUR PRO",
        html: `<p>Has sido invitado a unirte a BARITUR PRO.</p>
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
