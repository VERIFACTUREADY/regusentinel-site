/**
 * Generador de guia personalizada de tramites post-fallecimiento.
 *
 * A partir de unas pocas respuestas del usuario (fecha de fallecimiento,
 * CCAA, si hay testamento, inmuebles, seguros, vehiculos, negocio),
 * produce una linea de tiempo ordenada de tramites con su plazo concreto,
 * urgencia y explicacion.
 *
 * Es un motor puro y deterministico: la misma entrada produce la misma
 * guia. Se usa en la pagina publica /guia-fallecimiento (lead magnet) y
 * puede reutilizarse dentro del producto.
 */

export interface GuideInput {
  /** Fecha del fallecimiento (ISO o Date). Null = desconocida. */
  deathDate: Date | null;
  /** Provincia / CCAA del causante (string libre). */
  province: string | null;
  /** Hay testamento conocido. */
  hasWill: boolean;
  /** Hay bienes inmuebles en la herencia. */
  hasRealEstate: boolean;
  /** El causante tenia seguros de vida. */
  hasLifeInsurance: boolean;
  /** Hay vehiculos a nombre del causante. */
  hasVehicles: boolean;
  /** El causante era titular de un negocio o empresa. */
  hasBusiness: boolean;
}

export type GuideUrgency = "overdue" | "now" | "soon" | "later";

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  /** Fase relativa al fallecimiento. */
  phase: "inmediato" | "primera-semana" | "primer-mes" | "meses-2-5" | "antes-6-meses" | "posterior";
  /** Dias desde el fallecimiento en que vence (null = sin plazo estricto). */
  deadlineDays: number | null;
  /** Fecha limite calculada si deathDate esta disponible. */
  deadlineDate: Date | null;
  /** Urgencia derivada de la fecha. */
  urgency: GuideUrgency;
  /** Categoria para agrupar / iconos. */
  category: "certificados" | "banca" | "fiscal" | "seguros" | "inmuebles" | "vehiculos" | "negocio" | "administrativo";
}

const MS_PER_DAY = 86_400_000;

interface StepTemplate {
  id: string;
  title: string;
  description: string;
  phase: GuideStep["phase"];
  deadlineDays: number | null;
  category: GuideStep["category"];
  /** Condicion para incluir el paso. */
  applies?: (input: GuideInput) => boolean;
}

