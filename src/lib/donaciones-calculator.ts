/**
 * Motor de calculo del Impuesto sobre Donaciones (Modelo 651).
 *
 * Diferencias clave con sucesiones (Modelo 650):
 *   - Plazo: 30 dias habiles desde la donacion (no 6 meses)
 *   - Sujeto pasivo: el donatario (quien recibe), no los herederos
 *   - CCAA aplicable: depende del tipo de bien
 *       - Bienes muebles (dinero, valores): residencia del donatario
 *       - Bienes inmuebles: ubicacion del inmueble
 *   - Reducciones distintas:
 *       - NO hay reduccion base por parentesco (solo en sucesiones, art. 20.2.a)
 *       - SI hay reducciones especificas: donacion vivienda habitual a hijo,
 *         empresa familiar, donacion dineraria para vivienda, etc.
 *   - Bonificaciones CCAA: con frecuencia distintas a las de sucesiones
 *
 * Reutilizamos la tarifa estatal y los coeficientes multiplicadores; cambia
 * la base imponible (sin reduccion parentesco) y las bonificaciones aplicadas.
 */

import {
  calculateCuotaIntegra,
  getCoeficienteMultiplicador,
  CCAA_LABELS,
  type CCAAKey,
  type ParentescoGroup,
} from "./isd-calculator";

export interface DonacionInputs {
  /** Group of relationship to donor */
  group: ParentescoGroup;
  /** Net taxable base (valor declarado de la donacion) in euros */
  baseImponible: number;
  /** Pre-existing patrimony of donatario in euros */
  preexistingPatrimony: number;
  /**
   * Subset of donaciones with reducciones autonomicas frecuentes.
   * - "vivienda-habitual-hijo": donacion de vivienda habitual a descendiente
   *   menor de 35 (en muchas CCAA reduce 95% hasta limites)
   * - "dinero-para-vivienda-hijo": donacion dineraria a descendiente para
   *   adquisicion de vivienda habitual (algunas CCAA reducen base)
   * - "empresa-familiar": donacion de empresa o participaciones (95% si
   *   se cumplen requisitos del art. 20.6 Ley 29/1987)
   * - "ninguna": sin reduccion especifica
   */
  reduccionTipo?: "vivienda-habitual-hijo" | "dinero-para-vivienda-hijo" | "empresa-familiar" | "ninguna";
  /** Type of asset transferred — affects CCAA competente */
  tipoBien?: "dinero" | "inmueble" | "valores" | "vehiculo" | "otros";
}

export interface DonacionResult {
  baseImponible: number;
  reduccionAplicada: number;
  baseLiquidable: number;
  cuotaIntegra: number;
  coeficienteMultiplicador: number;
  cuotaTributaria: number;
  bonificacionCcaa: number;
  cuotaAPagar: number;
  reduccionTipo: NonNullable<DonacionInputs["reduccionTipo"]>;
}

