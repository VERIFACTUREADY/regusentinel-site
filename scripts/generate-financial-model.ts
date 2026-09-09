/**
 * Genera el modelo financiero de Heredia en formato XLSX descargable.
 *
 * Uso:
 *   npx tsx scripts/generate-financial-model.ts
 *
 * Salida: public/heredia-modelo-financiero.xlsx
 *
 * El archivo tiene 6 hojas con formulas reales que recalculan al editar
 * cualquier hipotesis. Los valores precalculados se incluyen como cache
 * para que SheetJS preserve las formulas en el xlsx escrito.
 */

import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  projectFinancials,
  DEFAULT_ASSUMPTIONS,
  type FinancialAssumptions,
  type PlanConfig,
} from "../src/lib/financial-model";

const OUT_DIR = join(process.cwd(), "public");
const OUT_FILE = join(OUT_DIR, "heredia-modelo-financiero.xlsx");

function setupFeeWeightedAvg(plans: FinancialAssumptions["plans"]): number {
  const total = plans.INICIA.mix + plans.DESPACHO.mix + plans.FIRMA.mix;
  if (total === 0) return 0;
  const f = (p: PlanConfig) => (p.setupFee ?? 0) * p.mix;
  return (f(plans.INICIA) + f(plans.DESPACHO) + f(plans.FIRMA)) / total;
}

// Helpers ─────────────────────────────────────────────────

function setCell(ws: XLSX.WorkSheet, ref: string, value: string | number | boolean | null) {
  if (value === null) return;
  const t: "s" | "n" | "b" =
    typeof value === "number" ? "n" :
    typeof value === "boolean" ? "b" :
    "s";
  ws[ref] = { t, v: value };
}

/** Cell with formula AND cached value. SheetJS requires both. */
function setFormulaWithValue(ws: XLSX.WorkSheet, ref: string, formula: string, cachedValue: number) {
  ws[ref] = { t: "n", v: cachedValue, f: formula };
}

function setRange(ws: XLSX.WorkSheet, range: string) {
  ws["!ref"] = range;
}

function setCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

// ─── Compute projection data once ─────────────────────────

const projection = projectFinancials(DEFAULT_ASSUMPTIONS);
const a = DEFAULT_ASSUMPTIONS;
const arpu = a.plans.INICIA.price * a.plans.INICIA.mix +
             a.plans.DESPACHO.price * a.plans.DESPACHO.mix +
             a.plans.FIRMA.price * a.plans.FIRMA.mix;
const avgSetupFee = setupFeeWeightedAvg(a.plans);

// ─── HOJA 1: HIPOTESIS ────────────────────────────────────

function buildAssumptionsSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "Heredia - Modelo financiero");
  setCell(ws, "A2", "Hipotesis editables. Todas las hojas recalculan automaticamente al cambiar estos valores.");

  setCell(ws, "A4", "ADQUISICION (TRAFICO SEO)");
  setCell(ws, "C4", "valor");
  setCell(ws, "D4", "unidad");
  setCell(ws, "E4", "notas");

  setCell(ws, "A5", "Visitas SEO mes 1");
  setCell(ws, "C5", a.initialSeoVisits);
  setCell(ws, "D5", "visitas/mes");
  setCell(ws, "E5", "Estimacion conservadora desde lanzamiento");

  setCell(ws, "A6", "Crecimiento mensual fase inicial");
  setCell(ws, "C6", a.monthlySeoGrowth);
  setCell(ws, "D6", "x");
  setCell(ws, "E6", "45% mes a mes (SEO compounding)");

  setCell(ws, "A7", "Mes en que el crecimiento se modera");
  setCell(ws, "C7", a.growthCapMonth);
  setCell(ws, "D7", "mes");

  setCell(ws, "A8", "Crecimiento mensual fase madura");
  setCell(ws, "C8", a.postCapGrowth);
  setCell(ws, "D8", "x");
  setCell(ws, "E8", "12% mes a mes despues del cap");

  setCell(ws, "A10", "CONVERSION");
  setCell(ws, "C10", "valor");
  setCell(ws, "D10", "unidad");

  setCell(ws, "A11", "% visitas que usan free tools");
  setCell(ws, "C11", a.freeToolRate);
  setCell(ws, "D11", "%");
  setCell(ws, "E11", "Calculadora, comparador, borrador 650/651");

  setCell(ws, "A12", "% free tool users que inician trial");
  setCell(ws, "C12", a.trialRate);
  setCell(ws, "D12", "%");

  setCell(ws, "A13", "% trials que convierten a pago");
  setCell(ws, "C13", a.paidConversionRate);
  setCell(ws, "D13", "%");
  setCell(ws, "E13", "Benchmark B2B SaaS especializado");

  setCell(ws, "A15", "CHURN");
  setCell(ws, "C15", "valor");

  setCell(ws, "A16", "Churn mensual Y1");
  setCell(ws, "C16", a.churnMonthlyY1);
  setCell(ws, "D16", "%/mes");

  setCell(ws, "A17", "Churn mensual Y2");
  setCell(ws, "C17", a.churnMonthlyY2);
  setCell(ws, "D17", "%/mes");

  setCell(ws, "A18", "Churn mensual Y3");
  setCell(ws, "C18", a.churnMonthlyY3);
  setCell(ws, "D18", "%/mes");

  setCell(ws, "A20", "PRICING Y MIX");
  setCell(ws, "C20", "valor");
  setCell(ws, "E20", "setup fee");

  setCell(ws, "A21", "Precio INICIA");
  setCell(ws, "C21", a.plans.INICIA.price);
  setCell(ws, "D21", "EUR/mes");
  setCell(ws, "E21", a.plans.INICIA.setupFee ?? 0);
  setCell(ws, "F21", "EUR setup unico");

  setCell(ws, "A22", "Precio DESPACHO");
  setCell(ws, "C22", a.plans.DESPACHO.price);
  setCell(ws, "D22", "EUR/mes");
  setCell(ws, "E22", a.plans.DESPACHO.setupFee ?? 0);
  setCell(ws, "F22", "EUR setup unico");

  setCell(ws, "A23", "Precio FIRMA");
  setCell(ws, "C23", a.plans.FIRMA.price);
  setCell(ws, "D23", "EUR/mes");
  setCell(ws, "E23", a.plans.FIRMA.setupFee ?? 0);
  setCell(ws, "F23", "EUR setup unico");

  setCell(ws, "A25", "% mix INICIA");
  setCell(ws, "C25", a.plans.INICIA.mix);
  setCell(ws, "D25", "%");

  setCell(ws, "A26", "% mix DESPACHO");
  setCell(ws, "C26", a.plans.DESPACHO.mix);
  setCell(ws, "D26", "%");

  setCell(ws, "A27", "% mix FIRMA");
  setCell(ws, "C27", a.plans.FIRMA.mix);
  setCell(ws, "D27", "%");

  setCell(ws, "A29", "COSTES");
  setCell(ws, "C29", "valor");

  setCell(ws, "A30", "Coste variable por cliente");
  setCell(ws, "C30", a.variableCostPerCustomer);
  setCell(ws, "D30", "EUR/cliente/mes");
  setCell(ws, "E30", "Infra+AI+Stripe+Email+soporte");

  setCell(ws, "A31", "OPEX fijo mensual Y1");
  setCell(ws, "C31", a.fixedOpexY1);
  setCell(ws, "D31", "EUR/mes");

  setCell(ws, "A32", "OPEX fijo mensual Y2");
  setCell(ws, "C32", a.fixedOpexY2);
  setCell(ws, "D32", "EUR/mes");
  setCell(ws, "E32", "Incluye 1 contratacion soporte");

  setCell(ws, "A33", "OPEX fijo mensual Y3");
  setCell(ws, "C33", a.fixedOpexY3);
  setCell(ws, "D33", "EUR/mes");
  setCell(ws, "E33", "Soporte + sales + marketing");

  setCell(ws, "A34", "CAC por nuevo cliente");
  setCell(ws, "C34", a.cacPerNewCustomer);
  setCell(ws, "D34", "EUR/cliente nuevo");
  setCell(ws, "E34", "Blended: contenidos amortizados + paid puntual (0 si 100% organico)");

  setCell(ws, "A36", "ARPU MEDIO (calculado)");
  setFormulaWithValue(ws, "C36", "C21*C25+C22*C26+C23*C27", arpu);
  setCell(ws, "D36", "EUR/mes");
  setCell(ws, "E36", "Mix-weighted (no editar; deriva de Pricing y Mix)");

  setCell(ws, "A37", "SETUP FEE MEDIO (calculado)");
  setFormulaWithValue(ws, "C37", "E21*C25+E22*C26+E23*C27", avgSetupFee);
  setCell(ws, "D37", "EUR/cliente nuevo");
  setCell(ws, "E37", "Mix-weighted (no editar; deriva de Setup y Mix)");

  setRange(ws, "A1:F37");
  setCols(ws, [36, 4, 14, 18, 14, 60]);
  return ws;
}

