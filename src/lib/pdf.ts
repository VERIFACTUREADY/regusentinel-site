import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { TaskStatus, TaskCategory } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────

interface CaseData {
  ref: string;
  status: string;
  isUrgent: boolean;
  categories: TaskCategory[];
  province?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  deceased?: {
    fullName: string;
    deathDate?: Date | string | null;
    dni?: string | null;
  } | null;
  contact?: {
    fullName: string;
    phone?: string | null;
    email?: string | null;
    relationship?: string | null;
  } | null;
}

interface TaskData {
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  description?: string | null;
  dueDate?: Date | string | null;
}

interface DocumentData {
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt: Date | string;
}

// ─── Helpers ───────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Recepcion",
  VALIDATION: "Validacion",
  IN_PROGRESS: "En progreso",
  PENDING_DOCS: "Pendiente docs",
  READY_TO_SEND: "Listo para enviar",
  SENT: "Enviado",
  FOLLOW_UP: "Seguimiento",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
  PENDING: "Pendiente",
  BLOCKED: "Bloqueada",
  READY: "Lista",
  APPROVED: "Aprobada",
  DONE: "Completada",
  SKIPPED: "Omitida",
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

// ─── PDF Generation ────────────────────────────────────

/**
 * Generate a dossier PDF summarizing a case, its tasks, and documents.
 * Returns a Buffer containing the PDF bytes.
 */
