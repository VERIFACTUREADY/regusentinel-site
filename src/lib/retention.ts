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
import { sendEmail } from "./email";

/**
 * Reintentos automáticos rápidos antes de exigir intervención humana.
 *
 * Superarlo NO detiene la purga: cambia el estado a NEEDS_INTERVENTION, genera
 * un aviso operativo y pasa a un backoff largo. Antes el expediente
 * simplemente dejaba de seleccionarse (`purgeAttempts: { lt: 5 }`) y sus datos
 * personales quedaban indefinidamente en PostgreSQL y en S3 sin que nadie se
 * enterase — justo lo contrario de lo que la política de retención promete.
 */
export const INTENTOS_AUTOMATICOS = 5;

/** Backoff mientras quedan reintentos rápidos: 15 min, 30, 60, 120, 240. */
function esperaReintento(intentos: number): number {
  const minutos = 15 * Math.pow(2, Math.max(0, intentos - 1));
  return Math.min(minutos, 240) * 60 * 1000;
}

/** Backoff una vez que el caso requiere intervención: reintento diario. */
const ESPERA_INTERVENCION_MS = 24 * 60 * 60 * 1000;

export interface PurgeResult {
  caseId: string;
  ref: string;
  ok: boolean;
  s3Deleted: number;
  s3Failed: number;
  error?: string;
  /** Agotados los reintentos automáticos rápidos. */
  requiereIntervencion?: boolean;
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
      purgeAttempts: true,
      purgeScheduledAt: true,
      documents: { select: { id: true, fileKey: true } },
    },
  });

  // Idempotencia: si la fila ya no existe, la purga se completó. `purgedAt` no
  // sirve para esto —la purga borra la fila entera, así que nunca llega a
  // leerse con valor—; la constancia está en `PurgeEvidence`.
  if (!caso) {
    return { caseId, ref: "", ok: true, s3Deleted: 0, s3Failed: 0 };
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
    const intentos = caso.purgeAttempts + 1;
    const requiereIntervencion = intentos >= INTENTOS_AUTOMATICOS;

    await db.case.update({
      where: { id: caseId },
      data: {
        purgeError: mensaje,
        purgeAttempts: intentos,
        // El expediente NO se abandona al superar el umbral: cambia de estado
        // y de ritmo, pero se sigue reintentando.
        purgeState: requiereIntervencion ? "NEEDS_INTERVENTION" : "RETRYABLE_FAILURE",
        purgeNextAttemptAt: new Date(
          Date.now() + (requiereIntervencion ? ESPERA_INTERVENCION_MS : esperaReintento(intentos)),
        ),
      },
    });

    return {
      caseId,
      ref: caso.ref,
      ok: false,
      s3Deleted,
      s3Failed: fallidos.length,
      error: mensaje,
      requiereIntervencion,
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

    // EVIDENCIA SIN PII, en la misma transacción que el borrado: o quedan las
    // dos cosas o no queda ninguna. Sin esto, completar la purga no dejaba
    // ninguna constancia observable, porque la fila que la registraba era
    // precisamente la que se borraba.
    await tx.purgeEvidence.create({
      data: {
        orgId: caso.orgId,
        caseRef: caso.ref,
        scheduledAt: caso.purgeScheduledAt,
        documentsDeleted: s3Deleted,
        attempts: caso.purgeAttempts + 1,
      },
    });

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
): Promise<{
  scheduled: number;
  purged: number;
  failed: number;
  needsIntervention: number;
  alerts: number;
  results: PurgeResult[];
}> {
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
        purgeState: "PENDING",
      },
    });
    scheduled += marcados.count;
  }

  // FASE 2: PURGA DE LO QUE YA VENCIÓ.
  //
  // Antes el filtro incluía `purgeAttempts: { lt: 5 }`. Al quinto fallo el
  // expediente dejaba de seleccionarse PARA SIEMPRE: sus documentos seguían en
  // S3 y sus datos personales en PostgreSQL, sin aviso, sin reintento y sin
  // nada que lo distinguiera de un expediente sano. Un fallo transitorio de S3
  // durante cinco pasadas bastaba para incumplir el derecho de supresión de
  // forma permanente y silenciosa.
  //
  // Ahora NO hay tope de abandono: sólo un cambio de ritmo. Lo que decide si
  // toca intentarlo es `purgeNextAttemptAt`, no un contador.
  const pendientes = await db.case.findMany({
    where: {
      purgeScheduledAt: { not: null, lte: now },
      purgeState: { in: ["PENDING", "RETRYABLE_FAILURE", "NEEDS_INTERVENTION"] },
      OR: [{ purgeNextAttemptAt: null }, { purgeNextAttemptAt: { lte: now } }],
    },
    orderBy: { purgeScheduledAt: "asc" },
    select: { id: true },
    take: 200,
  });

  const results: PurgeResult[] = [];
  for (const { id } of pendientes) {
    results.push(await purgeCase(id, db));
  }

  // Aviso operativo: una sola vez por expediente mientras siga atascado, para
  // que el correo sea señal y no ruido.
  const alertas = await avisarPurgasAtascadas(db, now);

  return {
    scheduled,
    purged: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    needsIntervention: results.filter((r) => r.requiereIntervencion).length,
    alerts: alertas,
    results,
  };
}

