import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateHandoffBriefing, getLastHandoffBriefing } from "@/lib/handoff-briefing";

export async function GET(
  _req: NextRequest,
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

  const briefing = await getLastHandoffBriefing(params.id);
  return NextResponse.json({ briefing });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireOrgPermission("cases.write");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const briefing = await generateHandoffBriefing(params.id, session.user.id);
  return NextResponse.json({ briefing });
}
