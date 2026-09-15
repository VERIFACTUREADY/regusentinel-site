/**
 * Modelo financiero del proyecto Heredia.
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
  /** Setup fee unico cobrado al activar el plan (0 si no aplica) */
  setupFee?: number;
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

  /** CAC: coste de adquisicion EUR por cliente nuevo (paid marketing + content) */
  cacPerNewCustomer: number;

  /** OPEX fijo mensual por anyo (incluye payroll del fundador y contratacion progresiva) */
  fixedOpexY1: number;
  fixedOpexY2: number;
  fixedOpexY3: number;
}

/**
 * Escenario STRETCH: hipotesis optimistas — SEO compounding fuerte, conversion
 * alta, OPEX magro. Util para visualizar el upside pero no defendible ante un
 * inversor sin justificacion adicional. Asume fundador sin sueldo en Y1.
 */
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
    INICIA: { price: 149, mix: 40, setupFee: 0 },
    DESPACHO: { price: 349, mix: 50, setupFee: 299 },
    FIRMA: { price: 749, mix: 10, setupFee: 990 },
  },
  variableCostPerCustomer: 35,
  cacPerNewCustomer: 0, // 100% organico, asume contenido evergreen sin coste imputado
  fixedOpexY1: 1200,
  fixedOpexY2: 8500,
  fixedOpexY3: 22000,
};

/**
 * Escenario BASE/CONSERVATIVE: hipotesis defendibles ante due diligence.
 *   - SEO crece a tasas realistas para nicho B2B vertical (25% MoM early →
 *     8% MoM late). Asume contenido evergreen + 3-5 piezas pillar.
 *   - Conversion trial→paid en banda B2B SaaS sin tarjeta (15%).
 *   - Coste variable incluye soporte humano basico.
 *   - OPEX incluye payroll fundador, contenidos SEO, y plantilla creciente
 *     (Y1: 1 FTE, Y2: 3 FTE, Y3: 6 FTE total).
 *   - CAC blended cuenta esfuerzo de contenidos + adquisicion paid.
 *   - Setup fees incluidos como revenue puntual.
 *   - Mix de planes con sesgo a INICIA (ICP real: gestoria pequenya).
 *
 * Resultados esperados: break-even mes 28-32, capital ~150-200k,
 * ARR Y3 ~700k-1M EUR, margen EBITDA Y3 25-35%.
 */
export const CONSERVATIVE_ASSUMPTIONS: FinancialAssumptions = {
  initialSeoVisits: 400, // sitio en mes 1 con 5-8 piezas pillar + branded + algo de paid
  monthlySeoGrowth: 1.28, // 28% MoM (compounding realista con content marketing intencional)
  growthCapMonth: 9,
  postCapGrowth: 1.09, // 9% tras estabilizarse (sostenible nicho B2B vertical)
  freeToolRate: 0.15,
  trialRate: 0.025,
  paidConversionRate: 0.20, // 20% trial → paid (banda alta B2B SaaS vertical especializado)
  churnMonthlyY1: 0.035, // 3.5% mensual = 34% anual
  churnMonthlyY2: 0.025,
  churnMonthlyY3: 0.018,
  plans: {
    INICIA: { price: 149, mix: 55, setupFee: 0 },
    DESPACHO: { price: 349, mix: 38, setupFee: 299 },
    FIRMA: { price: 749, mix: 7, setupFee: 990 },
  },
  variableCostPerCustomer: 50, // infra + AI + Stripe + email + 30min soporte/cliente
  cacPerNewCustomer: 120, // blended: contenidos amortizados + paid puntual
  fixedOpexY1: 5000, // payroll fundador minimo + tools + legal + DPO + RC
  fixedOpexY2: 14000, // + 1 FTE (customer success / soporte)
  fixedOpexY3: 32000, // + 2 FTE adicionales (dev + sales/marketing) — lean team
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
  /** Ingresos puntuales del mes por setup fees (mix-weighted * nuevos) */
  setupRevenue: number;
  /** Ingresos totales del mes = MRR + setupRevenue */
  totalRevenue: number;
  variableCost: number;
  /** Coste de adquisicion del mes = cacPerNewCustomer * nuevos brutos */
  cacCost: number;
  fixedOpex: number;
  ebitda: number;
  cumulativeCash: number;
}

