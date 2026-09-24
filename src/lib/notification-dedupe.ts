/**
 * Reserva atómica de entregas de notificación.
 *
 * PRIMER ESTADO
 * -------------
 * Se comprobaba `notificationLog.findFirst({ caseId, kind, status: "sent" })`.
 * Si el email llegaba a un destinatario y fallaba en otro, la siguiente
 * ejecución saltaba el expediente entero; y un email enviado bloqueaba también
 * Slack, Teams y el webhook, porque el canal no formaba parte de la clave.
 *
 * SEGUNDO ESTADO — INSUFICIENTE
 * ------------------------------
 * La clave pasó a ser (expediente, tipo, canal, destinatario, ventana), pero el
 * flujo seguía siendo **consultar, enviar, y registrar después**:
 *
 *     if (await alreadyDelivered(t)) continue;   // ← A y B leen "no enviado"
 *     await enviarCorreo(...);                   // ← A y B envían
 *     await recordDelivery(t);                   // ← B choca con P2002
 *
 * Dos ejecuciones simultáneas del cron —o la misma ejecución reintentada por el
 * planificador— leían ambas "no enviado" y ambas llamaban al proveedor. La
 * restricción única sólo impedía la segunda FILA, no el segundo CORREO: la
 * familia recibía el aviso dos veces. Además Slack, Teams y el webhook no
 * pasaban por aquí en absoluto: se enviaban en cada pasada del cron.
 *
 * AHORA: RESERVAR, ENVIAR, CONFIRMAR
 * -----------------------------------
 * La fila se crea en PROCESSING **antes** de llamar al proveedor. Quien
 * consigue crearla —o reclamarla con una actualización condicional— es el
 * único que envía; el resto se retira sin llamar a nadie.
 *
 *     PENDING ─┐
 *              ├─► PROCESSING ─► SENT
 *     FAILED ──┘        │
 *        ▲              └────► FAILED (reintentable)
 *        └─────────────────────────┘
 *
 * Una entrega colgada (el proceso murió con la fila en PROCESSING) se puede
 * volver a reclamar pasados `ENTREGA_COLGADA_MS`.
 *
 * La clave incluye el canal y el destinatario, así que un canal enviado no
 * bloquea el reintento de otro, ni el fallo de un destinatario bloquea a los
 * demás.
 */

