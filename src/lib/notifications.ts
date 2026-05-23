/**
 * Notifications engine: scans cases and sends time-sensitive emails
 * (ISD deadline countdown, family reminders for pending docs).
 *
 * Designed to be idempotent: NotificationLog dedupes per (case, kind).
 * ISD alerts fire once per bucket (60D / 30D / 7D / 1D / PASSED).
 * Family reminders use a rolling 7-day cooldown.
 */

import { prisma } from "./prisma";
import { addMonths, daysUntil } from "./deadline-engine";
import { sendIsdDeadlineAlert, sendDocumentReminder } from "./email";
import {
  sendSlackNotification,
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
async function internalRecipientsFor(orgId: string): Promise<string[]> {
  const members = await prisma.membership.findMany({
    where: { orgId },
    include: { user: true },
  });
  const priority = members.filter((m) => m.role === "OWNER" || m.role === "MANAGER");
  const source = priority.length > 0 ? priority : members;
  return Array.from(new Set(source.map((m) => m.user.email).filter(Boolean)));
}

export interface NotificationRunResult {
  isdAlertsSent: number;
  familyRemindersSent: number;
  slackAlertsSent: number;
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
    include: { deceased: true, org: true },
  });

  for (const c of cases) {
    if (!c.deceased?.deathDate) continue;

    const deadline = addMonths(c.deceased.deathDate, 6);
    const remaining = daysUntil(deadline);
    const bucket = isdBucketFor(remaining);
    if (!bucket) continue;

    // Dedupe: one email per (case, bucket).
    const alreadySent = await prisma.notificationLog.findFirst({
      where: { caseId: c.id, kind: bucket, status: "sent" },
    });
    if (alreadySent) continue;

    const recipients = await internalRecipientsFor(c.orgId);
    if (recipients.length === 0) continue;

    const caseUrl = `${APP_URL}/cases/${c.id}`;

    for (const email of recipients) {
      try {
        await sendIsdDeadlineAlert({
          email,
          caseRef: c.ref,
          deceasedName: c.deceased.fullName,
          daysRemaining: remaining,
          deadline,
          caseUrl,
        });
        await prisma.notificationLog.create({
          data: {
            orgId: c.orgId,
            caseId: c.id,
            kind: bucket,
            channel: "EMAIL_INTERNAL",
            recipient: email,
            status: "sent",
          },
        });
        result.isdAlertsSent++;
      } catch (err: any) {
        await prisma.notificationLog.create({
          data: {
            orgId: c.orgId,
            caseId: c.id,
            kind: bucket,
            channel: "EMAIL_INTERNAL",
            recipient: email,
            status: "failed",
            error: String(err?.message ?? err).slice(0, 500),
          },
        });
        result.errors.push({ caseId: c.id, kind: bucket, error: String(err?.message ?? err) });
      }
    }

    // ── Notificaciones outbound (Slack + webhook, plan Firma) ──
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

    if (c.org.slackWebhookUrl) {
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

    if (c.org.customWebhookUrl) {
      const dispatch = await sendCustomWebhook(
        c.org.customWebhookUrl,
        c.org.customWebhookSecret,
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
      status: { notIn: ["CLOSED", "ARCHIVED"] },
      portalEnabled: true,
      contact: { email: { not: null } },
    },
    include: {
      contact: true,
      tasks: {
        where: { status: { in: ["PENDING", "IN_PROGRESS"] }, docTag: { not: null } },
      },
    },
  });

  for (const c of cases) {
    if (!c.contact?.email) continue;
    if (c.tasks.length === 0) continue;

    const lastReminder = await prisma.notificationLog.findFirst({
      where: {
        caseId: c.id,
        kind: "FAMILY_PENDING_DOCS",
        status: "sent",
      },
      orderBy: { createdAt: "desc" },
    });
    if (lastReminder && lastReminder.createdAt > cooldown) continue;

    const missingDocs = Array.from(
      new Set(c.tasks.map((t) => t.title).filter(Boolean))
    );
    if (missingDocs.length === 0) continue;

    const portalUrl = `${APP_URL}/portal/${c.portalToken}`;
    const contactName = c.contact.fullName || "";

    try {
      await sendDocumentReminder({
        email: c.contact.email,
        name: contactName,
        missingDocs,
        portalUrl,
      });
      await prisma.notificationLog.create({
        data: {
          orgId: c.orgId,
          caseId: c.id,
          kind: "FAMILY_PENDING_DOCS",
          channel: "EMAIL_FAMILY",
          recipient: c.contact.email,
          status: "sent",
        },
      });
      result.familyRemindersSent++;
    } catch (err: any) {
      await prisma.notificationLog.create({
        data: {
          orgId: c.orgId,
          caseId: c.id,
          kind: "FAMILY_PENDING_DOCS",
          channel: "EMAIL_FAMILY",
          recipient: c.contact.email,
          status: "failed",
          error: String(err?.message ?? err).slice(0, 500),
        },
      });
      result.errors.push({
        caseId: c.id,
        kind: "FAMILY_PENDING_DOCS",
        error: String(err?.message ?? err),
      });
    }
  }
}
