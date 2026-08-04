import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { triggerWorkflow } from "@/lib/workflow-engine";

// POST /api/workflow-rules/[id]/test — run rule against a specific case (dry preview)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("workflow.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const rule = await prisma.workflowRule.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
  });
  if (!rule) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const { caseId } = body;
  if (!caseId) return NextResponse.json({ error: "caseId requerido" }, { status: 400 });

  const testCase = await prisma.case.findFirst({
    where: { id: caseId, orgId: session.user.orgId, deletedAt: null },
  });
  if (!testCase) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  await triggerWorkflow({
    type: rule.trigger,
    orgId: session.user.orgId,
    caseId,
    userId: session.user.id,
    fromStatus: testCase.status,
    toStatus: testCase.status,
  });

  return NextResponse.json({ success: true, message: "Regla ejecutada sobre el expediente de prueba" });
}