// ─── HOJA 2: PROYECCION MENSUAL ──────────────────────────

function buildMonthlySheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "PROYECCION MENSUAL - 36 MESES");
  setCell(ws, "A2", "Todas las cifras se recalculan al cambiar las Hipotesis");

  const headers = [
    "Mes", "Visitas SEO", "Free tool sessions", "Trials", "Nuevos clientes",
    "Clientes churn", "Net new", "Total clientes",
    "MRR (EUR)", "ARR (EUR)", "Setup rev (EUR)", "Revenue total (EUR)",
    "Coste variable (EUR)", "CAC (EUR)", "OPEX fijo (EUR)",
    "EBITDA (EUR)", "Cash acumulado (EUR)",
  ];
  const cols = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q"];
  headers.forEach((h, i) => setCell(ws, `${cols[i]}4`, h));

  const A_VISITS_INIT = "Hipotesis!$C$5";
  const A_GROWTH_EARLY = "Hipotesis!$C$6";
  const A_GROWTH_CAP = "Hipotesis!$C$7";
  const A_GROWTH_LATE = "Hipotesis!$C$8";
  const A_FREE = "Hipotesis!$C$11";
  const A_TRIAL = "Hipotesis!$C$12";
  const A_PAID = "Hipotesis!$C$13";
  const A_CHURN_Y1 = "Hipotesis!$C$16";
  const A_CHURN_Y2 = "Hipotesis!$C$17";
  const A_CHURN_Y3 = "Hipotesis!$C$18";
  const A_VAR_COST = "Hipotesis!$C$30";
  const A_OPEX_Y1 = "Hipotesis!$C$31";
  const A_OPEX_Y2 = "Hipotesis!$C$32";
  const A_OPEX_Y3 = "Hipotesis!$C$33";
  const A_CAC = "Hipotesis!$C$34";
  const A_ARPU = "Hipotesis!$C$36";
  const A_SETUP_AVG = "Hipotesis!$C$37";

  for (let m = 1; m <= 36; m++) {
    const row = m + 4;
    const data = projection.monthly[m - 1];

    setCell(ws, `A${row}`, m);

    // B: visitas SEO
    if (m === 1) {
      setFormulaWithValue(ws, `B${row}`, `ROUND(${A_VISITS_INIT},0)`, data.seoVisits);
    } else {
      setFormulaWithValue(ws, `B${row}`, `ROUND(B${row - 1}*IF(${m}<=${A_GROWTH_CAP},${A_GROWTH_EARLY},${A_GROWTH_LATE}),0)`, data.seoVisits);
    }

    setFormulaWithValue(ws, `C${row}`, `ROUND(B${row}*${A_FREE},0)`, data.freeToolSessions);
    setFormulaWithValue(ws, `D${row}`, `ROUND(C${row}*${A_TRIAL},0)`, data.trials);
    setFormulaWithValue(ws, `E${row}`, `ROUND(D${row}*${A_PAID},0)`, data.newCustomersGross);

    // F: churn
    if (m === 1) {
      setCell(ws, `F${row}`, 0);
    } else {
      const churnRef = m <= 12 ? A_CHURN_Y1 : m <= 24 ? A_CHURN_Y2 : A_CHURN_Y3;
      setFormulaWithValue(ws, `F${row}`, `ROUND(H${row - 1}*${churnRef},0)`, data.churnedCustomers);
    }

    setFormulaWithValue(ws, `G${row}`, `E${row}-F${row}`, data.netNewCustomers);

    if (m === 1) {
      setFormulaWithValue(ws, `H${row}`, `MAX(0,G${row})`, data.totalCustomers);
    } else {
      setFormulaWithValue(ws, `H${row}`, `MAX(0,H${row - 1}+G${row})`, data.totalCustomers);
    }

    setFormulaWithValue(ws, `I${row}`, `ROUND(H${row}*${A_ARPU},0)`, data.mrr);
    setFormulaWithValue(ws, `J${row}`, `I${row}*12`, data.arr);
    setFormulaWithValue(ws, `K${row}`, `ROUND(E${row}*${A_SETUP_AVG},0)`, data.setupRevenue);
    setFormulaWithValue(ws, `L${row}`, `I${row}+K${row}`, data.totalRevenue);
    setFormulaWithValue(ws, `M${row}`, `ROUND(H${row}*${A_VAR_COST},0)`, data.variableCost);
    setFormulaWithValue(ws, `N${row}`, `ROUND(E${row}*${A_CAC},0)`, data.cacCost);

    const opexRef = m <= 12 ? A_OPEX_Y1 : m <= 24 ? A_OPEX_Y2 : A_OPEX_Y3;
    setFormulaWithValue(ws, `O${row}`, opexRef, data.fixedOpex);
    setFormulaWithValue(ws, `P${row}`, `L${row}-M${row}-N${row}-O${row}`, data.ebitda);

    if (m === 1) {
      setFormulaWithValue(ws, `Q${row}`, `P${row}`, data.cumulativeCash);
    } else {
      setFormulaWithValue(ws, `Q${row}`, `Q${row - 1}+P${row}`, data.cumulativeCash);
    }
  }

  setRange(ws, "A1:Q40");
  setCols(ws, [6, 14, 18, 10, 14, 14, 10, 14, 14, 16, 14, 16, 18, 12, 14, 14, 18]);
  return ws;
}

