/**
 * Generador del "Resumen para la familia": convierte el estado tecnico de
 * un expediente en un texto claro, no juridico y tranquilizador para los
 * herederos.
 *
 * Las familias estan angustiadas y quieren saber "como va". Este resumen
 * traduce tareas, estados y plazos a un lenguaje que cualquiera entiende.
 *
 * Motor puro y deterministico (sin DB ni IA): se testea con datos planos.
 */

export interface FamilySummaryTask {
  title: string;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "BLOCKED" | "READY";
}

export interface FamilySummaryInput {
  deceasedName: string | null;
  caseStatus: string;
  deathDate: Date | string | null;
  tasks: FamilySummaryTask[];
  orgName: string;
}

export interface FamilySummarySection {
  heading: string;
  /** Lineas de texto plano. */
  lines: string[];
}

export interface FamilySummary {
  /** Titulo del documento. */
  title: string;
  /** Frase de estado general, calida. */
  statusLine: string;
  /** Porcentaje de avance 0-100. */
  progressPct: number;
  sections: FamilySummarySection[];
  /** Texto de cierre tranquilizador. */
  closing: string;
}

const MS_PER_DAY = 86_400_000;

function isDone(t: FamilySummaryTask): boolean {
  return t.status === "DONE" || t.status === "SKIPPED";
}

function parseDate(d: Date | string | null): Date | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? null : date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function buildFamilySummary(input: FamilySummaryInput): FamilySummary {
  const name = input.deceasedName?.trim() || "su familiar";
  const total = input.tasks.length;
  const done = input.tasks.filter(isDone).length;
  const inProgress = input.tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "READY");
  const pending = input.tasks.filter((t) => t.status === "PENDING" || t.status === "BLOCKED");
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const closed = input.caseStatus === "CLOSED" || input.caseStatus === "ARCHIVED";

  // ── Frase de estado ───────────────────────────────────
  let statusLine: string;
  if (closed) {
    statusLine = `La tramitacion de la herencia de ${name} ha finalizado. Todos los tramites estan completados.`;
  } else if (total === 0) {
    statusLine = `Hemos abierto el expediente de ${name} y estamos preparando el plan de trabajo.`;
  } else if (progressPct >= 80) {
    statusLine = `La tramitacion de la herencia de ${name} esta muy avanzada. Quedan los ultimos detalles.`;
  } else if (progressPct >= 40) {
    statusLine = `La tramitacion de la herencia de ${name} avanza segun lo previsto.`;
  } else {
    statusLine = `Hemos iniciado la tramitacion de la herencia de ${name} y estamos en las primeras gestiones.`;
  }

  const sections: FamilySummarySection[] = [];

  // ── Lo que ya hemos hecho ─────────────────────────────
  const doneTasks = input.tasks.filter(isDone);
  if (doneTasks.length > 0) {
    sections.push({
      heading: "Lo que ya hemos completado",
      lines: doneTasks.map((t) => t.title),
    });
  }

  // ── En lo que trabajamos ahora ────────────────────────
  if (inProgress.length > 0) {
    sections.push({
      heading: "En lo que estamos trabajando ahora",
      lines: inProgress.map((t) => t.title),
    });
  }

  // ── Proximos pasos ────────────────────────────────────
  if (pending.length > 0) {
    sections.push({
      heading: "Proximos pasos",
      lines: pending.map((t) => t.title),
    });
  }

  // ── Plazos importantes ────────────────────────────────
  const death = parseDate(input.deathDate);
  if (death && !closed) {
    const isdDeadline = new Date(death.getTime() + 180 * MS_PER_DAY);
    const daysUntil = Math.ceil((isdDeadline.getTime() - Date.now()) / MS_PER_DAY);
    const plazoLines: string[] = [];
    plazoLines.push(`Fecha de fallecimiento: ${formatDate(death)}`);
    if (daysUntil > 0) {
      plazoLines.push(
        `Plazo para el Impuesto de Sucesiones (Modelo 650): ${formatDate(isdDeadline)} (quedan ${daysUntil} dias).`
      );
    } else {
      plazoLines.push(
        `El plazo ordinario del Impuesto de Sucesiones era el ${formatDate(isdDeadline)}. Estamos gestionando la presentacion.`
      );
    }
    sections.push({ heading: "Plazos importantes", lines: plazoLines });
  }

  // ── Cierre ────────────────────────────────────────────
  const closing = closed
    ? `Gracias por confiar en ${input.orgName}. Quedamos a su disposicion para cualquier consulta posterior.`
    : `Nos encargamos de todos los tramites y le mantendremos informado/a. Si tiene cualquier duda, no dude en contactar con ${input.orgName}: estamos para ayudarle.`;

  return {
    title: `Resumen de la tramitacion — ${name}`,
    statusLine,
    progressPct,
    sections,
    closing,
  };
}
