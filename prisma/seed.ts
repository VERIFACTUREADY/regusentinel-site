import {
  PrismaClient,
  Role,
  PlanTier,
  BillingInterval,
  TaskCategory,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEMO_ORG_SLUG,
  DEMO_OWNER_EMAIL,
  DEMO_OPERATOR_EMAIL,
  DEMO_VIEWER_EMAIL,
  DEMO_PASSWORD,
  resetDemoCases,
} from "../src/lib/demo-data";

const prisma = new PrismaClient();

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("Seeding database...");

  // ── Organization (branded DESPACHO org) ─────────────────
  const org = await prisma.organization.upsert({
    where: { slug: DEMO_ORG_SLUG },
    update: {
      name: "Despacho García & Asociados",
      brandDisplayName: "Despacho García & Asociados",
      brandPrimaryColor: "#1e40af",
      brandSupportEmail: "familias@garcia-asociados.es",
      brandFooterText:
        "Despacho García & Asociados · Calle Velázquez 45, Madrid · +34 910 00 00 00",
    },
    create: {
      name: "Despacho García & Asociados",
      slug: DEMO_ORG_SLUG,
      retentionDays: 180,
      brandDisplayName: "Despacho García & Asociados",
      brandPrimaryColor: "#1e40af",
      brandSupportEmail: "familias@garcia-asociados.es",
      brandFooterText:
        "Despacho García & Asociados · Calle Velázquez 45, Madrid · +34 910 00 00 00",
    },
  });
  console.log(`  Organization: ${org.name} (${org.id})`);

  // ── Users ────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: DEMO_OWNER_EMAIL },
    update: { passwordHash },
    create: {
      email: DEMO_OWNER_EMAIL,
      name: "Laura García (Owner)",
      passwordHash,
    },
  });
  const operator = await prisma.user.upsert({
    where: { email: DEMO_OPERATOR_EMAIL },
    update: { passwordHash },
    create: {
      email: DEMO_OPERATOR_EMAIL,
      name: "Miguel Fernández",
      passwordHash,
    },
  });
  const viewer = await prisma.user.upsert({
    where: { email: DEMO_VIEWER_EMAIL },
    update: { passwordHash },
    create: {
      email: DEMO_VIEWER_EMAIL,
      name: "Ana Ruiz (Socia)",
      passwordHash,
    },
  });
  console.log(`  Users: admin / operador / viewer (password: ${DEMO_PASSWORD})`);

  // ── Memberships ──────────────────────────────────────────
  for (const [user, role] of [
    [admin, Role.OWNER],
    [operator, Role.OPERATOR],
    [viewer, Role.VIEWER],
  ] as const) {
    await prisma.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: org.id } },
      update: { role },
      create: { userId: user.id, orgId: org.id, role },
    });
  }

  // ── Subscription (DESPACHO annual, setup paid) ──────────
  await prisma.subscription.upsert({
    where: { orgId: org.id },
    update: {
      plan: PlanTier.DESPACHO,
      interval: BillingInterval.ANNUAL,
      status: "active",
      setupFeePaid: true,
      setupFeePaidAt: daysFromNow(-120),
      currentPeriodEnd: daysFromNow(245),
    },
    create: {
      orgId: org.id,
      plan: PlanTier.DESPACHO,
      interval: BillingInterval.ANNUAL,
      status: "active",
      setupFeePaid: true,
      setupFeePaidAt: daysFromNow(-120),
      currentPeriodEnd: daysFromNow(245),
    },
  });
  console.log(`  Subscription: DESPACHO annual (setup paid)`);

  // ── Templates (only if none exist) ───────────────────────
  const existingTemplates = await prisma.template.count({ where: { orgId: org.id } });
  if (existingTemplates === 0) {
    await prisma.template.create({
      data: {
        orgId: org.id,
        name: "Notificación de fallecimiento a banco",
        category: TaskCategory.BANCOS,
        type: "carta",
        versions: {
          create: {
            version: 1,
            subject: "Notificación de fallecimiento - {{deceased.fullName}}",
            body: `Estimados señores,

Por medio de la presente, les comunico el fallecimiento de D./Dña. {{deceased.fullName}}, con DNI {{deceased.dni}}, ocurrido en fecha {{deceased.deathDate}}.

En calidad de {{contact.relationship}} del/la fallecido/a, les ruego procedan a bloquear las cuentas y emitir un certificado de posiciones a fecha de fallecimiento.

Atentamente,
{{contact.fullName}}`,
            variables: [
              "deceased.fullName",
              "deceased.dni",
              "deceased.deathDate",
              "contact.relationship",
              "contact.fullName",
            ],
            isApproved: true,
          },
        },
      },
    });
    await prisma.template.create({
      data: {
        orgId: org.id,
        name: "Solicitud de baja de suministro",
        category: TaskCategory.SUMINISTROS,
        type: "carta",
        versions: {
          create: {
            version: 1,
            subject: "Solicitud de baja por fallecimiento - {{deceased.fullName}}",
            body: `Estimados señores,

Solicito la baja del contrato de suministro a nombre de D./Dña. {{deceased.fullName}} (DNI {{deceased.dni}}), motivada por el fallecimiento del titular en fecha {{deceased.deathDate}}.

Un saludo,
{{contact.fullName}}`,
            variables: [
              "deceased.fullName",
              "deceased.dni",
              "deceased.deathDate",
              "contact.fullName",
            ],
            isApproved: true,
          },
        },
      },
    });
    await prisma.template.create({
      data: {
        orgId: org.id,
        name: "Recordatorio de documentación pendiente",
        category: null,
        type: "email",
        versions: {
          create: {
            version: 1,
            subject: "Documentación pendiente - Expediente {{case.ref}}",
            body: `Estimado/a {{contact.fullName}},

Le escribimos en relación con el expediente {{case.ref}} del fallecimiento de D./Dña. {{deceased.fullName}}.

Tenemos pendiente la siguiente documentación:
{{pending.documentList}}

Puede subirla desde el portal de seguimiento.

Un cordial saludo,
{{org.name}}`,
            variables: [
              "contact.fullName",
              "case.ref",
              "deceased.fullName",
              "pending.documentList",
              "org.name",
            ],
            isApproved: true,
          },
        },
      },
    });
    console.log(`  Templates: 3 created`);
  } else {
    console.log(`  Templates: ${existingTemplates} existing (skipped)`);
  }

  // ── Demo cases (delegated to shared lib so the cron can reuse it) ──
  const { created } = await resetDemoCases(org.id, admin.id, operator.id);
  console.log(`  Demo cases: ${created} recreated`);

  // Seed audit log so the dashboard "Actividad reciente" isn't empty.
  const recentCases = await prisma.case.findMany({
    where: { orgId: org.id, ref: { startsWith: "EXP-DEMO-" } },
    select: { id: true, ref: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  for (const c of recentCases) {
    await prisma.auditLog.create({
      data: {
        orgId: org.id,
        userId: admin.id,
        caseId: c.id,
        action: "case.created",
        details: `Expediente ${c.ref} creado`,
      },
    });
  }

  console.log("\nSeed complete.");
  console.log(`Login: ${DEMO_OWNER_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`       ${DEMO_OPERATOR_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`       ${DEMO_VIEWER_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
