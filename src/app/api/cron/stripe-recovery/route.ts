import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/cron-auth";
import { recuperarEventosAtascados, reintentarEvento } from "@/lib/stripe";

/**
 * Recuperador de eventos de Stripe atascados.
 *
 * POR QUÉ EXISTE
 * --------------
 * Un webhook puede quedarse a medias: el proceso que reclamó el evento muere
 * (despliegue, OOM, timeout de la función) con la fila en PROCESSING. Stripe
 * reintenta durante tres días y luego deja de hacerlo. Sin este cron, un cobro
 * cobrado cuyo efecto no se aplicó —activar el plan, levantar una suspensión—
 * se pierde de forma definitiva y silenciosa.
 *
 * Qué hace en cada pasada:
 *   1. Libera los PROCESSING colgados (más de 5 minutos sin terminar).
 *   2. Reprocesa los FAILED que aún tienen reintentos, volviendo a pedir el
 *      evento a la API de Stripe (los conserva 30 días).
 *   3. Los que agotan los reintentos pasan a NEEDS_INTERVENTION y generan un
 *      aviso operativo por correo (una sola vez por evento).
 *
 * Frecuencia recomendada: cada 10 minutos.
 *
 * Reintento manual tras resolver la causa:
 *   POST /api/cron/stripe-recovery?force=evt_123
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resumen = await recuperarEventosAtascados();
    return NextResponse.json({ ...resumen, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/stripe-recovery] fallo:", err);
    return NextResponse.json({ error: "Error ejecutando la recuperacion" }, { status: 500 });
  }
}

/**
 * Reintento manual de un evento concreto. Mismo secreto de cron: es una
 * operación de mantenimiento, no una ruta de producto.
 */
export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = new URL(req.url).searchParams.get("force");
  if (!eventId) {
    return NextResponse.json({ error: "Falta el parametro `force=<event_id>`" }, { status: 400 });
  }

  const resultado = await reintentarEvento(eventId);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 422 });
}
