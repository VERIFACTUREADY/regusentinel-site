/**
 * Minimización de datos personales antes de enviarlos a un modelo externo.
 *
 * ESTADO ANTERIOR
 * ---------------
 * El contexto del expediente se enviaba a Anthropic tal cual: nombre del
 * fallecido, nombre y email del contacto, DNI, teléfonos y notas libres. Y
 * `PromptLog` guardaba el prompt **íntegro** y la respuesta, sin retención, de
 * modo que la PII quedaba almacenada por duplicado y para siempre.
 *
 * Este módulo no convierte el tratamiento en anónimo — un expediente sigue
 * siendo identificable por su contexto — pero elimina los identificadores
 * directos, que es lo que exige la minimización del art. 5.1.c RGPD.
 */

import { createHash } from "crypto";

/** Marcadores estables: el modelo puede razonar sobre ellos sin ver el dato. */
export const PLACEHOLDERS = {
  email: "[EMAIL]",
  phone: "[TELEFONO]",
  dni: "[DNI]",
  iban: "[IBAN]",
  deceased: "[CAUSANTE]",
  contact: "[SOLICITANTE]",
} as const;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** DNI/NIE españoles. Se comprueba antes que el teléfono para no solaparse. */
const DNI_RE = /\b[XYZ]?\d{7,8}[-\s]?[A-HJ-NP-TV-Z]\b/gi;
const IBAN_RE = /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){3,7}[A-Z0-9]{1,4}\b/g;
/** Teléfonos españoles, con o sin prefijo y con separadores habituales. */
const PHONE_RE = /(?:\+34[\s.-]?)?\b[6-9]\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}\b/g;

/**
 * Elimina identificadores directos de un texto libre.
 *
 * El orden importa: DNI e IBAN se sustituyen antes que el teléfono, porque un
 * DNI de 8 dígitos puede encajar en el patrón telefónico.
 */
export function redactPii(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL_RE, PLACEHOLDERS.email)
    .replace(IBAN_RE, PLACEHOLDERS.iban)
    .replace(DNI_RE, PLACEHOLDERS.dni)
    .replace(PHONE_RE, PLACEHOLDERS.phone);
}

/**
 * Sustituye apariciones de nombres propios conocidos por su marcador.
 *
 * Se hace por nombre completo y también por cada apellido de más de tres
 * letras, porque las notas suelen referirse a "la Sra. Pérez".
 */
export function pseudonymizeNames(
  text: string,
  names: { deceased?: string | null; contact?: string | null },
): string {
  let out = text;

  const reemplazos: Array<[string | null | undefined, string]> = [
    [names.deceased, PLACEHOLDERS.deceased],
    [names.contact, PLACEHOLDERS.contact],
  ];

  for (const [nombre, marcador] of reemplazos) {
    if (!nombre) continue;
    const limpio = nombre.trim();
    if (limpio.length < 3) continue;

    out = out.replace(new RegExp(escapeRegExp(limpio), "gi"), marcador);

    for (const parte of limpio.split(/[\s,]+/)) {
      if (parte.length > 3) {
        out = out.replace(new RegExp(`\\b${escapeRegExp(parte)}\\b`, "gi"), marcador);
      }
    }
  }

  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Minimiza un contexto completo: primero los nombres, luego el resto. */
export function minimizeContext(
  text: string,
  names: { deceased?: string | null; contact?: string | null } = {},
): string {
  return redactPii(pseudonymizeNames(text, names));
}

/**
 * Huella del contexto para poder correlacionar una respuesta con la entrada
 * sin almacenar la entrada. Sustituye al guardado del prompt íntegro.
 */
export function contextHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** ¿Queda algún identificador directo? Se usa como red de seguridad y en tests. */
export function containsDirectIdentifiers(text: string): boolean {
  return (
    new RegExp(EMAIL_RE.source, "i").test(text) ||
    new RegExp(DNI_RE.source, "i").test(text) ||
    new RegExp(IBAN_RE.source).test(text) ||
    new RegExp(PHONE_RE.source).test(text)
  );
}

/**
 * ¿Puede esta organización usar funciones de IA?
 *
 * Configuración explícita por organización: sin ella, el tratamiento con un
 * proveedor externo se hacía sin que el responsable lo hubiera decidido.
 * Por defecto **desactivado**: activarlo es una decisión del cliente, que es
 * quien responde frente a los interesados.
 */
export function aiEnabledFor(org: { aiEnabled?: boolean | null } | null | undefined): boolean {
  return org?.aiEnabled === true;
}

/** Días que se conservan los registros de PromptLog. */
export const PROMPT_LOG_RETENTION_DAYS = (() => {
  const raw = Number.parseInt(process.env.PROMPT_LOG_RETENTION_DAYS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 && raw <= 3650 ? raw : 90;
})();

/**
 * ¿Puede este expediente usar IA externa?
 *
 * Combina las dos condiciones que deben cumplirse:
 *   1. El proveedor tiene clave configurada (`ANTHROPIC_API_KEY`).
 *   2. La organización lo ha activado explícitamente (`aiEnabled`).
 *
 * Antes sólo se comprobaba la primera: bastaba con que Heredia tuviera clave
 * para que los datos de cualquier cliente salieran hacia un tercero, sin que
 * el responsable del tratamiento lo hubiera decidido. Cuando devuelve `false`
 * los módulos caen al comportamiento determinista local, que ya existía.
 */
export async function aiAllowedForCase(
  caseId: string,
  db: { case: { findUnique: (args: any) => Promise<any> } },
): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;

  const row = await db.case.findUnique({
    where: { id: caseId },
    select: { org: { select: { aiEnabled: true } } },
  });
  return row?.org?.aiEnabled === true;
}

/** Igual que la anterior, partiendo de la organización. */
export async function aiAllowedForOrg(
  orgId: string,
  db: { organization: { findUnique: (args: any) => Promise<any> } },
): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { aiEnabled: true },
  });
  return org?.aiEnabled === true;
}
