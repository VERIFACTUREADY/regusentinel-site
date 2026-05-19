import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { seedDefaultCaseTemplates } from "@/lib/default-case-templates";

export const dynamic = "force-dynamic";

const TRIAL_DAYS = 14;
const VALID_PLANS = ["INICIA", "DESPACHO", "FIRMA"] as const;

/**
 * Crea una organización para un usuario ya autenticado que aún no tiene
 * ninguna. Cubre el caso de cuentas que quedaron sin organización
 * (registro interrumpido, error transitorio al iniciar sesión, etc.).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Si ya tiene una membresía, no creamos otra: devolvemos la existente.
  const existing = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { orgId: true },
  });
  if (existing) {
    return NextResponse.json({ orgId: existing.orgId, alreadyExisted: true });
  }

  const body = await req.json().catch(() => ({}));
  const orgName = typeof body.orgName === "string" ? body.orgName.trim() : "";
  if (orgName.length < 2 || orgName.length > 200) {
    return NextResponse.json(
      { error: "El nombre de la organización debe tener entre 2 y 200 caracteres" },
      { status: 400 }
    );
  }
  const plan = VALID_PLANS.includes(body.plan) ? body.plan : "INICIA";

  // Slug único: base + sufijo aleatorio corto para evitar colisiones.
  const baseSlug = orgName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "org";
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;

  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  try {
    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name: orgName, slug },
      });
      await tx.membership.create({
        data: { userId: session.user.id, orgId: created.id, role: "OWNER" },
      });
      await tx.subscription.create({
        data: {
          orgId: created.id,
          plan,
          status: "trialing",
          currentPeriodEnd: trialEnd,
        },
      });
      await seedDefaultCaseTemplates(tx, created.id);
      return created;
    });

    logAudit({
      orgId: org.id,
      userId: session.user.id,
      action: "org.created",
      details: `Organización creada desde la configuración de cuenta (plan ${plan})`,
    }).catch(() => {});

    return NextResponse.json({ orgId: org.id, created: true });
  } catch (err) {
    console.error("create-organization error:", err);
    return NextResponse.json({ error: "No se pudo crear la organización" }, { status: 500 });
  }
}
