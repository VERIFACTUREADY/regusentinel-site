import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRetention, purgeOldPromptLogs, reintentarPurga } from "@/lib/retention";
import { PROMPT_LOG_RETENTION_DAYS } from "@/lib/ai-privacy";
import { sendEmail } from "@/lib/email";
import { validateCronSecret } from "@/lib/cron-auth";
import { limpiarSubidasCaducadas } from "@/lib/subida-directa";

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Purga REAL: borra los objetos de S3 y las filas con datos personales, y
  // anonimiza lo que debe conservarse. Antes esto solo ponia `deletedAt` y se
  // llamaba "limpieza": el expediente seguia integro en PostgreSQL y todos sus
  // documentos en S3, mientras la politica de privacidad afirmaba lo contrario.
  const retention = await runRetention(prisma, now);
  const promptLogsPurged = await purgeOldPromptLogs(PROMPT_LOG_RETENTION_DAYS, prisma);

  /*
   * Subidas autorizadas que nunca se confirmaron.
   *
   * Con la subida directa al almacenamiento, el servidor firma un permiso de
   * escritura y el navegador escribe por su cuenta. Si el usuario cierra la
   * pestaña entre una cosa y la otra, el objeto queda en el bucket sin ninguna
   * fila que lo mencione. Esta pasada es la garantía de que eso se recoge; la
   * autorización barre además unas pocas cada vez, para que no se acumulen
   * entre ejecuciones del cron.
   */
  const subidasCaducadas = await limpiarSubidasCaducadas({ ahora: now }).catch((err) => {
    console.error("Limpieza de subidas caducadas fallida:", err);
    return null;
  });

  const results = retention.results.map((r) => ({
    name: r.ref,
    cleaned: r.ok ? 1 : 0,
    retentionDays: 0,
    error: r.error,
  }));

  const orgResults = results.filter((r) => r.cleaned > 0);
  const totalCleaned = retention.purged;

  if (totalCleaned > 0) {
    const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
    if (notifyEmail) {
      const rows = orgResults
        .map(
          (r) =>
            `<tr><td style="padding:4px 12px 4px 0;">${r.name}</td><td style="padding:4px 12px;">${r.cleaned ? "si" : "no"}</td><td style="padding:4px 0;">${r.error ?? "ok"}</td></tr>`
        )
        .join("");

      await sendEmail({
        to: notifyEmail,
        subject: `Purga de retencion — ${totalCleaned} expediente(s) eliminado(s)`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <p style="background:#6366f1;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;">RETENCION RGPD</p>
            <h2 style="color:#1a1a2e;margin-top:12px;">Limpieza automatica de datos</h2>
            <p style="font-size:14px;color:#333;">${totalCleaned} expediente(s) cerrado(s) han sido archivados (soft-delete) por superar el periodo de retencion configurado.</p>
            <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
              <tr style="border-bottom:1px solid #eee;font-weight:600;"><td style="padding:4px 12px 4px 0;">Expediente</td><td style="padding:4px 12px;">Purgado</td><td style="padding:4px 0;">Estado</td></tr>
              ${rows}
            </table>
          </div>
        `,
      }).catch(console.error);
    }
  }

  return NextResponse.json({
    scheduledForPurge: retention.scheduled,
    purged: retention.purged,
    purgeFailed: retention.failed,
    needsIntervention: retention.needsIntervention,
    alerts: retention.alerts,
    promptLogsPurged,
    subidasCaducadas,
    // Solo referencias de expediente; sin nombres ni emails.
    details: retention.results.map((r) => ({ ref: r.ref, ok: r.ok, error: r.error })),
    timestamp: now.toISOString(),
  });
}

/**
 * Reintento manual de la purga de un expediente concreto, tras resolver la
 * causa del fallo (permisos de S3, bucket inaccesible…).
 *
 * Existe porque la corrección de la fase 10 exige que un expediente atascado
 * NUNCA quede abandonado: además del reintento automático con backoff largo,
 * operaciones tiene que poder forzarlo en el momento.
 *
 *   POST /api/cron/retention-cleanup?force=<caseId>
 */
export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caseId = new URL(req.url).searchParams.get("force");
  if (!caseId) {
    return NextResponse.json({ error: "Falta el parametro `force=<caseId>`" }, { status: 400 });
  }

  const resultado = await reintentarPurga(caseId, prisma);

  // Sólo la referencia interna y el resultado: nada de datos personales.
  return NextResponse.json(
    {
      ref: resultado.ref,
      ok: resultado.ok,
      s3Deleted: resultado.s3Deleted,
      s3Failed: resultado.s3Failed,
      error: resultado.error,
    },
    { status: resultado.ok ? 200 : 422 },
  );
}