// ─── HOJA 3: RESUMEN ANUAL ───────────────────────────────

function buildAnnualSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "RESUMEN ANUAL");
  setCell(ws, "A2", "Calculado a partir de la Proyeccion Mensual (Revenue = MRR + Setup)");

  const headers = ["Anyo", "Clientes fin", "MRR fin (EUR)", "ARR fin (EUR)", "Revenue total (EUR)", "Coste var (EUR)", "CAC (EUR)", "OPEX fijo (EUR)", "EBITDA (EUR)", "Margen EBITDA"];
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  headers.forEach((h, i) => setCell(ws, `${cols[i]}4`, h));

  for (let y = 1; y <= 3; y++) {
    const yData = projection.annual[y - 1];
    const row = y + 4;
    const startMonth = (y - 1) * 12 + 5;
    const endMonth = startMonth + 11;

    setCell(ws, `A${row}`, y);
    setFormulaWithValue(ws, `B${row}`, `Proyeccion!H${endMonth}`, yData.endingCustomers);
    setFormulaWithValue(ws, `C${row}`, `Proyeccion!I${endMonth}`, yData.endingMrr);
    setFormulaWithValue(ws, `D${row}`, `Proyeccion!J${endMonth}`, yData.endingArr);
    setFormulaWithValue(ws, `E${row}`, `SUM(Proyeccion!L${startMonth}:L${endMonth})`, yData.totalRevenue);
    setFormulaWithValue(ws, `F${row}`, `SUM(Proyeccion!M${startMonth}:M${endMonth})`, yData.totalVariableCost);
    setFormulaWithValue(ws, `G${row}`, `SUM(Proyeccion!N${startMonth}:N${endMonth})`, yData.totalCac);
    setFormulaWithValue(ws, `H${row}`, `SUM(Proyeccion!O${startMonth}:O${endMonth})`, yData.totalFixedOpex);
    setFormulaWithValue(ws, `I${row}`, `E${row}-F${row}-G${row}-H${row}`, yData.ebitda);
    setFormulaWithValue(ws, `J${row}`, `IF(E${row}=0,0,I${row}/E${row})`, yData.ebitdaMargin);
  }

  setCell(ws, "A10", "BREAK-EVEN");
  setCell(ws, "A11", "Mes en que cash acumulado >= 0");
  if (projection.breakEvenMonth) {
    setFormulaWithValue(ws, "C11", "MATCH(TRUE,Proyeccion!Q5:Q40>=0,0)", projection.breakEvenMonth);
  } else {
    setCell(ws, "C11", "n/a");
  }
  setCell(ws, "A12", "Capital inicial necesario (EUR)");
  setFormulaWithValue(ws, "C12", "ABS(MIN(0,MIN(Proyeccion!Q5:Q40)))", projection.totalCapitalNeeded);

  setRange(ws, "A1:J12");
  setCols(ws, [36, 14, 14, 16, 18, 18, 12, 16, 14, 14]);
  return ws;
}

// ─── HOJA 4: CASH FLOW ───────────────────────────────────

function buildCashFlowSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "CASH FLOW MENSUAL");
  setCell(ws, "A2", "Ingresos (MRR + Setup), costes (variable + CAC + OPEX) y posicion de tesoreria");

  const headers = ["Mes", "Revenue total (EUR)", "Coste variable (EUR)", "CAC (EUR)", "OPEX fijo (EUR)", "Cash flow del mes (EUR)", "Cash acumulado (EUR)"];
  const cols = ["A", "B", "C", "D", "E", "F", "G"];
  headers.forEach((h, i) => setCell(ws, `${cols[i]}4`, h));

  for (let m = 1; m <= 36; m++) {
    const row = m + 4;
    const d = projection.monthly[m - 1];
    setCell(ws, `A${row}`, m);
    setFormulaWithValue(ws, `B${row}`, `Proyeccion!L${row}`, d.totalRevenue);
    setFormulaWithValue(ws, `C${row}`, `Proyeccion!M${row}`, d.variableCost);
    setFormulaWithValue(ws, `D${row}`, `Proyeccion!N${row}`, d.cacCost);
    setFormulaWithValue(ws, `E${row}`, `Proyeccion!O${row}`, d.fixedOpex);
    setFormulaWithValue(ws, `F${row}`, `B${row}-C${row}-D${row}-E${row}`, d.ebitda);
    setFormulaWithValue(ws, `G${row}`, `Proyeccion!Q${row}`, d.cumulativeCash);
  }

  setRange(ws, "A1:G40");
  setCols(ws, [6, 18, 18, 12, 14, 22, 18]);
  return ws;
}

// ─── HOJA 5: ESCENARIOS ──────────────────────────────────

function buildScenariosSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "ESCENARIOS COMPARADOS");
  setCell(ws, "A2", "Este XLSX se genera con el escenario STRETCH. Para ver el escenario CONSERVATIVE, edita la hoja Hipotesis con los valores de la columna 'Conservador' o consulta src/lib/financial-model.ts (export CONSERVATIVE_ASSUMPTIONS).");

  const rows: (string | number | null)[][] = [
    ["Variable", "Conservador", "Stretch (default)"],
    ["Visitas SEO mes 1", 400, 200],
    ["Crecimiento m-a-m inicial (x)", 1.28, 1.45],
    ["Crecimiento m-a-m maduro (x)", 1.09, 1.12],
    ["% free tools sobre visitas", 0.15, 0.15],
    ["% trials sobre free tools", 0.025, 0.03],
    ["% paid sobre trials", 0.20, 0.30],
    ["Churn Y1", 0.035, 0.025],
    ["Churn Y2", 0.025, 0.020],
    ["Churn Y3", 0.018, 0.015],
    ["Coste variable / cliente", 50, 35],
    ["CAC / nuevo cliente", 120, 0],
    ["OPEX fijo Y1 (EUR/mes)", 5000, 1200],
    ["OPEX fijo Y2 (EUR/mes)", 14000, 8500],
    ["OPEX fijo Y3 (EUR/mes)", 32000, 22000],
    ["% mix INICIA / DESPACHO / FIRMA", "55/38/7", "40/50/10"],
    [null, null, null],
    ["Resultados M36 (valores aproximados del motor):", null, null],
    ["Clientes finales", 213, 910],
    ["ARR fin (EUR/anyo)", 681000, 3373000],
    ["Revenue total acumulado 36m (EUR)", 600000, 2610000],
    ["EBITDA Y3 (EUR)", -26000, 1620000],
    ["Margen EBITDA Y3", "-6%", "77%"],
    ["Break-even (mes)", "no alcanzado", 8],
    ["Capital necesario (EUR)", 174000, 3200],
  ];

  rows.forEach((r, i) => {
    const rowNum = i + 4;
    r.forEach((cell, j) => {
      const colLetter = ["A", "B", "C"][j];
      if (cell != null) setCell(ws, `${colLetter}${rowNum}`, cell as string | number);
    });
  });

  setRange(ws, "A1:C30");
  setCols(ws, [42, 18, 18]);
  return ws;
}

// ─── HOJA 6: NOTAS ───────────────────────────────────────

function buildNotesSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  const lines = [
    "Heredia - Notas metodologicas",
    "",
    "EMBUDO DE ADQUISICION",
    "Visitas SEO -> Free tool sessions -> Trials -> Paying customers",
    "Cada conversion tiene su tasa parametrizable en Hipotesis.",
    "",
    "CRECIMIENTO ORGANICO",
    "El SEO crece compounding al principio (paginas indexan, backlinks suman)",
    "y se modera cuando se agota el long-tail. Cap configurable en Hipotesis!C7.",
    "",
    "CHURN",
    "Decreciente con la madurez (Y1 mas alto, Y3 mas bajo).",
    "Aplicado al saldo de clientes a fin del mes anterior.",
    "",
    "ARPU",
    "Precio medio ponderado por mix de planes.",
    "Editar el mix en Hipotesis para reflejar tu estrategia comercial.",
    "Si cambias el mix, asegurate de que la suma sea 1.0 (o ajusta a porcentajes).",
    "",
    "COSTE VARIABLE",
    "Por cliente al mes incluye: Vercel/DB/S3, Anthropic API,",
    "email transaccional, Stripe fees (~3%) y soporte humano basico",
    "(30 min/cliente/mes en escenario conservador).",
    "",
    "CAC",
    "Coste de adquisicion blended: amortizacion del contenido SEO publicado",
    "+ paid puntual. Default STRETCH = 0 (asume 100% organico).",
    "Default CONSERVATIVE = 120 EUR/cliente nuevo.",
    "",
    "SETUP FEE",
    "Cuota unica al activar planes Despacho (299 EUR) y Firma (990 EUR).",
    "El motor calcula el promedio ponderado por mix y lo aplica a cada nuevo",
    "cliente. Se contabiliza como revenue puntual en Revenue total.",
    "",
    "OPEX FIJO (escenario STRETCH default)",
    "Y1: founder sin sueldo + tools + dominios = 1.200/mes",
    "Y2: +1 perfil soporte (~30k anuales) = 8.500/mes",
    "Y3: +1 perfil sales + marketing pagado = 22.000/mes",
    "",
    "OPEX FIJO (escenario CONSERVATIVE)",
    "Y1: payroll fundador minimo + tools + legal + DPO + RC = 5.000/mes",
    "Y2: +1 FTE customer success/soporte = 14.000/mes",
    "Y3: +2 FTE dev + sales/marketing + content = 32.000/mes",
    "",
    "LIMITACIONES DEL MODELO",
    "1. No considera estacionalidad (mortalidad varia por mes)",
    "2. Asume conversion lineal; en realidad hay efecto cohorte",
    "3. No incluye recargos por overage (expedientes extra)",
    "4. No considera precio anual con descuento (suele dar +15% LTV)",
    "5. Supone bootstrap: si levantas capital, ajusta OPEX",
    "6. No incluye IVA ni Impuesto de Sociedades (25%)",
    "7. No incluye bad debt (1-3% tipico SaaS B2B)",
    "",
    "COMO USAR",
    "1. Edita las Hipotesis en la primera hoja con tus propios numeros",
    "2. Las hojas Proyeccion, Resumen anual y Cash flow recalcularan automaticamente",
    "3. Si Excel no recalcula, presiona F9 (PC) o Cmd+= (Mac)",
    "4. Para el escenario CONSERVATIVE, edita Hipotesis con los valores de la",
    "   hoja Escenarios (columna B) o consulta CONSERVATIVE_ASSUMPTIONS en el codigo",
  ];

  lines.forEach((line, i) => setCell(ws, `A${i + 1}`, line));

  setRange(ws, `A1:A${lines.length}`);
  setCols(ws, [80]);
  return ws;
}

// ─── BUILD ───────────────────────────────────────────────

function build() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildAssumptionsSheet(), "Hipotesis");
  XLSX.utils.book_append_sheet(wb, buildMonthlySheet(), "Proyeccion");
  XLSX.utils.book_append_sheet(wb, buildAnnualSheet(), "Resumen anual");
  XLSX.utils.book_append_sheet(wb, buildCashFlowSheet(), "Cash flow");
  XLSX.utils.book_append_sheet(wb, buildScenariosSheet(), "Escenarios");
  XLSX.utils.book_append_sheet(wb, buildNotesSheet(), "Notas");

  wb.Props = {
    Title: "Heredia - Modelo financiero",
    Author: "Heredia",
    CreatedDate: new Date(),
  };

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellDates: true }) as Buffer;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, buf);

  console.log(`OK: archivo generado en ${OUT_FILE}`);
  console.log(`Tamanyo: ${(buf.length / 1024).toFixed(1)} KB`);
  console.log(`\nDescargable en:`);
  console.log(`  /heredia-modelo-financiero.xlsx`);
  console.log(`\nUna vez se despliegue Vercel:`);
  console.log(`  https://[tu-dominio]/heredia-modelo-financiero.xlsx`);
}

build();
