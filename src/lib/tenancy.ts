/**
 * Validación de pertenencia de los identificadores que llegan del cliente.
 *
 * PROBLEMA QUE RESUELVE
 * ---------------------
 * Varias rutas tomaban un id del body o del FormData y lo usaban directamente
 * en `prisma.*.update({ where: { id } })`. Comprobar que el objeto **existe**
 * no es comprobar que **es tuyo**: el caso más grave era la subida de
 * documentos, donde un `taskId` de otra organización se marcaba como READY.
 *
 * Todas las funciones de este módulo resuelven la pertenencia en la propia
 * consulta (filtrando por `orgId` y, cuando procede, por `caseId`) en lugar de
 * leer primero y comparar después, que deja una ventana de carrera y es fácil
 * de olvidar.
 *
 * Convención: devuelven el objeto pedido o `null`. Nunca lanzan. El llamador
 * responde 404 — no 403 — para no revelar la existencia de recursos ajenos.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";

/** Acepta el cliente normal o el transaccional. */
type Db = PrismaClient | Prisma.TransactionClient;

/** El expediente pertenece a la organización y no está borrado. */
export async function findCaseInOrg(
  caseId: string,
  orgId: string,
  db: Db = defaultPrisma,
) {
  if (!caseId || !orgId) return null;
  return db.case.findFirst({
    where: { id: caseId, orgId, deletedAt: null },
  });
}

/**
 * La tarea pertenece al expediente **y** el expediente a la organización.
 * Ambas condiciones importan: comprobar sólo la organización permitiría mover
 * documentos entre expedientes del mismo cliente sin control.
 */
export async function findTaskInCase(
  taskId: string,
  caseId: string,
  orgId: string,
  db: Db = defaultPrisma,
) {
  if (!taskId || !caseId || !orgId) return null;
  return db.task.findFirst({
    where: { id: taskId, caseId, case: { orgId, deletedAt: null } },
  });
}

/** La tarea pertenece a la organización, sin fijar expediente. */
export async function findTaskInOrg(
  taskId: string,
  orgId: string,
  db: Db = defaultPrisma,
) {
  if (!taskId || !orgId) return null;
  return db.task.findFirst({
    where: { id: taskId, case: { orgId, deletedAt: null } },
  });
}

/** El documento pertenece al expediente y a la organización. */
export async function findDocumentInCase(
  documentId: string,
  caseId: string,
  orgId: string,
  db: Db = defaultPrisma,
) {
  if (!documentId || !caseId || !orgId) return null;
  return db.document.findFirst({
    where: { id: documentId, caseId, case: { orgId } },
  });
}

/** El documento pertenece a la organización. */
export async function findDocumentInOrg(
  documentId: string,
  orgId: string,
  db: Db = defaultPrisma,
) {
  if (!documentId || !orgId) return null;
  return db.document.findFirst({
    where: { id: documentId, case: { orgId } },
  });
}

/**
 * El usuario tiene membresía **activa** en la organización. Es la comprobación
 * que faltaba antes de aceptar un `assigneeId`: sin ella se podía asignar una
 * tarea a un usuario de otro tenant, que además recibía el email con el nombre
 * del fallecido y la referencia del expediente.
 */
export async function findActiveMember(
  userId: string,
  orgId: string,
  db: Db = defaultPrisma,
) {
  if (!userId || !orgId) return null;
  return db.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
    select: { id: true, role: true, userId: true, orgId: true },
  });
}

/** La plantilla de documento pertenece a la organización. */
export async function findTemplateInOrg(
  templateId: string,
  orgId: string,
  db: Db = defaultPrisma,
) {
  if (!templateId || !orgId) return null;
  return db.template.findFirst({ where: { id: templateId, orgId } });
}

/** La plantilla de expediente pertenece a la organización. */
export async function findCaseTemplateInOrg(
  templateId: string,
  orgId: string,
  db: Db = defaultPrisma,
) {
  if (!templateId || !orgId) return null;
  return db.caseTemplate.findFirst({ where: { id: templateId, orgId } });
}

