/**
 * Modelo financiero del proyecto BARITUR PRO.
 *
 * Motor puro de proyeccion a 36 meses con tres ejes:
 *   1. Adquisicion (SEO traffic -> free tool sessions -> trials -> paid)
 *   2. Retencion (churn mensual decreciente con la madurez)
 *   3. Costes (variables por cliente + opex creciente con plantilla)
 *
 * Sin dependencia de DB ni de IA: todo es deterministico y testeable.
 */

export interface PlanConfig {
  /** Precio mensual del plan en euros */
  price: number;
  /** % del mix de clientes nuevos que va a este plan (0-100) */
  mix: number;
}

export interface FinancialAssumptions {
  /** Visitas SEO mensuales el mes 1 */
  initialSeoVisits: number;
  /** Multiplicador mensual de crecimiento (1.15 = 15% mes a mes) */
  monthlySeoGrowth: number;
  /** Mes a partir del cual el crecimiento se modera (compounding cap) */
  growthCapMonth: number;
  /** Crecimiento mensual tras el cap (1.05 = 5% mes a mes) */
  postCapGrowth: number;

  /** % de visitas que usan free tools (calc, borrador) */
  freeToolRate: number;
  /** % de free tool users que inician trial */
  trialRate: number;
  /** % de trials que convierten a pago */
  paidConversionRate: number;

  /** Churn mensual a Y1 (0.025 = 2.5%) */
  churnMonthlyY1: number;
  /** Churn mensual a Y2 */
  churnMonthlyY2: number;
  /** Churn mensual a Y3 */
  churnMonthlyY3: number;

  /** Mix de planes */
  plans: {
    INICIA: PlanConfig;
    DESPACHO: PlanConfig;
    FIRMA: PlanConfig;
  };

  /** Coste variable por cliente al mes (infra + AI + email + Stripe) */
  variableCostPerCustomer: number;

  /** OPEX fijo mensual por anyo */
  fixedOpexY1: number;
  fixedOpexY2: number;
  fixedOpexY3: number;
}

export const DEFAULT_ASSUMPTIONS: FinancialAssumptions = {
  initialSeoVisits: 200,
  monthlySeoGrowth: 1.45, // 45% mes a mes en fase inicial (SEO compounding)
  growthCapMonth: 9,
  postCapGrowth: 1.12, // 12% tras estabilizarse
  freeToolRate: 0.15, // 15% de visitas usa una herramienta
  trialRate: 0.03, // 3% de free tools inicia trial
  paidConversionRate: 0.30, // 30% trial -> paid
  churnMonthlyY1: 0.025,
  churnMonthlyY2: 0.020,
  churnMonthlyY3: 0.015,
  plans: {
    INICIA: { price: 149, mix: 40 },
    DESPACHO: { price: 349, mix: 50 },
    FIRMA: { price: 749, mix: 10 },
  },
  variableCostPerCustomer: 35,
  fixedOpexY1: 1200,
  fixedOpexY2: 8500,
  fixedOpexY3: 22000,
};

export interface MonthRow {
  month: number;
  seoVisits: number;
  freeToolSessions: number;
  trials: number;
  newCustomersGross: number;
  churnedCustomers: number;
  netNewCustomers: number;
  totalCustomers: number;
  mrr: number;
  arr: number;
  variableCost: number;
  fixedOpex: number;
  ebitda: number;
  cumulativeCash: number;
}

export interface AnnualSummary {
  year: 1 | 2 | 3;
  endingCustomers: number;
  endingMrr: number;
  endingArr: number;
  totalRevenue: number;
  totalVariableCost: number;
  totalFixedOpex: number;
  ebitda: number;
  ebitdaMargin: number;
}

export interface FinancialProjection {
  monthly: MonthRow[];
  annual: AnnualSummary[];
  breakEvenMonth: number | null;
  totalCapitalNeeded: number;
  arpu: number;
}

function average(plans: FinancialAssumptions["plans"]): number {
  const total = plans.INICIA.mix + plans.DESPACHO.mix + plans.FIRMA.mix;
  if (total === 0) return 0;
  return (
    (plans.INICIA.price * plans.INICIA.mix +
      plans.DESPACHO.price * plans.DESPACHO.mix +
      plans.FIRMA.price * plans.FIRMA.mix) /
    total
  );
}

function churnForMonth(month: number, a: FinancialAssumptions): number {
  if (month <= 12) return a.churnMonthlyY1;
  if (month <= 24) return a.churnMonthlyY2;
  return a.churnMonthlyY3;
}

function fixedOpexForMonth(month: number, a: FinancialAssumptions): number {
  if (month <= 12) return a.fixedOpexY1;
  if (month <= 24) return a.fixedOpexY2;
  return a.fixedOpexY3;
}