const STEP_TEMPLATES: StepTemplate[] = [
  {
    id: "certificado-defuncion",
    title: "Solicitar el Certificado Literal de Defunción",
    description: "Pide varias copias en el Registro Civil: las necesitarás para bancos, aseguradoras y Hacienda. La funeraria suele iniciar este trámite.",
    phase: "inmediato",
    deadlineDays: 7,
    category: "certificados",
  },
  {
    id: "seguro-decesos",
    title: "Comprobar si existe seguro de decesos",
    description: "Muchas personas tienen un seguro de decesos que cubre los gastos del sepelio. Revisa documentación del causante y consúltalo con la funeraria.",
    phase: "inmediato",
    deadlineDays: 3,
    category: "seguros",
  },
  {
    id: "bloqueo-cuentas",
    title: "Comunicar el fallecimiento a los bancos",
    description: "Los bancos bloquean las cuentas del titular fallecido. Solicita el certificado de saldos a fecha de fallecimiento: lo necesitarás para el Impuesto de Sucesiones.",
    phase: "primera-semana",
    deadlineDays: 14,
    category: "banca",
  },
  {
    id: "baja-seguridad-social",
    title: "Comunicar a la Seguridad Social y solicitar prestaciones",
    description: "Si el causante cobraba pensión, hay que comunicar la baja. Comprueba si procede el auxilio por defunción o una pensión de viudedad/orfandad.",
    phase: "primera-semana",
    deadlineDays: 30,
    category: "administrativo",
  },
  {
    id: "ultimas-voluntades",
    title: "Solicitar el Certificado de Últimas Voluntades",
    description: "Acredita si el causante otorgó testamento y ante qué notario. Se solicita con el Modelo 790-006 a partir de 15 días hábiles desde el fallecimiento.",
    phase: "primer-mes",
    deadlineDays: 25,
    category: "certificados",
  },
  {
    id: "rcsv",
    title: "Solicitar el Certificado de Seguros de Vida (RCSV)",
    description: "Informa de los seguros de vida que tenía contratados el causante. Mismo modelo y plazo que el de Últimas Voluntades.",
    phase: "primer-mes",
    deadlineDays: 25,
    category: "seguros",
  },
  {
    id: "copia-testamento",
    title: "Pedir copia autorizada del testamento",
    description: "Con el Certificado de Últimas Voluntades, solicita al notario indicado la copia del testamento.",
    phase: "primer-mes",
    deadlineDays: 40,
    category: "certificados",
    applies: (i) => i.hasWill,
  },
  {
    id: "declaracion-herederos",
    title: "Iniciar la declaración de herederos abintestato",
    description: "Si no hay testamento, hay que tramitar un acta notarial de declaración de herederos legales antes de poder repartir la herencia.",
    phase: "primer-mes",
    deadlineDays: 45,
    category: "certificados",
    applies: (i) => !i.hasWill,
  },
  {
    id: "reclamar-seguros",
    title: "Reclamar el capital de los seguros de vida",
    description: "Contacta con cada aseguradora identificada en el RCSV. Presenta la declaración de siniestro. La aseguradora tiene 40 días para pagar el capital.",
    phase: "meses-2-5",
    deadlineDays: 90,
    category: "seguros",
    applies: (i) => i.hasLifeInsurance,
  },
  {
    id: "tasacion-inmuebles",
    title: "Valorar y tasar los inmuebles",
    description: "Comprueba el Valor de Referencia del Catastro de cada inmueble. Si es superior al de mercado, una tasación oficial puede ahorrar impuestos.",
    phase: "meses-2-5",
    deadlineDays: 100,
    category: "inmuebles",
    applies: (i) => i.hasRealEstate,
  },
  {
    id: "valoracion-negocio",
    title: "Valorar el negocio o las participaciones",
    description: "Si el causante tenía una empresa, hay que valorarla. Comprueba si aplica la reducción del 95% por empresa familiar en el ISD.",
    phase: "meses-2-5",
    deadlineDays: 110,
    category: "negocio",
    applies: (i) => i.hasBusiness,
  },
  {
    id: "solicitar-prorroga",
    title: "Valorar solicitar la prórroga del Impuesto de Sucesiones",
    description: "Si la documentación no estará lista en 6 meses, se puede pedir una prórroga de otros 6 meses. Pero hay que solicitarla ANTES del 5º mes.",
    phase: "meses-2-5",
    deadlineDays: 150,
    category: "fiscal",
  },
  {
    id: "escritura-aceptacion",
    title: "Otorgar la escritura de aceptación y partición de herencia",
    description: "Ante notario, los herederos aceptan y reparten la herencia. Necesario para inscribir los bienes a su nombre.",
    phase: "meses-2-5",
    deadlineDays: 160,
    category: "certificados",
  },
  {
    id: "modelo-650",
    title: "Presentar el Modelo 650 (Impuesto sobre Sucesiones)",
    description: "Plazo legal: 6 meses desde el fallecimiento. Es el trámite fiscal central. Fuera de plazo hay recargos del 5% al 20%.",
    phase: "antes-6-meses",
    deadlineDays: 180,
    category: "fiscal",
  },
  {
    id: "plusvalia-municipal",
    title: "Presentar la Plusvalía municipal",
    description: "Por cada inmueble urbano heredado, hay que liquidar la plusvalía municipal en el ayuntamiento. Plazo: 6 meses, prorrogable a 1 año.",
    phase: "antes-6-meses",
    deadlineDays: 180,
    category: "inmuebles",
    applies: (i) => i.hasRealEstate,
  },
  {
    id: "cambio-titularidad-inmuebles",
    title: "Inscribir los inmuebles en el Registro de la Propiedad",
    description: "Con la escritura de aceptación y el Modelo 650 pagado, inscribe los inmuebles a nombre de los herederos.",
    phase: "posterior",
    deadlineDays: 240,
    category: "inmuebles",
    applies: (i) => i.hasRealEstate,
  },
  {
    id: "cambio-titularidad-vehiculos",
    title: "Cambiar la titularidad de los vehículos",
    description: "En la Jefatura Provincial de Tráfico. Necesitarás el Modelo 650, la escritura de aceptación y la documentación del vehículo.",
    phase: "posterior",
    deadlineDays: 240,
    category: "vehiculos",
    applies: (i) => i.hasVehicles,
  },
  {
    id: "cambio-suministros",
    title: "Cambiar titularidad de suministros y servicios",
    description: "Luz, gas, agua, telecomunicaciones, comunidad de propietarios. El cambio por mortis causa suele ser gratuito y sin penalización.",
    phase: "posterior",
    deadlineDays: 240,
    category: "administrativo",
  },
];

