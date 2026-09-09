/**
 * Política central de archivos, compartida por el portal familiar y la
 * aplicación interna.
 *
 * ESTADO ANTERIOR
 * ---------------
 * No había política. Ambos endpoints aceptaban cualquier `File`:
 *   - sin límite de tamaño (el fichero entero se cargaba en memoria);
 *   - sin lista de formatos permitidos;
 *   - confiando en `file.type`, que lo fija el cliente y se falsifica;
 *   - metiendo el nombre original crudo dentro de la clave de S3.
 *
 * NO HAY ANÁLISIS ANTIMALWARE. Este módulo valida tipo, tamaño y contenido
 * declarado; no busca virus ni contenido malicioso dentro de un PDF o un DOCX
 * bien formado. No debe describirse como "archivos analizados". Los campos de
 * estado dejan preparada la cuarentena para cuando exista un analizador real.
 */

import { randomBytes } from "crypto";

/** Tamaño máximo por archivo. Configurable por entorno. */
export const MAX_FILE_BYTES = (() => {
  const mb = Number.parseInt(process.env.MAX_UPLOAD_MB ?? "", 10);
  const safe = Number.isFinite(mb) && mb > 0 && mb <= 200 ? mb : 20;
  return safe * 1024 * 1024;
})();

export const MAX_FILE_MB = Math.round(MAX_FILE_BYTES / (1024 * 1024));

/**
 * Formatos admitidos. Lista de permitidos, no de prohibidos: cualquier tipo no
 * enumerado se rechaza.
 *
 * `magic` son las firmas de bytes iniciales aceptables. `null` significa que el
 * formato no tiene firma fiable (texto plano, CSV) y se valida por otra vía.
 */
interface AllowedType {
  mime: string;
  extensions: string[];
  magic: number[][] | null;
  label: string;
}

const ALLOWED_TYPES: AllowedType[] = [
  {
    mime: "application/pdf",
    extensions: ["pdf"],
    magic: [[0x25, 0x50, 0x44, 0x46]], // %PDF
    label: "PDF",
  },
  {
    mime: "image/jpeg",
    extensions: ["jpg", "jpeg"],
    magic: [[0xff, 0xd8, 0xff]],
    label: "JPEG",
  },
  {
    mime: "image/png",
    extensions: ["png"],
    magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    label: "PNG",
  },
  {
    mime: "image/tiff",
    extensions: ["tif", "tiff"],
    magic: [
      [0x49, 0x49, 0x2a, 0x00],
      [0x4d, 0x4d, 0x00, 0x2a],
    ],
    label: "TIFF",
  },
  {
    mime: "image/heic",
    extensions: ["heic"],
    // ftyp en el offset 4; se comprueba aparte.
    magic: null,
    label: "HEIC",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
    magic: [[0x50, 0x4b, 0x03, 0x04]], // ZIP
    label: "Word (docx)",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
    magic: [[0x50, 0x4b, 0x03, 0x04]], // ZIP
    label: "Excel (xlsx)",
  },
  {
    mime: "text/csv",
    extensions: ["csv"],
    magic: null,
    label: "CSV",
  },
  {
    mime: "text/plain",
    extensions: ["txt"],
    magic: null,
    label: "Texto",
  },
];

/**
 * Firmas explícitamente peligrosas. Se comprueban antes que la lista de
 * permitidos para dar un mensaje claro y para cortar el caso de un ejecutable
 * renombrado a .pdf.
 */
const DANGEROUS_SIGNATURES: Array<{ magic: number[]; label: string }> = [
  { magic: [0x4d, 0x5a], label: "ejecutable de Windows" }, // MZ
  { magic: [0x7f, 0x45, 0x4c, 0x46], label: "ejecutable ELF" },
  { magic: [0xca, 0xfe, 0xba, 0xbe], label: "ejecutable Mach-O/Java" },
  { magic: [0xfe, 0xed, 0xfa, 0xce], label: "ejecutable Mach-O" },
  { magic: [0xcf, 0xfa, 0xed, 0xfe], label: "ejecutable Mach-O" },
  { magic: [0x23, 0x21], label: "script con shebang" }, // #!
];

export type FileRejection =
  | "empty"
  | "too_large"
  | "extension_not_allowed"
  | "mime_not_allowed"
  | "content_mismatch"
  | "dangerous_content";

export interface FileValidationResult {
  ok: boolean;
  reason?: FileRejection;
  message?: string;
  /** Tipo confirmado por contenido, no por lo que declaró el cliente. */
  detectedType?: string;
}

function startsWith(buffer: Buffer, magic: number[]): boolean {
  if (buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
}

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/** HEIC/HEIF: "ftyp" en el offset 4. */
function looksLikeHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  return (
    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
  );
}

/** Contenido con HTML activo dentro de un fichero declarado como texto/imagen. */
function containsActiveMarkup(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 2048).toString("utf8").toLowerCase();
  return (
    head.includes("<script") ||
    head.includes("<iframe") ||
    head.includes("javascript:") ||
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<svg")
  );
}

/**
 * Valida un archivo por su tamaño, su extensión y su CONTENIDO REAL.
 *
 * `declaredMime` se usa sólo para dar mensajes útiles: la decisión la toman la
 * extensión y los bytes. Un ejecutable renombrado a `.pdf` con
 * `Content-Type: application/pdf` se rechaza porque sus bytes no empiezan por
 * `%PDF`.
 */
