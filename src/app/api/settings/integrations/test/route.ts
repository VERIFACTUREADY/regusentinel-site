import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  sendSlackNotification,
  sendTeamsNotification,
  sendCustomWebhook,
  type OutboundEvent,
} from "@/lib/outbound-integrations";
import { readSecret } from "@/lib/secret-crypto";
import { rateLimit } from "@/lib/api-rate-limit";

/**
 * Dispara un evento de prueba a Slack y/o al webhook configurado de la org
 * para que el cliente verifique la conexión sin esperar a que haya un
 * plazo crítico real. Devuelve el resultado por canal.
 */
export async function POST(req: NextRequest) {
  // El endpoint hace peticiones salientes bajo demanda: sin limite, sirve para
  // sondear destinos a ritmo alto aunque cada destino se valide de por si.
  // Dos ventanas: una corta contra ráfagas y otra por hora contra el sondeo
  // lento y sostenido, que la ventana de un minuto no llega a ver.
  const limitedBurst = rateLimit(req, { bucket: "integrations-test", windowMs: 60_000, max: 6 });
  if (limitedBurst) return limitedBurst;
  const limitedHora = rateLimit(req, { bucket: "integrations-test-hora", windowMs: 3_600_000, max: 30 });
  if (limitedHora) return limitedHora;

  const auth = await requireOrgPermission("billing.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const body = await req.json().catch(() => ({}));
  const target =
    body.target === "slack" || body.target === "teams" || body.target === "webhook"
      ? body.target
      : "all";

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: {
      slackWebhookUrl: true,
      teamsWebhookUrl: true,
      customWebhookUrl: true,
      customWebhookSecret: true,
      subscription: { select: { plan: true } },
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  }

  // EL PLAN SE COMPRUEBA EN EL MOMENTO DEL ENVÍO.
  //
  // Guardar la integración exige plan FIRMA, pero este endpoint no lo
  // comprobaba: una organización que había estado en FIRMA y bajó de plan (o
  // cuya suscripción se canceló) conservaba las URLs guardadas y seguía
  // pudiendo disparar peticiones salientes desde nuestros servidores
  // indefinidamente. El gating en el momento de guardar no dice nada sobre el
  // momento de usar.
  if (org.subscription?.plan !== "FIRMA") {
    return NextResponse.json(
      { error: "Las notificaciones Slack y webhooks están disponibles a partir del plan Firma" },
      { status: 402 },
    );
  }

  const event: OutboundEvent = {
    event: "isd.test",
    orgId: session.user.orgId,
    caseId: "test",
    caseRef: "EXP-TEST-0001",
    caseUrl: `${process.env.APP_URL || "http://localhost:3000"}/cases/test`,
    deceasedName: "Causante de prueba",
    daysRemaining: 7,
    deadline: new Date(Date.now() + 7 * 86400_000).toISOString(),
    emittedAt: new Date().toISOString(),
  };

  const results: { slack?: unknown; teams?: unknown; webhook?: unknown } = {};

  if ((target === "all" || target === "slack") && org.slackWebhookUrl) {
    results.slack = await sendSlackNotification(org.slackWebhookUrl, event);
  } else if (target === "slack" && !org.slackWebhookUrl) {
    results.slack = { ok: false, error: "Slack webhook URL no configurado" };
  }

  if ((target === "all" || target === "teams") && org.teamsWebhookUrl) {
    results.teams = await sendTeamsNotification(org.teamsWebhookUrl, event);
  } else if (target === "teams" && !org.teamsWebhookUrl) {
    results.teams = { ok: false, error: "Teams webhook URL no configurado" };
  }

  if ((target === "all" || target === "webhook") && org.customWebhookUrl) {
    results.webhook = await sendCustomWebhook(
      org.customWebhookUrl,
      readSecret(org.customWebhookSecret),
      event,
    );
  } else if (target === "webhook" && !org.customWebhookUrl) {
    results.webhook = { ok: false, error: "Webhook URL no configurado" };
  }

  return NextResponse.json({ event: event.event, results });
}
