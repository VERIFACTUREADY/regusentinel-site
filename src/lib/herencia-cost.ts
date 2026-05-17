/**
 * Calculadora del coste total de una herencia.
 *
 * Combina en un unico desglose los costes que afronta un heredero:
 *   1. Impuesto sobre Sucesiones (Modelo 650) - autonomico
 *   2. Plusvalia municipal (IIVTNU) - municipal, si hay inmueble
 *   3. Aranceles de notaria (escritura de aceptacion y adjudicacion)
 *   4. Aranceles del Registro de la Propiedad (inscripcion de inmuebles)
 *   5. Honorarios de gestoria (opcional, estimado)
 *
 * Los aranceles de notaria y registro tienen escalas oficiales complejas
 * (RD 1426/1989 y RD 1427/1989). Usamos una estimacion simplificada y
 * realista basada en el valor de los bienes. Resultado orientativo.
 */

import {
  calculateISDForCCAA,
  type CCAAKey,
  type ParentescoGroup,
} from "./isd-calculator";
import { calculatePlusvalia, type PlusvaliaInput } from "./plusvalia-calculator";

export interface HerenciaCostInput {
  /** Valor total del caudal hereditario (para el ISD). */
  valorHerencia: number;
  /** CCAA competente. */
  ccaa: CCAAKey;
  /** Grupo de parentesco del heredero. */
  group: ParentescoGroup;
  /** Patrimonio preexistente del heredero. */
  preexistingPatrimony: number;
  /** Hay un inmueble en la herencia. */
  hasProperty: boolean;
  /** Datos del inmueble (si hasProperty). */
  property: {
    valorCatastralTotal: number;
    valorCatastralSuelo: number | null;
    anyosTenencia: number;
    tipoGravamenMunicipal: number;
    valorAdquisicion: number | null;
    valorTransmision: number | null;
  } | null;
  /** Incluir estimacion de honorarios de gestoria. */
  includeGestoria: boolean;
}

export interface CostLine {
  key: string;
  label: string;
  amount: number;
  note: string;
}

