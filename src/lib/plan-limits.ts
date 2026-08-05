/**
 * Límites de plan. Fuente única: `PLAN_PRICING` en `lib/stripe.ts`, que es lo
 * mismo que se muestra en /precios.
 *
 * ESTADO ANTERIOR
 * ---------------
 * El tope de expedientes sólo se aplicaba al plan INICIA, y con el número `15`
 * escrito a mano en la ruta en vez de leerlo de `PLAN_PRICING`. DESPACHO y
 * FIRMA anunciaban 50 y 200 expedientes y **no tenían ningún tope**.
 *
 * DECISIÓN: se aplica tope duro en los tres planes.
 * No se factura por excedentes. El copy comercial se ha alineado con esto en
 * la Fase 8: "hasta N expedientes al mes", sin promesa ambigua de excedentes.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import type { PlanTier } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";
import { PLAN_PRICING } from "./stripe";

type Db = PrismaClient | Prisma.TransactionClient;

export function currentMonthKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function caseLimitFor(plan: PlanTier): number {
  return PLAN_PRICING[plan].includedCases;
}

export function userLimitFor(plan: PlanTier): number {
  return PLAN_PRICING[plan].maxUsers;
}

export interface LimitCheck {
  allowed: boolean;
  limit: number;
  used: number;
  plan: PlanTier;
  message?: string;
}

function upgradeHint(plan: PlanTier): string {
  if (plan === "INICIA") return " Actualiza a Despacho para ampliar el límite.";
  if (plan === "DESPACHO") return " Actualiza a Firma para ampliar el límite.";
  return " Contacta con soporte si necesitas ampliar el límite.";
}

/**
 * Comprueba el tope mensual de expedientes del plan.
 *
 * Debe llamarse **dentro** de la transacción que crea el expediente, con el
 * cliente transaccional: contar fuera y crear después deja una ventana en la
 * que N peticiones simultáneas ven el mismo recuento y todas pasan.
 */
export async function checkCaseLimit(
  orgId: string,
  plan: PlanTier,
  db: Db = defaultPrisma,
  now: Date = new Date(),
): Promise<LimitCheck> {
  const limit = caseLimitFor(plan);
  const month = currentMonthKey(now);

  const usage = await db.usageRecord.findUnique({
    where: { orgId_month: { orgId, month } },
    select: { casesCreated: true },
  });
  const used = usage?.casesCreated ?? 0;

  if (used >= limit) {
    return {
      allowed: false,
      limit,
      used,
      plan,
      message: `Límite de expedientes alcanzado para el plan ${PLAN_PRICING[plan].label} (${limit} al mes).${upgradeHint(plan)}`,
    };
  }

  return { allowed: true, limit, used, plan };
}

/**
 * Comprueba el tope de usuarios del plan.
 *
 * Igual que el anterior: debe ejecutarse dentro de la transacción que crea la
 * membresía. Antes se contaba fuera y se creaba después, así que dos
 * invitaciones simultáneas podían superar el tope.
 */
export async function checkUserLimit(
  orgId: string,
  plan: PlanTier,
  db: Db = defaultPrisma,
): Promise<LimitCheck> {
  const limit = userLimitFor(plan);
  const used = await db.membership.count({ where: { orgId } });

  if (used >= limit) {
    return {
      allowed: false,
      limit,
      used,
      plan,
      message: `Límite de usuarios alcanzado para el plan ${PLAN_PRICING[plan].label} (${limit} usuarios).${upgradeHint(plan)}`,
    };
  }

  return { allowed: true, limit, used, plan };
}

/** Plan vigente de la organización; INICIA si aún no hay suscripción. */
export async function planOf(orgId: string, db: Db = defaultPrisma): Promise<PlanTier> {
  const sub = await db.subscription.findUnique({
    where: { orgId },
    select: { plan: true },
  });
  return sub?.plan ?? "INICIA";
}

/**
 * Serializa las comprobaciones de límite por organización dentro de una
 * transacción, igual que se hace con la referencia de expediente. Sin esto,
 * dos peticiones simultáneas leen el mismo recuento y ambas pasan el tope.
 */
export async function lockOrgForLimits(orgId: string, db: Db): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`limits:${orgId}`}))`;
}

/**
 * Serializa las operaciones sobre la TITULARIDAD de una organizacion:
 * eliminar, degradar, promover o transferir OWNER.
 *
 * Sin esto, el recuento de owners y la mutacion viajan en una transaccion
 * READ COMMITTED normal: dos peticiones simultaneas leen ambas `ownerCount = 2`,
 * ambas concluyen que pueden degradar, y la organizacion se queda con CERO
 * owners. El `$transaction` por si solo no lo impide porque no hay conflicto de
 * escritura entre filas distintas.
 *
 * Se usa un espacio de nombres distinto al de los limites de plan para que una
 * invitacion en curso no bloquee un cambio de titularidad y viceversa.
 */
export async function lockOrgForOwnership(orgId: string, db: Db): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ownership:${orgId}`}))`;
}
