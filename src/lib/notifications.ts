/**
 * Notifications engine: scans cases and sends time-sensitive emails
 * (ISD deadline countdown, family reminders for pending docs).
 *
 * Designed to be idempotent: NotificationLog dedupes per (case, kind).
 * ISD alerts fire once per bucket (60D / 30D / 7D / 1D / PASSED).
 * Family reminders use a rolling 7-day cooldown.
 */

import { prisma } from "./prisma";
import { parsePrefs, type NotifPrefs } from "./notif-prefs";
import { getConsentStatus } from "./portal-consent";
import {
  alreadyDelivered,
  recordDelivery,
  recordFailure,
  isoWeekWindow,
} from "./notification-dedupe";
import { readSecret } from "./secret-crypto";
import { addMonths, daysUntil } from "./deadline-engine";
import { sendIsdDeadlineAlert, sendDocumentReminder } from "./email";
import {
  sendSlackNotification,
  sendTeamsNotification,
  sendCustomWebhook,
  eventNameForKind,
  type OutboundEvent,
} from "./outbound-integrations";
import type { NotificationKind } from "@prisma/client";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const FAMILY_REMINDER_COOLDOWN_DAYS = 7;

/**
 * Map the days-remaining to the ISD bucket that should fire (at most one).
 * Returns null if we are outside any alert window.
 */
function isdBucketFor(daysRemaining: number): NotificationKind | null {
  if (daysRemaining < 0) return "ISD_PASSED";
  if (daysRemaining <= 1) return "ISD_1D";
  if (daysRemaining <= 7) return "ISD_7D";
  if (daysRemaining <= 30) return "ISD_30D";
  if (daysRemaining <= 60) return "ISD_60D";
  return null;
}

/**
 * Internal recipients for a case's org alerts.
 * Prefer OWNERs and MANAGERs; fall back to any member.
 */
/**
 * Validacion sintactica minima. No comprueba que el buzon exista; solo evita
 * intentar enviar a valores que claramente no son direcciones ("-", "no
 * tiene", un telefono), que generaban un fallo por expediente en cada pasada.
 */
function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(value);
}

async function internalRecipientsFor(
  orgId: string,
  prefKey: keyof NotifPrefs = "isdAlerts",
): Promise<string[]> {
  const members = await prisma.membership.findMany({
    where: { orgId },
    include: { user: true },
  });

  // Respeta Membership.notifPrefs: antes se ignoraba por completo y un usuario
  // que desactivaba una categoria la seguia recibiendo. Los valores ausentes
  // toman el defecto de DEFAULT_PREFS (activado).
  const optedIn = members.filter((m) => parsePrefs(m.notifPrefs)[prefKey]);

  const priority = optedIn.filter((m) => m.role === "OWNER" || m.role === "MANAGER");
  const source = priority.length > 0 ? priority : optedIn;
  return Array.from(new Set(source.map((m) => m.user.email).filter(Boolean)));
}

export interface NotificationRunResult {
  isdAlertsSent: number;
  familyRemindersSent: number;
  slackAlertsSent: number;
  teamsAlertsSent: number;
  webhookAlertsSent: number;
  errors: Array<{ caseId: string; kind: string; error: string }>;
}

/**
 * Main entrypoint. Runs both scanners.
 */
export async function runDeadlineNotifications(): Promise<NotificationRunResult> {
  const result: NotificationRunResult = {
    isdAlertsSent: 0,
    familyRemindersSent: 0,
    slackAlertsSent: 0,
    teamsAlertsSent: 0,
    webhookAlertsSent: 0,
    errors: [],
  };

  await scanIsdDeadlines(result);
  await scanFamilyPendingDocs(result);

  return result;
}

// ─── ISD deadline scanner ──────────────────────────────────────────────

