import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { reintentarEntregasFallidas } from "@/lib/workflow-engine";

/**
 * POST /api/workflow-logs/[id]/retry — reintenta las entregas pendientes de una
 * ejecución de automatización.
 *
 * POR QUÉ EXISTE
 * --------------
 * `reintentarEntregasFallidas()` existía pero no había forma de llamarla: ni
 * endpoint, ni cron, ni botón. Una ejecución PARTIAL —con destinatarios que no
 * recibieron el aviso— se quedaba así para siempre, visible en el registro y sin
 * ninguna acción posible. Registrar un fallo que nadie puede resolver es sólo
 * documentar el problema.
 *
 * QUÉ NO ACEPTA DEL CLIENTE
 * -------------------------
 * Nada del contenido. Ni asunto, ni cuerpo, ni destinatarios. Todo se
 * reconstruye desde la regla y el expediente leídos de la base de datos.
 *
 * Si el cliente pudiera enviarlos, este endpoint sería un relé de correo
 * autenticado: cualquiera con permiso de automatizaciones podría mandar el
 * texto que quisiera a la dirección que quisiera, saliendo del dominio y la
 * reputación de la organización. El cuerpo de la petición se ignora por
 * completo.
 *
 * GARANTÍAS
 * ---------
 *   - Sólo se reintentan entregas FAILED y reclamaciones PROCESSING colgadas.
 *   - Los destinatarios en SENT no reciben nada: un correo entregado no se
 *     reenvía por pulsar el botón dos veces.
 *   - Cada entrega se reclama de forma atómica antes de llamar al proveedor,
 *     así que dos reintentos simultáneos producen UNA sola llamada.
 *   - El estado agregado (SUCCESS / PARTIAL / FAILED) se recalcula al terminar.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Provoca envíos externos bajo demanda: sin límite, sirve para bombardear a
  // los destinatarios pulsando el botón en bucle.
  const limitado = rateLimit(req, { bucket: "workflow-retry", windowMs: 60_000, max: 10 });
  if (limitado) return limitado;

  const auth = await requireOrgPermission("workflow.manage");
  if (!auth.ok) return auth.response;
  const { orgId, userId } = auth.session;

  // TENENCIA: el log se busca filtrando por la organización de la sesión, no
  // por su id a secas. Sin este filtro, conocer un id bastaría para disparar
  // envíos de otra organización.
  const log = await prisma.workflowLog.findFirst({
    where: { id: params.id, rule: { orgId } },
    select: {
      id: true,
      status: true,
      rule: { select: { name: true } },
      case: { select: { ref: true } },
    },
  });

  // Mismo 404 para "no existe" y "es de otra organización": distinguirlos
  // confirmaría la existencia del log ajeno.
  if (!log) {
    return NextResponse.json({ error: "Ejecución no encontrada" }, { status: 404 });
  }

  const resultado = await reintentarEntregasFallidas(log.id);

  await logAudit({
    orgId,
    userId,
    action: "workflow.retry",
    details:
      `Reintento de la regla "${log.rule.name}"` +
      `${log.case ? ` sobre ${log.case.ref}` : ""}: ` +
      `${resultado.recuperadas} de ${resultado.reintentadas} entrega(s) recuperada(s); ` +
      `estado ${resultado.estado}`,
  }).catch(console.error);

  return NextResponse.json({
    retried: resultado.reintentadas,
    recovered: resultado.recuperadas,
    status: resultado.estado,
    // Resultado por destinatario, que es lo que necesita quien mira el
    // registro para saber a quién sigue sin llegarle.
    deliveries: resultado.entregas.map((e) => ({
      recipient: e.recipient,
      ok: e.ok,
      skipped: e.omitida ?? false,
      error: e.error ?? null,
    })),
  });
}
