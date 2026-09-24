import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateDraft } from "@/lib/autopilot";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const auth = await requireOrgPermission("autopilot.run");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const body = await req.json();
  const { caseId, templateId, versionId } = body;

  const c = await prisma.case.findFirst({
    where: { id: caseId, orgId: session.user.orgId },
    include: { deceased: true, contact: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  let version;
  if (versionId) {
    version = await prisma.templateVersion.findUnique({ where: { id: versionId } });
  } else {
    version = await prisma.templateVersion.findFirst({
      where: { templateId },
      orderBy: { version: "desc" },
    });
  }
  if (!version) return NextResponse.json({ error: "Version de plantilla no encontrada" }, { status: 404 });

  const draft = await generateDraft(version.body, c, session.user.id);

  // Create approval record
  const approval = await prisma.approval.create({
    data: {
      caseId,
      action: "send_draft",
      status: "PENDING",
      details: draft,
    },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId,
    action: "autopilot.draft_generated",
    details: `Borrador generado desde plantilla ${templateId}`,
  });

  return NextResponse.json({ draft, approvalId: approval.id });
}