export function projectFinancials(a: FinancialAssumptions): FinancialProjection {
  const arpu = average(a.plans);
  const monthly: MonthRow[] = [];

  let seoVisits = a.initialSeoVisits;
  let totalCustomers = 0;
  let cumulativeCash = 0;
  let breakEvenMonth: number | null = null;

  for (let m = 1; m <= 36; m++) {
    if (m > 1) {
      const growth = m <= a.growthCapMonth ? a.monthlySeoGrowth : a.postCapGrowth;
      seoVisits = Math.floor(seoVisits * growth);
    }

    const freeToolSessions = Math.floor(seoVisits * a.freeToolRate);
    const trials = Math.floor(freeToolSessions * a.trialRate);
    const newCustomersGross = Math.floor(trials * a.paidConversionRate);

    const churnRate = churnForMonth(m, a);
    const churnedCustomers = Math.round(totalCustomers * churnRate);
    const netNewCustomers = newCustomersGross - churnedCustomers;
    totalCustomers = Math.max(0, totalCustomers + netNewCustomers);

    const mrr = totalCustomers * arpu;
    const arr = mrr * 12;
    const variableCost = totalCustomers * a.variableCostPerCustomer;
    const fixedOpex = fixedOpexForMonth(m, a);
    const ebitda = mrr - variableCost - fixedOpex;
    cumulativeCash += ebitda;

    if (breakEvenMonth === null && cumulativeCash >= 0 && m > 1) {
      breakEvenMonth = m;
    }

    monthly.push({
      month: m,
      seoVisits,
      freeToolSessions,
      trials,
      newCustomersGross,
      churnedCustomers,
      netNewCustomers,
      totalCustomers,
      mrr: round0(mrr),
      arr: round0(arr),
      variableCost: round0(variableCost),
      fixedOpex,
      ebitda: round0(ebitda),
      cumulativeCash: round0(cumulativeCash),
    });
  }

  const annual: AnnualSummary[] = [];
  for (let y = 1; y <= 3; y++) {
    const start = (y - 1) * 12;
    const slice = monthly.slice(start, start + 12);
    const last = slice[slice.length - 1];
    const totalRevenue = slice.reduce((s, r) => s + r.mrr, 0);
    const totalVariableCost = slice.reduce((s, r) => s + r.variableCost, 0);
    const totalFixedOpex = slice.reduce((s, r) => s + r.fixedOpex, 0);
    const ebitda = totalRevenue - totalVariableCost - totalFixedOpex;
    annual.push({
      year: y as 1 | 2 | 3,
      endingCustomers: last.totalCustomers,
      endingMrr: last.mrr,
      endingArr: last.arr,
      totalRevenue: round0(totalRevenue),
      totalVariableCost: round0(totalVariableCost),
      totalFixedOpex,
      ebitda: round0(ebitda),
      ebitdaMargin: totalRevenue > 0 ? round2(ebitda / totalRevenue) : 0,
    });
  }

  // Capital needed = max negative cumulative cash from any month
  const minCash = Math.min(0, ...monthly.map((r) => r.cumulativeCash));
  const totalCapitalNeeded = round0(Math.abs(minCash));

  return {
    monthly,
    annual,
    breakEvenMonth,
    totalCapitalNeeded,
    arpu: round2(arpu),
  };
}

/**
 * Genera el modelo en formato CSV (descargable, abre en Excel/Sheets).
 */
export function projectionToCSV(p: FinancialProjection): string {
  const lines: string[] = [];

  // Header summary
  lines.push("BARITUR PRO - Modelo financiero a 36 meses");
  lines.push("");
  lines.push(`ARPU medio (€/mes);${p.arpu}`);
  lines.push(`Break-even mes;${p.breakEvenMonth ?? "n/a"}`);
  lines.push(`Capital inicial necesario (€);${p.totalCapitalNeeded}`);
  lines.push("");

  // Annual summary
  lines.push("RESUMEN ANUAL");
  lines.push("Anyo;Clientes fin;MRR fin (€);ARR fin (€);Ingresos anuales (€);Coste variable (€);OPEX fijo (€);EBITDA (€);Margen EBITDA");
  for (const y of p.annual) {
    lines.push(`${y.year};${y.endingCustomers};${y.endingMrr};${y.endingArr};${y.totalRevenue};${y.totalVariableCost};${y.totalFixedOpex};${y.ebitda};${(y.ebitdaMargin * 100).toFixed(0)}%`);
  }
  lines.push("");

  // Monthly detail
  lines.push("DETALLE MENSUAL");
  lines.push("Mes;Visitas SEO;Free tools;Trials;Nuevos brutos;Churn;Net new;Total clientes;MRR (€);ARR (€);Coste variable (€);OPEX fijo (€);EBITDA (€);Cash acumulado (€)");
  for (const r of p.monthly) {
    lines.push(`${r.month};${r.seoVisits};${r.freeToolSessions};${r.trials};${r.newCustomersGross};${r.churnedCustomers};${r.netNewCustomers};${r.totalCustomers};${r.mrr};${r.arr};${r.variableCost};${r.fixedOpex};${r.ebitda};${r.cumulativeCash}`);
  }

  return lines.join("\n");
}

function round0(n: number): number {
  return Math.round(n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
