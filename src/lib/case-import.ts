/**
 * Parser común para importación de expedientes desde CSV o Excel.
 *
 * Comparte la lógica de cabeceras, validación por fila y mapeo a
 * ParsedRow entre el path CSV (texto) y el path Excel (.xlsx, lectura
 * binaria por SheetJS). Lo extraemos del API route para poder testearlo.
 */

import * as XLSX from "xlsx";
import { TaskCategory } from "@prisma/client";

const VALID_CATEGORIES = new Set(Object.values(TaskCategory));

export interface ParsedRow {
  row: number;
  deceasedName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  province: string;
  categories: TaskCategory[];
  deathDate: string;
  deceasedDni: string;
  contactRelationship: string;
  isUrgent: boolean;
  notes: string;
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface ParseResult {
  parsed: ParsedRow[];
  errors: RowError[];
  total: number;
  /** Si el archivo no tenía cabeceras válidas, se devuelve aquí sin filas. */
  headerIssue?: string;
}

export const EXPECTED_HEADERS = [
  "fallecido",
  "contacto",
  "email_contacto",
  "telefono_contacto",
  "provincia",
  "categorias",
  "fecha_fallecimiento",
  "dni_fallecido",
  "parentesco",
  "urgente",
  "notas",
] as const;

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";") {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(raw: string): string {
  return raw
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z_]/g, "");
}

/** Convierte un CSV string a una matriz de filas (cada fila = array de celdas). */
export function csvToRows(csv: string): string[][] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((l) => parseCSVLine(l));
}

/**
 * Convierte un XLSX (en base64) a una matriz de filas usando la primera hoja.
 * Maneja celdas vacías, fechas y números convirtiéndolos a strings formateados.
 */
export function xlsxToRows(base64: string): string[][] {
  const buffer = Buffer.from(base64, "base64");
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const firstName = wb.SheetNames[0];
  if (!firstName) return [];
  const ws = wb.Sheets[firstName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
  return rows
    .map((row) => row.map((cell) => (cell == null ? "" : String(cell).trim())))
    .filter((row) => row.some((cell) => cell !== ""));
}

function buildColIndex(headerRow: string[]): Record<string, number> {
  const colIndex: Record<string, number> = {};
  const normalized = headerRow.map(normalizeHeader);
  for (const expected of EXPECTED_HEADERS) {
    const idx = normalized.indexOf(expected);
    if (idx !== -1) colIndex[expected] = idx;
  }
  return colIndex;
}

function parseDataRows(
  dataRows: string[][],
  colIndex: Record<string, number>,
): { parsed: ParsedRow[]; errors: RowError[] } {
  const parsed: ParsedRow[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2;
    const fields = dataRows[i];
    const get = (key: string) =>
      colIndex[key] !== undefined ? (fields[colIndex[key]] ?? "").toString().trim() : "";

    const deceasedName = get("fallecido");
    const contactName = get("contacto");
    const contactEmail = get("email_contacto");
    const contactPhone = get("telefono_contacto");

    if (!deceasedName) {
      errors.push({ row: rowNum, field: "fallecido", message: "Nombre del fallecido obligatorio" });
    }
    if (!contactName) {
      errors.push({ row: rowNum, field: "contacto", message: "Nombre del contacto obligatorio" });
    }
    if (!contactEmail && !contactPhone) {
      errors.push({ row: rowNum, field: "email_contacto", message: "Se requiere al menos email o teléfono" });
    }

    const rawCategories = get("categorias");
    const categories: TaskCategory[] = [];
    if (rawCategories) {
      for (const cat of rawCategories.split(/[,;|]+/).map((c) => c.trim().toUpperCase())) {
        if (VALID_CATEGORIES.has(cat as TaskCategory)) {
          categories.push(cat as TaskCategory);
        } else if (cat) {
          errors.push({
            row: rowNum,
            field: "categorias",
            message: `Categoría inválida: "${cat}". Válidas: ${Array.from(VALID_CATEGORIES).join(", ")}`,
          });
        }
      }
    }
    if (categories.length === 0) categories.push(TaskCategory.OTROS);

    const deathDate = get("fecha_fallecimiento");
    if (deathDate && isNaN(Date.parse(deathDate))) {
      errors.push({ row: rowNum, field: "fecha_fallecimiento", message: "Formato de fecha inválido" });
    }

    const urgentRaw = get("urgente").toLowerCase();
    const isUrgent = urgentRaw === "true" || urgentRaw === "si" || urgentRaw === "sí" || urgentRaw === "1";

    if (errors.filter((e) => e.row === rowNum).length === 0) {
      parsed.push({
        row: rowNum,
        deceasedName,
        contactName,
        contactEmail,
        contactPhone,
        province: get("provincia"),
        categories,
        deathDate,
        deceasedDni: get("dni_fallecido"),
        contactRelationship: get("parentesco"),
        isUrgent,
        notes: get("notas"),
      });
    }
  }

  return { parsed, errors };
}

/**
 * Pipeline central: matriz de filas → resultado normalizado para el route.
 * Devuelve `headerIssue` si la primera fila no contiene las cabeceras obligatorias.
 */
export function parseSpreadsheet(rows: string[][]): ParseResult {
  if (rows.length < 2) {
    return {
      parsed: [],
      errors: [],
      total: 0,
      headerIssue: "El archivo debe tener al menos una cabecera y una fila de datos",
    };
  }
  const colIndex = buildColIndex(rows[0]);
  if (colIndex["fallecido"] === undefined || colIndex["contacto"] === undefined) {
    return {
      parsed: [],
      errors: [],
      total: rows.length - 1,
      headerIssue: `Cabeceras obligatorias no encontradas: 'fallecido' y 'contacto'. Cabeceras esperadas: ${EXPECTED_HEADERS.join(", ")}`,
    };
  }
  const dataRows = rows.slice(1);
  const { parsed, errors } = parseDataRows(dataRows, colIndex);
  return { parsed, errors, total: dataRows.length };
}