async function scanIsdDeadlines(result: NotificationRunResult): Promise<void> {
  // Open cases with a deathDate known. Closed/archived cases are skipped.
  const cases = await prisma.case.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
      deceased: { deathDate: { not: null } },
    },
    include: { deceased: true, org: { include: { subscription: true } } },
  });

  for (const c of cases) {
    if (!c.deceased?.deathDate) continue;

    const deadline = addMonths(c.deceased.deathDate, 6);
    const remaining = daysUntil(deadline);
    const bucket = isdBucketFor(remaining);
    if (!bucket) continue;

    // La deduplicacion es por ENTREGA (expediente, tipo, canal, destinatario),
    // no por expediente: antes, si un destinatario recibia el email y otro
    // fallaba, la siguiente ejecucion saltaba el expediente entero y el
    // segundo no lo recibia nunca — y ademas bloqueaba Slack/Teams/webhook.
    const recipients = await internalRecipientsFor(c.orgId, "isdAlerts");

    const caseUrl = `${APP_URL}/cases/${c.id}`;

    for (const email of recipients) {
      const target = {
        orgId: c.orgId,
        caseId: c.id,
        kind: bucket,
        channel: "EMAIL_INTERNAL" as const,
        recipient: email,
      };
      if (await alreadyDelivered(target)) continue;

      try {
        await sendIsdDeadlineAlert({
          email,
          caseRef: c.ref,
          deceasedName: c.deceased.fullName,
          daysRemaining: remaining,
          deadline,
          caseUrl,
        });
        await recordDelivery(target);
        result.isdAlertsSent++;
      } catch (err: any) {
        // Se registra SIN dedupeKey: el proximo intento vuelve a intentarlo
        // para este destinatario concreto, sin afectar a los demas.
        await recordFailure({ ...target, error: String(err?.message ?? err) });
        result.errors.push({ caseId: c.id, kind: bucket, error: String(err?.message ?? err) });
      }
    }

    // ── Notificaciones outbound (Slack + Teams + webhook, plan Firma) ──
    //
    // El plan se vuelve a comprobar AQUI, en el momento de enviar. Antes solo
    // se comprobaba al guardar la configuracion, asi que una organizacion que
    // configuro las integraciones con plan Firma y luego bajo de plan seguia
    // recibiendolas indefinidamente.
    const outboundEnabled = c.org.subscription?.plan === "FIRMA";

    const event: OutboundEvent = {
      event: eventNameForKind(bucket),
      orgId: c.orgId,
      caseId: c.id,
      caseRef: c.ref,
      caseUrl,
      deceasedName: c.deceased.fullName,
      daysRemaining: remaining,
      deadline: deadline.toISOString(),
      emittedAt: new Date().toISOString(),
    };

    if (outboundEnabled && c.org.slackWebhookUrl) {
      const dispatch = await sendSlackNotification(c.org.slackWebhookUrl, event);
      await prisma.notificationLog.create({
        data: {
          orgId: c.orgId,
          caseId: c.id,
          kind: bucket,
          channel: "SLACK",
          recipient: "slack",
          status: dispatch.ok ? "sent" : "failed",
          error: dispatch.ok ? null : (dispatch.error ?? "unknown").slice(0, 500),
        },
      });
      if (dispatch.ok) {
        result.slackAlertsSent++;
      } else {
        result.errors.push({ caseId: c.id, kind: `${bucket}/SLACK`, error: dispatch.error ?? "fail" });
      }
    }

    if (outboundEnabled && c.org.teamsWebhookUrl) {
      const dispatch = await sendTeamsNotification(c.org.teamsWebhookUrl, event);
      await prisma.notificationLog.create({
        data: {
          orgId: c.orgId,
          caseId: c.id,
          kind: bucket,
          channel: "TEAMS",
          recipient: "teams",
          status: dispatch.ok ? "sent" : "failed",
          error: dispatch.ok ? null : (dispatch.error ?? "unknown").slice(0, 500),
        },
      });
      if (dispatch.ok) {
        result.teamsAlertsSent++;
      } else {
        result.errors.push({ caseId: c.id, kind: `${bucket}/TEAMS`, error: dispatch.error ?? "fail" });
      }
    }

    if (outboundEnabled && c.org.customWebhookUrl) {
      const dispatch = await sendCustomWebhook(
        c.org.customWebhookUrl,
        readSecret(c.org.customWebhookSecret),
        event,
      );
      await prisma.notificationLog.create({
        data: {
          orgId: c.orgId,
          caseId: c.id,
          kind: bucket,
          channel: "WEBHOOK",
          recipient: c.org.customWebhookUrl.slice(0, 100),
          status: dispatch.ok ? "sent" : "failed",
          error: dispatch.ok ? null : (dispatch.error ?? "unknown").slice(0, 500),
        },
      });
      if (dispatch.ok) {
        result.webhookAlertsSent++;
      } else {
        result.errors.push({ caseId: c.id, kind: `${bucket}/WEBHOOK`, error: dispatch.error ?? "fail" });
      }
    }
  }
}

