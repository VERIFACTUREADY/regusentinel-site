/**
 * Bank pack exporter.
 *
 * Produces a single unified PDF (portada + indice + documentos originales
 * embebidos) and an optional ZIP that also contains the original files
 * renamed consistently. This is the BdE-ready entregable that justifies
 * the Despacho plan.
 *
 * Supported document formats for embedding:
 *   - application/pdf: pages are copied into the merged PDF.
 *   - image/jpeg, image/png: embedded as a full A4 page (fit contained).
 *   - Anything else: a placeholder page is inserted, and the original
 *     file remains in the ZIP under /originales/.
 */

import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import JSZip from "jszip";
import { downloadFile } from "./s3";
import { generateBankPack, type BankDocRequirement } from "./bank-pack";

export interface BankPackCaseInput {
  ref: string;
  orgName: string;
  deceased?: {
    fullName: string;
    deathDate?: Date | string | null;
    dni?: string | null;
  } | null;
  contact?: {
    fullName: string;
    relationship?: string | null;
  } | null;
  province?: string | null;
}

export interface BankPackDocumentInput {
  id: string;
  fileName: string;
  fileKey: string;
  mimeType?: string | null;
  docTag?: string | null; // from linked task
}

interface IndexRow {
  status: "INCLUIDO" | "FALTA" | "NO_EMBEBIBLE";
  requirement: string;
  fileName?: string;
  pageInPack?: number;
}

const PAGE_W = PageSizes.A4[0]; // 595.28
const PAGE_H = PageSizes.A4[1]; // 841.89
const MARGIN = 50;

const ACCENT = rgb(0.39, 0.4, 0.95);
const DARK = rgb(0.1, 0.1, 0.18);
const GRAY = rgb(0.4, 0.4, 0.4);
const RED = rgb(0.72, 0.11, 0.11);
const GREEN = rgb(0.08, 0.5, 0.25);

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

/**
 * Build the unified bank pack PDF.
 * Returns the bytes and the rows used for the index (useful for ZIP metadata).
 */
export async function generateBankPackPdf(
  caseInput: BankPackCaseInput,
  documents: BankPackDocumentInput[]
): Promise<{ pdf: Buffer; rows: IndexRow[]; embeddedDocs: BankPackDocumentInput[] }> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ── Build the requirements with availability based on docTags present ──
  const availableTags = new Set(
    documents.map((d) => d.docTag).filter((t): t is string => !!t)
  );
  const { requirements } = generateBankPack(availableTags);

  const docsByTag = new Map<string, BankPackDocumentInput[]>();
  for (const d of documents) {
    if (!d.docTag) continue;
    const list = docsByTag.get(d.docTag) ?? [];
    list.push(d);
    docsByTag.set(d.docTag, list);
  }

  const rows: IndexRow[] = [];
  const embedQueue: Array<{ requirement: BankDocRequirement; doc: BankPackDocumentInput }> = [];

  for (const req of requirements) {
    const matching = req.docTags.flatMap((t) => docsByTag.get(t) ?? []);
    if (matching.length === 0) {
      rows.push({ status: "FALTA", requirement: req.name });
    } else {
      for (const doc of matching) {
        rows.push({ status: "INCLUIDO", requirement: req.name, fileName: doc.fileName });
        embedQueue.push({ requirement: req, doc });
      }
    }
  }

  // ── Cover (page 1) ──────────────────────────────────────────────
  drawCover(pdf, font, fontBold, caseInput);

  // ── Index placeholder (page 2) — we'll rewrite it after embedding ──
  // We add it now so embedded docs start at page 3+, then we redraw
  // its contents with correct page numbers at the end.
  const indexPage = pdf.addPage([PAGE_W, PAGE_H]);

  // ── Embed each document and fill page numbers ───────────────────
  for (const { requirement, doc } of embedQueue) {
    const row = rows.find(
      (r) => r.status === "INCLUIDO" && r.requirement === requirement.name && r.fileName === doc.fileName
    );

    try {
      const bytes = await downloadFile(doc.fileKey);
      const mime = (doc.mimeType || "").toLowerCase();

      if (mime === "application/pdf" || doc.fileName.toLowerCase().endsWith(".pdf")) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pageCount = src.getPageCount();
        const copied = await pdf.copyPages(src, Array.from({ length: pageCount }, (_, i) => i));
        const firstPage = pdf.getPageCount() + 1;
        copied.forEach((p) => pdf.addPage(p));
        if (row) row.pageInPack = firstPage;
      } else if (mime === "image/jpeg" || mime === "image/png" || /\.(jpe?g|png)$/i.test(doc.fileName)) {
        const img =
          mime === "image/png" || /\.png$/i.test(doc.fileName)
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(bytes);
        const page = pdf.addPage([PAGE_W, PAGE_H]);
        const maxW = PAGE_W - MARGIN * 2;
        const maxH = PAGE_H - MARGIN * 2 - 40; // leave room for caption
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, {
          x: (PAGE_W - w) / 2,
          y: (PAGE_H - h) / 2 - 10,
          width: w,
          height: h,
        });
        page.drawText(`${requirement.name}`, {
          x: MARGIN, y: PAGE_H - MARGIN, size: 12, font: fontBold, color: ACCENT,
        });
        page.drawText(doc.fileName, {
          x: MARGIN, y: MARGIN - 10, size: 8, font, color: GRAY,
        });
        if (row) row.pageInPack = pdf.getPageCount();
      } else {
        // Non-embeddable format — placeholder page, original ships in ZIP.
        drawPlaceholderPage(pdf, font, fontBold, requirement.name, doc.fileName);
        if (row) {
          row.status = "NO_EMBEBIBLE";
          row.pageInPack = pdf.getPageCount();
        }
      }
    } catch (err) {
      drawPlaceholderPage(pdf, font, fontBold, requirement.name, doc.fileName, String((err as Error).message));
      if (row) {
        row.status = "NO_EMBEBIBLE";
        row.pageInPack = pdf.getPageCount();
      }
    }
  }

  // ── Fill the index page now that we know final page numbers ─────
  drawIndex(indexPage, font, fontBold, rows, caseInput);

  const bytes = await pdf.save();
  return {
    pdf: Buffer.from(bytes),
    rows,
    embeddedDocs: embedQueue.map((e) => e.doc),
  };
}

