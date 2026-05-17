/**
 * Modelo de calculo de ROI para gestorias y funerarias que evaluan BARITUR PRO.
 *
 * Premisa: el ahorro nace de tres ejes
 *   1. Tareas administrativas que ya no se hacen a mano (recordatorios, plazos,
 *      seguimiento documental, redaccion de mails).
 *   2. Errores evitados (perdida de bonificacion, recargos por presentacion
 *      tardia, reclamaciones del cliente).
 *   3. Capacidad recuperada del equipo (mas expedientes con la misma plantilla).
 *
 * No es asesoramiento financiero. Cifras parametrizadas y conservadoras.
 */

export interface ROIInputs {
  /** Expedientes activos al mes */
  expedientesPorMes: number;
  /** Horas que el equipo dedica a cada expediente actualmente */
  horasPorExpediente: number;
  /** Coste/hora del equipo (con cargas sociales) */
  costeHora: number;
  /** Plan elegido: INICIA, DESPACHO o FIRMA */
  plan: "INICIA" | "DESPACHO" | "FIRMA";
}

export interface ROIResult {
  /** Coste mensual del plan */
  costePlanMensual: number;
  /** Horas que BARITUR PRO ahorra por expediente (estimacion conservadora) */
  horasAhorradasPorExpediente: number;
  /** Total horas ahorradas al mes */
  horasAhorradasMes: number;
  /** Equivalente en euros del ahorro de horas al mes */
  ahorroHorasMensual: number;
  /** Estimacion de errores evitados al mes (recargos, perdida de bonif) */
  ahorroErroresMensual: number;
  /** Ahorro total mensual */
  ahorroTotalMensual: number;
  /** Ahorro neto mes (despues de pagar el plan) */
  ahorroNetoMensual: number;
  /** Ahorro neto anual */
  ahorroNetoAnual: number;
  /** Multiplicador del ROI: (ahorroNeto + costePlan) / costePlan */
  multiplicador: number;
  /** Tiempo en meses para pagar el plan */
  paybackMeses: number;
  /** Capacidad extra de expedientes con las horas liberadas */
  expedientesExtraEquivalentes: number;
}

const PLANES = {
  INICIA: { precioMes: 149, capacidadIncluida: 30 },
  DESPACHO: { precioMes: 349, capacidadIncluida: 100 },
  FIRMA: { precioMes: 749, capacidadIncluida: 250 },
} as const;

/**
 * Heuristica conservadora: BARITUR PRO ahorra entre 35% y 55% del tiempo
 * dedicado a tareas administrativas repetitivas (recordatorios, plazos,
 * borradores, comunicacion familia, plantillas). Usamos 40% como estimacion
 * conservadora.
 */
const FACTOR_AHORRO_HORAS = 0.4;

/**
 * Probabilidad mensual de un error costoso por expediente. Errores tipicos:
 * - Presentacion tardia del Modelo 650 (recargo 5-20% + intereses)
 * - Perdida de bonificacion autonomica por presentacion fuera de plazo
 * - Reclamacion de cliente por documentacion mal archivada
 *
 * Estimacion conservadora: 1 error cada 50 expedientes con coste medio 350€.
 */
const PROB_ERROR_POR_EXPEDIENTE = 1 / 50;
const COSTE_MEDIO_ERROR = 350;

export function calculateROI(inputs: ROIInputs): ROIResult {
  const plan = PLANES[inputs.plan];
  const costePlanMensual = plan.precioMes;

  // Horas liberadas por expediente (con tope inferior de 0)
  const horasAhorradasPorExpediente = Math.max(
    0,
    inputs.horasPorExpediente * FACTOR_AHORRO_HORAS
  );
  const horasAhorradasMes = horasAhorradasPorExpediente * inputs.expedientesPorMes;
  const ahorroHorasMensual = horasAhorradasMes * inputs.costeHora;

  const ahorroErroresMensual = inputs.expedientesPorMes * PROB_ERROR_POR_EXPEDIENTE * COSTE_MEDIO_ERROR;

  const ahorroTotalMensual = ahorroHorasMensual + ahorroErroresMensual;
  const ahorroNetoMensual = Math.max(0, ahorroTotalMensual - costePlanMensual);
  const ahorroNetoAnual = ahorroNetoMensual * 12;

  const multiplicador = costePlanMensual > 0 ? (ahorroTotalMensual + costePlanMensual) / costePlanMensual : 0;
  const paybackMeses = ahorroTotalMensual > 0 ? costePlanMensual / ahorroTotalMensual : Infinity;

  const expedientesExtraEquivalentes = inputs.horasPorExpediente > 0
    ? Math.floor(horasAhorradasMes / (inputs.horasPorExpediente * (1 - FACTOR_AHORRO_HORAS)))
    : 0;

  return {
    costePlanMensual,
    horasAhorradasPorExpediente: round1(horasAhorradasPorExpediente),
    horasAhorradasMes: round1(horasAhorradasMes),
    ahorroHorasMensual: round0(ahorroHorasMensual),
    ahorroErroresMensual: round0(ahorroErroresMensual),
    ahorroTotalMensual: round0(ahorroTotalMensual),
    ahorroNetoMensual: round0(ahorroNetoMensual),
    ahorroNetoAnual: round0(ahorroNetoAnual),
    multiplicador: round1(multiplicador),
    paybackMeses: paybackMeses === Infinity ? Infinity : round1(paybackMeses),
    expedientesExtraEquivalentes,
  };
}

/**
 * Recomendacion de plan basada en numero de expedientes mensuales.
 */
export function recommendPlan(expedientesPorMes: number): ROIInputs["plan"] {
  if (expedientesPorMes <= 30) return "INICIA";
  if (expedientesPorMes <= 100) return "DESPACHO";
  return "FIRMA";
}

function round0(n: number): number {
  return Math.round(n);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
