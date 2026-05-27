/**
 * Notificaciones outbound a sistemas del cliente (plan Firma):
 *   - Slack incoming webhook (mensaje formateado).
 *   - Webhook genérico HTTP POST + firma HMAC-SHA256 en X-HEREDIA-Signature.
 *
 * Cada función es pura desde el punto de vista del proceso: hace fetch,
 * devuelve { ok, status, error } y no toca DB. El llamador es responsable
 * de loguear el resultado en NotificationLog.
 */

import { createHmac, timingSafeEqual } from "crypto";

export interface DispatchResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/** Evento que se serializa al webhook genérico. Estable: el cliente lo parsea. */
export interface OutboundEvent {
  event: string; // e.g. "isd.deadline_60d"
  orgId: string;
  caseId: string;
  caseRef: string;
  caseUrl: string;
  deceasedName: string;
  daysRemaining: number;
  deadline: string; // ISO
  emittedAt: string; // ISO
}

const FETCH_TIMEOUT_MS = 7000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Construye un mensaje Slack legible a partir del evento. */
export function buildSlackMessage(event: OutboundEvent): unknown {
  const urgency =
    event.daysRemaining < 0
      ? ":rotating_light: VENCIDO"
      : event.daysRemaining <= 7
        ? ":warning: CRÍTICO"
        : ":hourglass_flowing_sand: AVISO";
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `${urgency} · ${event.caseRef}` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Causante:*\n${event.deceasedName}` },
        {
          type: "mrkdwn",
          text:
            event.daysRemaining < 0
              ? `*Plazo:*\nVencido hace ${Math.abs(event.daysRemaining)} días`
              : `*Plazo:*\nQuedan ${event.daysRemaining} días`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Abrir expediente" },
          url: event.caseUrl,
          style: "primary",
        },
      ],
    },
  ];
  return {
    text: `${urgency} ${event.caseRef} — ${event.deceasedName}`,
    blocks,
  };
}

/**
 * MessageCard de Office 365 / Microsoft Teams. Formato heredado pero
 * sigue funcionando en los incoming webhooks de Teams; los Adaptive
 * Cards modernos requieren Workflows/Power Automate, más complejos.
 */
export function buildTeamsMessage(event: OutboundEvent): unknown {
  const urgency =
    event.daysRemaining < 0
      ? { color: "EE2C2C", text: "⚠ VENCIDO" }
      : event.daysRemaining <= 7
        ? { color: "F9A825", text: "⚠ CRÍTICO" }
        : { color: "2563EB", text: "ℹ AVISO" };
  const subtitle =
    event.daysRemaining < 0
      ? `Vencido hace ${Math.abs(event.daysRemaining)} días`
      : `Quedan ${event.daysRemaining} días`;
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: `${urgency.text} ${event.caseRef}`,
    themeColor: urgency.color,
    title: `${urgency.text} · ${event.caseRef}`,
    sections: [
      {
        activityTitle: event.deceasedName,
        activitySubtitle: subtitle,
        facts: [
          { name: "Expediente", value: event.caseRef },
          { name: "Causante", value: event.deceasedName },
          { name: "Plazo", value: subtitle },
        ],
      },
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "Abrir expediente",
        targets: [{ os: "default", uri: event.caseUrl }],
      },
    ],
  };
}

export async function sendTeamsNotification(
  webhookUrl: string,
  event: OutboundEvent,
): Promise<DispatchResult> {
  if (!webhookUrl) return { ok: false, error: "Teams webhook URL not configured" };
  try {
    const res = await fetchWithTimeout(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTeamsMessage(event)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

export async function sendSlackNotification(
  webhookUrl: string,
  event: OutboundEvent,
): Promise<DispatchResult> {
  if (!webhookUrl) return { ok: false, error: "Slack webhook URL not configured" };
  try {
    const res = await fetchWithTimeout(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSlackMessage(event)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

/**
 * Calcula la firma HMAC-SHA256 de `body` con `secret`. Se envía como
 * "sha256=hex" en el header X-HEREDIA-Signature. El cliente puede
 * verificarla para descartar requests no firmados.
 */
export function signWebhookPayload(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/** Para tests / endpoints de validación entrante (no se usa en outbound). */
export function verifyWebhookSignature(secret: string, body: string, header: string): boolean {
  const expected = signWebhookPayload(secret, body);
  if (expected.length !== header.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

export async function sendCustomWebhook(
  url: string,
  secret: string | null,
  event: OutboundEvent,
): Promise<DispatchResult> {
  if (!url) return { ok: false, error: "Webhook URL not configured" };
  const body = JSON.stringify(event);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Heredia/1.0",
    "X-HEREDIA-Event": event.event,
  };
  if (secret) headers["X-HEREDIA-Signature"] = signWebhookPayload(secret, body);

  try {
    const res = await fetchWithTimeout(url, { method: "POST", headers, body });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

/** Helper para mapear una NotificationKind del ISD a un nombre de evento estable. */
export function eventNameForKind(kind: string): string {
  // Devuelve "isd.deadline_60d", "isd.deadline_30d", "isd.deadline_passed", etc.
  return `isd.deadline_${kind.replace(/^ISD_/, "").toLowerCase()}`;
}
