import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { validateOutboundUrl } from "@/lib/ssrf-guard";
import { writeSecret, encryptionAvailable } from "@/lib/secret-crypto";

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
  const auth = await requireOrgPermission("billing.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

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
  const auth = await requireOrgPermission("billing.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

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

  // Validación de destino ANTES de guardar. Zod sólo comprueba que la cadena
  // parece una URL: no impide `https://169.254.169.254/` ni un nombre público
  // que resuelva a una dirección interna. Se vuelve a comprobar al enviar,
  // porque el DNS puede cambiar entre que se guarda y que se usa.
  for (const [campo, valor] of [
    ["Teams", parsed.data.teamsWebhookUrl],
    ["webhook personalizado", parsed.data.customWebhookUrl],
    ["Slack", parsed.data.slackWebhookUrl],
  ] as const) {
    if (!valor) continue;
    const verdict = await validateOutboundUrl(valor);
    if (!verdict.ok) {
      return NextResponse.json(
        { error: `URL de ${campo} no admitida: ${verdict.message}` },
        { status: 400 },
      );
    }
  }

  // El secreto se guarda cifrado (AES-256-GCM). Si no hay clave configurada,
  // se rechaza la operación: guardarlo en claro sin avisar sería peor.
  let secretToStore: string | null | undefined;
  if (parsed.data.customWebhookSecret !== undefined) {
    if (parsed.data.customWebhookSecret) {
      if (!encryptionAvailable()) {
        return NextResponse.json(
          {
            error:
              "No se puede guardar el secreto: falta SECRETS_ENCRYPTION_KEY en el servidor. Contacta con soporte.",
          },
          { status: 503 },
        );
      }
      secretToStore = writeSecret(parsed.data.customWebhookSecret);
    } else {
      secretToStore = null;
    }
  }

  const updated = await prisma.organization.update({
    where: { id: session.user.orgId },
    data: {
      slackWebhookUrl: parsed.data.slackWebhookUrl ?? null,
      teamsWebhookUrl: parsed.data.teamsWebhookUrl ?? null,
      customWebhookUrl: parsed.data.customWebhookUrl ?? null,
      ...(secretToStore !== undefined && { customWebhookSecret: secretToStore }),
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
