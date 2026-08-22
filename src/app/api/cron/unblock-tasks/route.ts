import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { validateCronSecret } from "@/lib/cron-auth";
import { triggerWorkflow, claveDeEvento } from "@/lib/workflow-engine";

/**
 * Desbloqueo de tareas cuyo `blockedUntil` ya ha pasado.
 *
 * Esto vivía dentro del GET de `/api/cases/[id]`: leer un expediente escribía
 * en la base de datos. Tres problemas que aquí desaparecen:
 *
 *   1. Un GET mutaba estado (y sólo para los expedientes que alguien abría:
 *      una tarea de un expediente no visitado seguía bloqueada para siempre).
 *   2. El desbloqueo no quedaba auditado.
 *   3. No disparaba los workflows de cambio de estado de tarea, así que las
 *      automatizaciones del cliente no se enteraban.
 *
 * Protegido por CRON_SECRET, como el resto de crons. Vercel Cron sólo emite
 * GET, de ahí que sea un GET con escritura: es la excepción documentada.
 */
export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const due = await prisma.task.findMany({
    where: {
      status: "BLOCKED",
      blockedUntil: { not: null, lte: now },
      case: { deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
    },
    select: {
      id: true,
      title: true,
      category: true,
      caseId: true,
      case: { select: { orgId: true } },
    },
    take: 1000,
  });

  let unblocked = 0;

  for (const task of due) {
    // Actualización condicional: si otra ruta ya cambió el estado entre la
    // lectura y ahora, `count` será 0 y no auditamos un cambio que no ocurrió.
    const result = await prisma.task.updateMany({
      where: { id: task.id, status: "BLOCKED" },
      data: { status: "PENDING", blockReason: null },
    });
    if (result.count === 0) continue;

    // La versión de la tarea tras desbloquearla identifica ESTE desbloqueo.
    // El cron puede reejecutarse; sin una identidad estable, dos pasadas que
    // vieran la misma tarea generarían dos avisos, y sin una identidad
    // distinta un desbloqueo posterior de la misma tarea se perdería.
    const desbloqueada = await prisma.task.findUnique({
      where: { id: task.id },
      select: { updatedAt: true },
    });

    unblocked++;

    await logAudit({
      orgId: task.case.orgId,
      caseId: task.caseId,
      action: "task.unblocked",
      details: `Tarea "${task.title}" desbloqueada al vencer su fecha de espera`,
    }).catch(console.error);

    triggerWorkflow({
      type: "TASK_STATUS_CHANGED",
      orgId: task.case.orgId,
      caseId: task.caseId,
      taskId: task.id,
      taskStatus: "PENDING",
      taskCategory: task.category,
      ...(desbloqueada
        ? { eventKey: claveDeEvento.estadoTarea(task.id, desbloqueada.updatedAt) }
        : {}),
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, candidates: due.length, unblocked });
}