export interface HerenciaCostResult {
  lines: CostLine[];
  total: number;
  /** Coste como % del valor de la herencia. */
  pctOfHerencia: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Estimacion simplificada de aranceles notariales para una escritura de
 * aceptacion y adjudicacion de herencia. Escala progresiva orientativa.
 */
export function estimateNotaria(valorBienes: number): number {
  if (valorBienes <= 0) return 0;
  // Base fija + porcentaje decreciente por tramos (orientativo).
  let arancel = 90; // base aproximada
  const tramos: { hasta: number; pct: number }[] = [
    { hasta: 30000, pct: 0.0045 },
    { hasta: 60000, pct: 0.0015 },
    { hasta: 150000, pct: 0.001 },
    { hasta: 600000, pct: 0.0005 },
    { hasta: Infinity, pct: 0.0003 },
  ];
  let prev = 0;
  for (const t of tramos) {
    if (valorBienes <= prev) break;
    const tramoBase = Math.min(valorBienes, t.hasta) - prev;
    arancel += tramoBase * t.pct;
    prev = t.hasta;
  }
  // La escritura de herencia suele incluir copias y diligencias: +30%
  return round2(arancel * 1.3);
}

/**
 * Estimacion simplificada de aranceles del Registro de la Propiedad
 * para inscribir un inmueble heredado.
 */
export function estimateRegistro(valorInmueble: number): number {
  if (valorInmueble <= 0) return 0;
  let arancel = 24; // base aproximada
  const tramos: { hasta: number; pct: number }[] = [
    { hasta: 6010, pct: 0 },
    { hasta: 30050, pct: 0.00175 },
    { hasta: 60100, pct: 0.00125 },
    { hasta: 150250, pct: 0.00075 },
    { hasta: 601000, pct: 0.0003 },
    { hasta: Infinity, pct: 0.0002 },
  ];
  let prev = 0;
  for (const t of tramos) {
    if (valorInmueble <= prev) break;
    const tramoBase = Math.min(valorInmueble, t.hasta) - prev;
    arancel += tramoBase * t.pct;
    prev = t.hasta;
  }
  return round2(arancel);
}

/**
 * Estimacion de honorarios de gestoria por tramitar la herencia completa.
 * Muy variable en el mercado; usamos un rango medio.
 */
export function estimateGestoria(valorHerencia: number, hasProperty: boolean): number {
  let base = 350;
  if (hasProperty) base += 250;
  // Pequenyo componente variable para herencias grandes
  if (valorHerencia > 300000) base += Math.min(800, (valorHerencia - 300000) * 0.001);
  return round2(base);
}

export function calculateHerenciaCost(input: HerenciaCostInput): HerenciaCostResult {
  const lines: CostLine[] = [];

  // ── 1. Impuesto sobre Sucesiones (Modelo 650) ─────────
  const isd = calculateISDForCCAA(input.ccaa, {
    group: input.group,
    baseImponible: input.valorHerencia,
    preexistingPatrimony: input.preexistingPatrimony,
  });
  lines.push({
    key: "isd",
    label: "Impuesto sobre Sucesiones (Modelo 650)",
    amount: round2(isd.cuotaAPagar),
    note: `Cuota tras bonificacion autonomica. Base ${input.valorHerencia.toLocaleString("es-ES")} €, grupo ${input.group}.`,
  });

  // ── 2. Plusvalia municipal (si hay inmueble) ──────────
  if (input.hasProperty && input.property) {
    const plusvaliaInput: PlusvaliaInput = {
      valorCatastralTotal: input.property.valorCatastralTotal,
      valorCatastralSuelo: input.property.valorCatastralSuelo,
      anyosTenencia: input.property.anyosTenencia,
      tipoGravamen: input.property.tipoGravamenMunicipal,
      valorAdquisicion: input.property.valorAdquisicion,
      valorTransmision: input.property.valorTransmision,
    };
    const plusvalia = calculatePlusvalia(plusvaliaInput);
    lines.push({
      key: "plusvalia",
      label: "Plusvalia municipal (IIVTNU)",
      amount: round2(plusvalia.cuotaRecomendada),
      note:
        plusvalia.metodoRecomendado === "no-sujeto"
          ? "No sujeto: no hay incremento de valor del suelo."
          : `Metodo ${plusvalia.metodoRecomendado === "real" ? "real" : "objetivo"} (el de menor cuota).`,
    });
  }

  // ── 3. Notaria ────────────────────────────────────────
  const notaria = estimateNotaria(input.valorHerencia);
  lines.push({
    key: "notaria",
    label: "Notaria (escritura de aceptacion de herencia)",
    amount: notaria,
    note: "Estimacion de aranceles notariales. El importe real depende del numero de bienes y herederos.",
  });

  // ── 4. Registro de la Propiedad (si hay inmueble) ─────
  if (input.hasProperty && input.property) {
    const valorInmueble =
      input.property.valorTransmision ?? input.property.valorCatastralTotal;
    const registro = estimateRegistro(valorInmueble);
    lines.push({
      key: "registro",
      label: "Registro de la Propiedad (inscripcion del inmueble)",
      amount: registro,
      note: "Estimacion de aranceles registrales para inscribir el inmueble a nombre de los herederos.",
    });
  }

  // ── 5. Gestoria (opcional) ────────────────────────────
  if (input.includeGestoria) {
    const gestoria = estimateGestoria(input.valorHerencia, input.hasProperty);
    lines.push({
      key: "gestoria",
      label: "Honorarios de gestoria (estimado)",
      amount: gestoria,
      note: "Estimacion media de mercado por tramitar la herencia completa. Muy variable segun el despacho.",
    });
  }

  const total = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const pctOfHerencia =
    input.valorHerencia > 0 ? round2((total / input.valorHerencia) * 100) : 0;

  return { lines, total, pctOfHerencia };
}