export function validateFile(params: {
  fileName: string;
  size: number;
  declaredMime?: string | null;
  head: Buffer;
}): FileValidationResult {
  const { fileName, size, head } = params;

  if (size <= 0 || head.length === 0) {
    return { ok: false, reason: "empty", message: "El archivo está vacío." };
  }

  if (size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: "too_large",
      message: `El archivo supera el máximo de ${MAX_FILE_MB} MB.`,
    };
  }

  for (const sig of DANGEROUS_SIGNATURES) {
    if (startsWith(head, sig.magic)) {
      return {
        ok: false,
        reason: "dangerous_content",
        message: `El contenido del archivo es un ${sig.label}, no un documento.`,
      };
    }
  }

  const ext = extensionOf(fileName);
  const allowed = ALLOWED_TYPES.find((t) => t.extensions.includes(ext));
  if (!allowed) {
    const lista = Array.from(new Set(ALLOWED_TYPES.map((t) => t.label))).join(", ");
    return {
      ok: false,
      reason: "extension_not_allowed",
      message: `Formato no admitido. Se aceptan: ${lista}.`,
    };
  }

  // SVG se rechaza siempre: es XML ejecutable en el navegador y no hay
  // sanitizador aquí. Se documenta como limitación en vez de fingir soporte.
  if (ext === "svg") {
    return {
      ok: false,
      reason: "dangerous_content",
      message: "No se admiten archivos SVG.",
    };
  }

  if (allowed.magic) {
    const matches = allowed.magic.some((m) => startsWith(head, m));
    if (!matches) {
      return {
        ok: false,
        reason: "content_mismatch",
        message: `El contenido del archivo no corresponde a un ${allowed.label}.`,
      };
    }
  } else if (ext === "heic") {
    if (!looksLikeHeic(head)) {
      return {
        ok: false,
        reason: "content_mismatch",
        message: "El contenido del archivo no corresponde a una imagen HEIC.",
      };
    }
  } else {
    // Formatos sin firma (txt, csv): exigimos que no traigan marcado activo,
    // que es la vía por la que un .txt se convierte en XSS al abrirlo.
    if (containsActiveMarkup(head)) {
      return {
        ok: false,
        reason: "dangerous_content",
        message: "El archivo de texto contiene marcado HTML o scripts.",
      };
    }
  }

  return { ok: true, detectedType: allowed.mime };
}

/**
 * Comprobación de NOMBRE y TAMAÑO, sin ver un solo byte.
 *
 * POR QUÉ HACE FALTA APARTE
 * -------------------------
 * Con la subida directa al almacenamiento, el servidor autoriza antes de que
 * exista ningún byte que mirar: no puede llamar a `validateFile`, que decide
 * por contenido. Esto es lo único que sí se puede decidir en ese momento, y
 * evita entregar un permiso de escritura para un `.exe` o para algo que ya se
 * sabe que excede el máximo.
 *
 * NO SUSTITUYE A `validateFile`. La extensión la pone quien sube y se falsifica
 * sola; la palabra final la siguen teniendo los bytes reales, ya en la
 * confirmación. Esto sólo evita el viaje inútil.
 */
export function validarNombreYTamano(params: {
  fileName: string;
  size: number;
}): FileValidationResult {
  const { fileName, size } = params;

  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: "empty", message: "El archivo está vacío." };
  }

  if (size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: "too_large",
      message: `El archivo supera el máximo de ${MAX_FILE_MB} MB.`,
    };
  }

  const ext = extensionOf(fileName);
  const allowed = ALLOWED_TYPES.find((t) => t.extensions.includes(ext));
  if (!allowed || ext === "svg") {
    const lista = Array.from(new Set(ALLOWED_TYPES.map((t) => t.label))).join(", ");
    return {
      ok: false,
      reason: "extension_not_allowed",
      message: `Formato no admitido. Se aceptan: ${lista}.`,
    };
  }

  return { ok: true, detectedType: allowed.mime };
}

/**
 * Limpia el nombre original para mostrarlo y para la cabecera de descarga.
 * No se usa como parte principal de la clave de S3.
 */
export function sanitizeFileName(original: string): string {
  const base = (original || "documento")
    .replace(/[\r\n\t\0]/g, "")
    .split(/[/\\]/)
    .pop()!;

  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/\.{2,}/g, ".")
    .trim();

  const safe = cleaned.replace(/^\.+/, "") || "documento";
  return safe.length > 180 ? safe.slice(-180) : safe;
}

/**
 * Clave de S3 impredecible. Antes se usaba
 * `${orgId}/${caseId}/${Date.now()}-${file.name}`, que era adivinable y metía
 * el nombre del usuario (con su posible path traversal) dentro de la ruta.
 *
 * Ahora el nombre original vive sólo en la columna `fileName`.
 */
export function buildFileKey(params: {
  orgId: string;
  caseId: string;
  fileName: string;
  fromPortal?: boolean;
}): string {
  const ext = extensionOf(params.fileName);
  const suffix = ext ? `.${ext}` : "";
  const random = randomBytes(16).toString("hex");
  const scope = params.fromPortal ? "portal" : "interno";
  return `${params.orgId}/${params.caseId}/${scope}/${random}${suffix}`;
}

/** Cabeceras de descarga que impiden que el navegador ejecute el contenido. */
export function downloadHeaders(fileName: string, mimeType?: string | null) {
  const safe = sanitizeFileName(fileName);
  return {
    // `attachment` evita el renderizado en línea; el nombre va codificado para
    // que no pueda romper la cabecera.
    "Content-Disposition": `attachment; filename="${safe.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    "Content-Type": mimeType && ALLOWED_TYPES.some((t) => t.mime === mimeType)
      ? mimeType
      : "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store",
  };
}

export { ALLOWED_TYPES };
