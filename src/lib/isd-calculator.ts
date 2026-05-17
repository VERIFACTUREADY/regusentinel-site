/**
 * ISD Modelo 650 calculator (state-level scale).
 *
 * Implements:
 * - State reductions by parentesco group (art. 20 LISD)
 * - State progressive scale (art. 21 LISD)
 * - State multiplier coefficient (art. 22 LISD)
 *
 * CCAA bonifications vary every year and are user-configurable.
 * This calculator is an estimation tool; final tax must be reviewed by a professional.
 */

export type ParentescoGroup = "I" | "II" | "III" | "IV";

export interface ISDInputs {
  /** Group of relationship to deceased */
  group: ParentescoGroup;
  /** Age of heir if Group I (under 21) */
  ageIfMinor?: number | null;
  /** Net taxable base (caudal hereditario neto * cuota) in euros */
  baseImponible: number;
  /** Pre-existing patrimony of heir in euros */
  preexistingPatrimony: number;
  /** Habitual dwelling reduction applies (95%, max 122,606.47€) */
  dwellingReduction?: boolean;
  /** Value of habitual dwelling if reduction applies */
  dwellingValue?: number;
  /** Disability reduction (state level): "none" | "33-65" | "65+" */
  disability?: "none" | "33-65" | "65+";
  /** Life insurance reduction (max 9,195.49€ per beneficiary, group I/II) */
  lifeInsuranceAmount?: number;
  /** CCAA bonification percentage (0-100) over cuota tributaria */
  ccaaBonificationPct?: number;
}

export interface ISDResult {
  baseImponible: number;
  totalReducciones: number;
  baseLiquidable: number;
  cuotaIntegra: number;
  coeficienteMultiplicador: number;
  cuotaTributaria: number;
  bonificacionCcaa: number;
  cuotaAPagar: number;
  desglose: {
    reduccionParentesco: number;
    reduccionVivienda: number;
    reduccionDiscapacidad: number;
    reduccionSeguroVida: number;
  };
}

const REDUCCION_BASE: Record<ParentescoGroup, number> = {
  I: 15956.87,
  II: 15956.87,
  III: 7993.46,
  IV: 0,
};

const REDUCCION_GROUP_I_PER_YEAR_UNDER_21 = 3990.72;
const REDUCCION_GROUP_I_MAX = 47858.59;

const REDUCCION_DISCAPACIDAD = {
  none: 0,
  "33-65": 47858.59,
  "65+": 150253.03,
};

const REDUCCION_VIVIENDA_MAX = 122606.47;
const REDUCCION_VIVIENDA_PCT = 0.95;

const REDUCCION_SEGURO_VIDA_MAX = 9195.49;

// State progressive scale (art. 21 LISD, Ley 29/1987)
const ESCALA: { upTo: number; rate: number }[] = [
  { upTo: 7993.46, rate: 0.0765 },
  { upTo: 15980.91, rate: 0.085 },
  { upTo: 23968.36, rate: 0.0935 },
  { upTo: 31955.81, rate: 0.102 },
  { upTo: 39943.26, rate: 0.1105 },
  { upTo: 47930.72, rate: 0.119 },
  { upTo: 55918.17, rate: 0.1275 },
  { upTo: 63905.62, rate: 0.136 },
  { upTo: 71893.07, rate: 0.1445 },
  { upTo: 79880.52, rate: 0.153 },
  { upTo: 119757.67, rate: 0.1615 },
  { upTo: 159634.83, rate: 0.187 },
  { upTo: 239389.13, rate: 0.2125 },
  { upTo: 398777.54, rate: 0.255 },
  { upTo: 797555.08, rate: 0.2975 },
  { upTo: Infinity, rate: 0.34 },
];

