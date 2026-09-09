/**
 * Helper para construir deep links a WhatsApp Web / app móvil.
 *
 * Formato oficial: https://wa.me/<phone>?text=<urlencoded>
 *   - phone: número internacional SIN espacios, signos ni "+".
 *   - text: texto pre-rellenado en el chat.
 *
 * Trabajamos con teléfonos en formato libre ("+34 612 345 678",
 * "612345678", "(34) 612-34-56-78") y normalizamos. Si no se puede
 * normalizar a algo plausible, devolvemos null para que el caller
 * decida qué hacer (ocultar el botón, mostrar disabled, etc.).
 */

/** Prefijo por defecto cuando el teléfono empieza con un 6/7/8/9 de 9 dígitos. */
const DEFAULT_COUNTRY = "34";

/** Cualquier carácter que no sea dígito se considera separador (excepto el +). */
const NON_DIGITS = /[^0-9+]/g;

/**
 * Normaliza un teléfono libre a formato wa.me (sólo dígitos).
 * - Si empieza por +XX..., se quita el +.
 * - Si empieza por 00XX..., se quitan los dos ceros iniciales.
 * - Si son 9 dígitos y empiezan por 6/7/8/9, prefijo 34 (España).
 * - Si tras todo eso no parece un teléfono internacional (>= 9 dígitos),
 *   devolvemos null.
 */
export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(NON_DIGITS, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (normalized.startsWith("+")) {
    normalized = normalized.slice(1);
  } else if (normalized.startsWith("00")) {
    normalized = normalized.slice(2);
  } else if (/^[6789]\d{8}$/.test(normalized)) {
    // 9 dígitos móvil/fijo nacional español → añade prefijo 34
    normalized = `${DEFAULT_COUNTRY}${normalized}`;
  }

  if (!/^\d{9,15}$/.test(normalized)) return null;
  return normalized;
}

export interface WhatsAppLinkInput {
  phone: string | null | undefined;
  text?: string | null;
}

/**
 * Construye la URL https://wa.me/... lista para usar en `href`.
 * Devuelve null si el teléfono no se puede normalizar.
 */
export function buildWhatsAppUrl({ phone, text }: WhatsAppLinkInput): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  const trimmed = text ? text.trim() : "";
  // encodeURIComponent (no URLSearchParams) para que los espacios sean %20
  // en lugar de "+", igual que los ejemplos oficiales de wa.me.
  const query = trimmed ? `?text=${encodeURIComponent(trimmed)}` : "";
  return `https://wa.me/${normalized}${query}`;
}
