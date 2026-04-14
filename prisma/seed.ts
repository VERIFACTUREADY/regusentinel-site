import {
  PrismaClient,
  Role,
  PlanTier,
  BillingInterval,
  CaseStatus,
  TaskStatus,
  TaskCategory,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { calculateTaskDeadlines } from "../src/lib/deadline-engine";

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  return daysAgo(-n);
}

async function main() {
  console.log("Seeding database...");

  // ── Organization (branded DESPACHO org) ─────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "gestoria-demo" },
    update: {
      brandDisplayName: "Despacho García & Asociados",
      brandPrimaryColor: "#1e40af",
      brandSupportEmail: "familias@garcia-asociados.es",
      brandFooterText:
        "Despacho García & Asociados · Calle Velázquez 45, Madrid · +34 910 00 00 00",
    },
    create: {
      name: "Despacho García & Asociados",
      slug: "gestoria-demo",
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
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@baritur.com" },
    update: { passwordHash },
    create: {
      email: "admin@baritur.com",
      name: "Laura García (Owner)",
      passwordHash,
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: "operador@baritur.com" },
    update: { passwordHash },
    create: {
      email: "operador@baritur.com",
      name: "Miguel Fernández",
      passwordHash,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@baritur.com" },
    update: { passwordHash },
    create: {
      email: "viewer@baritur.com",
      name: "Ana Ruiz (Socia)",
      passwordHash,
    },
  });

  console.log(`  Users: admin / operador / viewer (password: admin123)`);

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
      setupFeePaidAt: daysAgo(120),
      currentPeriodEnd: daysFromNow(245),
    },
    create: {
      orgId: org.id,
      plan: PlanTier.DESPACHO,
      interval: BillingInterval.ANNUAL,
      status: "active",
      setupFeePaid: true,
      setupFeePaidAt: daysAgo(120),
      currentPeriodEnd: daysFromNow(245),
    },
  });
  console.log(`  Subscription: DESPACHO annual (setup paid)`);

  // ── Templates ────────────────────────────────────────────
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

Por medio de la presente, les comunico el fallecimiento de D./Dña. {{deceased.fullName}}, con DNI {{deceased.dni}}, ocurrido en fecha {{deceased.deathDate}}, quien era titular de una o varias cuentas en su entidad.

En calidad de {{contact.relationship}} del/la fallecido/a, les ruego procedan a:

1. Bloquear las cuentas y productos asociados al titular fallecido.
2. Emitir un certificado de posiciones a fecha de fallecimiento.
3. Informar sobre la documentación necesaria para la tramitación de la herencia.

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