export async function generateDossierPdf(
  caseData: CaseData,
  tasks: TaskData[],
  documents: DocumentData[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 16;
  const sectionGap = 24;

  const darkColor = rgb(0.1, 0.1, 0.18);
  const accentColor = rgb(0.39, 0.4, 0.95); // Indigo-ish
  const grayColor = rgb(0.4, 0.4, 0.4);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawText(
    text: string,
    x: number,
    size: number,
    useBold = false,
    color = darkColor
  ) {
    const f = useBold ? fontBold : font;
    page.drawText(text, { x, y, size, font: f, color });
  }

  // ─── Header ────────────────────────────────────────
  drawText("BARITUR PRO", margin, 20, true, accentColor);
  y -= 14;
  drawText("Dossier de Expediente", margin, 10, false, grayColor);
  y -= 8;

  // Separator line
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: accentColor,
  });
  y -= sectionGap;

  // ─── Case Info Section ─────────────────────────────
  drawText("DATOS DEL EXPEDIENTE", margin, 12, true, accentColor);
  y -= lineHeight + 4;

  const caseFields: [string, string][] = [
    ["Referencia:", caseData.ref],
    ["Estado:", STATUS_LABELS[caseData.status] || caseData.status],
    ["Urgente:", caseData.isUrgent ? "Si" : "No"],
    ["Categorias:", caseData.categories.join(", ")],
    ["Provincia:", caseData.province || "—"],
    ["Fecha de creacion:", formatDate(caseData.createdAt)],
  ];

  for (const [label, value] of caseFields) {
    ensureSpace(lineHeight);
    drawText(label, margin, 10, true);
    drawText(value, margin + 130, 10);
    y -= lineHeight;
  }

  // ─── Deceased Info ─────────────────────────────────
  if (caseData.deceased) {
    y -= sectionGap / 2;
    ensureSpace(lineHeight * 4);
    drawText("DATOS DEL FALLECIDO", margin, 12, true, accentColor);
    y -= lineHeight + 4;

    const deceasedFields: [string, string][] = [
      ["Nombre:", caseData.deceased.fullName],
      ["Fecha de fallecimiento:", formatDate(caseData.deceased.deathDate)],
      ["DNI:", caseData.deceased.dni || "—"],
    ];

    for (const [label, value] of deceasedFields) {
      ensureSpace(lineHeight);
      drawText(label, margin, 10, true);
      drawText(value, margin + 130, 10);
      y -= lineHeight;
    }
  }

  // ─── Contact Info ──────────────────────────────────
  if (caseData.contact) {
    y -= sectionGap / 2;
    ensureSpace(lineHeight * 5);
    drawText("DATOS DEL CONTACTO", margin, 12, true, accentColor);
    y -= lineHeight + 4;

    const contactFields: [string, string][] = [
      ["Nombre:", caseData.contact.fullName],
      ["Telefono:", caseData.contact.phone || "—"],
      ["Email:", caseData.contact.email || "—"],
      ["Relacion:", caseData.contact.relationship || "—"],
    ];

    for (const [label, value] of contactFields) {
      ensureSpace(lineHeight);
      drawText(label, margin, 10, true);
      drawText(value, margin + 130, 10);
      y -= lineHeight;
    }
  }

  // ─── Notes ─────────────────────────────────────────
  if (caseData.notes) {
    y -= sectionGap / 2;
    ensureSpace(lineHeight * 3);
    drawText("NOTAS", margin, 12, true, accentColor);
    y -= lineHeight + 4;

    const noteLines = caseData.notes.match(/.{1,80}/g) || [caseData.notes];
    for (const line of noteLines) {
      ensureSpace(lineHeight);
      drawText(line, margin, 9, false, grayColor);
      y -= lineHeight;
    }
  }

  // ─── Tasks Section ─────────────────────────────────
  y -= sectionGap;
  ensureSpace(lineHeight * 3);

  page.drawLine({
    start: { x: margin, y: y + 8 },
    end: { x: pageWidth - margin, y: y + 8 },
    thickness: 0.5,
    color: grayColor,
  });
  y -= 4;

  drawText(`TAREAS (${tasks.length})`, margin, 12, true, accentColor);
  y -= lineHeight + 4;

  if (tasks.length === 0) {
    drawText("No hay tareas registradas.", margin, 10, false, grayColor);
    y -= lineHeight;
  } else {
    // Table header
    ensureSpace(lineHeight);
    drawText("Categoria", margin, 8, true, grayColor);
    drawText("Tarea", margin + 100, 8, true, grayColor);
    drawText("Estado", margin + 380, 8, true, grayColor);
    drawText("Fecha limite", margin + 440, 8, true, grayColor);
    y -= lineHeight;

    for (const task of tasks) {
      ensureSpace(lineHeight);
      drawText(task.category, margin, 8);
      drawText(truncate(task.title, 50), margin + 100, 8);
      drawText(STATUS_LABELS[task.status] || task.status, margin + 380, 8);
      drawText(formatDate(task.dueDate), margin + 440, 8);
      y -= lineHeight;
    }
  }

  // ─── Documents Section ─────────────────────────────
  y -= sectionGap;
  ensureSpace(lineHeight * 3);

  page.drawLine({
    start: { x: margin, y: y + 8 },
    end: { x: pageWidth - margin, y: y + 8 },
    thickness: 0.5,
    color: grayColor,
  });
  y -= 4;

  drawText(`DOCUMENTOS (${documents.length})`, margin, 12, true, accentColor);
  y -= lineHeight + 4;

  if (documents.length === 0) {
    drawText("No hay documentos adjuntos.", margin, 10, false, grayColor);
    y -= lineHeight;
  } else {
    // Table header
    ensureSpace(lineHeight);
    drawText("Archivo", margin, 8, true, grayColor);
    drawText("Tipo", margin + 280, 8, true, grayColor);
    drawText("Tamano", margin + 380, 8, true, grayColor);
    drawText("Fecha", margin + 440, 8, true, grayColor);
    y -= lineHeight;

    for (const doc of documents) {
      ensureSpace(lineHeight);
      drawText(truncate(doc.fileName, 45), margin, 8);
      drawText(doc.mimeType || "—", margin + 280, 8);
      drawText(formatFileSize(doc.fileSize), margin + 380, 8);
      drawText(formatDate(doc.createdAt), margin + 440, 8);
      y -= lineHeight;
    }
  }

  // ─── Footer ────────────────────────────────────────
  y -= sectionGap;
  ensureSpace(lineHeight * 2);
  page.drawLine({
    start: { x: margin, y: y + 8 },
    end: { x: pageWidth - margin, y: y + 8 },
    thickness: 0.5,
    color: grayColor,
  });
  y -= lineHeight;
  drawText(
    `Generado por BARITUR PRO — ${new Date().toLocaleDateString("es-ES")}`,
    margin,
    8,
    false,
    grayColor
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
