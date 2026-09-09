/**
 * Datos de la entidad responsable, leidos de configuracion.
 *
 * POR QUE EXISTE ESTE FICHERO
 * ----------------------------
 * Los textos legales citaban "HEREDIA TECHNOLOGIES S.L." como titular de la
 * marca y como responsable del tratamiento. Esa sociedad NO EXISTE: no hay
 * ninguna constituida todavia. Un aviso legal que nombra a una sociedad
 * inexistente y unas condiciones que le atribuyen la titularidad no son un
 * detalle de redaccion pendiente de pulir: son informacion falsa presentada
 * como vinculante ante clientes y ante la autoridad de proteccion de datos.
 *
 * La alternativa tampoco puede ser dejar `[DENOMINACION SOCIAL]` a la vista del
 * publico, como hacia la politica de privacidad. Es menos grave —no afirma algo
 * falso— pero deja el documento sin responsable identificable, que es
 * exactamente lo que el articulo 13 del RGPD exige que conste.
 *
 * Asi que los datos salen de configuracion:
 *
 *   - Si estan definidos, los textos los usan.
 *   - Si faltan, los textos lo dicen abiertamente en vez de inventarlos o de
 *     ensenar un marcador cripico.
 *   - Y `scripts/check-legal-config.mjs` impide desplegar a produccion sin
 *     ellos, para que "ya lo rellenaremos" no acabe publicado.
 */

export interface DatosEntidadLegal {
  denominacion: string | null;
  nif: string | null;
  domicilio: string | null;
  /** Direccion de contacto para ejercicio de derechos y privacidad. */
  contactoPrivacidad: string | null;
  /** Delegado de proteccion de datos, si se ha designado. Puede no existir. */
  dpo: string | null;
}

/** Nombre comercial del producto. No es una sociedad y no pretende serlo. */
export const NOMBRE_COMERCIAL = "Heredia";

function leer(nombre: string): string | null {
  const valor = process.env[nombre]?.trim();
  return valor ? valor : null;
}

export function datosEntidadLegal(): DatosEntidadLegal {
  return {
    denominacion: leer("LEGAL_ENTITY_NAME"),
    nif: leer("LEGAL_ENTITY_NIF"),
    domicilio: leer("LEGAL_ENTITY_ADDRESS"),
    contactoPrivacidad: leer("LEGAL_PRIVACY_EMAIL"),
    dpo: leer("LEGAL_DPO_CONTACT"),
  };
}

/**
 * Campos sin los que no se puede publicar un aviso legal valido.
 *
 * El DPO queda fuera a proposito: designarlo solo es obligatorio en los
 * supuestos del articulo 37 del RGPD, y afirmar que hay uno cuando no lo hay
 * seria otra invencion.
 */
export const CAMPOS_LEGALES_OBLIGATORIOS = [
  "LEGAL_ENTITY_NAME",
  "LEGAL_ENTITY_NIF",
  "LEGAL_ENTITY_ADDRESS",
  "LEGAL_PRIVACY_EMAIL",
] as const;

export function faltanDatosLegales(): string[] {
  return CAMPOS_LEGALES_OBLIGATORIOS.filter((c) => !leer(c));
}

/**
 * Texto identificativo del responsable para incrustar en los documentos.
 *
 * Cuando falta el dato NO se inventa y NO se deja un marcador: se dice que esta
 * pendiente. Un lector que se encuentre esto sabe exactamente que ocurre, y
 * quien publique la pagina no puede confundirlo con un texto terminado.
 */
export function identificacionResponsable(): string {
  const { denominacion, nif, domicilio } = datosEntidadLegal();
  if (!denominacion || !nif || !domicilio) {
    return "[Entidad responsable pendiente de constituir e inscribir]";
  }
  return `${denominacion}, con NIF ${nif} y domicilio en ${domicilio}`;
}

export function contactoPrivacidadTexto(): string {
  return (
    datosEntidadLegal().contactoPrivacidad ??
    "[Direccion de contacto pendiente de designar]"
  );
}
