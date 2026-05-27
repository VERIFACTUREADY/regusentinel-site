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
} from "../src/lib/financial-model";

const OUT_DIR = join(process.cwd(), "public");
const OUT_FILE = join(OUT_DIR, "heredia-modelo-financiero.xlsx");

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

  setCell(ws, "A21", "Precio INICIA");
  setCell(ws, "C21", a.plans.INICIA.price);
  setCell(ws, "D21", "EUR/mes");

  setCell(ws, "A22", "Precio DESPACHO");
  setCell(ws, "C22", a.plans.DESPACHO.price);
  setCell(ws, "D22", "EUR/mes");

  setCell(ws, "A23", "Precio FIRMA");
  setCell(ws, "C23", a.plans.FIRMA.price);
  setCell(ws, "D23", "EUR/mes");

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
  setCell(ws, "E30", "Infra+AI+Stripe+Email");

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

  setCell(ws, "A35", "ARPU MEDIO (calculado)");
  setFormulaWithValue(ws, "C35", "C21*C25+C22*C26+C23*C27", arpu);
  setCell(ws, "D35", "EUR/mes");
  setCell(ws, "E35", "Mix-weighted (no editar; deriva de Pricing y Mix)");

  setRange(ws, "A1:E35");
  setCols(ws, [36, 4, 14, 18, 60]);
  return ws;
}

// ─── HOJA 2: PROYECCION MENSUAL ──────────────────────────

function buildMonthlySheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "PROYECCION MENSUAL - 36 MESES");
  setCell(ws, "A2", "Todas las cifras se recalculan al cambiar las Hipotesis");

  const headers = ["Mes", "Visitas SEO", "Free tool sessions", "Trials", "Nuevos clientes", "Clientes churn", "Net new", "Total clientes", "MRR (EUR)", "ARR (EUR)", "Coste variable (EUR)", "OPEX fijo (EUR)", "EBITDA (EUR)", "Cash acumulado (EUR)"];
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
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
  const A_ARPU = "Hipotesis!$C$35";

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
    setFormulaWithValue(ws, `K${row}`, `ROUND(H${row}*${A_VAR_COST},0)`, data.variableCost);

    const opexRef = m <= 12 ? A_OPEX_Y1 : m <= 24 ? A_OPEX_Y2 : A_OPEX_Y3;
    setFormulaWithValue(ws, `L${row}`, opexRef, data.fixedOpex);
    setFormulaWithValue(ws, `M${row}`, `I${row}-K${row}-L${row}`, data.ebitda);

    if (m === 1) {
      setFormulaWithValue(ws, `N${row}`, `M${row}`, data.cumulativeCash);
    } else {
      setFormulaWithValue(ws, `N${row}`, `N${row - 1}+M${row}`, data.cumulativeCash);
    }
  }

  setRange(ws, "A1:N40");
  setCols(ws, [6, 14, 18, 10, 14, 14, 10, 14, 14, 16, 18, 14, 14, 18]);
  return ws;
}

// ─── HOJA 3: RESUMEN ANUAL ───────────────────────────────

function buildAnnualSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "RESUMEN ANUAL");
  setCell(ws, "A2", "Calculado a partir de la Proyeccion Mensual");

  const headers = ["Anyo", "Clientes fin", "MRR fin (EUR)", "ARR fin (EUR)", "Ingresos (EUR)", "Coste var (EUR)", "OPEX fijo (EUR)", "EBITDA (EUR)", "Margen EBITDA"];
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
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
    setFormulaWithValue(ws, `E${row}`, `SUM(Proyeccion!I${startMonth}:I${endMonth})`, yData.totalRevenue);
    setFormulaWithValue(ws, `F${row}`, `SUM(Proyeccion!K${startMonth}:K${endMonth})`, yData.totalVariableCost);
    setFormulaWithValue(ws, `G${row}`, `SUM(Proyeccion!L${startMonth}:L${endMonth})`, yData.totalFixedOpex);
    setFormulaWithValue(ws, `H${row}`, `E${row}-F${row}-G${row}`, yData.ebitda);
    setFormulaWithValue(ws, `I${row}`, `IF(E${row}=0,0,H${row}/E${row})`, yData.ebitdaMargin);
  }

  setCell(ws, "A10", "BREAK-EVEN");
  setCell(ws, "A11", "Mes en que cash acumulado >= 0");
  if (projection.breakEvenMonth) {
    setFormulaWithValue(ws, "C11", "MATCH(TRUE,Proyeccion!N5:N40>=0,0)", projection.breakEvenMonth);
  } else {
    setCell(ws, "C11", "n/a");
  }
  setCell(ws, "A12", "Capital inicial necesario (EUR)");
  setFormulaWithValue(ws, "C12", "ABS(MIN(0,MIN(Proyeccion!N5:N40)))", projection.totalCapitalNeeded);

  setRange(ws, "A1:I12");
  setCols(ws, [36, 14, 14, 16, 18, 18, 16, 14, 14]);
  return ws;
}

