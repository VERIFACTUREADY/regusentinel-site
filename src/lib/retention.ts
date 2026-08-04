/**
 * Purga real de expedientes vencidos.
 *
 * ESTADO ANTERIOR
 * ---------------
 * El cron de retención hacía `case.updateMany({ deletedAt: now })` y lo
 * llamaba "limpieza". Eso es un borrado **lógico**: el expediente seguía
 * íntegro en PostgreSQL y todos sus documentos en S3, indefinidamente. La
 * política de privacidad afirmaba que los datos se eliminaban.
 *
 * Ahora el ciclo tiene fases explícitas:
 *   cierre → `deletedAt` (soft) → `purgeScheduledAt` → purga → `purgedAt`
 *
 * La purga borra los objetos de S3 y las filas con datos personales, y
 * **anonimiza** —sin borrar— los registros que deben conservarse por
 * obligación legítima (auditoría, facturación).
 */

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";
import { deleteFile } from "./s3";
import { logAudit } from "./audit";

export interface PurgeResult {
  caseId: string;
  ref: string;
  ok: boolean;
  s3Deleted: number;
  s3Failed: number;
  error?: string;
}

/**
 * Purga un expediente. Es **idempotente**: si falla a mitad, la siguiente
 * ejecución retoma lo que falte.
 *
 * El orden importa: primero S3, después la base de datos. Si se borrase antes
 * la fila, se perderían las claves de los objetos y quedarían huérfanos en el
 * bucket para siempre — exactamente el problema que hay que evitar.
 */
export async function purgeCase(
  caseId: string,
  db: PrismaClient = defaultPrisma,
): Promise<PurgeResult> {
  const caso = await db.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      ref: true,
      orgId: true,
      purgedAt: true,
      documents: { select: { id: true, fileKey: true } },
    },
  });

  if (!caso) {
    return { caseId, ref: "", ok: true, s3Deleted: 0, s3Failed: 0 };
  }
  if (caso.purgedAt) {
    return { caseId, ref: caso.ref, ok: true, s3Deleted: 0, s3Failed: 0 };
  }

  let s3Deleted = 0;
  const fallidos: string[] = [];

  for (const doc of caso.documents) {
    try {
      await deleteFile(doc.fileKey);
      s3Deleted++;
    } catch (err) {
      fallidos.push(doc.fileKey);
      console.error(`Purga: no se pudo borrar ${doc.fileKey}`, err);
    }
  }

  // Si algún objeto sigue en S3, NO marcamos el expediente como purgado: sería
  // afirmar que el dato está eliminado cuando su contenido sigue almacenado.
  if (fallidos.length > 0) {
    const mensaje = `No se pudieron borrar ${fallidos.length} objeto(s) de S3`;
    await db.case.update({
      where: { id: caseId },
      data: {
        purgeError: mensaje,
        purgeAttempts: { increment: 1 },
      },
    });
    return {
      caseId,
      ref: caso.ref,
      ok: false,
      s3Deleted,
      s3Failed: fallidos.length,
      error: mensaje,
    };
  }

  // Borrado en base de datos. `onDelete: Cascade` arrastra deceased, contact,
  // documentos, tareas, mensajes y consentimientos; los prompts y la auditoría
  // se tratan aparte porque su relación no es en cascada.
  await db.$transaction(async (tx) => {
    // Los prompts pueden contener respuestas derivadas del expediente.
    await tx.promptLog.deleteMany({ where: { caseId } });

    // La auditoría se CONSERVA por obligación legítima, pero anonimizada: se
    // desvincula del expediente y se le quita el texto libre, que podía
    // contener nombres de fichero, de tarea y del causante.
    await tx.auditLog.updateMany({
      where: { caseId },
      data: {
        caseId: null,
        details: "[purgado por política de retención]",
        ip: null,
      },
    });

    // Las notificaciones guardan el email del destinatario.
    await tx.notificationLog.deleteMany({ where: { caseId } });

    await tx.case.delete({ where: { id: caseId } });
  });

  await logAudit({
    orgId: caso.orgId,
    action: "retention.case_purged",
    // Sólo la referencia: ni nombre del causante ni de contacto.
    details: `Expediente ${caso.ref} purgado (${s3Deleted} documento(s) eliminados del almacenamiento)`,
  }).catch(console.error);

  return { caseId, ref: caso.ref, ok: true, s3Deleted, s3Failed: 0 };
}

/**
 * Marca para purga los expedientes cerrados cuyo periodo de retención ha
 * vencido, y purga los que ya tocan.
 *
 * Se separa en dos pasos a propósito: `purgeScheduledAt` da una fecha visible
 * antes de que el dato desaparezca, en vez de borrar en el mismo momento en
 * que se cumple el plazo.
 */
export async function runRetention(
  db: PrismaClient = defaultPrisma,
  now: Date = new Date(),
): Promise<{ scheduled: number; purged: number; failed: number; results: PurgeResult[] }> {
  const orgs = await db.organization.findMany({
    select: { id: true, retentionDays: true },
  });

  let scheduled = 0;

  for (const org of orgs) {
    const cutoff = new Date(now.getTime() - org.retentionDays * 24 * 60 * 60 * 1000);

    // Fase 1: cierre vencido → borrado lógico + fecha de purga.
    const marcados = await db.case.updateMany({
      where: {
        orgId: org.id,
        status: "CLOSED",
        closedAt: { lt: cutoff },
        deletedAt: null,
      },
      data: {
        deletedAt: now,
        // Margen de gracia: la purga real ocurre 30 días después del borrado
        // lógico, para que un cierre por error sea recuperable.
        purgeScheduledAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    scheduled += marcados.count;
  }

  // Fase 2: purga de lo que ya venció.
  const pendientes = await db.case.findMany({
    where: {
      purgedAt: null,
      purgeScheduledAt: { not: null, lte: now },
      // Tope de reintentos: un expediente que falla siempre no debe bloquear
      // el cron indefinidamente; queda visible con su purgeError.
      purgeAttempts: { lt: 5 },
    },
    select: { id: true },
    take: 200,
  });

  const results: PurgeResult[] = [];
  for (const { id } of pendientes) {
    results.push(await purgeCase(id, db));
  }

  return {
    scheduled,
    purged: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

/**
 * Elimina los registros de IA que superan su plazo de retención. `PromptLog`
 * no tenía ninguno: las entradas se acumulaban indefinidamente.
 */
export async function purgeOldPromptLogs(
  retentionDays: number,
  db: PrismaClient = defaultPrisma,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await db.promptLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
