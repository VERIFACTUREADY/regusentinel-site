/**
 * Deduplicación de notificaciones **por entrega**.
 *
 * ESTADO ANTERIOR
 * ---------------
 * Se comprobaba `notificationLog.findFirst({ caseId, kind, status: "sent" })`.
 * Consecuencias:
 *   - Si el email llegaba a un destinatario y fallaba en otro, la siguiente
 *     ejecución saltaba **el expediente entero**: el segundo no lo recibía nunca.
 *   - Un email enviado bloqueaba también Slack, Teams y el webhook, porque el
 *     canal no formaba parte de la comprobación.
 *
 * Ahora la unidad es (expediente, tipo, canal, destinatario, ventana), con
 * restricción única en base de datos. Un fallo se reintenta solo.
 */

import type { NotificationChannel, NotificationKind, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

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

/**
 * ¿Se entregó ya esta notificación concreta?
 *
 * Sólo cuentan las entregas correctas: una fallida debe poder reintentarse.
 */
export async function alreadyDelivered(
  target: DeliveryTarget,
  db: Db = defaultPrisma,
): Promise<boolean> {
  const existing = await db.notificationLog.findUnique({
    where: { dedupeKey: dedupeKeyFor(target) },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Registra una entrega correcta. La `dedupeKey` sólo se escribe aquí, de modo
 * que la restricción única impide duplicar aunque dos ejecuciones del cron se
 * solapen.
 *
 * Devuelve `false` si otra ejecución se adelantó (P2002), sin lanzar.
 */
export async function recordDelivery(
  target: DeliveryTarget & { orgId: string },
  db: Db = defaultPrisma,
): Promise<boolean> {
  try {
    await db.notificationLog.create({
      data: {
        orgId: target.orgId,
        caseId: target.caseId,
        kind: target.kind,
        channel: target.channel,
        recipient: target.recipient,
        status: "sent",
        dedupeKey: dedupeKeyFor(target),
      },
    });
    return true;
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return false;
    throw err;
  }
}

/**
 * Registra una entrega fallida **sin** `dedupeKey`, para que el siguiente
 * intento no la considere entregada. Queda registrada para diagnóstico.
 */
export async function recordFailure(
  target: DeliveryTarget & { orgId: string; error: string },
  db: Db = defaultPrisma,
): Promise<void> {
  await db.notificationLog.create({
    data: {
      orgId: target.orgId,
      caseId: target.caseId,
      kind: target.kind,
      channel: target.channel,
      recipient: target.recipient,
      status: "failed",
      error: target.error.slice(0, 500),
      dedupeKey: null,
    },
  });
}
