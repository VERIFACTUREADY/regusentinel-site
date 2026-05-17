/**
 * Sembrador de expediente de ejemplo para nuevos despachos.
 *
 * A diferencia del demo-data (que genera 5 expedientes para la org publica
 * de demo), este sembrador crea UN expediente realista en cualquier org
 * para que un trial recien creado vea el producto funcionando con datos
 * verosimiles sin tener que rellenar nada.
 *
 * El expediente sembrado:
 *   - Causante con datos completos (DNI, fecha de fallecimiento)
 *   - Heredero con datos de contacto
 *   - Provincia de Madrid (CCAA con bonificacion 99%)
 *   - Fecha de fallecimiento hace 90 dias (asi el plazo ISD esta activo)
 *   - 10 tareas precargadas con deadlines reales
 *   - Categorias y notas que disparan riesgos del Radar ISD
 *
 * Idempotente: si ya existe un expediente con ref "EXP-EJEMPLO" lo omite.
 */

import type { Prisma } from "@prisma/client";

interface SampleCaseSeederResult {
  caseId: string | null;
  caseRef: string;
  created: boolean;
}

const SAMPLE_REF = "EXP-EJEMPLO";

type TaskCategory = "BANCOS" | "SUMINISTROS" | "TELECOM" | "SUSCRIPCIONES" | "SEGUROS" | "VIDA_DIGITAL" | "FISCAL" | "OTROS";

interface TaskSeed {
  title: string;
  description: string;
  category: TaskCategory;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  deadlineOffsetDays: number;
}

const SAMPLE_TASKS: TaskSeed[] = [
  {
    title: "Solicitar Certificado Literal de Defuncion",
    description: "Original para Hacienda + 3 copias para bancos y aseguradoras.",
    category: "OTROS",
    status: "DONE",
    deadlineOffsetDays: -85,
  },
  {
    title: "Solicitar Certificado de Ultimas Voluntades",
    description: "Modelo 790-006. Plazo de espera 15 dias habiles desde el fallecimiento.",
    category: "OTROS",
    status: "DONE",
    deadlineOffsetDays: -75,
  },
  {
    title: "Solicitar RCSV (Registro Contratos Seguros Vida)",
    description: "Modelo 790-006 simultaneo al CUV. Imprescindible para detectar polizas.",
    category: "OTROS",
    status: "DONE",
    deadlineOffsetDays: -75,
  },
  {
    title: "Bloquear cuentas y solicitar saldos a fecha de fallecimiento",
    description: "Banco Santander (cuenta principal) + BBVA (deposito). Carta enviada el 15/03.",
    category: "BANCOS",
    status: "DONE",
    deadlineOffsetDays: -70,
  },
  {
    title: "Recopilar tasacion de la vivienda habitual",
    description: "C/ Mayor 1, 3B Madrid. Tasacion oficial pendiente. Valor de Referencia Catastral: 245.000 €.",
    category: "OTROS",
    status: "IN_PROGRESS",
    deadlineOffsetDays: 15,
  },
  {
    title: "Tramitar seguro de vida con MAPFRE",
    description: "Capital asegurado 30.000 €. Documentacion en curso. Plazo aseguradora: 40 dias desde recepcion completa.",
    category: "SEGUROS",
    status: "IN_PROGRESS",
    deadlineOffsetDays: 20,
  },
  {
    title: "Cambiar titularidad de luz y gas",
    description: "Iberdrola + Naturgy. Pendiente de DNI del nuevo titular.",
    category: "SUMINISTROS",
    status: "PENDING",
    deadlineOffsetDays: 30,
  },
  {
    title: "Comunicar fallecimiento a comunidad de propietarios",
    description: "Administrador: Fincas Garcia. Cuotas pendientes: 0 €.",
    category: "OTROS",
    status: "PENDING",
    deadlineOffsetDays: 30,
  },
  {
    title: "Preparar borrador del Modelo 650 (ISD)",
    description: "CCAA Madrid (bonificacion 99% grupo II). Pendiente de tasaciones para cerrar caudal.",
    category: "FISCAL",
    status: "BLOCKED",
    deadlineOffsetDays: 90,
  },
  {
    title: "Presentar Modelo 650 antes del plazo legal",
    description: "Plazo limite ordinario: 6 meses desde el fallecimiento.",
    category: "FISCAL",
    status: "PENDING",
    deadlineOffsetDays: 90,
  },
];

export async function seedSampleCase(
  tx: Prisma.TransactionClient,
  orgId: string
): Promise<SampleCaseSeederResult> {
  // Idempotente: si existe ya, devolver sin crear
  const existing = await tx.case.findFirst({
    where: { orgId, ref: SAMPLE_REF, deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    return { caseId: existing.id, caseRef: SAMPLE_REF, created: false };
  }

  const now = new Date();
  const deathDate = new Date(now);
  deathDate.setDate(deathDate.getDate() - 90);

  const createdAt = new Date(deathDate);
  createdAt.setDate(createdAt.getDate() + 3);

  const caseRecord = await tx.case.create({
    data: {
      orgId,
      ref: SAMPLE_REF,
      status: "INTAKE",
      isUrgent: false,
      hasDeceasedInsurance: true,
      categories: ["BANCOS", "SEGUROS", "FISCAL"],
      province: "madrid",
      notes: "Expediente de ejemplo precargado por BARITUR PRO. Puedes editarlo o eliminarlo cuando quieras.",
      consentAccepted: true,
      consentDate: createdAt,
      createdAt,
      updatedAt: createdAt,
      deceased: {
        create: {
          fullName: "Maria Garcia Lopez",
          dni: "12345678A",
          deathDate,
        },
      },
      contact: {
        create: {
          fullName: "Antonio Garcia Perez",
          phone: "+34 600 123 456",
          email: "antonio.garcia.ejemplo@example.com",
          relationship: "Hijo",
        },
      },
    },
  });

  // Crear tareas con sus deadlines
  for (let i = 0; i < SAMPLE_TASKS.length; i++) {
    const t = SAMPLE_TASKS[i];
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + t.deadlineOffsetDays);

    await tx.task.create({
      data: {
        caseId: caseRecord.id,
        category: t.category,
        title: t.title,
        description: t.description,
        status: t.status,
        sortOrder: i,
        deadline,
        dueDate: deadline,
      },
    });
  }

  return { caseId: caseRecord.id, caseRef: SAMPLE_REF, created: true };
}
