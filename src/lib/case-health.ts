/**
 * Health Score del expediente: una puntuacion 0-100 que resume el estado
 * de un expediente de herencia de un vistazo.
 *
 * A diferencia del Radar ISD (que detecta riesgos concretos), el Health
 * Score da una vision agregada: como de "sano" esta el expediente teniendo
 * en cuenta progreso de tareas, presion de plazos, documentacion y
 * completitud de datos.
 *
 * Motor puro y deterministico, sin DB ni IA.
 */

export interface CaseHealthInput {
  /** Total de tareas del expediente. */
  totalTasks: number;
  /** Tareas en estado DONE o SKIPPED. */
  doneTasks: number;
  /** Tareas en estado BLOCKED. */
  blockedTasks: number;
  /** Tareas con deadline en el pasado y no completadas. */
  overdueTasks: number;
  /** Fecha de fallecimiento del causante (null si no consta). */
  deathDate: Date | null;
  /** Provincia del causante (null si no consta). */
  province: string | null;
  /** Nombre del causante presente. */
  hasDeceasedName: boolean;
  /** Datos de contacto del heredero presentes. */
  hasContact: boolean;
  /** Numero de documentos subidos al expediente. */
  documentCount: number;
  /** Fecha de la ultima actualizacion del expediente. */
  lastUpdatedAt: Date | null;
  /** Estado del expediente. */
  status: string;
}

export type HealthGrade = "A" | "B" | "C" | "D" | "E";

export interface HealthFactor {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  /** Mensaje accionable si el factor no esta al maximo. */
  hint: string | null;
}

export interface CaseHealthResult {
  /** Puntuacion total 0-100. */
  score: number;
  /** Grado A (excelente) a E (critico). */
  grade: HealthGrade;
  /** Etiqueta legible del grado. */
  gradeLabel: string;
  /** Desglose por factor. */
  factors: HealthFactor[];
  /** El factor con mas puntos perdidos (lo que mas urge mejorar). */
  topIssue: string | null;
}

const MS_PER_DAY = 86_400_000;

// Pesos de cada factor (suman 100)
const W_PROGRESS = 30;
const W_DEADLINE = 30;
const W_DATA = 20;
const W_DOCS = 10;
const W_RECENCY = 10;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function gradeFor(score: number): { grade: HealthGrade; label: string } {
  if (score >= 85) return { grade: "A", label: "Excelente" };
  if (score >= 70) return { grade: "B", label: "Bueno" };
  if (score >= 50) return { grade: "C", label: "Aceptable" };
  if (score >= 30) return { grade: "D", label: "Necesita atencion" };
  return { grade: "E", label: "Critico" };
}

