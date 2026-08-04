import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { batchTaskSchema } from "@/lib/validations";
import { findActiveMember } from "@/lib/tenancy";
import { logAudit } from "@/lib/audit";
import { triggerWorkflow } from "@/lib/workflow-engine";

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgPermission("tasks.update");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const orgId = session.user.orgId;
  const userId = session.user.id;

  const parsed = batchTaskSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 400 },
    );
  }
  const { taskIds, status, assigneeId } = parsed.data;

  // El asignado debe ser miembro vivo de esta organización. Antes `assigneeId`
  // se escribía sin comprobar nada y permitía asignar tareas en bloque a un
  // usuario de otro tenant.
  if (assigneeId) {
    const member = await findActiveMember(assigneeId, orgId);
    if (!member) {
      return NextResponse.json(
        { error: "El usuario asignado no pertenece a esta organización" },
        { status: 400 },
      );
    }
  }

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, case: { orgId, deletedAt: null } },
    select: { id: true, title: true, caseId: true, status: true, category: true },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ error: "No se encontraron tareas validas" }, { status: 404 });
  }

  const data: Prisma.TaskUncheckedUpdateManyInput = {};
  if (status) data.status = status;
  if (assigneeId !== undefined) data.assigneeId = assigneeId ?? null;

  await prisma.task.updateMany({
    where: { id: { in: tasks.map((t) => t.id) } },
    data,
  });

  const action = status ? `task.batch_${status.toLowerCase()}` : "task.batch_assigned";
  const details = status
    ? `${tasks.length} tareas marcadas como ${status}`
    : assigneeId
      ? `${tasks.length} tareas reasignadas`
      : `${tasks.length} tareas desasignadas`;

  const caseIds = Array.from(new Set(tasks.map((t) => t.caseId)));
  await Promise.all(caseIds.map((caseId) =>
    logAudit({
      orgId,
      userId,
      caseId,
      action,
      details,
    })
  ));

  if (status) {
    // Trigger once per unique case, not per task
    Promise.allSettled(
      caseIds.map((caseId) => {
        const t = tasks.find((t) => t.caseId === caseId)!;
        return triggerWorkflow({
          type: "TASK_STATUS_CHANGED",
          orgId,
          caseId,
          userId,
          taskStatus: status,
          taskCategory: t.category,
        });
      })
    ).catch(console.error);
  }

  return NextResponse.json({ updated: tasks.length });
}
