import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "org.members")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { role } = body;

  const membership = await prisma.membership.findFirst({
    where: { userId: params.id, orgId: session.user.orgId },
  });
  if (!membership) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });

  if (membership.role === "OWNER" && role !== "OWNER") {
    const ownerCount = await prisma.membership.count({
      where: { orgId: session.user.orgId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Debe haber al menos un Owner" }, { status: 400 });
    }
  }

  await prisma.membership.update({ where: { id: membership.id }, data: { role } });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "user.role_changed",
    details: `Usuario ${params.id} cambiado a ${role}`,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "org.members")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: params.id, orgId: session.user.orgId },
  });
  if (!membership) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });

  await prisma.membership.delete({ where: { id: membership.id } });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "user.removed",
    details: `Usuario ${params.id} eliminado de la organizacion`,
  });

  return NextResponse.json({ success: true });
}