export interface AnnualSummary {
  year: 1 | 2 | 3;
  endingCustomers: number;
  endingMrr: number;
  endingArr: number;
  /** Revenue total del anyo (MRR acumulado + setup fees del anyo) */
  totalRevenue: number;
  totalVariableCost: number;
  /** Coste de adquisicion acumulado del anyo (CAC * nuevos brutos) */
  totalCac: number;
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

function averageSetupFee(plans: FinancialAssumptions["plans"]): number {
  const total = plans.INICIA.mix + plans.DESPACHO.mix + plans.FIRMA.mix;
  if (total === 0) return 0;
  const fee = (p: PlanConfig) => (p.setupFee ?? 0) * p.mix;
  return (fee(plans.INICIA) + fee(plans.DESPACHO) + fee(plans.FIRMA)) / total;
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
  const avgSetupFee = averageSetupFee(a.plans);
  const monthly: MonthRow[] = [];

  let seoVisits = a.initialSeoVisits;
  let totalCustomers = 0;
  let cumulativeCash = 0;
  let breakEvenMonth: number | null = null;

  // Acumuladores en float — solo redondeamos al escribir el MonthRow.
  // Floorear cada step intermedio destruye volumenes pequenyos (1k visitas *
  // 2% trial * 15% paid = 3.0 → tres pasos de Math.floor lo dejan en 0).
  for (let m = 1; m <= 36; m++) {
    if (m > 1) {
      const growth = m <= a.growthCapMonth ? a.monthlySeoGrowth : a.postCapGrowth;
      seoVisits = seoVisits * growth;
    }

    const freeToolSessions = seoVisits * a.freeToolRate;
    const trials = freeToolSessions * a.trialRate;
    const newCustomersGross = trials * a.paidConversionRate;

    const churnRate = churnForMonth(m, a);
    const churnedCustomers = totalCustomers * churnRate;
    const netNewCustomers = newCustomersGross - churnedCustomers;
    totalCustomers = Math.max(0, totalCustomers + netNewCustomers);

    const mrr = totalCustomers * arpu;
    const arr = mrr * 12;
    const setupRevenue = newCustomersGross * avgSetupFee;
    const totalRevenueMonth = mrr + setupRevenue;
    const variableCost = totalCustomers * a.variableCostPerCustomer;
    const cacCost = newCustomersGross * a.cacPerNewCustomer;
    const fixedOpex = fixedOpexForMonth(m, a);
    const ebitda = totalRevenueMonth - variableCost - cacCost - fixedOpex;
    cumulativeCash += ebitda;

    if (breakEvenMonth === null && cumulativeCash >= 0 && m > 1) {
      breakEvenMonth = m;
    }

    monthly.push({
      month: m,
      seoVisits: round0(seoVisits),
      freeToolSessions: round0(freeToolSessions),
      trials: round0(trials),
      newCustomersGross: round0(newCustomersGross),
      churnedCustomers: round0(churnedCustomers),
      netNewCustomers: round0(netNewCustomers),
      totalCustomers: round0(totalCustomers),
      mrr: round0(mrr),
      arr: round0(arr),
      setupRevenue: round0(setupRevenue),
      totalRevenue: round0(totalRevenueMonth),
      variableCost: round0(variableCost),
      cacCost: round0(cacCost),
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
    const totalRevenue = slice.reduce((s, r) => s + r.totalRevenue, 0);
    const totalVariableCost = slice.reduce((s, r) => s + r.variableCost, 0);
    const totalCac = slice.reduce((s, r) => s + r.cacCost, 0);
    const totalFixedOpex = slice.reduce((s, r) => s + r.fixedOpex, 0);
    const ebitda = totalRevenue - totalVariableCost - totalCac - totalFixedOpex;
    annual.push({
      year: y as 1 | 2 | 3,
      endingCustomers: last.totalCustomers,
      endingMrr: last.mrr,
      endingArr: last.arr,
      totalRevenue: round0(totalRevenue),
      totalVariableCost: round0(totalVariableCost),
      totalCac: round0(totalCac),
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
  lines.push("Heredia - Modelo financiero a 36 meses");
  lines.push("");
  lines.push(`ARPU medio (€/mes);${p.arpu}`);
  lines.push(`Break-even mes;${p.breakEvenMonth ?? "n/a"}`);
  lines.push(`Capital inicial necesario (€);${p.totalCapitalNeeded}`);
  lines.push("");

  // Annual summary
  lines.push("RESUMEN ANUAL");
  lines.push("Anyo;Clientes fin;MRR fin (€);ARR fin (€);Ingresos anuales (€);Coste variable (€);CAC (€);OPEX fijo (€);EBITDA (€);Margen EBITDA");
  for (const y of p.annual) {
    lines.push(`${y.year};${y.endingCustomers};${y.endingMrr};${y.endingArr};${y.totalRevenue};${y.totalVariableCost};${y.totalCac};${y.totalFixedOpex};${y.ebitda};${(y.ebitdaMargin * 100).toFixed(0)}%`);
  }
  lines.push("");

  // Monthly detail
  lines.push("DETALLE MENSUAL");
  lines.push("Mes;Visitas SEO;Free tools;Trials;Nuevos brutos;Churn;Net new;Total clientes;MRR (€);ARR (€);Setup (€);Revenue total (€);Coste variable (€);CAC (€);OPEX fijo (€);EBITDA (€);Cash acumulado (€)");
  for (const r of p.monthly) {
    lines.push(`${r.month};${r.seoVisits};${r.freeToolSessions};${r.trials};${r.newCustomersGross};${r.churnedCustomers};${r.netNewCustomers};${r.totalCustomers};${r.mrr};${r.arr};${r.setupRevenue};${r.totalRevenue};${r.variableCost};${r.cacCost};${r.fixedOpex};${r.ebitda};${r.cumulativeCash}`);
  }

  return lines.join("\n");
}

function round0(n: number): number {
  return Math.round(n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