/**
 * Build a ZIP containing:
 *   /pack-banco-unificado.pdf        (the merged PDF)
 *   /indice.txt                      (plain-text index for auditors)
 *   /originales/<NN>_<docTag>_<fileName>
 */
export async function generateBankPackZip(
  caseInput: BankPackCaseInput,
  documents: BankPackDocumentInput[]
): Promise<Buffer> {
  const { pdf, rows, embeddedDocs } = await generateBankPackPdf(caseInput, documents);

  const zip = new JSZip();
  zip.file("pack-banco-unificado.pdf", pdf);

  // Plain-text index (useful when the pack is reviewed by compliance).
  const indexLines = [
    `Pack banco - Expediente ${caseInput.ref}`,
    `Despacho: ${caseInput.orgName}`,
    `Fallecido: ${caseInput.deceased?.fullName ?? "—"}`,
    `Fecha generacion: ${fmtDate(new Date())}`,
    "",
    "INDICE DE DOCUMENTOS:",
    ...rows.map((r, i) => {
      const n = String(i + 1).padStart(2, "0");
      const status =
        r.status === "INCLUIDO" ? "[OK]" : r.status === "NO_EMBEBIBLE" ? "[ADJUNTO]" : "[FALTA]";
      const page = r.pageInPack ? ` -> p.${r.pageInPack}` : "";
      const file = r.fileName ? ` (${r.fileName})` : "";
      return `${n}. ${status} ${r.requirement}${file}${page}`;
    }),
  ];
  zip.file("indice.txt", indexLines.join("\n"));

  // Originals folder, named consistently with the index.
  const originals = zip.folder("originales");
  if (originals) {
    let n = 0;
    for (const doc of embeddedDocs) {
      n += 1;
      try {
        const bytes = await downloadFile(doc.fileKey);
        const prefix = String(n).padStart(2, "0");
        const tag = doc.docTag ? `_${sanitizeFilename(doc.docTag)}` : "";
        const name = sanitizeFilename(doc.fileName);
        originals.file(`${prefix}${tag}_${name}`, bytes);
      } catch {
        // Skip; the merged PDF already has a placeholder page for it.
      }
    }
  }

  const zipBytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return zipBytes;
}

// ─── PDF drawing helpers ────────────────────────────────────────────

