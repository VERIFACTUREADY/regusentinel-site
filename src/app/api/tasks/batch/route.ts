import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { batchTaskSchema } from "@/lib/validations";
import { findActiveMember } from "@/lib/tenancy";
import { logAudit } from "@/lib/audit";
import { triggerWorkflow, claveDeEvento } from "@/lib/workflow-engine";

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

  const action = status ? `task.batch_${status.toLowerCase()}` : "task.batch_assigned";
  const details = status
    ? `${tasks.length} tareas marcadas como ${status}`
    : assigneeId
      ? `${tasks.length} tareas reasignadas`
      : `${tasks.length} tareas desasignadas`;

  const caseIds = Array.from(new Set(tasks.map((t) => t.caseId)));

  /*
   * La escritura del lote y sus filas de auditoría, en UNA transacción.
   *
   * Antes eran dos operaciones confirmadas por separado: si la auditoría
   * fallaba, quedaban N tareas con el estado nuevo y ningún registro de quién
   * lo hizo. Y como la identidad del evento ES esa fila, tampoco se disparaba
   * la automatización.
   *
   * Una fila por expediente tocado. Su id es además la identidad de este lote:
   * el disparo es uno por expediente y no lleva `taskId`, así que sin ella la
   * clave sería `(org, regla, expediente, tipo, estado, ventana)` y dos lotes
   * distintos sobre el mismo expediente con el mismo estado destino dentro de
   * cinco minutos contarían como uno solo. Sale de una fila ya escrita, así que
   * una reentrega del mismo lote da la misma clave —no repite el aviso— y el
   * lote siguiente da otra.
   */
  const transiciones = await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { id: { in: tasks.map((t) => t.id) } },
      data,
    });

    const filas = [];
    for (const caseId of caseIds) {
      filas.push(await logAudit({ orgId, userId, caseId, action, details }, tx));
    }
    return filas;
  });

  if (status) {
    // Trigger once per unique case, not per task
    Promise.allSettled(
      caseIds.map((caseId, i) => {
        const t = tasks.find((t) => t.caseId === caseId)!;
        return triggerWorkflow({
          type: "TASK_STATUS_CHANGED",
          orgId,
          caseId,
          userId,
          taskStatus: status,
          taskCategory: t.category,
          eventKey: claveDeEvento.transicionAuditada(transiciones[i].id),
        });
      })
    ).catch(console.error);
  }

  return NextResponse.json({ updated: tasks.length });
}