/** La aprobación pertenece a la organización (a través de su expediente). */
export async function findApprovalInOrg(
  approvalId: string,
  orgId: string,
  db: Db = defaultPrisma,
) {
  if (!approvalId || !orgId) return null;
  return db.approval.findFirst({
    where: { id: approvalId, case: { orgId, deletedAt: null } },
  });
}

// ─── Dependencias entre tareas ──────────────────────────

export type DependencyRejection =
  | "self_dependency"
  | "not_found" // no existe, o es de otro expediente/organización
  | "cycle";

/**
 * Valida `dependsOnId` antes de guardarlo.
 *
 * Comprueba tres cosas que antes no se comprobaban ninguna:
 *   1. Que la tarea no dependa de sí misma.
 *   2. Que la dependencia sea una tarea del **mismo expediente** (antes podía
 *      apuntar a cualquier tarea de cualquier organización).
 *   3. Que no se cree un ciclo: se recorre la cadena `dependsOn` hacia arriba
 *      desde el candidato y se rechaza si vuelve a la tarea que se edita.
 *
 * El recorrido está acotado (`MAX_DEPTH`) para que una cadena ya corrupta en
 * base de datos no cuelgue la petición.
 */
export async function validateTaskDependency(
  taskId: string,
  dependsOnId: string,
  caseId: string,
  orgId: string,
  db: Db = defaultPrisma,
): Promise<{ ok: true } | { ok: false; reason: DependencyRejection }> {
  if (taskId === dependsOnId) {
    return { ok: false, reason: "self_dependency" };
  }

  const candidate = await findTaskInCase(dependsOnId, caseId, orgId, db);
  if (!candidate) {
    return { ok: false, reason: "not_found" };
  }

  const MAX_DEPTH = 64;
  const visited = new Set<string>([dependsOnId]);
  let cursor: string | null = candidate.dependsOnId;

  for (let depth = 0; cursor && depth < MAX_DEPTH; depth++) {
    if (cursor === taskId) {
      return { ok: false, reason: "cycle" };
    }
    // Cadena ya circular entre terceras tareas: cortamos sin dar por válido
    // nada nuevo.
    if (visited.has(cursor)) {
      return { ok: false, reason: "cycle" };
    }
    visited.add(cursor);

    const next: { dependsOnId: string | null } | null = await db.task.findFirst({
      where: { id: cursor, case: { orgId } },
      select: { dependsOnId: true },
    });
    if (!next) break;
    cursor = next.dependsOnId;
  }

  return { ok: true };
}

// ─── Referencia de expediente ───────────────────────────

/**
 * Genera la referencia del expediente de forma segura ante concurrencia.
 *
 * Antes se hacía `count + 1` fuera de transacción: dos altas simultáneas
 * producían la misma `ref` (y no había restricción única que lo impidiera).
 *
 * Ahora se usa el máximo sufijo **ya existente** para el año en curso dentro
 * de la transacción, y la restricción `@@unique([orgId, ref])` cierra la
 * ventana restante: si dos transacciones eligen el mismo número, una falla con
 * P2002 y el llamador reintenta.
 */
export function caseRefFor(year: number, sequence: number): string {
  return `EXP-${year}-${String(sequence).padStart(4, "0")}`;
}

export async function nextCaseRef(
  orgId: string,
  db: Db = defaultPrisma,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const prefix = `EXP-${year}-`;

  // Serializa la asignación de referencia POR ORGANIZACIÓN.
  //
  // Sin esto, la restricción única evita los duplicados pero no la contienda:
  // diez altas simultáneas leen el mismo máximo, nueve fallan con P2002 y al
  // reintentar vuelven a chocar en tropel, agotando los reintentos y
  // devolviendo errores al usuario. Se comprobó con la prueba de integración
  // de 10 altas concurrentes.
  //
  // El lock es a nivel de transacción: PostgreSQL lo libera solo al hacer
  // commit o rollback. Sólo bloquea a otras altas de la MISMA organización, y
  // sólo durante la lectura del máximo y la inserción.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`;

  const last = await db.case.findFirst({
    where: { orgId, ref: { startsWith: prefix } },
    orderBy: { ref: "desc" },
    select: { ref: true },
  });

  const lastSequence = last ? Number.parseInt(last.ref.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(lastSequence) && lastSequence > 0 ? lastSequence + 1 : 1;

  return caseRefFor(year, next);
}
