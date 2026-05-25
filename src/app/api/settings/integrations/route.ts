import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const integrationsSchema = z.object({
  slackWebhookUrl: z
    .string()
    .trim()
    .url("URL de Slack inválida")
    .max(500)
    .startsWith("https://hooks.slack.com/", "Debe ser un incoming webhook de Slack")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  teamsWebhookUrl: z
    .string()
    .trim()
    .url("URL de Teams inválida")
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  customWebhookUrl: z
    .string()
    .trim()
    .url("URL de webhook inválida")
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  customWebhookSecret: z
    .string()
    .trim()
    .min(16, "El secreto debe tener al menos 16 caracteres")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "billing.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

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

  return NextResponse.json({
    slackWebhookUrl: org.slackWebhookUrl,
    teamsWebhookUrl: org.teamsWebhookUrl,
    customWebhookUrl: org.customWebhookUrl,
    // Devolver sólo si está configurado (no el secreto en claro).
    customWebhookSecretConfigured: Boolean(org.customWebhookSecret),
    tier: org.subscription?.plan ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "billing.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = integrationsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Plan gating: Slack/webhook son funcionalidades del plan Firma.
  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: { subscription: { select: { plan: true } } },
  });
  const plan = org?.subscription?.plan;
  if (plan !== "FIRMA") {
    return NextResponse.json(
      { error: "Las notificaciones Slack y webhooks están disponibles a partir del plan Firma" },
      { status: 402 },
    );
  }

  const updated = await prisma.organization.update({
    where: { id: session.user.orgId },
    data: {
      slackWebhookUrl: parsed.data.slackWebhookUrl ?? null,
      teamsWebhookUrl: parsed.data.teamsWebhookUrl ?? null,
      customWebhookUrl: parsed.data.customWebhookUrl ?? null,
      // Si el cliente envía un secreto, lo guardamos; si manda undefined, no tocamos.
      ...(parsed.data.customWebhookSecret !== undefined && {
        customWebhookSecret: parsed.data.customWebhookSecret || null,
      }),
    },
    select: {
      slackWebhookUrl: true,
      teamsWebhookUrl: true,
      customWebhookUrl: true,
      customWebhookSecret: true,
    },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "org.integrations.update",
    details: `Slack: ${updated.slackWebhookUrl ? "set" : "cleared"}, Teams: ${updated.teamsWebhookUrl ? "set" : "cleared"}, Webhook: ${updated.customWebhookUrl ? "set" : "cleared"}`,
  });

  return NextResponse.json({
    slackWebhookUrl: updated.slackWebhookUrl,
    teamsWebhookUrl: updated.teamsWebhookUrl,
    customWebhookUrl: updated.customWebhookUrl,
    customWebhookSecretConfigured: Boolean(updated.customWebhookSecret),
  });
}