// Multiplier coefficient (art. 22 LISD)
// Rows: pre-existing patrimony brackets
// Cols: parentesco groups
const COEFICIENTE_BRACKETS = [
  { upTo: 402678.11, coef: { I: 1.0, II: 1.0, III: 1.5882, IV: 2.0 } },
  { upTo: 2007380.43, coef: { I: 1.05, II: 1.05, III: 1.6676, IV: 2.1 } },
  { upTo: 4020770.98, coef: { I: 1.1, II: 1.1, III: 1.7471, IV: 2.2 } },
  { upTo: Infinity, coef: { I: 1.2, II: 1.2, III: 1.9059, IV: 2.4 } },
];

export function calculateReducciones(input: ISDInputs): ISDResult["desglose"] & { total: number } {
  let reduccionParentesco = REDUCCION_BASE[input.group];
  if (input.group === "I" && input.ageIfMinor != null && input.ageIfMinor < 21) {
    const yearsUnder21 = Math.max(0, 21 - input.ageIfMinor);
    reduccionParentesco = Math.min(
      REDUCCION_GROUP_I_MAX,
      REDUCCION_BASE.I + yearsUnder21 * REDUCCION_GROUP_I_PER_YEAR_UNDER_21
    );
  }

  let reduccionVivienda = 0;
  if (input.dwellingReduction && input.dwellingValue && input.dwellingValue > 0) {
    // 95% with cap of 122,606.47€ per heir on group I, II, III (relatives 65+ living together)
    if (input.group === "I" || input.group === "II" || input.group === "III") {
      reduccionVivienda = Math.min(REDUCCION_VIVIENDA_MAX, input.dwellingValue * REDUCCION_VIVIENDA_PCT);
    }
  }

  const reduccionDiscapacidad = REDUCCION_DISCAPACIDAD[input.disability || "none"];

  let reduccionSeguroVida = 0;
  if (input.lifeInsuranceAmount && input.lifeInsuranceAmount > 0) {
    if (input.group === "I" || input.group === "II") {
      reduccionSeguroVida = Math.min(REDUCCION_SEGURO_VIDA_MAX, input.lifeInsuranceAmount);
    }
  }

  const total = reduccionParentesco + reduccionVivienda + reduccionDiscapacidad + reduccionSeguroVida;

  return {
    reduccionParentesco,
    reduccionVivienda,
    reduccionDiscapacidad,
    reduccionSeguroVida,
    total,
  };
}

export function calculateCuotaIntegra(baseLiquidable: number): number {
  if (baseLiquidable <= 0) return 0;
  let cuota = 0;
  let prevUpTo = 0;
  for (const bracket of ESCALA) {
    if (baseLiquidable <= bracket.upTo) {
      cuota += (baseLiquidable - prevUpTo) * bracket.rate;
      return cuota;
    }
    cuota += (bracket.upTo - prevUpTo) * bracket.rate;
    prevUpTo = bracket.upTo;
  }
  return cuota;
}

export function getCoeficienteMultiplicador(
  group: ParentescoGroup,
  preexistingPatrimony: number
): number {
  for (const bracket of COEFICIENTE_BRACKETS) {
    if (preexistingPatrimony <= bracket.upTo) {
      return bracket.coef[group];
    }
  }
  return COEFICIENTE_BRACKETS[COEFICIENTE_BRACKETS.length - 1].coef[group];
}