/**
 * Envía un aviso de alta prioridad por los expedientes cuya purga ha agotado
 * los reintentos automáticos, y marca que ya se avisó.
 */
async function avisarPurgasAtascadas(db: PrismaClient, now: Date): Promise<number> {
  const atascados = await db.case.findMany({
    where: { purgeState: "NEEDS_INTERVENTION", purgeAlertedAt: null },
    select: { id: true, ref: true, orgId: true, purgeError: true, purgeAttempts: true },
    take: 100,
  });

  if (atascados.length === 0) return 0;

  for (const c of atascados) {
    await logAudit({
      orgId: c.orgId,
      action: "retention.purge_needs_intervention",
      // Sólo la referencia interna: el registro que documenta un problema de
      // privacidad no puede ser él mismo una fuga.
      details: `La purga del expediente ${c.ref} ha fallado ${c.purgeAttempts} veces y requiere intervención`,
    }).catch(console.error);
  }

  const destino = process.env.OPS_ALERT_EMAIL || process.env.LEADS_NOTIFY_EMAIL;
  if (destino) {
    const filas = atascados
      .map(
        (c) =>
          `<tr><td style="padding:4px 8px;">${c.ref}</td>` +
          `<td style="padding:4px 8px;text-align:right;">${c.purgeAttempts}</td>` +
          `<td style="padding:4px 8px;">${(c.purgeError ?? "").slice(0, 200)}</td></tr>`,
      )
      .join("");

    await sendEmail({
      to: destino,
      subject: `[URGENTE] ${atascados.length} expediente(s) con la purga bloqueada`,
      html: `
        <div style="font-family:sans-serif;max-width:760px;">
          <h2 style="color:#b91c1c;">Purga de retención bloqueada</h2>
          <p>
            Estos expedientes han agotado los ${INTENTOS_AUTOMATICOS} reintentos
            automáticos rápidos. <strong>Sus datos personales siguen almacenados.</strong>
            El sistema seguirá reintentando una vez al día, pero la causa
            (normalmente el almacenamiento de objetos) necesita revisión.
          </p>
          <p>Reintento manual inmediato: <code>POST /api/cron/retention-cleanup?force=&lt;caseId&gt;</code></p>
          <table style="border-collapse:collapse;font-size:13px;">
            <tr style="background:#f1f5f9;text-align:left;">
              <th style="padding:4px 8px;">Expediente</th>
              <th style="padding:4px 8px;">Intentos</th>
              <th style="padding:4px 8px;">Último error</th>
            </tr>
            ${filas}
          </table>
        </div>
      `,
    }).catch(console.error);
  } else {
    console.error(
      `[retención] ${atascados.length} expediente(s) con la purga bloqueada y sin OPS_ALERT_EMAIL configurado:`,
      atascados.map((c) => c.ref).join(", "),
    );
  }

  await db.case.updateMany({
    where: { id: { in: atascados.map((c) => c.id) } },
    data: { purgeAlertedAt: now },
  });

  return atascados.length;
}

/**
 * Reintento manual de un expediente concreto, tras resolver la causa. Devuelve
 * el estado a reintentable inmediato y lo purga en el acto.
 */
export async function reintentarPurga(
  caseId: string,
  db: PrismaClient = defaultPrisma,
): Promise<PurgeResult> {
  await db.case.updateMany({
    where: { id: caseId },
    data: { purgeState: "RETRYABLE_FAILURE", purgeNextAttemptAt: null, purgeAlertedAt: null },
  });
  return purgeCase(caseId, db);
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
