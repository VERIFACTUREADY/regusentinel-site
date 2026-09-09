import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const messages = await prisma.portalMessage.findMany({
    where: { caseId: c.id },
    orderBy: { createdAt: "asc" },
  });

  // El marcado como leído se ha movido a POST /read: este GET ya no escribe.
  // Antes, cualquier lectura del hilo (incluido un prefetch del navegador o un
  // reintento) marcaba los mensajes de la familia como leídos.
  return NextResponse.json(messages);
}

/**
 * POST /api/cases/[id]/portal-messages/read — marca como leídos los mensajes
 * de la familia. Acción explícita de escritura, invocada por la interfaz
 * cuando el usuario abre la conversación.
 */
export async function PUT(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.update");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const result = await prisma.portalMessage.updateMany({
    where: { caseId: c.id, fromFamily: true, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true, marked: result.count });
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

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
