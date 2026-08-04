import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { findApprovalInOrg, findTaskInCase } from "@/lib/tenancy";
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

  const approval = await findApprovalInOrg(params.id, session.user.orgId);
  if (!approval) return NextResponse.json({ error: "Aprobacion no encontrada" }, { status: 404 });

  // La tarea asociada debe pertenecer al mismo expediente que la aprobación.
  // Antes se actualizaba con `where: { id: approval.taskId }` sin más: si una
  // aprobación quedaba apuntando a una tarea de otro expediente, la escritura
  // salía del tenant.
  if (approval.taskId) {
    const linkedTask = await findTaskInCase(
      approval.taskId, approval.caseId, session.user.orgId,
    );
    if (!linkedTask) {
      return NextResponse.json(
        { error: "La tarea asociada no pertenece a este expediente" },
        { status: 409 },
      );
    }
  }

  // Aprobación y tarea se actualizan juntas: si la segunda falla, la primera
  // no debe quedar marcada como revisada.
  const updated = await prisma.$transaction(async (tx) => {
    const approvalRow = await tx.approval.update({
      where: { id: approval.id },
      data: { status, reviewerId: session.user.id, reviewedAt: new Date() },
    });

    if (approval.taskId) {
      await tx.task.update({
        where: { id: approval.taskId },
        data: { status: status === "APPROVED" ? "APPROVED" : "PENDING" },
      });
    }

    return approvalRow;
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: approval.caseId,
    action: `approval.${status.toLowerCase()}`,
    details: `Accion "${approval.action}" ${status === "APPROVED" ? "aprobada" : "rechazada"}`,
  });

  return NextResponse.json(updated);
}
