import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { triggerWorkflow, claveEjecucion } from "@/lib/workflow-engine";

/**
 * POST /api/workflow-rules/[id]/test — ejecuta la regla sobre un expediente
 * concreto desde el modal «Probar regla».
 *
 * LOS DOS DEFECTOS QUE CORRIGE
 * ----------------------------
 * 1. **Decía «Regla ejecutada» pasara lo que pasara.** `triggerWorkflow`
 *    devuelve `void`, así que el endpoint respondía `success: true` sin haber
 *    mirado nada. Si las condiciones de la regla no encajaban con el
 *    expediente, si el correo rebotaba, si la acción se omitía… el gestor leía
 *    «ejecutada» y se iba convencido de que su automatización funcionaba.
 *    Probar algo y que la prueba diga siempre que sí no es probar.
 *
 * 2. **La segunda pulsación no hacía nada, y también decía que sí.** No se
 *    pasaba `eventKey`, así que la clave caía en la ventana de cinco minutos:
 *    volver a pulsar «Probar» sobre el mismo expediente dentro de ese rato
 *    daba la MISMA identidad, la ejecución se consideraba duplicada y se
 *    descartaba en silencio.
 *
 * POR QUÉ AQUÍ SÍ VALE UNA IDENTIDAD POR PULSACIÓN
 * ------------------------------------------------
 * En los disparadores automáticos la identidad tiene que salir de datos
 * persistidos, porque un mismo hecho puede entregarse dos veces y no puede
 * ejecutarse dos veces. Aquí no hay reentrega: cada pulsación es una petición
 * síncrona de una persona que está pidiendo **una ejecución ahora**. Dos
 * pulsaciones son dos peticiones, y las dos deben ejecutarse. El doble clic lo
 * corta el cliente, que deshabilita el botón mientras hay una en vuelo.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("workflow.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const rule = await prisma.workflowRule.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
  });
  if (!rule) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { caseId } = body as { caseId?: string };
  if (!caseId) return NextResponse.json({ error: "caseId requerido" }, { status: 400 });

  const testCase = await prisma.case.findFirst({
    where: { id: caseId, orgId: session.user.orgId, deletedAt: null },
  });
  if (!testCase) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const evento = {
    type: rule.trigger,
    orgId: session.user.orgId,
    caseId,
    userId: session.user.id,
    fromStatus: testCase.status,
    toStatus: testCase.status,
    eventKey: `manual-test:${randomUUID()}`,
  };

  await triggerWorkflow(evento);

  /*
   * Se lee lo que DE VERDAD ha quedado registrado, por la misma clave con la
   * que el motor lo habría escrito. Es la única forma de que esta respuesta
   * diga la verdad sin cambiar la firma del motor.
   */
  const clave = claveEjecucion(evento, rule.id);
  const log = await prisma.workflowLog.findUnique({
    where: { idempotencyKey: clave },
    select: {
      id: true,
      status: true,
      error: true,
      deliveries: { select: { recipient: true, status: true, error: true } },
    },
  });

  /*
   * Sin registro no hubo ejecución: las condiciones de la regla no encajan con
   * este expediente. Es un resultado legítimo de una prueba —y muy útil, que
   * es justo lo que el gestor necesita saber— pero NO es un éxito.
   */
  if (!log) {
    return NextResponse.json({
      success: false,
      executed: false,
      status: "NOT_MATCHED",
      message:
        "La regla no se ha ejecutado: sus condiciones no coinciden con este expediente.",
    });
  }

  const exito = log.status === "SUCCESS";
  const mensajes: Record<string, string> = {
    SUCCESS: "Regla ejecutada sobre el expediente de prueba.",
    PARTIAL: "Ejecutada con entregas fallidas: parte de los destinatarios no lo ha recibido.",
    FAILED: "La ejecución ha fallado.",
    SKIPPED: "La regla no ha llegado a actuar.",
    PROCESSING: "La ejecución sigue en curso.",
  };

  return NextResponse.json({
    success: exito,
    executed: true,
    status: log.status,
    logId: log.id,
    error: log.error,
    deliveries: log.deliveries,
    message: `${mensajes[log.status] ?? "Ejecución registrada."}${
      log.error ? ` ${log.error}` : ""
    }`,
  });
}