/** Dataset de bonificaciones autonomicas para donaciones (grupos I-II). */
const DONACION_BONIFICATION: Record<CCAAKey, (group: ParentescoGroup) => { pct: number; note: string; foralRegime: boolean }> = {
  ANDALUCIA: (g) => g === "I" || g === "II"
    ? { pct: 99, note: "Andalucía bonifica 99% donaciones a descendientes/conyuge.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general grupos III-IV.", foralRegime: false },
  ARAGON: (g) => g === "I" || g === "II"
    ? { pct: 65, note: "Aragón bonifica 65% donaciones grupo I-II hasta 100.000€.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  ASTURIAS: () => ({ pct: 0, note: "Asturias no aplica bonificacion general en donaciones.", foralRegime: false }),
  BALEARES: (g) => g === "I" || g === "II"
    ? { pct: 100, note: "Baleares bonifica 100% donaciones a descendientes/conyuge.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  CANARIAS: (g) => g === "I" || g === "II"
    ? { pct: 99.9, note: "Canarias bonifica 99,9% donaciones grupo I-II.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  CANTABRIA: (g) => g === "I" || g === "II"
    ? { pct: 100, note: "Cantabria bonifica 100% hasta cierto importe; consulta tabla.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  CASTILLA_LEON: (g) => g === "I" || g === "II"
    ? { pct: 99, note: "Castilla y León bonifica 99% donaciones grupo I-II.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  CASTILLA_LA_MANCHA: (g) => g === "I" || g === "II"
    ? { pct: 95, note: "Castilla-La Mancha bonifica 95% donaciones grupo I-II (escala distinta a sucesiones).", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  CATALUNA: () => ({ pct: 0, note: "Cataluña no bonifica donaciones; aplica reducciones especificas (escala 5%-9% para grupo I-II en escritura publica).", foralRegime: false }),
  EXTREMADURA: (g) => g === "I" || g === "II"
    ? { pct: 99, note: "Extremadura bonifica 99% donaciones grupo I-II.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  GALICIA: (g) => g === "I" || g === "II"
    ? { pct: 95, note: "Galicia bonifica 95% donaciones grupo I-II hasta 1M€.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  LA_RIOJA: (g) => g === "I" || g === "II"
    ? { pct: 99, note: "La Rioja bonifica 99% donaciones grupo I-II.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  MADRID: (g) => g === "I" || g === "II"
    ? { pct: 99, note: "Madrid bonifica 99% donaciones a conyuge, descendientes y ascendientes.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general grupos III-IV.", foralRegime: false },
  MURCIA: (g) => g === "I" || g === "II"
    ? { pct: 99, note: "Murcia bonifica 99% donaciones grupo I-II.", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
  NAVARRA: () => ({ pct: 0, note: "Navarra: regimen foral. Cuota orientativa con tarifa estatal.", foralRegime: true }),
  PAIS_VASCO: () => ({ pct: 0, note: "Pais Vasco: regimen foral. Cuota orientativa con tarifa estatal.", foralRegime: true }),
  VALENCIA: (g) => g === "I" || g === "II"
    ? { pct: 99, note: "C. Valenciana bonifica 99% donaciones grupo I-II (desde 2023).", foralRegime: false }
    : { pct: 0, note: "Sin bonificacion general.", foralRegime: false },
};

export function getDonacionBonification(ccaa: CCAAKey, group: ParentescoGroup): { pct: number; note: string; foralRegime: boolean } {
  return DONACION_BONIFICATION[ccaa](group);
}

/**
 * Reducciones especificas (porcentaje sobre la base imponible).
 * Conservador y orientativo: la normativa concreta varia por CCAA y supuestos.
 */
const REDUCCION_PCT: Record<NonNullable<DonacionInputs["reduccionTipo"]>, number> = {
  "vivienda-habitual-hijo": 95,
  "dinero-para-vivienda-hijo": 80,
  "empresa-familiar": 95,
  ninguna: 0,
};

export function calculateDonacion(input: DonacionInputs, ccaa?: CCAAKey): DonacionResult {
  const reduccionTipo = input.reduccionTipo ?? "ninguna";
  const reduccionPct = REDUCCION_PCT[reduccionTipo];
  const reduccionAplicada = (input.baseImponible * reduccionPct) / 100;
  const baseLiquidable = Math.max(0, input.baseImponible - reduccionAplicada);
  const cuotaIntegra = calculateCuotaIntegra(baseLiquidable);
  const coef = getCoeficienteMultiplicador(input.group, input.preexistingPatrimony);
  const cuotaTributaria = cuotaIntegra * coef;

  const bonifPct = ccaa ? DONACION_BONIFICATION[ccaa](input.group).pct : 0;
  const bonificacionCcaa = (cuotaTributaria * bonifPct) / 100;
  const cuotaAPagar = Math.max(0, cuotaTributaria - bonificacionCcaa);

  return {
    baseImponible: input.baseImponible,
    reduccionAplicada: round2(reduccionAplicada),
    baseLiquidable: round2(baseLiquidable),
    cuotaIntegra: round2(cuotaIntegra),
    coeficienteMultiplicador: coef,
    cuotaTributaria: round2(cuotaTributaria),
    bonificacionCcaa: round2(bonificacionCcaa),
    cuotaAPagar: round2(cuotaAPagar),
    reduccionTipo,
  };
}

/** Comparativa de la misma donacion entre todas las CCAA, ordenada por cuota. */
export function compareDonacionCCAAs(input: DonacionInputs): {
  ccaa: CCAAKey;
  label: string;
  cuotaAPagar: number;
  bonificacionPct: number;
  foralRegime: boolean;
}[] {
  const all = Object.keys(CCAA_LABELS) as CCAAKey[];
  return all
    .map((ccaa) => {
      const result = calculateDonacion(input, ccaa);
      const bonif = DONACION_BONIFICATION[ccaa](input.group);
      return {
        ccaa,
        label: CCAA_LABELS[ccaa],
        cuotaAPagar: result.cuotaAPagar,
        bonificacionPct: bonif.pct,
        foralRegime: bonif.foralRegime,
      };
    })
    .sort((a, b) => a.cuotaAPagar - b.cuotaAPagar);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