import type { NotificationChannel, NotificationKind, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/** Tras esto, una entrega en PROCESSING se considera abandonada. */
export const ENTREGA_COLGADA_MS = 10 * 60 * 1000;

export interface DeliveryTarget {
  caseId: string;
  kind: NotificationKind;
  channel: NotificationChannel;
  recipient: string;
  /**
   * Discriminador temporal. Vacío para avisos de una sola vez (los tramos del
   * ISD: un aviso de 30 días es único por expediente). Para recordatorios
   * recurrentes, la ventana (p. ej. `2026-W31`) permite uno por periodo.
   */
  window?: string;
}

export function dedupeKeyFor(target: DeliveryTarget): string {
  const { caseId, kind, channel, recipient, window = "" } = target;
  return `${caseId}:${kind}:${channel}:${recipient.toLowerCase()}:${window}`;
}

/** Semana ISO, para las ventanas rodantes de los recordatorios a la familia. */
export function isoWeekWindow(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type ResultadoReserva =
  /** Esta ejecución es la que debe llamar al proveedor externo. */
  | "reservada"
  /** Ya se entregó correctamente. No hay nada que hacer. */
  | "ya_entregada"
  /** Otra ejecución la tiene reclamada ahora mismo. */
  | "en_curso";

/**
 * Reserva la entrega de forma atómica. **Sólo quien recibe `"reservada"` puede
 * llamar al proveedor externo.**
 *
 * Dos mecanismos, ambos atómicos en PostgreSQL:
 *   1. `create` sobre la restricción única de `dedupeKey`: la primera gana.
 *   2. Si ya existe, `updateMany` condicionado al estado observado: sólo una
 *      transacción ve `count === 1`.
 *
 * No mantiene ninguna transacción abierta durante la llamada de red, que es
 * lenta y no debe bloquear filas.
 */
export async function reservarEntrega(
  target: DeliveryTarget & { orgId: string },
  db: Db = defaultPrisma,
  ahora: Date = new Date(),
): Promise<ResultadoReserva> {
  const dedupeKey = dedupeKeyFor(target);

  try {
    await db.notificationLog.create({
      data: {
        orgId: target.orgId,
        caseId: target.caseId,
        kind: target.kind,
        channel: target.channel,
        recipient: target.recipient,
        status: "processing",
        deliveryStatus: "PROCESSING",
        attempts: 1,
        startedAt: ahora,
        dedupeKey,
      },
    });
    return "reservada";
  } catch (err) {
    if ((err as { code?: string })?.code !== "P2002") throw err;
  }

  // Ya existe: decide el estado, no la mera existencia.
  const existente = await db.notificationLog.findUnique({
    where: { dedupeKey },
    select: { deliveryStatus: true, startedAt: true },
  });
  if (!existente) return "en_curso"; // carrera improbable; se reintenta luego

  if (existente.deliveryStatus === "SENT") return "ya_entregada";

  const colgada =
    existente.deliveryStatus === "PROCESSING" &&
    existente.startedAt !== null &&
    ahora.getTime() - existente.startedAt.getTime() > ENTREGA_COLGADA_MS;

  const reclamable = existente.deliveryStatus === "PENDING" || existente.deliveryStatus === "FAILED";
  if (!reclamable && !colgada) return "en_curso";

  const reclamo = await db.notificationLog.updateMany({
    where: { dedupeKey, deliveryStatus: existente.deliveryStatus },
    data: {
      status: "processing",
      deliveryStatus: "PROCESSING",
      startedAt: ahora,
      attempts: { increment: 1 },
      error: null,
    },
  });

  return reclamo.count === 1 ? "reservada" : "en_curso";
}

/** Confirma la entrega. Sólo debe llamarlo quien obtuvo la reserva. */
export async function confirmarEntrega(
  target: DeliveryTarget,
  db: Db = defaultPrisma,
  ahora: Date = new Date(),
): Promise<void> {
  await db.notificationLog.updateMany({
    where: { dedupeKey: dedupeKeyFor(target) },
    data: { status: "sent", deliveryStatus: "SENT", completedAt: ahora, error: null },
  });
}

/**
 * Marca la entrega como fallida. Queda reclamable: el siguiente intento la
 * vuelve a tomar sin afectar a otros destinatarios ni a otros canales.
 */
export async function marcarFalloEntrega(
  target: DeliveryTarget & { error: string },
  db: Db = defaultPrisma,
): Promise<void> {
  await db.notificationLog.updateMany({
    where: { dedupeKey: dedupeKeyFor(target) },
    data: {
      status: "failed",
      deliveryStatus: "FAILED",
      error: target.error.slice(0, 500),
      completedAt: null,
    },
  });
}

/**
 * Ejecuta `enviar` como máximo una vez por entrega, en todo el sistema.
 *
 * Envuelve el ciclo completo reservar → enviar → confirmar/fallar, de modo que
 * ningún emisor pueda saltárselo por descuido. Devuelve si el envío se llegó a
 * realizar en esta llamada.
 */
export async function entregarUnaVez(
  target: DeliveryTarget & { orgId: string },
  enviar: () => Promise<unknown>,
  db: Db = defaultPrisma,
): Promise<{ enviado: boolean; motivo: ResultadoReserva; error?: string }> {
  const reserva = await reservarEntrega(target, db);
  if (reserva !== "reservada") return { enviado: false, motivo: reserva };

  try {
    await enviar();
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    await marcarFalloEntrega({ ...target, error: mensaje }, db);
    return { enviado: false, motivo: reserva, error: mensaje };
  }

  await confirmarEntrega(target, db);
  return { enviado: true, motivo: reserva };
}

/**
 * Devuelve a FAILED las entregas que quedaron colgadas en PROCESSING, para que
 * la siguiente pasada las reintente. Complementa a la reclamación por
 * caducidad: deja el estado explícito en vez de "PROCESSING desde hace horas".
 */
export async function recuperarEntregasColgadas(
  db: Db = defaultPrisma,
  ahora: Date = new Date(),
): Promise<number> {
  const { count } = await db.notificationLog.updateMany({
    where: {
      deliveryStatus: "PROCESSING",
      startedAt: { lt: new Date(ahora.getTime() - ENTREGA_COLGADA_MS) },
    },
    data: {
      status: "failed",
      deliveryStatus: "FAILED",
      error: "Entrega colgada: el proceso que la reclamó no terminó.",
    },
  });
  return count;
}

/**
 * ¿Se entregó ya esta notificación concreta?
 *
 * Se conserva para consultas de sólo lectura (paneles, informes). **No debe
 * usarse como puerta previa a un envío**: entre la consulta y el envío hay una
 * ventana, y ése era exactamente el fallo. Para enviar, `entregarUnaVez`.
 */
export async function alreadyDelivered(
  target: DeliveryTarget,
  db: Db = defaultPrisma,
): Promise<boolean> {
  const existing = await db.notificationLog.findUnique({
    where: { dedupeKey: dedupeKeyFor(target) },
    select: { deliveryStatus: true },
  });
  return existing?.deliveryStatus === "SENT";
}
