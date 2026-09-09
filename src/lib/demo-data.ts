/**
 * Demo fixtures. Shared by `prisma/seed.ts` and the daily reset cron so
 * prospects always see a consistent demo environment regardless of what
 * they clicked during the previous session.
 *
 * All cases have `ref` prefixed with `EXP-DEMO-` so `resetDemoCases`
 * can safely wipe them without touching real data.
 */

import { prisma } from "./prisma";
import { CaseStatus, TaskCategory, TaskStatus } from "@prisma/client";
import { calculateTaskDeadlines } from "./deadline-engine";

export const DEMO_ORG_SLUG = "gestoria-demo";
export const DEMO_OWNER_EMAIL = "admin@heredia.app";
export const DEMO_OPERATOR_EMAIL = "operador@heredia.app";
export const DEMO_VIEWER_EMAIL = "viewer@heredia.app";
export const DEMO_PASSWORD = "admin123";

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
  // Datos fiscales opcionales para que algunos casos demo disparen
  // alertas concretas del Radar ISD (plusvalía, patrimonio,
  // residencia, reducciones).
  hasUrbanProperty?: boolean;
  referenciaCatastral?: string;
  propertyAcquisitionValue?: number;
  propertyTransmissionValue?: number;
  preexistingPatrimony?: number;
  recentResidenceChange?: boolean;
  previousResidenceProvince?: string;
  appliedReductions?: Array<{
    type: "VIVIENDA_HABITUAL" | "EMPRESA_FAMILIAR" | "EXPLOTACION_AGRARIA" | "DISCAPACIDAD" | "OTRA";
    appliedDate: string;
    maintenanceYears: number;
    note?: string;
  }>;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

export const DEMO_CASE_SPECS: CaseSpec[] = [
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
      "Expediente recién abierto. Pendiente validar documentación y abrir portal familia.",
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
    // Caso con reducción a vigilar + cambio de residencia
    hasUrbanProperty: true,
    referenciaCatastral: "1234567CS5213N0001ML",
    appliedReductions: [
      {
        type: "EMPRESA_FAMILIAR",
        appliedDate: (() => {
          // Aniversario en ~20 días (10 años desde hoy - 20 días)
          const d = new Date();
          d.setFullYear(d.getFullYear() - 10);
          d.setDate(d.getDate() + 20);
          return d.toISOString().slice(0, 10);
        })(),
        maintenanceYears: 10,
        note: "Participaciones en empresa familiar — vigilar mantenimiento",
      },
    ],
    recentResidenceChange: true,
    previousResidenceProvince: "asturias",
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
      "Familia lenta aportando documentación. Portal abierto y en uso (2 documentos subidos).",
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
      "URGENTE: Modelo 650 vence esta semana. Revisión final antes de presentar.",
    // Caso crítico con varias alertas Radar activas
    hasUrbanProperty: true,
    referenciaCatastral: "9872023VH5797S0001WX",
    propertyAcquisitionValue: 245000,
    propertyTransmissionValue: 220000, // no-incremento → IIVTNU no sujeta
    preexistingPatrimony: 410000, // cerca del tramo 402.678
    recentResidenceChange: false,
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
    notes: "Modelo 650 presentado. Seguimiento de transferencias bancarias en curso.",
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

/**
 * Wipe existing `EXP-DEMO-*` cases and recreate them from `DEMO_CASE_SPECS`.
 * Safe to call repeatedly: only touches rows whose `ref` starts with the
 * demo prefix, so real data is never affected.
 */
export async function resetDemoCases(
  orgId: string,
  ownerUserId: string,
  operatorUserId?: string | null
): Promise<{ created: number }> {
  await prisma.case.deleteMany({
    where: { orgId, ref: { startsWith: "EXP-DEMO-" } },
  });

  let created = 0;
  for (const spec of DEMO_CASE_SPECS) {
    const deathDate = daysAgo(spec.deathDaysAgo);
    const createdAt = daysAgo(spec.createdDaysAgo);

    const caseRecord = await prisma.case.create({
      data: {
        orgId,
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
        hasUrbanProperty: spec.hasUrbanProperty ?? false,
        referenciaCatastral: spec.referenciaCatastral ?? null,
        propertyAcquisitionValue: spec.propertyAcquisitionValue ?? null,
        propertyTransmissionValue: spec.propertyTransmissionValue ?? null,
        preexistingPatrimony: spec.preexistingPatrimony ?? null,
        recentResidenceChange: spec.recentResidenceChange ?? false,
        previousResidenceProvince: spec.previousResidenceProvince ?? null,
        appliedReductions: spec.appliedReductions ?? undefined,
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
          assigneeId: i % 2 === 0 ? ownerUserId : operatorUserId ?? ownerUserId,
        },
      });
    }

    created++;
  }

  return { created };
}
