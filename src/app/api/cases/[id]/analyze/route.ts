import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { analyzeCase, getLatestAnalysis } from "@/lib/case-analyzer";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const analysis = await getLatestAnalysis(params.id);
  return NextResponse.json({ analysis });
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("autopilot.run");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  try {
    const analysis = await analyzeCase({ caseId: params.id, userId: session.user.id });
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: "case.analyzed",
      details: `Score: ${analysis.healthScore} (${analysis.status})`,
    }).catch(() => {});
    return NextResponse.json({ analysis });
  } catch (err: any) {
    console.error("[analyze] failed:", err);
    return NextResponse.json(
      { error: err?.message || "Error al analizar expediente" },
      { status: 500 }
    );
  }
}