// ─── Family pending-docs scanner ───────────────────────────────────────

async function scanFamilyPendingDocs(result: NotificationRunResult): Promise<void> {
  const cooldown = new Date(Date.now() - FAMILY_REMINDER_COOLDOWN_DAYS * 24 * 3600 * 1000);

  // Cases in PENDING_DOCS (or with pending tasks + a family email) that haven't
  // been pinged in the cooldown window.
  const cases = await prisma.case.findMany({
    where: {
      deletedAt: null,
      // Expediente vivo y portal habilitado.
      status: { notIn: ["CLOSED", "ARCHIVED"] },
      portalEnabled: true,
      // El enlace no puede estar revocado ni caducado: si lo esta, el
      // recordatorio llevaria a la familia a una pagina que no abre.
      portalTokenRevokedAt: null,
      OR: [{ portalTokenExpiresAt: null }, { portalTokenExpiresAt: { gt: new Date() } }],
      contact: { email: { not: null } },
    },
    include: {
      contact: true,
      tasks: {
        where: { status: { in: ["PENDING", "IN_PROGRESS"] }, docTag: { not: null } },
      },
      // Documentos ya aportados: una tarea con documento NO esta pendiente.
      documents: { where: { taskId: { not: null }, deletionState: null }, select: { taskId: true } },
    },
  });

  for (const c of cases) {
    const email = c.contact?.email?.trim();
    // Email sintacticamente valido: sin esto se intentaba enviar a cadenas
    // como "-" o "pendiente", generando un fallo por expediente en cada pasada.
    if (!email || !isPlausibleEmail(email)) continue;
    if (c.tasks.length === 0) continue;

    // Sin consentimiento vigente no se contacta a la familia. El portal ya lo
    // exige para operar; enviar el recordatorio seria tratar sus datos para
    // una finalidad que no ha aceptado.
    const consent = await getConsentStatus(c.id);
    if (!consent.valid) continue;

    // Solo son pendientes las tareas SIN documento vinculado. Antes se
    // contaban todas las tareas con docTag, asi que se seguia pidiendo a la
    // familia documentos que el equipo ya habia adjuntado.
    const conDocumento = new Set(c.documents.map((d) => d.taskId));
    const pendientes = c.tasks.filter((t) => !conDocumento.has(t.id));
    if (pendientes.length === 0) continue;

    const missingDocs = Array.from(new Set(pendientes.map((t) => t.title).filter(Boolean)));
    if (missingDocs.length === 0) continue;

    // Deduplicacion por entrega y ventana semanal.
    const target = {
      orgId: c.orgId,
      caseId: c.id,
      kind: "FAMILY_PENDING_DOCS" as const,
      channel: "EMAIL_FAMILY" as const,
      recipient: email,
      window: isoWeekWindow(),
    };
    if (await alreadyDelivered(target)) continue;

    // Cooldown adicional: la ventana semanal evita duplicados dentro de la
    // misma semana, y esto respeta ademas el periodo minimo configurado.
    const lastReminder = await prisma.notificationLog.findFirst({
      where: { caseId: c.id, kind: "FAMILY_PENDING_DOCS", status: "sent" },
      orderBy: { createdAt: "desc" },
    });
    if (lastReminder && lastReminder.createdAt > cooldown) continue;

    const portalUrl = `${APP_URL}/portal/${c.portalToken}`;
    const contactName = c.contact?.fullName || "";

    try {
      await sendDocumentReminder({ email, name: contactName, missingDocs, portalUrl });
      await recordDelivery(target);
      result.familyRemindersSent++;
    } catch (err: any) {
      // Sin dedupeKey: el proximo intento vuelve a probar este destinatario.
      await recordFailure({ ...target, error: String(err?.message ?? err) });
      result.errors.push({
        caseId: c.id,
        kind: "FAMILY_PENDING_DOCS",
        error: String(err?.message ?? err),
      });
    }
  }
}
