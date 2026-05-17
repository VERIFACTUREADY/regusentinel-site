import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const messages = await prisma.portalMessage.findMany({
    where: { caseId: c.id },
    orderBy: { createdAt: "asc" },
  });

  // Mark unread family messages as read
  const unread = messages.filter((m) => m.fromFamily && !m.readAt);
  if (unread.length > 0) {
    await prisma.portalMessage.updateMany({
      where: { id: { in: unread.map((m) => m.id) } },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const content = body.content?.trim();
  if (!content || content.length < 2) {
    return NextResponse.json({ error: "El mensaje no puede estar vacio" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 400 });
  }

  const message = await prisma.portalMessage.create({
    data: {
      caseId: c.id,
      fromFamily: false,
      authorName: session.user.name || session.user.email || "Gestor",
      content,
      readAt: new Date(),
    },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: c.id,
    action: "portal.message_sent",
    details: `Mensaje enviado a la familia (${content.length} chars)`,
  });

  return NextResponse.json(message, { status: 201 });
}
