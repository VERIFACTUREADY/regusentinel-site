/**
 * Deep links a la Sede Electrónica del Catastro.
 *
 * No es un lookup automático del valor de referencia (eso requiere
 * Cl@ve o certificado digital), pero abre la consulta del bien
 * inmueble en una nueva pestaña con la referencia catastral ya
 * pre-rellenada para que el gestor sólo tenga que autenticarse
 * y leer el valor.
 *
 * También aporta un helper que valida la referencia catastral
 * (20 dígitos alfanuméricos, formato oficial del Catastro español).
 */

/**
 * Una RC válida tiene 20 caracteres: 7 dígitos + 7 dígitos + 4 dígitos
 * + 2 letras de verificación. Aceptamos también las versiones con
 * espacios o guiones — los limpiamos.
 */
const RC_REGEX = /^[0-9A-Z]{20}$/;

export function normalizeReferenciaCatastral(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = String(raw).toUpperCase().replace(/[\s\-]/g, "").trim();
  if (!RC_REGEX.test(cleaned)) return null;
  return cleaned;
}

export function isValidReferenciaCatastral(raw: string | null | undefined): boolean {
  return normalizeReferenciaCatastral(raw) !== null;
}

/**
 * URL del callejero del Catastro con la consulta de bien inmueble
 * filtrada por referencia catastral. Abre el formulario de la sede
 * con el campo "Referencia catastral" ya rellenado. El usuario verá
 * la ficha del inmueble (titular, valor catastral, año construcción,
 * superficie, uso) y desde ahí puede consultar el valor de referencia
 * con su certificado.
 */
export function buildCatastroConsultaUrl(rc: string): string | null {
  const normalized = normalizeReferenciaCatastral(rc);
  if (!normalized) return null;
  return `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCConCiud.aspx?RefC=${normalized}`;
}

/**
 * URL del visor cartográfico del Catastro centrado en la parcela.
 * Muy útil para confirmar visualmente el inmueble antes de tramitar.
 */
export function buildCatastroMapaUrl(rc: string): string | null {
  const normalized = normalizeReferenciaCatastral(rc);
  if (!normalized) return null;
  return `https://www1.sedecatastro.gob.es/Cartografia/GeneraGraficoParcela.aspx?ReferenciaCatastral=${normalized}`;
}