export function computeCaseHealth(input: CaseHealthInput): CaseHealthResult {
  const factors: HealthFactor[] = [];
  const now = Date.now();

  // ── Factor 1: Progreso de tareas ──────────────────────
  let progressPoints: number;
  let progressHint: string | null = null;
  if (input.totalTasks === 0) {
    // Sin tareas: neutro-bajo, hay que crear el plan
    progressPoints = Math.round(W_PROGRESS * 0.4);
    progressHint = "Aun no hay tareas. Aplica una plantilla para generar el plan de trabajo.";
  } else {
    const completionRate = input.doneTasks / input.totalTasks;
    progressPoints = Math.round(W_PROGRESS * completionRate);
    if (completionRate < 1) {
      const pending = input.totalTasks - input.doneTasks;
      progressHint = `Quedan ${pending} tarea${pending !== 1 ? "s" : ""} por completar.`;
    }
  }
  factors.push({
    key: "progress",
    label: "Progreso de tareas",
    points: progressPoints,
    maxPoints: W_PROGRESS,
    hint: progressHint,
  });

  // ── Factor 2: Salud de plazos ─────────────────────────
  let deadlinePoints = W_DEADLINE;
  let deadlineHint: string | null = null;

  // Penalizacion por tareas vencidas
  if (input.overdueTasks > 0) {
    const penalty = Math.min(W_DEADLINE * 0.6, input.overdueTasks * 6);
    deadlinePoints -= penalty;
    deadlineHint = `${input.overdueTasks} tarea${input.overdueTasks !== 1 ? "s" : ""} con plazo vencido.`;
  }

  // Penalizacion por presion del plazo ISD
  if (input.deathDate) {
    const death = new Date(input.deathDate);
    const isdDeadline = new Date(death.getTime() + 180 * MS_PER_DAY);
    const daysUntilISD = Math.ceil((isdDeadline.getTime() - now) / MS_PER_DAY);
    const isClosed = input.status === "CLOSED" || input.status === "ARCHIVED";

    if (!isClosed) {
      if (daysUntilISD < 0) {
        deadlinePoints -= W_DEADLINE * 0.4;
        deadlineHint = `Plazo del Modelo 650 vencido hace ${Math.abs(daysUntilISD)} dias.`;
      } else if (daysUntilISD <= 30) {
        deadlinePoints -= W_DEADLINE * 0.25;
        if (!deadlineHint) deadlineHint = `Quedan ${daysUntilISD} dias para el plazo del Modelo 650.`;
      } else if (daysUntilISD <= 60) {
        deadlinePoints -= W_DEADLINE * 0.1;
      }
    }
  }

  // Penalizacion por tareas bloqueadas
  if (input.blockedTasks > 0) {
    deadlinePoints -= Math.min(W_DEADLINE * 0.2, input.blockedTasks * 3);
    if (!deadlineHint) {
      deadlineHint = `${input.blockedTasks} tarea${input.blockedTasks !== 1 ? "s" : ""} bloqueada${input.blockedTasks !== 1 ? "s" : ""}.`;
    }
  }

  deadlinePoints = clamp(Math.round(deadlinePoints), 0, W_DEADLINE);
  factors.push({
    key: "deadline",
    label: "Salud de plazos",
    points: deadlinePoints,
    maxPoints: W_DEADLINE,
    hint: deadlineHint,
  });

  // ── Factor 3: Completitud de datos ────────────────────
  let dataPoints = 0;
  const dataMissing: string[] = [];
  if (input.hasDeceasedName) dataPoints += W_DATA * 0.3;
  else dataMissing.push("nombre del causante");
  if (input.deathDate) dataPoints += W_DATA * 0.3;
  else dataMissing.push("fecha de fallecimiento");
  if (input.province) dataPoints += W_DATA * 0.25;
  else dataMissing.push("provincia");
  if (input.hasContact) dataPoints += W_DATA * 0.15;
  else dataMissing.push("datos de contacto");

  factors.push({
    key: "data",
    label: "Completitud de datos",
    points: Math.round(dataPoints),
    maxPoints: W_DATA,
    hint: dataMissing.length > 0 ? `Falta: ${dataMissing.join(", ")}.` : null,
  });

  // ── Factor 4: Documentacion ───────────────────────────
  let docsPoints: number;
  let docsHint: string | null = null;
  if (input.documentCount >= 5) {
    docsPoints = W_DOCS;
  } else if (input.documentCount > 0) {
    docsPoints = Math.round(W_DOCS * (0.4 + 0.12 * input.documentCount));
    docsHint = "Sube los certificados y documentos clave del expediente.";
  } else {
    docsPoints = 0;
    docsHint = "No hay documentos. Solicita los certificados a la familia por el portal.";
  }
  docsPoints = clamp(docsPoints, 0, W_DOCS);
  factors.push({
    key: "docs",
    label: "Documentacion",
    points: docsPoints,
    maxPoints: W_DOCS,
    hint: docsHint,
  });

  // ── Factor 5: Actividad reciente ──────────────────────
  let recencyPoints = W_RECENCY;
  let recencyHint: string | null = null;
  if (input.lastUpdatedAt) {
    const daysSinceUpdate = Math.floor((now - new Date(input.lastUpdatedAt).getTime()) / MS_PER_DAY);
    if (daysSinceUpdate > 30) {
      recencyPoints = 0;
      recencyHint = `Sin actividad desde hace ${daysSinceUpdate} dias.`;
    } else if (daysSinceUpdate > 14) {
      recencyPoints = Math.round(W_RECENCY * 0.5);
      recencyHint = `Ultima actividad hace ${daysSinceUpdate} dias.`;
    }
  }
  factors.push({
    key: "recency",
    label: "Actividad reciente",
    points: recencyPoints,
    maxPoints: W_RECENCY,
    hint: recencyHint,
  });

  // ── Score total ───────────────────────────────────────
  const score = clamp(
    factors.reduce((sum, f) => sum + f.points, 0),
    0,
    100
  );
  const { grade, label } = gradeFor(score);

  // topIssue: factor con mas puntos perdidos que tenga hint
  const withLoss = factors
    .map((f) => ({ f, loss: f.maxPoints - f.points }))
    .filter((x) => x.loss > 0 && x.f.hint)
    .sort((a, b) => b.loss - a.loss);

  return {
    score,
    grade,
    gradeLabel: label,
    factors,
    topIssue: withLoss.length > 0 ? withLoss[0].f.hint : null,
  };
}
