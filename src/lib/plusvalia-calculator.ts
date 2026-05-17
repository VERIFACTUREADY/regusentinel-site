/**
 * Calculadora de la Plusvalia Municipal (IIVTNU - Impuesto sobre el
 * Incremento de Valor de los Terrenos de Naturaleza Urbana).
 *
 * Tras la reforma del RDL 26/2021 (consecuencia de la STC 182/2021),
 * existen DOS metodos de calculo y el contribuyente elige el menor:
 *
 *  1. METODO OBJETIVO (estimacion objetiva):
 *     base = valor catastral del suelo x coeficiente segun anyos de tenencia
 *     cuota = base x tipo de gravamen municipal
 *
 *  2. METODO REAL (estimacion directa / plusvalia real):
 *     incremento real = valor transmision - valor adquisicion
 *     base = incremento real x (% que el suelo representa del valor catastral)
 *     cuota = base x tipo de gravamen municipal
 *
 * Ademas: si NO hay incremento real de valor, no se tributa (la operacion
 * esta no sujeta). El contribuyente debe poder acreditarlo.
 *
 * Los coeficientes son maximos estatales (Ley de Presupuestos); cada
 * ayuntamiento puede fijar coeficientes y tipos iguales o inferiores.
 *
 * Motor puro, deterministico, sin DB ni IA. Resultado orientativo.
 */

/** Coeficientes maximos estatales por anyos de generacion del incremento.
 *  Indice = anyos completos de tenencia. Vigentes desde 2023 (RDL 26/2021
 *  + actualizaciones de la Ley de Presupuestos). Orientativos. */
export const COEFICIENTES_MAXIMOS: Record<number, number> = {
  0: 0.15, // menos de 1 anyo
  1: 0.15,
  2: 0.14,
  3: 0.15,
  4: 0.17,
  5: 0.18,
  6: 0.19,
  7: 0.18,
  8: 0.15,
  9: 0.12,
  10: 0.1,
  11: 0.09,
  12: 0.09,
  13: 0.09,
  14: 0.09,
  15: 0.1,
  16: 0.13,
  17: 0.17,
  18: 0.23,
  19: 0.29,
  20: 0.45, // 20 anyos o mas
};

/** Tipo de gravamen maximo legal (art. 108 TRLRHL). */
export const TIPO_GRAVAMEN_MAXIMO = 0.30;

export interface PlusvaliaInput {
  /** Valor catastral total del inmueble (suelo + construccion) en euros. */
  valorCatastralTotal: number;
  /** Valor catastral del suelo en euros. Si no se conoce, se estima. */
  valorCatastralSuelo: number | null;
  /** Anyos completos transcurridos desde la adquisicion por el causante. */
  anyosTenencia: number;
  /** Tipo de gravamen del ayuntamiento (0-0.30). Default 0.30 (maximo). */
  tipoGravamen: number;
  /** Valor de adquisicion del inmueble por el causante (para metodo real). */
  valorAdquisicion: number | null;
  /** Valor de transmision = valor declarado en la herencia (para metodo real). */
  valorTransmision: number | null;
}

export interface PlusvaliaMethodResult {
  /** Base imponible del metodo. */
  base: number;
  /** Cuota a pagar del metodo. */
  cuota: number;
  /** Aplicable (false si faltan datos para este metodo). */
  aplicable: boolean;
  /** Nota explicativa. */
  nota: string;
}