function drawCover(
  pdf: PDFDocument,
  font: any,
  fontBold: any,
  c: BankPackCaseInput
): void {
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  page.drawText("BARITUR PRO", { x: MARGIN, y, size: 20, font: fontBold, color: ACCENT });
  y -= 14;
  page.drawText("Pack Banco — herencia", { x: MARGIN, y, size: 10, font, color: GRAY });
  y -= 14;

  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 1, color: ACCENT,
  });
  y -= 48;

  page.drawText("DOCUMENTACION PARA TRAMITACION DE HERENCIA", {
    x: MARGIN, y, size: 16, font: fontBold, color: DARK,
  });
  y -= 40;

  const rows: [string, string][] = [
    ["Despacho:", c.orgName],
    ["Expediente:", c.ref],
    ["Fallecido:", c.deceased?.fullName ?? "—"],
    ["DNI fallecido:", c.deceased?.dni ?? "—"],
    ["Fecha fallecimiento:", fmtDate(c.deceased?.deathDate ?? null)],
    ["Contacto familiar:", `${c.contact?.fullName ?? "—"}${c.contact?.relationship ? ` (${c.contact.relationship})` : ""}`],
    ["Provincia (CCAA):", c.province ?? "—"],
    ["Fecha de generacion:", fmtDate(new Date())],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, { x: MARGIN, y, size: 10, font: fontBold, color: DARK });
    page.drawText(value, { x: MARGIN + 180, y, size: 10, font, color: DARK });
    y -= 20;
  }

  y -= 24;
  page.drawText(
    "Este pack agrupa la documentacion estandar requerida por las entidades",
    { x: MARGIN, y, size: 9, font, color: GRAY }
  );
  y -= 12;
  page.drawText(
    "bancarias espanolas para la tramitacion de testamentarias (directrices BdE).",
    { x: MARGIN, y, size: 9, font, color: GRAY }
  );

  // Footer
  page.drawText(
    "Generado por BARITUR PRO",
    { x: MARGIN, y: MARGIN, size: 8, font, color: GRAY }
  );
}

function drawIndex(
  page: any,
  font: any,
  fontBold: any,
  rows: IndexRow[],
  c: BankPackCaseInput
): void {
  let y = PAGE_H - MARGIN;

  page.drawText("INDICE", { x: MARGIN, y, size: 18, font: fontBold, color: ACCENT });
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 1, color: ACCENT,
  });
  y -= 28;

  page.drawText(`Expediente ${c.ref} - ${rows.length} entradas`, {
    x: MARGIN, y, size: 10, font, color: GRAY,
  });
  y -= 24;

  // Column headers
  page.drawText("#",          { x: MARGIN,       y, size: 9, font: fontBold, color: GRAY });
  page.drawText("Documento",  { x: MARGIN + 24,  y, size: 9, font: fontBold, color: GRAY });
  page.drawText("Archivo",    { x: MARGIN + 260, y, size: 9, font: fontBold, color: GRAY });
  page.drawText("Estado",     { x: MARGIN + 420, y, size: 9, font: fontBold, color: GRAY });
  page.drawText("Pag.",       { x: MARGIN + 490, y, size: 9, font: fontBold, color: GRAY });
  y -= 14;

  page.drawLine({
    start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 },
    thickness: 0.5, color: GRAY,
  });
  y -= 4;

  rows.forEach((r, i) => {
    if (y < MARGIN + 24) return; // truncate gracefully; full list also in indice.txt
    const statusColor =
      r.status === "INCLUIDO" ? GREEN : r.status === "NO_EMBEBIBLE" ? GRAY : RED;
    const statusLabel =
      r.status === "INCLUIDO" ? "Incluido" : r.status === "NO_EMBEBIBLE" ? "Adjunto" : "FALTA";

    page.drawText(String(i + 1).padStart(2, "0"), { x: MARGIN, y, size: 9, font, color: DARK });
    page.drawText(truncate(r.requirement, 42),    { x: MARGIN + 24,  y, size: 9, font, color: DARK });
    page.drawText(truncate(r.fileName ?? "—", 28),{ x: MARGIN + 260, y, size: 9, font, color: GRAY });
    page.drawText(statusLabel,                    { x: MARGIN + 420, y, size: 9, font: fontBold, color: statusColor });
    page.drawText(r.pageInPack ? String(r.pageInPack) : "—", {
      x: MARGIN + 490, y, size: 9, font, color: DARK,
    });
    y -= 14;
  });
}

function drawPlaceholderPage(
  pdf: PDFDocument,
  font: any,
  fontBold: any,
  requirement: string,
  fileName: string,
  error?: string
): void {
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  page.drawText("DOCUMENTO ADJUNTO (no embebible)", {
    x: MARGIN, y, size: 12, font: fontBold, color: ACCENT,
  });
  y -= 28;
  page.drawText(requirement, { x: MARGIN, y, size: 14, font: fontBold, color: DARK });
  y -= 22;
  page.drawText(`Archivo: ${fileName}`, { x: MARGIN, y, size: 10, font, color: DARK });
  y -= 18;
  page.drawText(
    "El archivo original se incluye en la carpeta /originales del ZIP.",
    { x: MARGIN, y, size: 9, font, color: GRAY }
  );
  if (error) {
    y -= 14;
    page.drawText(`Motivo: ${truncate(error, 80)}`, { x: MARGIN, y, size: 8, font, color: GRAY });
  }
}

function truncate(t: string, max: number): string {
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}
