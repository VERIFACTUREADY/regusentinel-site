/**
 * Cola de acciones a nivel de organizacion.
 *
 * Para cada expediente activo calcula su "siguiente accion recomendada"
 * (via next-action) y devuelve la lista ordenada por urgencia. Es el
 * "plan del dia" del gestor: que necesita cada expediente, de un vistazo.
 *
 * Se separa la parte pura (buildActionQueue) de la de acceso a datos
 * (getOrgActionQueue) para poder testear la logica sin DB.
 */

import { prisma } from "./prisma";
import { detectISDRisks } from "./isd-risk-detector";
import { computeNextAction, type NextAction, type NextActionTask } from "./next-action";

export interface QueueCaseInput {
  caseId: string;
  caseRef: string;
  deceasedName: string | null;
  caseStatus: string;
  province: string | null;
  deathDate: Date | null;
  tasks: NextActionTask[];
  /** Inmueble urbano declarado en el caudal — alimenta riesgos IIVTNU. */
  hasUrbanProperty?: boolean;
  propertyAcquisitionValue?: number | null;
  propertyTransmissionValue?: number | null;
  /** Patrimonio preexistente del heredero — alimenta tramos del coeficiente. */
  preexistingPatrimony?: number | null;
}

export interface ActionQueueItem {
  caseId: string;
  caseRef: string;
  deceasedName: string | null;
  action: NextAction;
}

export interface ActionQueueResult {
  items: ActionQueueItem[];
  totalCases: number;
  countsByUrgency: { critical: number; high: number; medium: number; low: number };
}

const URGENCY_RANK: Record<NextAction["urgency"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

/**
 * Parte pura: dada la lista de expedientes con sus datos, calcula la
 * siguiente accion de cada uno y los ordena por urgencia.
 */
export function buildActionQueue(cases: QueueCaseInput[], limit = 8): ActionQueueResult {
  const items: ActionQueueItem[] = [];
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const c of cases) {
    const risks = detectISDRisks({
      deathDate: c.deathDate,
      province: c.province,
      hasUrbanProperty: c.hasUrbanProperty,
      propertyAcquisitionValue: c.propertyAcquisitionValue,
      propertyTransmissionValue: c.propertyTransmissionValue,
      preexistingPatrimony: c.preexistingPatrimony,
    });

    const action = computeNextAction({
      caseStatus: c.caseStatus,
      risks: risks.map((r) => ({ id: r.id, severity: r.severity, title: r.title })),
      tasks: c.tasks,
    });

    // No incluimos expedientes sin accion pendiente (urgency "none")
    if (action.urgency === "none") continue;

    if (action.urgency in counts) {
      counts[action.urgency as keyof typeof counts]++;
    }

    items.push({
      caseId: c.caseId,
      caseRef: c.caseRef,
      deceasedName: c.deceasedName,
      action,
    });
  }

  items.sort((a, b) => URGENCY_RANK[a.action.urgency] - URGENCY_RANK[b.action.urgency]);

  return {
    items: items.slice(0, limit),
    totalCases: cases.length,
    countsByUrgency: counts,
  };
}

/**
 * Acceso a datos: carga los expedientes activos de la organizacion con
 * sus tareas y construye la cola.
 */
export async function getOrgActionQueue(orgId: string, limit = 8): Promise<ActionQueueResult> {
  const cases = await prisma.case.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
    },
    select: {
      id: true,
      ref: true,
      status: true,
      province: true,
      hasUrbanProperty: true,
      propertyAcquisitionValue: true,
      propertyTransmissionValue: true,
      preexistingPatrimony: true,
      deceased: { select: { fullName: true, deathDate: true } },
      tasks: {
        select: { id: true, title: true, status: true, deadline: true, dueDate: true, blockReason: true },
      },
    },
  });

  const queueInput: QueueCaseInput[] = cases.map((c) => ({
    caseId: c.id,
    caseRef: c.ref,
    deceasedName: c.deceased?.fullName ?? null,
    caseStatus: c.status,
    province: c.province,
    deathDate: c.deceased?.deathDate ?? null,
    hasUrbanProperty: c.hasUrbanProperty,
    propertyAcquisitionValue: c.propertyAcquisitionValue,
    propertyTransmissionValue: c.propertyTransmissionValue,
    preexistingPatrimony: c.preexistingPatrimony,
    tasks: c.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as NextActionTask["status"],
      deadline: t.deadline ?? t.dueDate ?? null,
      blockReason: t.blockReason,
    })),
  }));

  return buildActionQueue(queueInput, limit);
}