Puede subir los documentos desde el portal de seguimiento.

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

  // ── Demo cases ───────────────────────────────────────────
  // Wipe previous demo cases so the seed is idempotent and we don't
  // accumulate duplicates when re-running.
  await prisma.case.deleteMany({
    where: { orgId: org.id, ref: { startsWith: "EXP-DEMO-" } },
  });

  interface CaseSpec {
    ref: string;
    status: CaseStatus;
    deathDaysAgo: number;
    createdDaysAgo: number;
    isUrgent?: boolean;
    hasDeceasedInsurance?: boolean;
    province: string;
    categories: TaskCategory[];
    deceased: { fullName: string; dni: string };
    contact: { fullName: string; email: string; phone: string; relationship: string };
    notes: string;
    tasks: Array<{
      category: TaskCategory;
      title: string;
      description: string;
      status: TaskStatus;
      docTag?: string;
    }>;
    closedDaysAgo?: number;
  }

  const specs: CaseSpec[] = [
    {
      ref: "EXP-DEMO-0001",
      status: CaseStatus.INTAKE,
      deathDaysAgo: 4,
      createdDaysAgo: 2,
      province: "Madrid",
      categories: [TaskCategory.BANCOS, TaskCategory.SUMINISTROS, TaskCategory.TELECOM],
      deceased: { fullName: "Carmen Molina Rivas", dni: "45678912B" },
      contact: {
        fullName: "Pablo Molina Sanz",
        email: "pablo.molina@example.com",
        phone: "+34 611 223 344",
        relationship: "Hijo",
      },
      notes:
        "Expediente recién abierto tras la visita de ayer. Pendiente de validar documentación y abrir portal.",
      tasks: [
        {
          category: TaskCategory.BANCOS,
          title: "Solicitar certificado de saldos (BBVA)",
          description: "Certificado a fecha de fallecimiento para el inventario.",
          status: TaskStatus.BLOCKED,
          docTag: "certificado_saldos",
        },
        {
          category: TaskCategory.BANCOS,
          title: "Notificar fallecimiento a entidad bancaria (Sabadell)",
          description: "Cuenta nómina y tarjeta titular único.",
          status: TaskStatus.PENDING,
          docTag: "notificacion_banco",
        },
        {
          category: TaskCategory.SUMINISTROS,
          title: "Cambio de titularidad de suministros (luz, agua, gas)",
          description: "Vivienda habitual. Heredera única: viuda.",
          status: TaskStatus.PENDING,
          docTag: "titularidad_suministros",
        },
      ],
    },
    {
      ref: "EXP-DEMO-0002",
      status: CaseStatus.IN_PROGRESS,
      deathDaysAgo: 62,
      createdDaysAgo: 55,
      hasDeceasedInsurance: true,
      province: "Barcelona",
      categories: [TaskCategory.BANCOS, TaskCategory.SEGUROS, TaskCategory.FISCAL],
      deceased: { fullName: "José Luis Pérez Navarro", dni: "11223344C" },
      contact: {
        fullName: "María Pérez Olmedo",
        email: "maria.perez@example.com",
        phone: "+34 622 334 455",
        relationship: "Hija",
      },
      notes:
        "Dos entidades bancarias y póliza de vida en Mapfre. Pendiente liquidación ISD.",
      tasks: [
        {
          category: TaskCategory.BANCOS,
          title: "Solicitar certificado de saldos",
          description: "CaixaBank y Santander.",
          status: TaskStatus.DONE,
          docTag: "certificado_saldos",
        },
        {
          category: TaskCategory.BANCOS,
          title: "Gestionar transferencia de titularidad",
          description: "A nombre de los herederos según escritura.",
          status: TaskStatus.IN_PROGRESS,
          docTag: "transferencia_titularidad_banco",
        },
        {
          category: TaskCategory.SEGUROS,
          title: "Reclamar seguro de vida",
          description: "Póliza Mapfre. Beneficiarios: cónyuge e hijos.",
          status: TaskStatus.READY,
          docTag: "seguro_vida",
        },
        {
          category: TaskCategory.FISCAL,
          title: "Liquidar modelo 650 ISD",
          description: "Autoliquidación dentro de plazo de 6 meses.",
          status: TaskStatus.PENDING,
          docTag: "modelo_650",
        },
      ],
    },
    {
      ref: "EXP-DEMO-0003",
      status: CaseStatus.PENDING_DOCS,
      deathDaysAgo: 125,
      createdDaysAgo: 115,
      province: "Valencia",
      categories: [TaskCategory.BANCOS, TaskCategory.FISCAL, TaskCategory.SUSCRIPCIONES],
      deceased: { fullName: "Rosa Hernández Pardo", dni: "55667788D" },
      contact: {
        fullName: "Daniel Hernández",
        email: "daniel.h@example.com",
        phone: "+34 633 445 566",
        relationship: "Hijo",
      },
      notes:
        "Familia lenta aportando documentación. Portal abierto y usado (ha subido 2 documentos).",
      tasks: [
        {
          category: TaskCategory.BANCOS,
          title: "Notificar fallecimiento a entidad bancaria",
          description: "Ing Direct - única entidad.",
          status: TaskStatus.DONE,
          docTag: "notificacion_banco",
        },
        {
          category: TaskCategory.BANCOS,
          title: "Gestionar transferencia de titularidad",
          description: "Pendiente aceptación de herencia notarial.",
          status: TaskStatus.BLOCKED,
          docTag: "transferencia_titularidad_banco",
        },
        {
          category: TaskCategory.FISCAL,
          title: "Preparar documentación fiscal",
          description: "Inventario completo y valoraciones inmuebles.",
          status: TaskStatus.IN_PROGRESS,
          docTag: "doc_fiscal",
        },
        {
          category: TaskCategory.FISCAL,
          title: "Liquidar modelo 650 ISD",
          description: "Autoliquidación dentro de plazo de 6 meses.",
          status: TaskStatus.PENDING,
          docTag: "modelo_650",
        },
        {
          category: TaskCategory.SUSCRIPCIONES,
          title: "Identificar y cancelar suscripciones activas",
          description: "Netflix, Amazon Prime, El País y gimnasio.",
          status: TaskStatus.READY,
          docTag: "cancelacion_suscripciones",
        },
      ],
    },
    {
      ref: "EXP-DEMO-0004",
      status: CaseStatus.READY_TO_SEND,
      deathDaysAgo: 168,
      createdDaysAgo: 160,
      isUrgent: true,
      hasDeceasedInsurance: true,
      province: "Sevilla",
      categories: [TaskCategory.BANCOS, TaskCategory.FISCAL, TaskCategory.SEGUROS],
      deceased: { fullName: "Antonio Ruiz Vega", dni: "22334455E" },
      contact: {
        fullName: "Isabel Ruiz Castro",
        email: "isabel.ruiz@example.com",
        phone: "+34 644 556 677",
        relationship: "Viuda",
      },
      notes:
        "URGENTE: Modelo 650 a punto de vencer. Toda la documentación recopilada, revisión final antes de presentar.",
      tasks: [
        {
          category: TaskCategory.FISCAL,
          title: "Liquidar modelo 650 ISD",
          description: "Presentar en hacienda autonómica esta semana.",
          status: TaskStatus.READY,
          docTag: "modelo_650",
        },
        {
          category: TaskCategory.BANCOS,
          title: "Gestionar transferencia de titularidad",
          description: "Pendiente tras pago de ISD.",
          status: TaskStatus.APPROVED,
          docTag: "transferencia_titularidad_banco",
        },
        {
          category: TaskCategory.SEGUROS,
          title: "Reclamar seguro de vida",
          description: "Indemnización cobrada. Documentación archivada.",
          status: TaskStatus.DONE,
          docTag: "seguro_vida",
        },
      ],
    },
    {
      ref: "EXP-DEMO-0005",
      status: CaseStatus.SENT,
      deathDaysAgo: 205,
      createdDaysAgo: 195,
      province: "Bilbao",
      categories: [TaskCategory.BANCOS, TaskCategory.FISCAL],
      deceased: { fullName: "Francisco Aguirre Etxebarria", dni: "99887766F" },
      contact: {
        fullName: "Nerea Aguirre López",
        email: "nerea.aguirre@example.com",
        phone: "+34 655 667 788",
        relationship: "Hija",
      },
      notes:
        "Modelo 650 presentado. Seguimiento de transferencias bancarias en curso.",
      tasks: [
        {
          category: TaskCategory.FISCAL,
          title: "Liquidar modelo 650 ISD",
          description: "Presentado. Justificante archivado.",
          status: TaskStatus.DONE,
          docTag: "modelo_650",
        },
        {
          category: TaskCategory.BANCOS,
          title: "Gestionar transferencia de titularidad",
          description: "Kutxabank en curso. BBVA completado.",
          status: TaskStatus.IN_PROGRESS,
          docTag: "transferencia_titularidad_banco",
        },
      ],
    },
    {
      ref: "EXP-DEMO-0006",
      status: CaseStatus.CLOSED,
      deathDaysAgo: 310,
      createdDaysAgo: 300,
      closedDaysAgo: 20,
      province: "Madrid",
      categories: [TaskCategory.BANCOS, TaskCategory.SUMINISTROS, TaskCategory.FISCAL],
      deceased: { fullName: "Elena Sáenz Morán", dni: "33445566G" },
      contact: {
        fullName: "Javier Sáenz",
        email: "javier.saenz@example.com",
        phone: "+34 666 778 899",
        relationship: "Hijo",
      },
      notes: "Cerrado. Expediente completo. Cliente muy satisfecho.",
      tasks: [
        {
          category: TaskCategory.FISCAL,
          title: "Liquidar modelo 650 ISD",
          description: "Completado.",
          status: TaskStatus.DONE,
          docTag: "modelo_650",
        },
        {
          category: TaskCategory.BANCOS,
          title: "Gestionar transferencia de titularidad",
          description: "Completado.",
          status: TaskStatus.DONE,
          docTag: "transferencia_titularidad_banco",
        },
        {
          category: TaskCategory.SUMINISTROS,
          title: "Cambio de titularidad de suministros",
          description: "Completado.",
          status: TaskStatus.DONE,
          docTag: "titularidad_suministros",
        },
      ],
    },
  ];

  for (const spec of specs) {
    const deathDate = daysAgo(spec.deathDaysAgo);
    const createdAt = daysAgo(spec.createdDaysAgo);

    const caseRecord = await prisma.case.create({
      data: {
        orgId: org.id,
        ref: spec.ref,
        status: spec.status,
        isUrgent: spec.isUrgent ?? false,
        hasDeceasedInsurance: spec.hasDeceasedInsurance ?? false,
        categories: spec.categories,
        province: spec.province,
        notes: spec.notes,
        consentAccepted: true,
        consentDate: createdAt,
        createdAt,
        updatedAt: createdAt,
        closedAt: spec.closedDaysAgo != null ? daysAgo(spec.closedDaysAgo) : null,
        deceased: {
          create: { fullName: spec.deceased.fullName, dni: spec.deceased.dni, deathDate },
        },
        contact: { create: spec.contact },
      },
    });

    for (let i = 0; i < spec.tasks.length; i++) {
      const t = spec.tasks[i];
      const { blockedUntil, deadline, blockReason } = calculateTaskDeadlines(
        deathDate,
        t.docTag ?? null,
        t.title
      );
      await prisma.task.create({
        data: {
          caseId: caseRecord.id,
          category: t.category,
          title: t.title,
          description: t.description,
          status: t.status,
          sortOrder: i + 1,
          docTag: t.docTag ?? null,
          blockedUntil: t.status === TaskStatus.BLOCKED ? blockedUntil : null,
          deadline,
          blockReason: t.status === TaskStatus.BLOCKED ? blockReason : null,
          assigneeId: i % 2 === 0 ? admin.id : operator.id,
        },
      });
    }

    console.log(`  Case: ${spec.ref} [${spec.status}] ${spec.deceased.fullName}`);
  }

  // ── Audit log seed (so dashboard "Actividad reciente" isn't empty) ──
  const recentCaseIds = await prisma.case.findMany({
    where: { orgId: org.id, ref: { startsWith: "EXP-DEMO-" } },
    select: { id: true, ref: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  for (const c of recentCaseIds) {
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
  console.log("Login: admin@baritur.com / admin123");
  console.log("       operador@baritur.com / admin123");
  console.log("       viewer@baritur.com / admin123");
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
