/**
 * Renderiza el "Resumen para la familia" a PDF.
 *
 * Documento A4 de una pagina, calido y claro, pensado para entregar o
 * enviar a los herederos. Solo caracteres ASCII (Helvetica WinAnsi).
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import type { FamilySummary } from "./family-summary";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const INNER_W = PAGE_W - MARGIN * 2;

const NAVY = rgb(0.08, 0.15, 0.35);
const BLUE = rgb(0.18, 0.4, 0.72);
const GREEN = rgb(0.1, 0.55, 0.2);
const GRAY_DARK = rgb(0.2, 0.2, 0.2);
const GRAY_MID = rgb(0.45, 0.45, 0.45);
const GRAY_LIGHT = rgb(0.88, 0.88, 0.88);
const LIGHT_BLUE = rgb(0.92, 0.95, 0.99);
const WHITE = rgb(1, 1, 1);

export interface FamilySummaryPdfInput {
  summary: FamilySummary;
  caseRef: string;
  orgName: string;
  generatedAt: Date;
}

function text(
  page: PDFPage,
  font: PDFFont,
  str: string,
  x: number,
  y: number,
  size: number,
  color = GRAY_DARK,
  maxWidth?: number
): number {
  // Word-wrap; devuelve la y tras el ultimo renglon
  const words = str.split(" ");
  let line = "";
  let curY = y;
  const lineHeight = size + 4;

  const flush = () => {
    if (line) {
      page.drawText(line, { x, y: PAGE_H - curY, size, font, color });
      curY += lineHeight;
      line = "";
    }
  };

  if (!maxWidth) {
    page.drawText(str, { x, y: PAGE_H - y, size, font, color });
    return y + lineHeight;
  }

  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
      flush();
      line = w;
    } else {
      line = candidate;
    }
  }
  flush();
  return curY;
}

export async function generateFamilySummaryPDF(input: FamilySummaryPdfInput): Promise<Uint8Array> {
  const { summary } = input;
  const pdf = await PDFDocument.create();
  pdf.setTitle(summary.title);
  pdf.setAuthor(input.orgName);
  pdf.setCreationDate(input.generatedAt);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = MARGIN;

  // ── Cabecera ──────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70, color: NAVY });
  text(page, bold, input.orgName, MARGIN, 32, 11, WHITE);
  text(page, font, "Resumen de la tramitacion de la herencia", MARGIN, 50, 9, rgb(0.7, 0.8, 0.9));
  y = 70 + 28;

  // ── Titulo ────────────────────────────────────────────
  y = text(page, bold, summary.title, MARGIN, y, 15, NAVY, INNER_W);
  y += 6;

  // ── Estado general ────────────────────────────────────
  const statusBoxY = y;
  const statusLineEndY = text(page, font, summary.statusLine, MARGIN + 12, y + 16, 10, GRAY_DARK, INNER_W - 24);
  const statusBoxHeight = statusLineEndY - statusBoxY + 4;
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - statusBoxY - statusBoxHeight,
    width: INNER_W,
    height: statusBoxHeight,
    color: LIGHT_BLUE,
  });
  // Re-draw text on top of the box
  text(page, font, summary.statusLine, MARGIN + 12, statusBoxY + 16, 10, GRAY_DARK, INNER_W - 24);
  y = statusBoxY + statusBoxHeight + 18;

  // ── Barra de progreso ─────────────────────────────────
  text(page, bold, `Avance de la tramitacion: ${summary.progressPct}%`, MARGIN, y, 9, GRAY_MID);
  y += 8;
  page.drawRectangle({ x: MARGIN, y: PAGE_H - y - 8, width: INNER_W, height: 8, color: GRAY_LIGHT });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - y - 8,
    width: (INNER_W * summary.progressPct) / 100,
    height: 8,
    color: GREEN,
  });
  y += 26;

  // ── Secciones ─────────────────────────────────────────
  for (const section of summary.sections) {
    // Salto de pagina si no cabe
    if (y > PAGE_H - 160) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = MARGIN;
    }

    y = text(page, bold, section.heading, MARGIN, y, 11, BLUE);
    y += 4;

    for (const line of section.lines) {
      if (y > PAGE_H - 110) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = MARGIN;
      }
      // Bullet
      page.drawCircle({ x: MARGIN + 4, y: PAGE_H - y - 3, size: 1.6, color: BLUE });
      y = text(page, font, line, MARGIN + 14, y, 9.5, GRAY_DARK, INNER_W - 14);
      y += 2;
    }
    y += 12;
  }

  // ── Cierre ────────────────────────────────────────────
  if (y > PAGE_H - 140) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = MARGIN;
  }
  y += 6;
  const closingY = y;
  const closingEndY = text(page, font, summary.closing, MARGIN + 12, y + 16, 9.5, GRAY_DARK, INNER_W - 24);
  const closingHeight = closingEndY - closingY + 4;
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - closingY - closingHeight,
    width: INNER_W,
    height: closingHeight,
    color: rgb(0.95, 0.98, 0.95),
  });
  text(page, font, summary.closing, MARGIN + 12, closingY + 16, 9.5, GRAY_DARK, INNER_W - 24);

  // ── Pie de pagina ─────────────────────────────────────
  const footerPage = pdf.getPage(pdf.getPageCount() - 1);
  footerPage.drawText(
    `Expediente ${input.caseRef}  -  Documento informativo generado el ${input.generatedAt.toLocaleDateString("es-ES")}`,
    { x: MARGIN, y: 36, size: 7, font, color: GRAY_MID }
  );
  footerPage.drawText(
    "Este resumen es informativo. No sustituye a la documentacion oficial de la herencia.",
    { x: MARGIN, y: 26, size: 7, font, color: GRAY_MID }
  );

  return pdf.save();
}
