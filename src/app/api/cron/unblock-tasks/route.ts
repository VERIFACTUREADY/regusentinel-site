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
  let failed = 0;

  for (const task of due) {
    /*
     * Desbloqueo y auditoría, en UNA transacción.
     *
     * La actualización sigue siendo condicional: si otra ruta ya cambió el
     * estado entre la lectura y ahora, `count` es 0 y no auditamos un cambio
     * que no ocurrió. Lo que se añade es que la fila de auditoría entra en el
     * mismo COMMIT: antes eran dos escrituras sueltas y un fallo en la segunda
     * dejaba la tarea desbloqueada sin ningún registro de por qué.
     *
     * Esa fila es además la identidad del evento. El cron puede reejecutarse;
     * sin una identidad estable, dos pasadas que vieran la misma tarea
     * generarían dos avisos, y sin una identidad distinta un desbloqueo
     * posterior de la misma tarea se perdería.
     */
    const transicion = await prisma
      .$transaction(async (tx) => {
        const result = await tx.task.updateMany({
          where: { id: task.id, status: "BLOCKED" },
          data: { status: "PENDING", blockReason: null },
        });
        if (result.count === 0) return null;

        return logAudit(
          {
            orgId: task.case.orgId,
            caseId: task.caseId,
            action: "task.unblocked",
            details: `Tarea "${task.title}" desbloqueada al vencer su fecha de espera`,
          },
          tx,
        );
      })
      .catch((err) => {
        /*
         * Una tarea que falla no puede llevarse por delante a las demás: el
         * cron procesa el lote entero de la organización. Su transacción se ha
         * deshecho, así que sigue BLOQUEADA y vuelve a ser candidata mañana.
         * `failed` lo cuenta en la respuesta para que no pase inadvertido.
         */
        console.error(`unblock-tasks: la tarea ${task.id} no se ha podido desbloquear`, err);
        failed++;
        return null;
      });

    // Sin transición confirmada no hay nada que anunciar.
    if (!transicion) continue;

    unblocked++;

    triggerWorkflow({
      type: "TASK_STATUS_CHANGED",
      orgId: task.case.orgId,
      caseId: task.caseId,
      taskId: task.id,
      taskStatus: "PENDING",
      taskCategory: task.category,
      eventKey: claveDeEvento.transicionAuditada(transicion.id),
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, candidates: due.length, unblocked, failed });
}