// ─── HOJA 4: CASH FLOW ───────────────────────────────────

function buildCashFlowSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "CASH FLOW MENSUAL");
  setCell(ws, "A2", "Ingresos cobrados, costes y posicion de tesoreria");

  const headers = ["Mes", "MRR (EUR)", "Coste variable (EUR)", "OPEX fijo (EUR)", "Cash flow del mes (EUR)", "Cash acumulado (EUR)"];
  const cols = ["A", "B", "C", "D", "E", "F"];
  headers.forEach((h, i) => setCell(ws, `${cols[i]}4`, h));

  for (let m = 1; m <= 36; m++) {
    const row = m + 4;
    const d = projection.monthly[m - 1];
    setCell(ws, `A${row}`, m);
    setFormulaWithValue(ws, `B${row}`, `Proyeccion!I${row}`, d.mrr);
    setFormulaWithValue(ws, `C${row}`, `Proyeccion!K${row}`, d.variableCost);
    setFormulaWithValue(ws, `D${row}`, `Proyeccion!L${row}`, d.fixedOpex);
    setFormulaWithValue(ws, `E${row}`, `B${row}-C${row}-D${row}`, d.ebitda);
    setFormulaWithValue(ws, `F${row}`, `Proyeccion!N${row}`, d.cumulativeCash);
  }

  setRange(ws, "A1:F40");
  setCols(ws, [6, 14, 18, 14, 22, 18]);
  return ws;
}

// ─── HOJA 5: ESCENARIOS ──────────────────────────────────

function buildScenariosSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  setCell(ws, "A1", "ESCENARIOS COMPARADOS (resultados M36)");
  setCell(ws, "A2", "Para usar: copia este Excel, edita Hipotesis con los valores de cada escenario y compara.");

  const rows: (string | number | null)[][] = [
    ["Variable", "Conservador", "Base", "Optimista"],
    ["Visitas SEO mes 1", 100, 200, 400],
    ["Crecimiento m-a-m inicial (x)", 1.30, 1.45, 1.60],
    ["Crecimiento m-a-m maduro (x)", 1.08, 1.12, 1.18],
    ["% free tools sobre visitas", 0.10, 0.15, 0.22],
    ["% trials sobre free tools", 0.025, 0.03, 0.04],
    ["% paid sobre trials", 0.25, 0.30, 0.40],
    ["Churn Y1", 0.035, 0.025, 0.018],
    ["Churn Y2", 0.025, 0.020, 0.015],
    ["Churn Y3", 0.020, 0.015, 0.012],
    [null, null, null, null],
    ["Resultados aproximados M36 (de tu plan financiero):", null, null, null],
    ["Clientes finales", 400, 870, 1500],
    ["MRR fin (EUR/mes)", 140000, 305000, 525000],
    ["ARR fin (EUR/anyo)", 1700000, 3660000, 6300000],
  ];

  rows.forEach((r, i) => {
    const rowNum = i + 4;
    r.forEach((cell, j) => {
      const colLetter = ["A", "B", "C", "D"][j];
      if (cell != null) setCell(ws, `${colLetter}${rowNum}`, cell as string | number);
    });
  });

  setRange(ws, "A1:D20");
  setCols(ws, [42, 16, 16, 16]);
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
    "email transaccional, Stripe fees (~2.5% de la cuota).",
    "",
    "OPEX FIJO",
    "Y1: founder solo (sin contrataciones). 1.200/mes cubre",
    "herramientas, asesoria, legal, dominios.",
    "Y2: +1 perfil soporte (~30k anuales) -> 8.500/mes",
    "Y3: +1 perfil sales + marketing pagado -> 22.000/mes",
    "",
    "LIMITACIONES DEL MODELO",
    "1. No considera estacionalidad (mortalidad varia por mes)",
    "2. Asume conversion lineal; en realidad hay efecto cohorte",
    "3. No incluye recargos por overage (expedientes extra)",
    "4. No considera precio anual con descuento (suele dar +15% LTV)",
    "5. Supone bootstrap: si levantas capital, ajusta OPEX",
    "",
    "COMO USAR",
    "1. Edita las Hipotesis en la primera hoja con tus propios numeros",
    "2. Las hojas Proyeccion, Resumen anual y Cash flow recalcularan automaticamente",
    "3. Si Excel no recalcula, presiona F9 (PC) o Cmd+= (Mac)",
    "4. Para escenarios distintos, guarda copias del Excel con cada hipotesis",
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
