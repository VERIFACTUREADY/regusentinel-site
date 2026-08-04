/**
 * Deadline & dependency engine for post-death case management.
 * Based on verified Spanish legal deadlines:
 * - 15 business days for Ultimas Voluntades & Seguros certificates
 * - 6 months for ISD (Modelo 650), extendable under conditions
 */

/**
 * Suma dias habiles contando **solo de lunes a viernes, sin calendario de
 * festivos**.
 *
 * No se aplican festivos nacionales, autonomicos ni locales. Los plazos que
 * salen de aqui son por tanto una estimacion optimista: el plazo real puede
 * ser posterior. Cualquier texto de producto debe describirlo asi y no como
 * "calendario laboral" ni "17 calendarios autonomicos".
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
 * Suma meses conservando el ultimo dia del mes cuando el destino es mas corto.
 *
 * `setMonth` desborda: 31-ene + 1 mes da 3 de marzo, porque febrero no tiene
 * 31 dias. Aplicado al plazo de 6 meses del ISD, un fallecimiento el 31 de
 * agosto daba como plazo el 3 de marzo en vez del 28 de febrero: **tres dias
 * de mas en un plazo legal**, justo en el sentido peligroso.
 *
 * El criterio del art. 67 RISD (de fecha a fecha, y si no existe el dia
 * equivalente, el ultimo del mes) se implementa fijando el dia 1 antes de
 * mover el mes y recortando despues al ultimo dia disponible.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();

  result.setDate(Math.min(day, lastDayOfTargetMonth));
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
/**
 * Plazos legales del expediente. FUENTE UNICA: cualquier modulo que necesite
 * el plazo del ISD debe llamar aqui.
 *
 * Antes habia calculos duplicados por todo el codigo — `setMonth(+6)` suelto,
 * `180 * 24 * 60 * 60 * 1000` como aproximacion de seis meses, `22` dias
 * naturales — que daban resultados distintos entre si para el mismo caso.
 */
export const ISD_DEADLINE_MONTHS = 6;
export const ISD_EXTENSION_REQUEST_MONTHS = 5;
export const CERTIFICATES_BUSINESS_DAYS = 15;

export function getCaseDeadlines(deathDate: Date) {
  return {
    certificatesAvailable: addBusinessDays(deathDate, CERTIFICATES_BUSINESS_DAYS),
    isdDeadline: isdDeadlineFor(deathDate),
    isdExtensionRequestDeadline: isdExtensionRequestDeadlineFor(deathDate),
  };
}

/** Plazo de presentacion del ISD: 6 meses desde el fallecimiento. */
export function isdDeadlineFor(deathDate: Date): Date {
  return addMonths(deathDate, ISD_DEADLINE_MONTHS);
}

/**
 * Ultimo dia para SOLICITAR la prorroga: dentro de los 5 primeros meses.
 * Pasado ese plazo, la prorroga ya no se puede pedir.
 */
export function isdExtensionRequestDeadlineFor(deathDate: Date): Date {
  return addMonths(deathDate, ISD_EXTENSION_REQUEST_MONTHS);
}

/**
 * ¿Sigue siendo posible solicitar la prorroga del ISD?
 *
 * Existe porque el producto recomendaba solicitarla tambien cuando el plazo
 * para pedirla ya habia vencido: un consejo que no se puede seguir.
 */
export function canStillRequestIsdExtension(deathDate: Date, now: Date = new Date()): boolean {
  return now.getTime() <= isdExtensionRequestDeadlineFor(deathDate).getTime();
}

/**
 * Get days remaining until a deadline.
 */
export function daysUntil(deadline: Date): number {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
