import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import {
  sendSlackNotification,
  sendCustomWebhook,
  type OutboundEvent,
} from "@/lib/outbound-integrations";

/**
 * Dispara un evento de prueba a Slack y/o al webhook configurado de la org
 * para que el cliente verifique la conexión sin esperar a que haya un
 * plazo crítico real. Devuelve el resultado por canal.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "billing.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const target = body.target === "slack" || body.target === "webhook" ? body.target : "all";

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: {
      slackWebhookUrl: true,
      customWebhookUrl: true,
      customWebhookSecret: true,
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
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

  const results: { slack?: unknown; webhook?: unknown } = {};

  if ((target === "all" || target === "slack") && org.slackWebhookUrl) {
    results.slack = await sendSlackNotification(org.slackWebhookUrl, event);
  } else if (target === "slack" && !org.slackWebhookUrl) {
    results.slack = { ok: false, error: "Slack webhook URL no configurado" };
  }

  if ((target === "all" || target === "webhook") && org.customWebhookUrl) {
    results.webhook = await sendCustomWebhook(org.customWebhookUrl, org.customWebhookSecret, event);
  } else if (target === "webhook" && !org.customWebhookUrl) {
    results.webhook = { ok: false, error: "Webhook URL no configurado" };
  }

  return NextResponse.json({ event: event.event, results });
}
