import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendChatMessage, getChatHistory } from "@/lib/case-chat";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const history = await getChatHistory(params.id);
  return NextResponse.json({ history });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireOrgPermission("autopilot.run");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });

  try {
    const result = await sendChatMessage({
      caseId: params.id,
      userId: session.user.id,
      message,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[case-chat] failed:", err);
    return NextResponse.json(
      { error: err?.message || "Error en el asistente IA" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireOrgPermission("autopilot.run");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  await prisma.promptLog.deleteMany({
    where: { caseId: params.id, action: "case_chat" },
  });
  return NextResponse.json({ ok: true });
}
