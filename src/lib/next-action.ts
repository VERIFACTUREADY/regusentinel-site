/**
 * Motor de "siguiente accion recomendada" para un expediente.
 *
 * Sintetiza el estado del expediente (riesgos ISD, tareas, plazos) en
 * UNA sola instruccion clara y priorizada: lo siguiente que hay que hacer.
 *
 * Convierte un panel lleno de informacion en una decision. Motor puro,
 * deterministico, testeable sin DB.
 */

export type NextActionUrgency = "critical" | "high" | "medium" | "low" | "none";

export interface NextActionTask {
  id: string;
  title: string;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "BLOCKED" | "READY";
  /** Fecha limite efectiva (deadline ?? dueDate). */
  deadline: Date | string | null;
  blockReason?: string | null;
}

export interface NextActionRisk {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
}

export interface NextActionInput {
  caseStatus: string;
  risks: NextActionRisk[];
  tasks: NextActionTask[];
}

export interface NextAction {
  /** Instruccion principal, imperativa y concreta. */
  action: string;
  /** Por que es lo siguiente (contexto breve). */
  reason: string;
  urgency: NextActionUrgency;
  /** Id de la tarea relacionada, si aplica. */
  relatedTaskId: string | null;
}

const MS_PER_DAY = 86_400_000;

function effectiveDeadline(task: NextActionTask): Date | null {
  if (!task.deadline) return null;
  const d = typeof task.deadline === "string" ? new Date(task.deadline) : task.deadline;
  return isNaN(d.getTime()) ? null : d;
}

function isOpen(task: NextActionTask): boolean {
  return task.status !== "DONE" && task.status !== "SKIPPED";
}

export function computeNextAction(input: NextActionInput): NextAction {
  const now = Date.now();
  const closed = input.caseStatus === "CLOSED" || input.caseStatus === "ARCHIVED";

  if (closed) {
    return {
      action: "Expediente cerrado",
      reason: "No hay acciones pendientes. El expediente esta archivado.",
      urgency: "none",
      relatedTaskId: null,
    };
  }

  // ── 1. ISD vencido (riesgo critico de plazo) ──────────
  const isdOverdue = input.risks.find((r) => r.id === "isd_overdue");
  if (isdOverdue) {
    return {
      action: "Presentar el Modelo 650 de inmediato",
      reason: "El plazo del Impuesto de Sucesiones esta vencido. Cada dia de retraso aumenta el recargo.",
      urgency: "critical",
      relatedTaskId: null,
    };
  }

  // ── 2. ISD critico (<= 7 dias) ────────────────────────
  const isdCritical = input.risks.find((r) => r.id === "isd_critical");
  if (isdCritical) {
    return {
      action: "Presentar el Modelo 650 esta semana",
      reason: isdCritical.title,
      urgency: "critical",
      relatedTaskId: null,
    };
  }

  // ── 3. Tareas vencidas ────────────────────────────────
  const overdueTasks = input.tasks
    .filter((t) => {
      if (!isOpen(t)) return false;
      const dl = effectiveDeadline(t);
      return dl != null && dl.getTime() < now;
    })
    .sort((a, b) => {
      const da = effectiveDeadline(a)!.getTime();
      const db = effectiveDeadline(b)!.getTime();
      return da - db; // la mas vencida primero
    });

  if (overdueTasks.length > 0) {
    const t = overdueTasks[0];
    const daysOverdue = Math.floor((now - effectiveDeadline(t)!.getTime()) / MS_PER_DAY);
    const extra = overdueTasks.length > 1 ? ` (y ${overdueTasks.length - 1} mas)` : "";
    return {
      action: `Completar: ${t.title}`,
      reason: `Tarea vencida hace ${daysOverdue} dia${daysOverdue !== 1 ? "s" : ""}${extra}.`,
      urgency: "high",
      relatedTaskId: t.id,
    };
  }

  // ── 4. Ventana de prorroga cerrandose ─────────────────
  const extWindow = input.risks.find((r) => r.id === "extension_window_closing");
  if (extWindow) {
    return {
      action: "Valorar la solicitud de prorroga del ISD",
      reason: extWindow.title,
      urgency: "high",
      relatedTaskId: null,
    };
  }

  // ── 5. Tareas bloqueadas ──────────────────────────────
  const blockedTasks = input.tasks.filter((t) => t.status === "BLOCKED");
  if (blockedTasks.length > 0) {
    const t = blockedTasks[0];
    return {
      action: `Desbloquear: ${t.title}`,
      reason: t.blockReason
        ? `Bloqueada: ${t.blockReason}`
        : "Hay una tarea bloqueada que frena el avance del expediente.",
      urgency: "medium",
      relatedTaskId: t.id,
    };
  }

  // ── 6. ISD a 30 dias ──────────────────────────────────
  const isd30 = input.risks.find((r) => r.id === "isd_30d");
  if (isd30) {
    return {
      action: "Preparar la presentacion del Modelo 650",
      reason: isd30.title,
      urgency: "high",
      relatedTaskId: null,
    };
  }

  // ── 7. Datos incompletos ──────────────────────────────
  const missingProvince = input.risks.find(
    (r) => r.id === "missing_province" || r.id === "unknown_province"
  );
  if (missingProvince) {
    return {
      action: "Completar la provincia del causante",
      reason: "Sin la provincia no se puede determinar la bonificacion autonomica del ISD.",
      urgency: "medium",
      relatedTaskId: null,
    };
  }

  // ── 8. Proxima tarea con plazo ────────────────────────
  const upcomingTasks = input.tasks
    .filter((t) => isOpen(t) && t.status !== "BLOCKED" && effectiveDeadline(t) != null)
    .sort((a, b) => effectiveDeadline(a)!.getTime() - effectiveDeadline(b)!.getTime());

  if (upcomingTasks.length > 0) {
    const t = upcomingTasks[0];
    const daysUntil = Math.ceil((effectiveDeadline(t)!.getTime() - now) / MS_PER_DAY);
    return {
      action: `Avanzar: ${t.title}`,
      reason: `Proxima tarea con plazo — vence en ${daysUntil} dia${daysUntil !== 1 ? "s" : ""}.`,
      urgency: daysUntil <= 14 ? "medium" : "low",
      relatedTaskId: t.id,
    };
  }

  // ── 9. Tareas sin plazo pendientes ────────────────────
  const anyOpenTask = input.tasks.find((t) => isOpen(t) && t.status !== "BLOCKED");
  if (anyOpenTask) {
    return {
      action: `Avanzar: ${anyOpenTask.title}`,
      reason: "Hay tareas pendientes en el expediente.",
      urgency: "low",
      relatedTaskId: anyOpenTask.id,
    };
  }

  // ── 10. Sin tareas ────────────────────────────────────
  if (input.tasks.length === 0) {
    return {
      action: "Aplicar una plantilla de tareas",
      reason: "El expediente no tiene plan de trabajo. Aplica una plantilla para generarlo.",
      urgency: "medium",
      relatedTaskId: null,
    };
  }

  // ── 11. Todo hecho ────────────────────────────────────
  return {
    action: "Revisar y cerrar el expediente",
    reason: "Todas las tareas estan completadas. Verifica la documentacion y cierra el expediente.",
    urgency: "low",
    relatedTaskId: null,
  };
}
