/**
 * Pre-relleno de plantillas de documentos desde los datos de un expediente.
 *
 * Las plantillas de document-templates.ts tienen campos genericos
 * (remitenteName, deceasedName, deathDate, relationship, etc.). Esta
 * funcion mapea los datos conocidos del expediente a esos campos para
 * que el gestor no tenga que reescribirlos.
 *
 * Los campos que no se pueden derivar del expediente (bancoName,
 * polizaNumber, etc.) se dejan vacios para que el gestor los complete.
 */

import { getTemplateBySlug } from "./document-templates";

export interface CasePrefillData {
  /** Nombre del causante. */
  deceasedName: string | null;
  /** DNI del causante. */
  deceasedDni: string | null;
  /** Fecha de fallecimiento (Date o ISO string). */
  deathDate: Date | string | null;
  /** Nombre del contacto/heredero. */
  contactName: string | null;
  /** Parentesco del contacto con el causante. */
  contactRelationship: string | null;
  /** Email del contacto. */
  contactEmail: string | null;
  /** Telefono del contacto. */
  contactPhone: string | null;
  /** Provincia del causante. */
  province: string | null;
}

/** Convierte una fecha a formato yyyy-mm-dd para campos type=date. */
function toDateInputValue(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/**
 * Genera los valores pre-rellenos para una plantilla concreta a partir
 * de los datos del expediente. Solo rellena los campos cuya `key` exista
 * en la plantilla.
 */
export function prefillTemplateFromCase(
  templateSlug: string,
  caseData: CasePrefillData
): Record<string, string> {
  const template = getTemplateBySlug(templateSlug);
  if (!template) return {};

  // Mapa de derivaciones posibles desde el expediente
  const derived: Record<string, string> = {};

  if (caseData.deceasedName) derived.deceasedName = caseData.deceasedName;
  if (caseData.deceasedDni) derived.deceasedDni = caseData.deceasedDni;

  const dateValue = toDateInputValue(caseData.deathDate);
  if (dateValue) derived.deathDate = dateValue;

  // El heredero/contacto es el remitente habitual de las cartas
  if (caseData.contactName) {
    derived.remitenteName = caseData.contactName;
  }
  if (caseData.contactEmail) derived.remitenteEmail = caseData.contactEmail;
  if (caseData.contactPhone) derived.remitentePhone = caseData.contactPhone;

  // Parentesco: el campo "relationship" de varias plantillas es un select.
  // Solo lo rellenamos si el valor del expediente coincide con una opcion.
  if (caseData.contactRelationship) {
    derived.relationship = caseData.contactRelationship;
  }

  // Provincia del causante -> campo province cuando exista
  if (caseData.province) derived.province = caseData.province;

  // Filtrar solo los campos que la plantilla realmente tiene
  const templateKeys = new Set(template.fields.map((f) => f.key));
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(derived)) {
    if (templateKeys.has(key)) {
      result[key] = value;
    }
  }

  // Para campos select de parentesco, validar que el valor sea una opcion
  for (const field of template.fields) {
    if (
      field.type === "select" &&
      result[field.key] !== undefined &&
      field.options &&
      !field.options.includes(result[field.key])
    ) {
      // El valor del expediente no encaja en las opciones: lo quitamos
      delete result[field.key];
    }
  }

  return result;
}

/**
 * Cuenta cuantos campos de una plantilla quedan por rellenar tras el
 * pre-relleno. Util para mostrar al gestor "3 campos pendientes".
 */
export function countPendingFields(
  templateSlug: string,
  prefilled: Record<string, string>
): { total: number; filled: number; pending: number; pendingRequired: number } {
  const template = getTemplateBySlug(templateSlug);
  if (!template) return { total: 0, filled: 0, pending: 0, pendingRequired: 0 };

  let filled = 0;
  let pendingRequired = 0;
  for (const field of template.fields) {
    const value = prefilled[field.key];
    if (value && value.trim().length > 0) {
      filled++;
    } else if (field.required) {
      pendingRequired++;
    }
  }

  return {
    total: template.fields.length,
    filled,
    pending: template.fields.length - filled,
    pendingRequired,
  };
}
