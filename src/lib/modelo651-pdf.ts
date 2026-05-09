/**
 * Generador de borrador del Modelo 651 (Donaciones) en formato PDF.
 *
 * Sigue el mismo patron que modelo650-pdf.ts pero con bloques especificos
 * para donaciones inter vivos: datos del donante, donatario, plazos
 * (30 dias habiles), tipo de bien, reduccion aplicable y cuota estimada.
 *
 * No es el modelo oficial de la AEAT/CCAA — es una guia de trabajo.
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import {
  CCAA_LABELS,
  type CCAAKey,
  type ParentescoGroup,
} from "./isd-calculator";
import {
  calculateDonacion,
  getDonacionBonification,
  type DonacionInputs,
} from "./donaciones-calculator";

// ─── Types ──────────────────────────────────────────────

export interface Modelo651Input {
  caseRef: string;
  donante: {
    fullName: string;
    dni: string | null;
  };
  donatario: {
    fullName: string;
    dni: string | null;
    relationship: string | null;
    province: string | null;
  };
  donationDate: Date | null;
  /** Tipo de bien donado */
  tipoBien: "dinero" | "inmueble" | "valores" | "vehiculo" | "otros";
  /** Importe / valor declarado */
  baseImponible: number | null;
  /** Reduccion aplicable */
  reduccion: NonNullable<DonacionInputs["reduccionTipo"]>;
  /** CCAA competente (residencia donatario o ubicacion inmueble) */
  ccaa: CCAAKey | null;
  /** Grupo de parentesco con el donante */
  group: ParentescoGroup | null;
  orgName: string;
  generatedAt: Date;
}

// ─── Colors (mismo palette que modelo650) ─────────────────

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

// ─── Layout ─────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const INNER_W = PAGE_W - MARGIN * 2;

const TIPO_BIEN_LABEL: Record<Modelo651Input["tipoBien"], string> = {
  dinero: "Dinero / efectivo",
  inmueble: "Bien inmueble",
  valores: "Valores mobiliarios",
  vehiculo: "Vehiculo",
  otros: "Otros bienes / derechos",
};

