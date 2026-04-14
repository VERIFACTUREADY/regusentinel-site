import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color HEX invalido (ej: #1e40af)")
  .optional()
  .or(z.literal("").transform(() => undefined));

const brandingSchema = z.object({
  brandDisplayName: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
  brandLogoUrl: z.string().trim().url("URL de logo invalida").max(500).optional().or(z.literal("").transform(() => undefined)),
  brandPrimaryColor: hexColor,
  brandSupportEmail: z.string().trim().email("Email invalido").optional().or(z.literal("").transform(() => undefined)),
  brandFooterText: z.string().trim().max(280).optional().or(z.literal("").transform(() => undefined)),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.user.orgId },
    select: {
      name: true,
      brandDisplayName: true,
      brandLogoUrl: true,
      brandPrimaryColor: true,
      brandSupportEmail: true,
      brandFooterText: true,
      subscription: { select: { plan: true } },
    },
  });

  const plan = org.subscription?.plan ?? "INICIA";
  const canHideAttribution = plan === "DESPACHO" || plan === "FIRMA";

  return NextResponse.json({
    org: {
      name: org.name,
      brandDisplayName: org.brandDisplayName,
      brandLogoUrl: org.brandLogoUrl,
      brandPrimaryColor: org.brandPrimaryColor,
      brandSupportEmail: org.brandSupportEmail,
      brandFooterText: org.brandFooterText,
    },
    plan,
    canHideAttribution,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // Only OWNER/MANAGER can change branding (reuse billing.manage as proxy
  // — it's the same tier of trust).
  if (!hasPermission(session.user.role, "billing.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = brandingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.errors },
      { status: 400 }
    );
  }

  const updated = await prisma.organization.update({
    where: { id: session.user.orgId },
    data: {
      brandDisplayName: parsed.data.brandDisplayName ?? null,
      brandLogoUrl: parsed.data.brandLogoUrl ?? null,
      brandPrimaryColor: parsed.data.brandPrimaryColor ?? null,
      brandSupportEmail: parsed.data.brandSupportEmail ?? null,
      brandFooterText: parsed.data.brandFooterText ?? null,
    },
    select: {
      brandDisplayName: true,
      brandLogoUrl: true,
      brandPrimaryColor: true,
      brandSupportEmail: true,
      brandFooterText: true,
    },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "org.branding.update",
    details: "Branding del portal familia actualizado",
  });

  return NextResponse.json(updated);
}
