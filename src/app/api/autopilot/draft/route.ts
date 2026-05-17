import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { generateDraft } from "@/lib/autopilot";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "autopilot.run")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

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