function urgencyFor(deadlineDays: number | null, daysSinceDeath: number | null): GuideUrgency {
  if (deadlineDays === null || daysSinceDeath === null) return "later";
  const remaining = deadlineDays - daysSinceDeath;
  if (remaining < 0) return "overdue";
  if (remaining <= 14) return "now";
  if (remaining <= 45) return "soon";
  return "later";
}

export function buildPostMortemGuide(input: GuideInput): GuideStep[] {
  const death = input.deathDate ? new Date(input.deathDate) : null;
  const daysSinceDeath = death
    ? Math.floor((Date.now() - death.getTime()) / MS_PER_DAY)
    : null;

  const steps: GuideStep[] = [];

  for (const tpl of STEP_TEMPLATES) {
    if (tpl.applies && !tpl.applies(input)) continue;

    const deadlineDate =
      death && tpl.deadlineDays != null
        ? new Date(death.getTime() + tpl.deadlineDays * MS_PER_DAY)
        : null;

    steps.push({
      id: tpl.id,
      title: tpl.title,
      description: tpl.description,
      phase: tpl.phase,
      deadlineDays: tpl.deadlineDays,
      deadlineDate,
      urgency: urgencyFor(tpl.deadlineDays, daysSinceDeath),
      category: tpl.category,
    });
  }

  // Orden: por deadlineDays asc (null al final)
  steps.sort((a, b) => {
    if (a.deadlineDays == null) return 1;
    if (b.deadlineDays == null) return -1;
    return a.deadlineDays - b.deadlineDays;
  });

  return steps;
}

export interface GuideSummary {
  totalSteps: number;
  overdue: number;
  now: number;
  soon: number;
  /** Dias restantes para el plazo del Modelo 650, si se conoce. */
  daysUntilISD: number | null;
}

export function summarizeGuide(steps: GuideStep[], input: GuideInput): GuideSummary {
  const death = input.deathDate ? new Date(input.deathDate) : null;
  let daysUntilISD: number | null = null;
  if (death) {
    const isdDeadline = new Date(death.getTime() + 180 * MS_PER_DAY);
    daysUntilISD = Math.ceil((isdDeadline.getTime() - Date.now()) / MS_PER_DAY);
  }

  return {
    totalSteps: steps.length,
    overdue: steps.filter((s) => s.urgency === "overdue").length,
    now: steps.filter((s) => s.urgency === "now").length,
    soon: steps.filter((s) => s.urgency === "soon").length,
    daysUntilISD,
  };
}

export const PHASE_LABELS: Record<GuideStep["phase"], string> = {
  inmediato: "Primeras 72 horas",
  "primera-semana": "Primera semana",
  "primer-mes": "Primer mes",
  "meses-2-5": "Meses 2 a 5",
  "antes-6-meses": "Antes del 6º mes",
  posterior: "Tras la liquidación",
};