const REDUCCION_LABEL: Record<NonNullable<DonacionInputs["reduccionTipo"]>, string> = {
  ninguna: "Sin reduccion especifica",
  "vivienda-habitual-hijo": "Donacion vivienda habitual a descendiente (95%)",
  "dinero-para-vivienda-hijo": "Donacion dineraria para adquirir vivienda (80%)",
  "empresa-familiar": "Empresa familiar / participaciones (95%)",
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatEUR(v: number): string {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

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
    while (displayStr.length > 0 && font.widthOfTextAtSize(displayStr, size) > maxWidth) {
      displayStr = displayStr.slice(0, -1);
    }
    if (displayStr !== str) displayStr = displayStr.slice(0, -1) + "...";
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

function sectionHeader(page: PDFPage, boldFont: PDFFont, label: string, number: string, y: number): number {
  rect(page, MARGIN, y, INNER_W, 18, NAVY);
  text(page, boldFont, number, MARGIN + 6, y + 13, 8, WHITE);
  text(page, boldFont, label, MARGIN + 24, y + 13, 8.5, WHITE);
  return y + 18;
}

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
  const labelW = colW * 0.4;
  const valueW = colW - labelW - 8;

  rect(page, MARGIN, y, labelW, 16, rgb(0.95, 0.96, 0.97), GRAY_LIGHT, 0.3);
  rect(page, MARGIN + labelW + 1, y, valueW, 16, WHITE, GRAY_LIGHT, 0.3);

  text(page, font, label, MARGIN + 4, y + 11, 7.5, GRAY_MID, "left", labelW - 8);

  if (!value || value === "-") {
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
      const labelW = half * 0.4;
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

// ─── Generator ──────────────────────────────────────────

export async function generateModelo651PDF(input: Modelo651Input): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Borrador Modelo 651 - ${input.caseRef}`);
  pdfDoc.setAuthor(input.orgName);
  pdfDoc.setSubject("Impuesto sobre Donaciones - guia de trabajo");
  pdfDoc.setCreationDate(input.generatedAt);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const p1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = MARGIN;

  // Header band
  rect(p1, 0, 0, PAGE_W, 60, NAVY);
  text(p1, bold, "BORRADOR DE TRABAJO", MARGIN, 22, 9, rgb(0.6, 0.75, 1));
  text(p1, bold, "Modelo 651 - Impuesto sobre Donaciones", MARGIN, 38, 13, WHITE);
  text(p1, font, `Expediente: ${input.caseRef}  -  Generado: ${formatDate(input.generatedAt)}  -  ${input.orgName}`, MARGIN, 52, 7.5, rgb(0.7, 0.8, 0.9));

  // Disclaimer band
  y = 60;
  rect(p1, 0, y, PAGE_W, 18, AMBER_BG);
  rect(p1, 0, y, 3, 18, AMBER);
  text(p1, bold, "AVISO  -  DOCUMENTO DE TRABAJO  -  NO SUSTITUYE AL MODELO OFICIAL", MARGIN + 6, y + 12, 7.5, rgb(0.5, 0.35, 0));
  y += 18 + 8;

  // ─── Donante ────────────────────────────────────────
  y = sectionHeader(p1, bold, "DATOS DEL DONANTE", "1", y);
  y += 4;
  y = twoColFields(p1, font, bold, [
    ["Nombre y apellidos", input.donante.fullName, false],
    ["NIF/DNI", input.donante.dni, !input.donante.dni],
    ["Domicilio fiscal", null, true],
    ["Codigo postal / Municipio", null, true],
  ], y);
  y += 6;

  // ─── Donatario ──────────────────────────────────────
  y = sectionHeader(p1, bold, "DATOS DEL DONATARIO (SUJETO PASIVO)", "2", y);
  y += 4;
  y = twoColFields(p1, font, bold, [
    ["Nombre y apellidos", input.donatario.fullName, false],
    ["NIF/DNI", input.donatario.dni, !input.donatario.dni],
    ["Parentesco con el donante", input.donatario.relationship, !input.donatario.relationship],
    ["Provincia residencia", input.donatario.province, !input.donatario.province],
    ["Grupo de parentesco (art. 20 Ley)", input.group ? `Grupo ${input.group}` : null, !input.group],
    ["Edad / situacion especial", null, true],
  ], y);
  y += 6;

  // ─── CCAA Competente ────────────────────────────────
  y = sectionHeader(p1, bold, "CCAA COMPETENTE (segun tipo de bien)", "3", y);
  y += 4;

  if (input.ccaa) {
    const bonif = getDonacionBonification(input.ccaa, input.group ?? "II");
    rect(p1, MARGIN, y, INNER_W, 30, GREEN_BG, rgb(0.1, 0.55, 0.2), 0.5);
    text(p1, bold, `[OK]  ${CCAA_LABELS[input.ccaa]}`, MARGIN + 8, y + 13, 9, GREEN);
    text(p1, font, bonif.foralRegime ? "Regimen foral - tributacion segun normativa propia." : `Bonificacion donaciones grupo ${input.group ?? "II"}: ${bonif.pct}%`, MARGIN + 8, y + 25, 7.5, GREEN);
    y += 30;
  } else {
    rect(p1, MARGIN, y, INNER_W, 22, AMBER_BG, AMBER, 0.5);
    text(p1, bold, "*  CCAA no especificada - determinar competencia segun tipo de bien", MARGIN + 8, y + 14, 8, rgb(0.5, 0.35, 0));
    y += 22;
  }
  y += 6;

  // ─── Donacion ───────────────────────────────────────
  y = sectionHeader(p1, bold, "OBJETO DE LA DONACION", "4", y);
  y += 4;
  y = twoColFields(p1, font, bold, [
    ["Fecha de la donacion", input.donationDate ? formatDate(input.donationDate) : null, !input.donationDate],
    ["Tipo de bien", TIPO_BIEN_LABEL[input.tipoBien], false],
    ["Valor declarado", input.baseImponible ? formatEUR(input.baseImponible) : null, !input.baseImponible],
    ["Reduccion aplicable", REDUCCION_LABEL[input.reduccion], false],
    ["Escritura publica (notario)", null, true],
    ["Numero de protocolo", null, true],
  ], y);
  y += 6;

  // ─── Plazos ─────────────────────────────────────────
  y = sectionHeader(p1, bold, "PLAZOS DE PRESENTACION", "5", y);
  y += 4;

  let plazoLimite: string | null = null;
  if (input.donationDate) {
    const limite = new Date(input.donationDate);
    // 30 dias habiles ~ 6 semanas naturales aproximadamente; conservadora
    let added = 0;
    while (added < 30) {
      limite.setDate(limite.getDate() + 1);
      const dow = limite.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    plazoLimite = formatDate(limite);
  }

  y = twoColFields(p1, font, bold, [
    ["Donacion", input.donationDate ? formatDate(input.donationDate) : null, !input.donationDate],
    ["Plazo limite (~30 dias habiles)", plazoLimite, !plazoLimite],
    ["Modelo a presentar", "Modelo 651 (autoliquidacion)", false],
    ["Forma de presentacion", "Telematica (sede CCAA)", false],
  ], y);
  y += 6;

  // ─── Cuota estimada ─────────────────────────────────
  y = sectionHeader(p1, bold, "CUOTA ESTIMADA - RESUMEN FISCAL", "6", y);
  y += 4;

  if (input.ccaa && input.baseImponible && input.group) {
    const calc = calculateDonacion(
      {
        group: input.group,
        baseImponible: input.baseImponible,
        preexistingPatrimony: 0,
        reduccionTipo: input.reduccion,
      },
      input.ccaa
    );
    const bonif = getDonacionBonification(input.ccaa, input.group);

    rect(p1, MARGIN, y, INNER_W, 100, LIGHT_BLUE, BLUE, 0.5);

    const col1 = MARGIN + 8;
    const col2 = MARGIN + INNER_W * 0.55;

    text(p1, font, "Valor declarado:", col1, y + 16, 8, GRAY_DARK);
    text(p1, bold, formatEUR(input.baseImponible), col2, y + 16, 8, NAVY);

    text(p1, font, "Reduccion aplicada:", col1, y + 30, 8, GRAY_DARK);
    text(p1, bold, formatEUR(calc.reduccionAplicada), col2, y + 30, 8, NAVY);

    text(p1, font, "Base liquidable:", col1, y + 44, 8, GRAY_DARK);
    text(p1, bold, formatEUR(calc.baseLiquidable), col2, y + 44, 8, NAVY);

    text(p1, font, "Cuota tributaria (tarifa estatal x coef.):", col1, y + 58, 8, GRAY_DARK);
    text(p1, bold, formatEUR(calc.cuotaTributaria), col2, y + 58, 8, NAVY);

    text(p1, font, `Bonificacion ${CCAA_LABELS[input.ccaa]} (${bonif.pct}%):`, col1, y + 72, 8, GRAY_DARK);
    text(p1, bold, `- ${formatEUR(calc.bonificacionCcaa)}`, col2, y + 72, 8, GREEN);

    text(p1, bold, "CUOTA A INGRESAR ESTIMADA:", col1, y + 90, 9, NAVY);
    text(p1, bold, formatEUR(calc.cuotaAPagar), col2, y + 90, 9.5, bonif.pct >= 90 ? GREEN : RED);

    y += 100 + 4;
    rect(p1, MARGIN, y, INNER_W, 13, AMBER_BG);
    text(p1, font, "Calculo orientativo. Verificar requisitos de la reduccion aplicada (edad, escritura publica, mantenimiento).", MARGIN + 6, y + 9, 7, rgb(0.5, 0.35, 0));
    y += 13;
  } else {
    rect(p1, MARGIN, y, INNER_W, 30, AMBER_BG, AMBER, 0.5);
    text(p1, bold, "*  Datos insuficientes para calcular cuota:", MARGIN + 8, y + 14, 8, rgb(0.5, 0.35, 0));
    text(p1, font, "indica CCAA, valor declarado y grupo de parentesco.", MARGIN + 8, y + 24, 7.5, rgb(0.5, 0.35, 0));
    y += 30;
  }
  y += 6;

  // ─── Checklist ──────────────────────────────────────
  y = sectionHeader(p1, bold, "DOCUMENTACION HABITUAL", "7", y);
  y += 4;

  const docs: string[] = [
    "Escritura publica de donacion (notario)",
    "DNI/NIE del donante y donatario",
    "Justificante del bien donado (escritura, certificado bancario, ficha tecnica vehiculo)",
    input.tipoBien === "inmueble" ? "Nota simple del Registro de la Propiedad" : null,
    input.tipoBien === "inmueble" ? "Tasacion homologada o consulta valor de referencia catastral" : null,
    input.reduccion === "vivienda-habitual-hijo" ? "Acreditacion de empadronamiento del donatario en la vivienda donada" : null,
    input.reduccion === "dinero-para-vivienda-hijo" ? "Justificante bancario de la transferencia + escritura compraventa vivienda" : null,
    input.reduccion === "empresa-familiar" ? "Acreditacion del cumplimiento del art. 20.6 (titulares, ejercicio, mantenimiento)" : null,
    "Modelo 651 cumplimentado",
    "Justificante de pago de la tasa CCAA si aplica",
  ].filter(Boolean) as string[];

  for (const doc of docs) {
    text(p1, font, "[ ]  " + doc, MARGIN + 4, y + 10, 7.5, GRAY_DARK);
    y += 14;
  }

  // Footer
  rect(p1, 0, PAGE_H - 22, PAGE_W, 22, LIGHT_BLUE);
  text(p1, font, "Pagina 1 de 1  -  Borrador de trabajo, no oficial", MARGIN, PAGE_H - 8, 7, GRAY_MID);
  text(p1, bold, "BARITUR PRO", PAGE_W - MARGIN, PAGE_H - 8, 7, BLUE, "right");

  return pdfDoc.save();
}
