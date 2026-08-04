import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("autopilot.approve");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const body = await req.json();
  const { status } = body;
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
  }

  const approval = await prisma.approval.findFirst({
    where: { id: params.id, case: { orgId: session.user.orgId } },
  });
  if (!approval) return NextResponse.json({ error: "Aprobacion no encontrada" }, { status: 404 });

  const updated = await prisma.approval.update({
    where: { id: params.id },
    data: { status, reviewerId: session.user.id, reviewedAt: new Date() },
  });

  if (approval.taskId) {
    await prisma.task.update({
      where: { id: approval.taskId },
      data: { status: status === "APPROVED" ? "APPROVED" : "PENDING" },
    });
  }

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: approval.caseId,
    action: `approval.${status.toLowerCase()}`,
    details: `Accion "${approval.action}" ${status === "APPROVED" ? "aprobada" : "rechazada"}`,
  });

  return NextResponse.json(updated);
}