export function calculateISD(input: ISDInputs): ISDResult {
  const reducciones = calculateReducciones(input);
  const baseLiquidable = Math.max(0, input.baseImponible - reducciones.total);
  const cuotaIntegra = calculateCuotaIntegra(baseLiquidable);
  const coef = getCoeficienteMultiplicador(input.group, input.preexistingPatrimony);
  const cuotaTributaria = cuotaIntegra * coef;
  const bonifPct = Math.max(0, Math.min(100, input.ccaaBonificationPct || 0));
  const bonificacionCcaa = cuotaTributaria * (bonifPct / 100);
  const cuotaAPagar = cuotaTributaria - bonificacionCcaa;

  return {
    baseImponible: input.baseImponible,
    totalReducciones: reducciones.total,
    baseLiquidable,
    cuotaIntegra: round2(cuotaIntegra),
    coeficienteMultiplicador: coef,
    cuotaTributaria: round2(cuotaTributaria),
    bonificacionCcaa: round2(bonificacionCcaa),
    cuotaAPagar: round2(Math.max(0, cuotaAPagar)),
    desglose: {
      reduccionParentesco: round2(reducciones.reduccionParentesco),
      reduccionVivienda: round2(reducciones.reduccionVivienda),
      reduccionDiscapacidad: round2(reducciones.reduccionDiscapacidad),
      reduccionSeguroVida: round2(reducciones.reduccionSeguroVida),
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reference bonifications by CCAA (orientative, 2024).
 * These change yearly and may have specific conditions per CCAA.
 * The user must verify and adjust manually.
 */
export const CCAA_BONIFICATION_REFERENCE: Record<string, { groups: ParentescoGroup[]; pct: number; note: string }[]> = {
  Madrid: [{ groups: ["I", "II"], pct: 99, note: "Bonificación 99% para grupos I y II" }],
  Andalucía: [{ groups: ["I", "II"], pct: 99, note: "Bonificación 99% para grupos I y II" }],
  Murcia: [{ groups: ["I", "II"], pct: 99, note: "Bonificación 99%" }],
  Galicia: [{ groups: ["I", "II"], pct: 99, note: "Bonificación 99% hasta 1M€" }],
  Canarias: [{ groups: ["I", "II"], pct: 99.9, note: "Bonificación 99.9%" }],
  "Comunidad Valenciana": [{ groups: ["I", "II"], pct: 99, note: "Bonificación 99%" }],
  Cantabria: [{ groups: ["I", "II"], pct: 100, note: "Bonificación 100%" }],
  "Castilla y León": [{ groups: ["I", "II"], pct: 99, note: "Bonificación 99%" }],
  "Castilla-La Mancha": [{ groups: ["I", "II"], pct: 100, note: "Bonificación variable, hasta 100% según base" }],
  Aragón: [{ groups: ["I", "II"], pct: 99, note: "Bonificación 99%" }],
  Extremadura: [{ groups: ["I", "II"], pct: 99, note: "Bonificación 99%" }],
  "La Rioja": [{ groups: ["I", "II"], pct: 99, note: "Bonificación 99%" }],
  "Islas Baleares": [{ groups: ["I", "II"], pct: 100, note: "Bonificación 100% (desde mayo 2023)" }],
  Cataluña: [{ groups: ["I", "II"], pct: 0, note: "Bonificaciones específicas, consulta tabla CCAA" }],
  Asturias: [{ groups: ["I", "II"], pct: 0, note: "Bonificaciones específicas según base" }],
  Navarra: [{ groups: ["I", "II"], pct: 0, note: "Régimen foral propio" }],
  "País Vasco": [{ groups: ["I", "II"], pct: 0, note: "Régimen foral propio" }],
};

// ─── Bonificaciones autonómicas progresivas (vigentes 2025) ──────────────
// A diferencia de CCAA_BONIFICATION_REFERENCE (porcentaje plano), aquí se
// modelan las CCAA cuya bonificación depende de la base liquidable o del
// grupo III. Lo usa la calculadora pública para mostrar resultados realistas
// sin que el usuario tenga que conocer los porcentajes.

export type CCAAKey =
  | "ANDALUCIA" | "ARAGON" | "ASTURIAS" | "BALEARES" | "CANARIAS"
  | "CANTABRIA" | "CASTILLA_LEON" | "CASTILLA_LA_MANCHA" | "CATALUNA"
  | "EXTREMADURA" | "GALICIA" | "LA_RIOJA" | "MADRID" | "MURCIA"
  | "NAVARRA" | "PAIS_VASCO" | "VALENCIA";

export const CCAA_LABELS: Record<CCAAKey, string> = {
  ANDALUCIA: "Andalucía",
  ARAGON: "Aragón",
  ASTURIAS: "Asturias",
  BALEARES: "Islas Baleares",
  CANARIAS: "Canarias",
  CANTABRIA: "Cantabria",
  CASTILLA_LEON: "Castilla y León",
  CASTILLA_LA_MANCHA: "Castilla-La Mancha",
  CATALUNA: "Cataluña",
  EXTREMADURA: "Extremadura",
  GALICIA: "Galicia",
  LA_RIOJA: "La Rioja",
  MADRID: "Madrid",
  MURCIA: "Murcia",
  NAVARRA: "Navarra",
  PAIS_VASCO: "País Vasco",
  VALENCIA: "Comunidad Valenciana",
};

interface CCAARule {
  /** Bonificación aplicada a la cuota tributaria (0-100) según grupo y base liquidable. */
  bonification: (group: ParentescoGroup, baseLiquidable: number) => number;
  /** Texto explicativo mostrado al usuario. */
  note: (group: ParentescoGroup) => string;
  /** True si la CCAA tiene régimen foral propio: cálculo estatal es orientativo. */
  foralRegime?: boolean;
}

const CCAA_RULES: Record<CCAAKey, CCAARule> = {
  ANDALUCIA: {
    bonification: (g) => (g === "I" || g === "II" ? 99 : 0),
    note: (g) => g === "I" || g === "II"
      ? "Andalucía bonifica el 99% de la cuota para cónyuge, descendientes y ascendientes."
      : "Andalucía no bonifica grupos III-IV; se aplica la cuota estatal completa.",
  },
  ARAGON: {
    bonification: (g, b) => g === "I" ? 100 : g === "II" && b <= 100000 ? 65 : 0,
    note: (g) => g === "I"
      ? "Aragón bonifica el 100% para descendientes menores de 21 años."
      : g === "II"
      ? "Aragón aplica reducción del 65% en grupo II hasta 100.000€ de base liquidable."
      : "Aragón no bonifica grupos III-IV.",
  },
  ASTURIAS: {
    bonification: () => 0,
    note: () => "Asturias mantiene tarifa propia y reducciones por discapacidad/vivienda; no aplica bonificación general en cuota.",
  },
  BALEARES: {
    bonification: (g) => g === "I" || g === "II" ? 100 : g === "III" ? 50 : 0,
    note: (g) => g === "I" || g === "II"
      ? "Baleares bonifica el 100% para cónyuge, descendientes y ascendientes."
      : g === "III"
      ? "Baleares bonifica el 50% para hermanos, tíos y sobrinos."
      : "Baleares no bonifica grupo IV.",
  },
  CANARIAS: {
    bonification: (g, b) => g === "I" || g === "II" ? 99.9 : g === "III" && b <= 55000 ? 99.9 : 0,
    note: (g) => g === "I" || g === "II"
      ? "Canarias bonifica el 99,9% para cónyuge, descendientes y ascendientes."
      : g === "III"
      ? "Canarias bonifica el 99,9% en grupo III sólo si la base liquidable ≤ 55.000€."
      : "Canarias no bonifica grupo IV.",
  },
  CANTABRIA: {
    bonification: (g, b) => {
      if (g === "I" || g === "II") return b <= 100000 ? 100 : 90;
      if (g === "III") return 90;
      return 0;
    },
    note: (g) => g === "I" || g === "II"
      ? "Cantabria bonifica el 100% hasta 100.000€ y el 90% sobre el exceso, para cónyuge y descendientes."
      : g === "III"
      ? "Cantabria bonifica el 90% para hermanos, tíos y sobrinos."
      : "Cantabria no bonifica grupo IV.",
  },
  CASTILLA_LEON: {
    bonification: (g) => g === "I" || g === "II" ? 99 : 0,
    note: (g) => g === "I" || g === "II"
      ? "Castilla y León bonifica el 99% para cónyuge, descendientes y ascendientes (con condiciones sobre patrimonio preexistente)."
      : "Castilla y León no bonifica grupos III-IV.",
  },
  CASTILLA_LA_MANCHA: {
    bonification: (g, b) => {
      if (g !== "I" && g !== "II") return 0;
      if (b <= 175000) return 100;
      if (b <= 225000) return 95;
      if (b <= 275000) return 90;
      if (b <= 300000) return 85;
      return 80;
    },
    note: (g) => g === "I" || g === "II"
      ? "Castilla-La Mancha aplica bonificación escalada del 80% al 100% según la base liquidable."
      : "Castilla-La Mancha no bonifica grupos III-IV.",
  },
  CATALUNA: {
    bonification: (g, b) => {
      if (g !== "I" && g !== "II") return 0;
      if (b <= 100000) return 99;
      if (b <= 200000) return 97;
      if (b <= 500000) return 90;
      if (b <= 1000000) return 70;
      return 50;
    },
    note: (g) => g === "I" || g === "II"
      ? "Cataluña aplica bonificación inversa progresiva: 99% hasta 100.000€, decrece hasta el 50% en bases altas."
      : "Cataluña no bonifica grupos III-IV.",
  },
  EXTREMADURA: {
    bonification: (g) => g === "I" || g === "II" ? 99 : 0,
    note: (g) => g === "I" || g === "II"
      ? "Extremadura bonifica el 99% para cónyuge, descendientes y ascendientes."
      : "Extremadura no bonifica grupos III-IV.",
  },
  GALICIA: {
    bonification: (g, b) => g === "I" ? 100 : g === "II" && b <= 1000000 ? 99 : 0,
    note: (g) => g === "I"
      ? "Galicia bonifica el 100% para descendientes menores de 21 años."
      : g === "II"
      ? "Galicia bonifica el 99% para cónyuge y descendientes hasta 1.000.000€ de base liquidable."
      : "Galicia no bonifica grupos III-IV.",
  },
  LA_RIOJA: {
    bonification: (g) => g === "I" || g === "II" ? 99 : 0,
    note: (g) => g === "I" || g === "II"
      ? "La Rioja bonifica el 99% para cónyuge, descendientes y ascendientes."
      : "La Rioja no bonifica grupos III-IV.",
  },
  MADRID: {
    bonification: (g) => g === "I" || g === "II" ? 99 : g === "III" ? 25 : 0,
    note: (g) => g === "I" || g === "II"
      ? "Madrid bonifica el 99% para cónyuge, descendientes y ascendientes."
      : g === "III"
      ? "Madrid bonifica el 25% para hermanos, tíos y sobrinos por consanguinidad."
      : "Madrid no bonifica grupo IV.",
  },
  MURCIA: {
    bonification: (g) => g === "I" || g === "II" ? 99 : g === "III" ? 50 : 0,
    note: (g) => g === "I" || g === "II"
      ? "Murcia bonifica el 99% para cónyuge, descendientes y ascendientes."
      : g === "III"
      ? "Murcia bonifica el 50% para hermanos, tíos y sobrinos."
      : "Murcia no bonifica grupo IV.",
  },
  NAVARRA: {
    bonification: () => 0,
    note: () => "Navarra tiene régimen foral propio (Ley Foral 13/1992). Cónyuge y ascendientes/descendientes: tipos del 0,8% al 16%. Esta calculadora aplica tarifa estatal como referencia; consulte con la Hacienda Foral.",
    foralRegime: true,
  },
  PAIS_VASCO: {
    bonification: () => 0,
    note: () => "País Vasco tiene Concierto Económico (normativa foral propia en Álava, Bizkaia, Gipuzkoa). Cónyuge y descendientes tienen exenciones generalizadas. Cálculo orientativo según tarifa estatal.",
    foralRegime: true,
  },
  VALENCIA: {
    bonification: (g) => g === "I" || g === "II" ? 99 : 0,
    note: (g) => g === "I" || g === "II"
      ? "Comunidad Valenciana bonifica el 99% para cónyuge, descendientes y ascendientes (Decreto-ley 6/2023)."
      : "Comunidad Valenciana no bonifica grupos III-IV.",
  },
};

export function getCCAABonification(ccaa: CCAAKey, group: ParentescoGroup, baseLiquidable: number): { pct: number; note: string; foralRegime: boolean } {
  const r = CCAA_RULES[ccaa];
  return { pct: r.bonification(group, baseLiquidable), note: r.note(group), foralRegime: !!r.foralRegime };
}

export const PROVINCIA_TO_CCAA: Record<string, CCAAKey> = {
  // Andalucía
  almeria: "ANDALUCIA", cadiz: "ANDALUCIA", cordoba: "ANDALUCIA",
  granada: "ANDALUCIA", huelva: "ANDALUCIA", jaen: "ANDALUCIA",
  malaga: "ANDALUCIA", sevilla: "ANDALUCIA",
  // Aragón
  huesca: "ARAGON", teruel: "ARAGON", zaragoza: "ARAGON",
  // Asturias
  asturias: "ASTURIAS",
  // Baleares
  baleares: "BALEARES", "illes-balears": "BALEARES",
  // Canarias
  "las-palmas": "CANARIAS", "santa-cruz-de-tenerife": "CANARIAS",
  // Cantabria
  cantabria: "CANTABRIA",
  // Castilla y León
  avila: "CASTILLA_LEON", burgos: "CASTILLA_LEON", leon: "CASTILLA_LEON",
  palencia: "CASTILLA_LEON", salamanca: "CASTILLA_LEON",
  segovia: "CASTILLA_LEON", soria: "CASTILLA_LEON",
  valladolid: "CASTILLA_LEON", zamora: "CASTILLA_LEON",
  // Castilla-La Mancha
  albacete: "CASTILLA_LA_MANCHA", "ciudad-real": "CASTILLA_LA_MANCHA",
  cuenca: "CASTILLA_LA_MANCHA", guadalajara: "CASTILLA_LA_MANCHA",
  toledo: "CASTILLA_LA_MANCHA",
  // Cataluña
  barcelona: "CATALUNA", girona: "CATALUNA", lleida: "CATALUNA",
  tarragona: "CATALUNA",
  // Extremadura
  badajoz: "EXTREMADURA", caceres: "EXTREMADURA",
  // Galicia
  "a-coruna": "GALICIA", lugo: "GALICIA", ourense: "GALICIA",
  pontevedra: "GALICIA",
  // La Rioja
  "la-rioja": "LA_RIOJA",
  // Madrid
  madrid: "MADRID",
  // Murcia
  murcia: "MURCIA",
  // Navarra
  navarra: "NAVARRA",
  // País Vasco
  alava: "PAIS_VASCO", araba: "PAIS_VASCO",
  guipuzcoa: "PAIS_VASCO", gipuzkoa: "PAIS_VASCO",
  vizcaya: "PAIS_VASCO", bizkaia: "PAIS_VASCO",
  // Valencia
  alicante: "VALENCIA", castellon: "VALENCIA", valencia: "VALENCIA",
};

export interface CCAAComparison {
  ccaa: CCAAKey;
  label: string;
  cuotaAPagar: number;
  bonificacionPct: number;
  foralRegime: boolean;
}

/**
 * Calcula el ISD para una CCAA aplicando su bonificación automáticamente.
 * Usa el motor existente y el dataset de bonificaciones por CCAA.
 */
export function calculateISDForCCAA(ccaa: CCAAKey, baseInputs: Omit<ISDInputs, "ccaaBonificationPct">): ISDResult {
  // Primer pase para conocer la base liquidable y aplicar la bonificación correcta
  const reductions = calculateReducciones(baseInputs);
  const baseLiquidable = Math.max(0, baseInputs.baseImponible - reductions.total);
  const { pct } = getCCAABonification(ccaa, baseInputs.group, baseLiquidable);
  return calculateISD({ ...baseInputs, ccaaBonificationPct: pct });
}

/**
 * Compara la cuota a pagar entre todas las CCAAs para los mismos inputs.
 * Útil para mostrar al usuario cuánto cambia el impuesto según residencia fiscal.
 */
export function compareCCAAs(baseInputs: Omit<ISDInputs, "ccaaBonificationPct">): CCAAComparison[] {
  const all = Object.keys(CCAA_LABELS) as CCAAKey[];
  return all
    .map((ccaa) => {
      const reductions = calculateReducciones(baseInputs);
      const baseLiquidable = Math.max(0, baseInputs.baseImponible - reductions.total);
      const { pct, foralRegime } = getCCAABonification(ccaa, baseInputs.group, baseLiquidable);
      const result = calculateISD({ ...baseInputs, ccaaBonificationPct: pct });
      return {
        ccaa,
        label: CCAA_LABELS[ccaa],
        cuotaAPagar: result.cuotaAPagar,
        bonificacionPct: pct,
        foralRegime,
      };
    })
    .sort((a, b) => a.cuotaAPagar - b.cuotaAPagar);
}

export function formatEUR(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

export function getReferenceBonification(province: string | null | undefined, group: ParentescoGroup): number {
  if (!province) return 0;
  // Simple province → CCAA mapping for the most common cases
  const provinceToCcaa: Record<string, string> = {
    Madrid: "Madrid",
    Barcelona: "Cataluña", Tarragona: "Cataluña", Lérida: "Cataluña", Lleida: "Cataluña", Girona: "Cataluña", Gerona: "Cataluña",
    Valencia: "Comunidad Valenciana", Alicante: "Comunidad Valenciana", Castellón: "Comunidad Valenciana",
    Sevilla: "Andalucía", Málaga: "Andalucía", Cádiz: "Andalucía", Córdoba: "Andalucía", Granada: "Andalucía", Huelva: "Andalucía", Jaén: "Andalucía", Almería: "Andalucía",
    Murcia: "Murcia",
    Bilbao: "País Vasco", Vizcaya: "País Vasco", Guipúzcoa: "País Vasco", Álava: "País Vasco", "San Sebastián": "País Vasco", Vitoria: "País Vasco",
    Pamplona: "Navarra", Navarra: "Navarra",
    Zaragoza: "Aragón", Huesca: "Aragón", Teruel: "Aragón",
    Asturias: "Asturias", Oviedo: "Asturias",
    Cantabria: "Cantabria", Santander: "Cantabria",
    "La Coruña": "Galicia", "A Coruña": "Galicia", Lugo: "Galicia", Orense: "Galicia", Ourense: "Galicia", Pontevedra: "Galicia",
    "Las Palmas": "Canarias", "Santa Cruz de Tenerife": "Canarias",
    Palma: "Islas Baleares", Baleares: "Islas Baleares", "Islas Baleares": "Islas Baleares",
    Logroño: "La Rioja", "La Rioja": "La Rioja",
    Badajoz: "Extremadura", Cáceres: "Extremadura",
    Valladolid: "Castilla y León", Burgos: "Castilla y León", Salamanca: "Castilla y León", León: "Castilla y León", Palencia: "Castilla y León", Ávila: "Castilla y León", Segovia: "Castilla y León", Soria: "Castilla y León", Zamora: "Castilla y León",
    Toledo: "Castilla-La Mancha", "Ciudad Real": "Castilla-La Mancha", Albacete: "Castilla-La Mancha", Cuenca: "Castilla-La Mancha", Guadalajara: "Castilla-La Mancha",
  };
  const ccaa = provinceToCcaa[province];
  if (!ccaa) return 0;
  const rules = CCAA_BONIFICATION_REFERENCE[ccaa];
  if (!rules) return 0;
  const match = rules.find((r) => r.groups.includes(group));
  return match?.pct || 0;
}