export interface PlusvaliaResult {
  /** Coeficiente aplicado en el metodo objetivo. */
  coeficienteObjetivo: number;
  /** Resultado del metodo objetivo. */
  objetivo: PlusvaliaMethodResult;
  /** Resultado del metodo real (estimacion directa). */
  real: PlusvaliaMethodResult;
  /** Hay incremento real de valor (si false, operacion no sujeta). */
  hayIncremento: boolean;
  /** Metodo recomendado: el de menor cuota entre los aplicables. */
  metodoRecomendado: "objetivo" | "real" | "no-sujeto" | null;
  /** Cuota final recomendada. */
  cuotaRecomendada: number;
  /** Porcentaje del valor catastral que representa el suelo. */
  porcentajeSuelo: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampYears(anyos: number): number {
  if (anyos < 0) return 0;
  if (anyos >= 20) return 20;
  return Math.floor(anyos);
}

export function getCoeficiente(anyosTenencia: number): number {
  return COEFICIENTES_MAXIMOS[clampYears(anyosTenencia)] ?? 0.45;
}

export function calculatePlusvalia(input: PlusvaliaInput): PlusvaliaResult {
  const tipo = Math.max(0, Math.min(TIPO_GRAVAMEN_MAXIMO, input.tipoGravamen));

  // Estimar valor del suelo si no se conoce: ~50% del valor catastral
  // (proporcion habitual en vivienda; varia por municipio).
  const valorSuelo =
    input.valorCatastralSuelo != null && input.valorCatastralSuelo > 0
      ? input.valorCatastralSuelo
      : input.valorCatastralTotal * 0.5;

  const porcentajeSuelo =
    input.valorCatastralTotal > 0 ? valorSuelo / input.valorCatastralTotal : 0.5;

  // ── METODO OBJETIVO ───────────────────────────────────
  const coeficiente = getCoeficiente(input.anyosTenencia);
  const baseObjetivo = valorSuelo * coeficiente;
  const cuotaObjetivo = baseObjetivo * tipo;

  const objetivo: PlusvaliaMethodResult = {
    base: round2(baseObjetivo),
    cuota: round2(cuotaObjetivo),
    aplicable: input.valorCatastralTotal > 0,
    nota: `Valor del suelo (${round2(valorSuelo).toLocaleString("es-ES")} €) x coeficiente ${coeficiente} x tipo ${(tipo * 100).toFixed(0)}%.`,
  };

  // ── METODO REAL ───────────────────────────────────────
  let real: PlusvaliaMethodResult;
  let hayIncremento = true;

  if (input.valorAdquisicion != null && input.valorTransmision != null) {
    const incrementoReal = input.valorTransmision - input.valorAdquisicion;
    hayIncremento = incrementoReal > 0;

    if (!hayIncremento) {
      real = {
        base: 0,
        cuota: 0,
        aplicable: true,
        nota: "No hay incremento de valor: la transmision esta NO SUJETA al impuesto. Conserva las escrituras como prueba.",
      };
    } else {
      // La base del metodo real es el incremento x % del suelo
      const baseReal = incrementoReal * porcentajeSuelo;
      const cuotaReal = baseReal * tipo;
      real = {
        base: round2(baseReal),
        cuota: round2(cuotaReal),
        aplicable: true,
        nota: `Incremento real ${incrementoReal.toLocaleString("es-ES")} € x ${(porcentajeSuelo * 100).toFixed(0)}% (proporcion suelo) x tipo ${(tipo * 100).toFixed(0)}%.`,
      };
    }
  } else {
    real = {
      base: 0,
      cuota: 0,
      aplicable: false,
      nota: "Indica el valor de adquisicion y el de transmision para calcular el metodo real.",
    };
  }

  // ── RECOMENDACION ─────────────────────────────────────
  let metodoRecomendado: PlusvaliaResult["metodoRecomendado"] = null;
  let cuotaRecomendada = 0;

  if (real.aplicable && !hayIncremento) {
    metodoRecomendado = "no-sujeto";
    cuotaRecomendada = 0;
  } else if (real.aplicable && objetivo.aplicable) {
    // El contribuyente elige el menor
    if (real.cuota <= objetivo.cuota) {
      metodoRecomendado = "real";
      cuotaRecomendada = real.cuota;
    } else {
      metodoRecomendado = "objetivo";
      cuotaRecomendada = objetivo.cuota;
    }
  } else if (objetivo.aplicable) {
    metodoRecomendado = "objetivo";
    cuotaRecomendada = objetivo.cuota;
  }

  return {
    coeficienteObjetivo: coeficiente,
    objetivo,
    real,
    hayIncremento,
    metodoRecomendado,
    cuotaRecomendada: round2(cuotaRecomendada),
    porcentajeSuelo: round2(porcentajeSuelo),
  };
}
