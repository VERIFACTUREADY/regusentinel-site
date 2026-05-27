/**
 * Generador de borrador del Modelo 650 (ISD) en formato PDF.
 *
 * Produce un documento A4 con los datos del expediente pre-rellenos,
 * indicando que campos estan pendientes de completar. No es el modelo
 * oficial de la AEAT; es una guia de trabajo para la gestoria.
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import {
  PROVINCIA_TO_CCAA,
  getCCAABonification,
  CCAA_LABELS,
  calculateISDForCCAA,
  type CCAAKey,
  type ParentescoGroup,
} from "./isd-calculator";

// ─── Types ──────────────────────────────────────────────

export interface Modelo650Input {
  caseRef: string;
  deceased: {
    fullName: string;
    dni: string | null;
    deathDate: Date | null;
    province: string | null;
  };
  contact: {
    fullName: string;
    relationship: string | null;
    dni?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  estimatedInheritanceValue?: number | null;
  hasDeceasedInsurance: boolean;
  categories: string[];
  orgName: string;
  generatedAt: Date;
}

// ─── Colors ─────────────────────────────────────────────

const NAVY = rgb(0.08, 0.15, 0.35);
const BLUE = rgb(0.18, 0.4, 0.72);
const LIGHT_BLUE = rgb(0.9, 0.94, 0.99);
const AMBER = rgb(1, 0.75, 0.1);
const AMBER_BG = rgb(1, 0.97, 0.88);
const RED = rgb(0.8, 0.1, 0.1);
const GRAY_DARK = rgb(0.2, 0.2, 0.2);
const GRAY_MID = rgb(0.45, 0.45, 0.45);
const GRAY_LIGHT = rgb(0.85, 0.85, 0.85);
const WHITE = rgb(1, 1, 1);
const GREEN_BG = rgb(0.92, 0.98, 0.93);
const GREEN = rgb(0.1, 0.55, 0.2);

// ─── Layout helpers ──────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const INNER_W = PAGE_W - MARGIN * 2;

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatEUR(v: number): string {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function mapProvince(province: string | null): CCAAKey | null {
  if (!province) return null;
  const slug = province
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
  return PROVINCIA_TO_CCAA[slug] ?? null;
}

// ─── Drawing primitives ─────────────────────────────────

function rect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: ReturnType<typeof rgb>,
  stroke?: ReturnType<typeof rgb>,
  strokeWidth = 0.5
) {
  page.drawRectangle({
    x,
    y: PAGE_H - y - h,
    width: w,
    height: h,
    color: fill,
    ...(stroke ? { borderColor: stroke, borderWidth: strokeWidth } : {}),
  });
}

function text(
  page: PDFPage,
  font: PDFFont,
  str: string,
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb> = GRAY_DARK,
  align: "left" | "center" | "right" = "left",
  maxWidth?: number
) {
  let displayStr = str;
  if (maxWidth) {
    // Truncate if too long
    while (displayStr.length > 0 && font.widthOfTextAtSize(displayStr, size) > maxWidth) {
      displayStr = displayStr.slice(0, -1);
    }
    if (displayStr !== str) displayStr = displayStr.slice(0, -1) + "…";
  }

  const w = font.widthOfTextAtSize(displayStr, size);
  let drawX = x;
  if (align === "center") drawX = x - w / 2;
  else if (align === "right") drawX = x - w;

  page.drawText(displayStr, {
    x: drawX,
    y: PAGE_H - y,
    size,
    font,
    color,
  });
}

// ─── Section header ──────────────────────────────────────

function sectionHeader(
  page: PDFPage,
  boldFont: PDFFont,
  label: string,
  number: string,
  y: number
): number {
  rect(page, MARGIN, y, INNER_W, 18, NAVY);
  text(page, boldFont, number, MARGIN + 6, y + 13, 8, WHITE);
  text(page, boldFont, label, MARGIN + 24, y + 13, 8.5, WHITE);
  return y + 18;
}

// ─── Field row ───────────────────────────────────────────

function fieldRow(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  label: string,
  value: string | null,
  y: number,
  colW = INNER_W,
  pending = false
): number {
  const labelW = colW * 0.38;
  const valueW = colW - labelW - 8;

  rect(page, MARGIN, y, labelW, 16, rgb(0.95, 0.96, 0.97), GRAY_LIGHT, 0.3);
  rect(page, MARGIN + labelW + 1, y, valueW, 16, WHITE, GRAY_LIGHT, 0.3);

  text(page, font, label, MARGIN + 4, y + 11, 7.5, GRAY_MID, "left", labelW - 8);

  if (!value || value === "—") {
    const msg = pending ? "* Pendiente" : "-";
    text(page, font, msg, MARGIN + labelW + 5, y + 11, 7.5, pending ? AMBER : GRAY_MID);
  } else {
    text(page, boldFont, value, MARGIN + labelW + 5, y + 11, 7.5, GRAY_DARK, "left", valueW - 8);
  }

  return y + 17;
}

function twoColFields(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  fields: [string, string | null, boolean?][],
  yStart: number
): number {
  let y = yStart;
  const half = INNER_W / 2 - 2;
  for (let i = 0; i < fields.length; i += 2) {
    const a = fields[i];
    const b = fields[i + 1];
    fieldRow(page, font, boldFont, a[0], a[1] ?? null, y, half, a[2] ?? !a[1]);
    if (b) {
      const bPending = b[2] ?? !b[1];
      const labelW = half * 0.38;
      const valueW = half - labelW - 8;
      rect(page, MARGIN + half + 4, y, labelW, 16, rgb(0.95, 0.96, 0.97), GRAY_LIGHT, 0.3);
      rect(page, MARGIN + half + 4 + labelW + 1, y, valueW, 16, WHITE, GRAY_LIGHT, 0.3);
      text(page, font, b[0], MARGIN + half + 4 + 4, y + 11, 7.5, GRAY_MID, "left", labelW - 8);
      if (!b[1]) {
        text(page, font, bPending ? "* Pendiente" : "-", MARGIN + half + 4 + labelW + 5, y + 11, 7.5, bPending ? AMBER : GRAY_MID);
      } else {
        text(page, boldFont, b[1], MARGIN + half + 4 + labelW + 5, y + 11, 7.5, GRAY_DARK, "left", valueW - 8);
      }
    }
    y += 17;
  }
  return y;
}

// ─── Badge ───────────────────────────────────────────────

function badge(
  page: PDFPage,
  font: PDFFont,
  label: string,
  x: number,
  y: number,
  bgColor: ReturnType<typeof rgb>,
  textColor: ReturnType<typeof rgb>
) {
  const w = font.widthOfTextAtSize(label, 7) + 10;
  rect(page, x, y, w, 12, bgColor);
  text(page, font, label, x + 5, y + 9, 7, textColor);
}

// ─── Main generator ──────────────────────────────────────

export async function generateModelo650PDF(input: Modelo650Input): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Borrador Modelo 650 — ${input.caseRef}`);
  pdfDoc.setAuthor(input.orgName);
  pdfDoc.setSubject("Impuesto sobre Sucesiones y Donaciones — guia de trabajo");
  pdfDoc.setCreationDate(input.generatedAt);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ─── PAGE 1 ───────────────────────────────────────────

  const p1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = MARGIN;

  // Header band
  rect(p1, 0, 0, PAGE_W, 60, NAVY);
  text(p1, bold, "BORRADOR DE TRABAJO", MARGIN, 22, 9, rgb(0.6, 0.75, 1));
  text(p1, bold, "Modelo 650 — Impuesto sobre Sucesiones y Donaciones", MARGIN, 38, 13, WHITE);
  text(p1, font, `Expediente: ${input.caseRef}  ·  Generado: ${formatDate(input.generatedAt)}  ·  ${input.orgName}`, MARGIN, 52, 7.5, rgb(0.7, 0.8, 0.9));

  // Disclaimer band
  y = 60;
  rect(p1, 0, y, PAGE_W, 18, AMBER_BG);
  rect(p1, 0, y, 3, 18, AMBER);
  text(p1, bold, "AVISO  -  DOCUMENTO DE TRABAJO  -  NO SUSTITUYE AL MODELO OFICIAL DE LA AEAT", MARGIN + 6, y + 12, 7.5, rgb(0.5, 0.35, 0));
  y += 18;

  y += 8;

  // ─── SECTION 1: Datos del causante ──────────────────

  y = sectionHeader(p1, bold, "DATOS DEL CAUSANTE", "1", y);
  y += 4;

  y = twoColFields(p1, font, bold, [
    ["Nombre y apellidos", input.deceased.fullName, false],
    ["NIF/DNI", input.deceased.dni, !input.deceased.dni],
    ["Fecha de fallecimiento", input.deceased.deathDate ? formatDate(input.deceased.deathDate) : null, !input.deceased.deathDate],
    ["Provincia de residencia fiscal", input.deceased.province, !input.deceased.province],
    ["Municipio de residencia", null, true],
    ["Domicilio fiscal", null, true],
    ["Codigo postal", null, true],
    ["Nacionalidad", "Española", false],
  ], y);

  y += 6;

  // ─── SECTION 2: CCAA competente ─────────────────────

  y = sectionHeader(p1, bold, "COMUNIDAD AUTONOMA COMPETENTE", "2", y);
  y += 4;

  const ccaa = mapProvince(input.deceased.province);
  const ccaaLabel = ccaa ? CCAA_LABELS[ccaa] : null;

  if (ccaa) {
    rect(p1, MARGIN, y, INNER_W, 20, GREEN_BG, rgb(0.1, 0.55, 0.2), 0.5);
    text(p1, bold, `[OK]  ${ccaaLabel}`, MARGIN + 8, y + 13, 9, GREEN);
    const bonif = getCCAABonification(ccaa, "II", 0);
    if (bonif.foralRegime) {
      text(p1, font, "Régimen foral — Hacienda Foral competente. No aplica tarifa estatal.", MARGIN + 8, y + 13, 8, GREEN);
    }
    y += 20;
  } else {
    rect(p1, MARGIN, y, INNER_W, 18, AMBER_BG, AMBER, 0.5);
    text(p1, bold, "*  Provincia no especificada - determinar CCAA para calcular bonificacion", MARGIN + 8, y + 12, 8, rgb(0.5, 0.35, 0));
    y += 18;
  }

  y += 6;

  // ─── SECTION 3: Heredero / Declarante ───────────────

  y = sectionHeader(p1, bold, "HEREDERO / SUJETO PASIVO (DECLARANTE PRINCIPAL)", "3", y);
  y += 4;

  if (input.contact) {
    y = twoColFields(p1, font, bold, [
      ["Nombre y apellidos", input.contact.fullName, false],
      ["NIF/DNI", input.contact.dni ?? null, !input.contact.dni],
      ["Parentesco con el causante", input.contact.relationship, !input.contact.relationship],
      ["Grupo de parentesco (art. 20 Ley)", null, true],
      ["Teléfono", input.contact.phone ?? null, !input.contact.phone],
      ["Email", input.contact.email ?? null, !input.contact.email],
      ["Domicilio", null, true],
      ["Codigo postal / Municipio", null, true],
    ], y);
  } else {
    rect(p1, MARGIN, y, INNER_W, 18, AMBER_BG, AMBER, 0.5);
    text(p1, bold, "*  Datos del contacto/heredero no registrados en el expediente", MARGIN + 8, y + 12, 8, rgb(0.5, 0.35, 0));
    y += 18;
  }

  y += 6;

  // ─── SECTION 4: Plazos ──────────────────────────────

  y = sectionHeader(p1, bold, "PLAZOS DE PRESENTACIÓN", "4", y);
  y += 4;

  let plazoPresent: string | null = null;
  let plazoProrrog: string | null = null;
  let plazoExt: string | null = null;

  if (input.deceased.deathDate) {
    const d = new Date(input.deceased.deathDate);
    const pres = new Date(d);
    pres.setMonth(pres.getMonth() + 6);
    const pror = new Date(d);
    pror.setMonth(pror.getMonth() + 12);
    const ext = new Date(d);
    ext.setMonth(ext.getMonth() + 5);

    plazoPresent = formatDate(pres);
    plazoProrrog = formatDate(pror);
    plazoExt = formatDate(ext);
  }

  y = twoColFields(p1, font, bold, [
    ["Fallecimiento", input.deceased.deathDate ? formatDate(input.deceased.deathDate) : null, !input.deceased.deathDate],
    ["Plazo ordinario (6 meses)", plazoPresent, !plazoPresent],
    ["Solicitud de prórroga (hasta mes 5)", plazoExt, !plazoExt],
    ["Plazo con prórroga (12 meses)", plazoProrrog, !plazoProrrog],
  ], y);

  y += 6;

  // ─── Page footer ────────────────────────────────────

  rect(p1, 0, PAGE_H - 22, PAGE_W, 22, LIGHT_BLUE);
  text(p1, font, "Página 1 de 2  ·  Borrador de trabajo, no oficial", MARGIN, PAGE_H - 8, 7, GRAY_MID);
  text(p1, bold, "Heredia", PAGE_W - MARGIN, PAGE_H - 8, 7, BLUE, "right");

  // ─── PAGE 2 ───────────────────────────────────────────

  const p2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  y = MARGIN;

  // Header band
  rect(p2, 0, 0, PAGE_W, 44, NAVY);
  text(p2, bold, `Modelo 650 — Borrador  /  ${input.caseRef}`, MARGIN, 28, 11, WHITE);

  y = 44 + 10;

  // ─── SECTION 5: Bienes y derechos ───────────────────

  y = sectionHeader(p2, bold, "BIENES Y DERECHOS QUE INTEGRAN EL CAUDAL HEREDITARIO", "5", y);
  y += 4;

  // Sub-sections
  const assetGroups = [
    { label: "Bienes inmuebles (pisos, locales, terrenos)", key: "INMUEBLES" },
    { label: "Cuentas y depósitos bancarios", key: "BANCOS" },
    { label: "Valores mobiliarios (acciones, fondos)", key: "VALORES" },
    { label: "Vehículos", key: "VEHICULOS" },
    { label: "Seguros de vida", key: "SEGUROS", note: input.hasDeceasedInsurance ? "Seguro detectado en expediente" : null },
    { label: "Otros bienes y derechos", key: "OTROS" },
  ];

  for (const g of assetGroups) {
    rect(p2, MARGIN, y, INNER_W * 0.55, 14, WHITE, GRAY_LIGHT, 0.3);
    rect(p2, MARGIN + INNER_W * 0.55 + 1, y, INNER_W * 0.22, 14, WHITE, GRAY_LIGHT, 0.3);
    rect(p2, MARGIN + INNER_W * 0.77 + 2, y, INNER_W * 0.23 - 2, 14, WHITE, GRAY_LIGHT, 0.3);

    text(p2, font, g.label, MARGIN + 4, y + 10, 7.5, GRAY_DARK);
    if (g.note) {
      badge(p2, font, g.note, MARGIN + INNER_W * 0.32, y + 1, rgb(0.92, 0.98, 0.93), GREEN);
    }
    text(p2, font, "Valor declarado (€)", MARGIN + INNER_W * 0.55 + 4, y + 10, 7, GRAY_MID);
    text(p2, font, "* Pendiente", MARGIN + INNER_W * 0.77 + 6, y + 10, 7, AMBER);
    y += 15;
  }

  y += 4;

  // Total patrimonio
  rect(p2, MARGIN, y, INNER_W, 16, LIGHT_BLUE, BLUE, 0.5);
  text(p2, bold, "VALOR TOTAL DEL CAUDAL HEREDITARIO (Suma de todos los bienes)", MARGIN + 6, y + 11, 8, NAVY);
  if (input.estimatedInheritanceValue) {
    text(p2, bold, formatEUR(input.estimatedInheritanceValue) + "  (estimado)", PAGE_W - MARGIN - 4, y + 11, 8, BLUE, "right");
  } else {
    text(p2, font, "* Pendiente de valoracion", PAGE_W - MARGIN - 4, y + 11, 8, AMBER, "right");
  }
  y += 16 + 6;

  // ─── SECTION 6: Reducciones ─────────────────────────

  y = sectionHeader(p2, bold, "REDUCCIONES DE LA BASE IMPONIBLE (art. 20 Ley 29/1987)", "6", y);
  y += 4;

  const reductions = [
    { label: "Reducción por parentesco (grupos I–IV, art. 20.2.a)", value: "Según grupo aplicable" },
    { label: "Reducción por discapacidad (art. 20.2.b)", value: "Hasta 47.858,59 € / 150.253,03 €" },
    { label: "Reducción vivienda habitual causante (95%, art. 20.2.c.3)", value: "Hasta 122.606,47 €/heredero" },
    { label: "Reducción empresa familiar (95%, art. 20.2.c)", value: "Si procede" },
    { label: "Seguros de vida (art. 20.2.b)", value: "Hasta 9.195,49 € por beneficiario" },
    { label: "Reducciones autonómicas adicionales", value: ccaaLabel ? `Comprobar en ${ccaaLabel}` : "Según CCAA competente" },
  ];

  for (const r of reductions) {
    rect(p2, MARGIN, y, INNER_W * 0.6, 14, WHITE, GRAY_LIGHT, 0.3);
    rect(p2, MARGIN + INNER_W * 0.6 + 1, y, INNER_W * 0.4 - 1, 14, rgb(0.97, 0.97, 1), GRAY_LIGHT, 0.3);
    text(p2, font, r.label, MARGIN + 4, y + 10, 7.5, GRAY_DARK);
    text(p2, font, r.value, MARGIN + INNER_W * 0.6 + 4, y + 10, 7.5, GRAY_MID, "left", INNER_W * 0.4 - 8);
    y += 15;
  }

  y += 6;

  // ─── SECTION 7: Cuota estimada ──────────────────────

  y = sectionHeader(p2, bold, "CUOTA ESTIMADA — RESUMEN FISCAL (calculado por Heredia)", "7", y);
  y += 4;

  if (ccaa && input.estimatedInheritanceValue) {
    const group: ParentescoGroup = "II";
    const calc = calculateISDForCCAA(ccaa, {
      baseImponible: input.estimatedInheritanceValue,
      group,
      preexistingPatrimony: 0,
      dwellingReduction: false,
    });
    const bonif = getCCAABonification(ccaa, group, input.estimatedInheritanceValue);

    rect(p2, MARGIN, y, INNER_W, 80, LIGHT_BLUE, BLUE, 0.5);

    const col1 = MARGIN + 8;
    const col2 = MARGIN + INNER_W * 0.55;

    text(p2, font, "Base liquidable (estimada):", col1, y + 16, 8, GRAY_DARK);
    text(p2, bold, formatEUR(input.estimatedInheritanceValue), col2, y + 16, 8, NAVY);

    text(p2, font, "Cuota íntegra (tarifa estatal):", col1, y + 30, 8, GRAY_DARK);
    text(p2, bold, formatEUR(calc.cuotaIntegra), col2, y + 30, 8, NAVY);

    text(p2, font, `Bonificación autonómica (${ccaaLabel}):`, col1, y + 44, 8, GRAY_DARK);
    text(p2, bold, `${bonif.pct}%`, col2, y + 44, 8, bonif.pct >= 90 ? GREEN : BLUE);

    text(p2, bold, "CUOTA A INGRESAR ESTIMADA (grupo II):", col1, y + 62, 9, NAVY);
    text(p2, bold, formatEUR(calc.cuotaAPagar), col2, y + 62, 9.5, bonif.pct >= 90 ? GREEN : RED);

    text(p2, font, `  ${bonif.note}`, col1, y + 76, 7, GRAY_MID, "left", INNER_W - 16);

    y += 80 + 4;
    rect(p2, MARGIN, y, INNER_W, 13, AMBER_BG);
    text(p2, font, "AVISO: Calculo orientativo para grupo II sin reducciones. Revisar grupo real, patrimonio preexistente y reducciones aplicables.", MARGIN + 6, y + 9, 7, rgb(0.5, 0.35, 0));
    y += 13;
  } else {
    rect(p2, MARGIN, y, INNER_W, 22, AMBER_BG, AMBER, 0.5);
    text(p2, bold, "* Pendiente: anyadir provincia y valor estimado de la herencia para calcular cuota", MARGIN + 8, y + 15, 8, rgb(0.5, 0.35, 0));
    y += 22;
  }

  y += 6;

  // ─── SECTION 8: Checklist ───────────────────────────

  y = sectionHeader(p2, bold, "DOCUMENTACIÓN NECESARIA PARA LA PRESENTACIÓN", "8", y);
  y += 4;

  const docs = [
    "Certificado literal de defunción",
    "Certificado de últimas voluntades (15 días hábiles desde fallecimiento)",
    "Certificado de contratos de seguros (RCSV)",
    "Testamento / Auto de declaración de herederos",
    "DNI/NIE de todos los herederos",
    "Certificados de saldo a fecha de fallecimiento (todos los bancos)",
    "Escrituras de inmuebles (si procede)",
    "Tasación homologada de inmuebles o consulta valor de referencia catastral",
    input.hasDeceasedInsurance ? "Póliza(s) de seguro de vida y documentación de reclamación" : null,
    "Justificante de gastos de sepelio (deducibles, art. 13 Ley 29/1987)",
    "Modelo 790 (tasa presentación, si aplica según CCAA)",
  ].filter(Boolean) as string[];

  for (const doc of docs) {
    text(p2, font, "[ ]  " + doc, MARGIN + 4, y + 10, 7.5, GRAY_DARK);
    y += 14;
  }

  y += 4;

  // Page footer
  rect(p2, 0, PAGE_H - 22, PAGE_W, 22, LIGHT_BLUE);
  text(p2, font, "Página 2 de 2  ·  Borrador de trabajo generado automáticamente por Heredia — No es documento oficial", MARGIN, PAGE_H - 8, 7, GRAY_MID);
  text(p2, bold, `${input.caseRef}  ·  ${formatDate(input.generatedAt)}`, PAGE_W - MARGIN, PAGE_H - 8, 7, BLUE, "right");

  return pdfDoc.save();
}
