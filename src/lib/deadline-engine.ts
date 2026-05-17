/**
 * Deadline & dependency engine for post-death case management.
 * Based on verified Spanish legal deadlines:
 * - 15 business days for Ultimas Voluntades & Seguros certificates
 * - 6 months for ISD (Modelo 650), extendable under conditions
 */

/**
 * Add business days to a date (Mon-Fri only, no holiday calendar).
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/**
 * Add months to a date.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

interface DeadlineRule {
  docTag: string;
  taskTitlePattern: string;
  type: "blocked_until" | "deadline";
  calc: (deathDate: Date) => Date;
  reason: string;
}

/**
 * Rules for date-based blocking and deadlines.
 * Based on verified Spanish legal requirements.
 */
export const DEADLINE_RULES: DeadlineRule[] = [
  // Blocked until 15 business days - Ultimas Voluntades
  {
    docTag: "certificado_defuncion",
    taskTitlePattern: "certificado de defuncion",
    type: "deadline",
    calc: (d) => addBusinessDays(d, 5),
    reason: "Solicitar lo antes posible tras la inscripcion en Registro Civil",
  },
  // Blocked until 15 business days - need certificates first
  {
    docTag: "certificado_saldos",
    taskTitlePattern: "certificado de saldos",
    type: "blocked_until",
    calc: (d) => addBusinessDays(d, 15),
    reason: "Requiere certificado de ultimas voluntades (disponible tras 15 dias habiles)",
  },
  {
    docTag: "notificacion_banco",
    taskTitlePattern: "Notificar fallecimiento a entidad bancaria",
    type: "deadline",
    calc: (d) => addBusinessDays(d, 10),
    reason: "Notificar cuanto antes para evitar movimientos no autorizados",
  },
  {
    docTag: "transferencia_titularidad_banco",
    taskTitlePattern: "transferencia de titularidad",
    type: "blocked_until",
    calc: (d) => addBusinessDays(d, 15),
    reason: "Requiere certificados de ultimas voluntades y aceptacion de herencia",
  },
  {
    docTag: "seguro_vida",
    taskTitlePattern: "seguro de vida",
    type: "blocked_until",
    calc: (d) => addBusinessDays(d, 15),
    reason: "Certificado de seguros de fallecimiento disponible tras 15 dias habiles",
  },
  {
    docTag: "notificacion_seguro",
    taskTitlePattern: "companias de seguros",
    type: "blocked_until",
    calc: (d) => addBusinessDays(d, 15),
    reason: "Certificado de seguros de fallecimiento disponible tras 15 dias habiles",
  },
  // Fiscal deadlines - 6 months
  {
    docTag: "modelo_650",
    taskTitlePattern: "modelo 650",
    type: "deadline",
    calc: (d) => addMonths(d, 6),
    reason: "Plazo legal: 6 meses desde fallecimiento (Modelo 650 ISD)",
  },
  {
    docTag: "doc_fiscal",
    taskTitlePattern: "documentacion fiscal",
    type: "deadline",
    calc: (d) => addMonths(d, 5),
    reason: "Recopilar antes del mes 5 para preparar Modelo 650 a tiempo",
  },
  {
    docTag: "plazos_fiscales",
    taskTitlePattern: "plazos fiscales",
    type: "deadline",
    calc: (d) => addMonths(d, 5),
    reason: "Prorroga de ISD debe solicitarse dentro de los 5 primeros meses",
  },
  // Seguridad Social - urgent
  {
    docTag: "seguridad_social",
    taskTitlePattern: "Seguridad Social",
    type: "deadline",
    calc: (d) => addBusinessDays(d, 30),
    reason: "Comunicar lo antes posible para baja y prestaciones",
  },
  {
    docTag: "pension",
    taskTitlePattern: "pension",
    type: "deadline",
    calc: (d) => addMonths(d, 3),
    reason: "Solicitar pension de viudedad/orfandad; efectos retroactivos limitados",
  },
];

/**
 * Calculate deadlines and blocks for tasks based on death date.
 */
export function calculateTaskDeadlines(
  deathDate: Date,
  docTag: string | null,
  title: string
): { blockedUntil: Date | null; deadline: Date | null; blockReason: string | null } {
  let blockedUntil: Date | null = null;
  let deadline: Date | null = null;
  let blockReason: string | null = null;

  if (!docTag && !title) return { blockedUntil, deadline, blockReason };

  for (const rule of DEADLINE_RULES) {
    const matchesTag = docTag && rule.docTag === docTag;
    const matchesTitle = title.toLowerCase().includes(rule.taskTitlePattern.toLowerCase());

    if (matchesTag || matchesTitle) {
      const date = rule.calc(deathDate);
      if (rule.type === "blocked_until") {
        if (!blockedUntil || date > blockedUntil) {
          blockedUntil = date;
          blockReason = rule.reason;
        }
      } else {
        if (!deadline || date < deadline) {
          deadline = date;
        }
      }
    }
  }

  return { blockedUntil, deadline, blockReason };
}

/**
 * Calculate key case-level deadlines.
 */
export function getCaseDeadlines(deathDate: Date) {
  return {
    certificatesAvailable: addBusinessDays(deathDate, 15),
    isdDeadline: addMonths(deathDate, 6),
    isdExtensionRequestDeadline: addMonths(deathDate, 5),
  };
}

/**
 * Get days remaining until a deadline.
 */
export function daysUntil(deadline: Date): number {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
