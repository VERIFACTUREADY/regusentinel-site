#!/usr/bin/env node
/**
 * Puerta de datos legales.
 *
 * POR QUE EXISTE
 * --------------
 * Los textos legales citaban "HEREDIA TECHNOLOGIES S.L." como titular de la
 * marca y responsable del tratamiento. Esa sociedad no existe. Y la politica de
 * privacidad ensenaba `[DENOMINACION SOCIAL]` a la vista del publico.
 *
 * Ahora los datos salen de configuracion, lo cual resuelve la invencion pero
 * abre otro riesgo: que se despliegue a produccion sin rellenarlos y se
 * publique un aviso legal sin responsable identificable, que es justo lo que el
 * articulo 13 del RGPD exige que conste.
 *
 * Este script convierte ese descuido en un fallo de despliegue. Solo actua
 * cuando el despliegue es de produccion: en previsualizaciones y en desarrollo
 * avisa, pero no bloquea, porque ahi el texto incompleto no lo lee ningun
 * cliente.
 *
 * Uso: node scripts/check-legal-config.mjs
 */

const OBLIGATORIAS = [
  ["LEGAL_ENTITY_NAME", "Denominacion social completa, tal como figure en el Registro Mercantil."],
  ["LEGAL_ENTITY_NIF", "NIF de la entidad."],
  ["LEGAL_ENTITY_ADDRESS", "Domicilio social completo."],
  ["LEGAL_PRIVACY_EMAIL", "Direccion para el ejercicio de derechos (acceso, rectificacion, supresion...)."],
];

// El DPO queda fuera a proposito: designarlo solo es obligatorio en los
// supuestos del articulo 37 del RGPD, y afirmar que hay uno cuando no lo hay
// seria otra invencion.
const OPCIONALES = [
  ["LEGAL_DPO_CONTACT", "Contacto del delegado de proteccion de datos, si se ha designado."],
];

/*
 * Que cuenta como "desplegar a produccion".
 *
 * NO vale mirar NODE_ENV. La suite E2E compila con NODE_ENV=production para
 * probar el artefacto real, y bloquear ahi impedia ejecutar las pruebas sin
 * aportar nada: ese build no lo ve ningun cliente.
 *
 * La senal tiene que ser explicita del despliegue: Vercel marca VERCEL_ENV, y
 * para cualquier otro destino se usa DEPLOY_TARGET=production. Lo que no esta
 * marcado no bloquea, solo avisa.
 */
const esProduccion =
  process.env.VERCEL_ENV === "production" ||
  process.env.DEPLOY_TARGET === "production";

const faltan = OBLIGATORIAS.filter(([nombre]) => !process.env[nombre]?.trim());

if (faltan.length === 0) {
  console.log("Datos legales: completos.");
  for (const [nombre] of OPCIONALES) {
    if (!process.env[nombre]?.trim()) {
      console.log(`Aviso: ${nombre} sin definir (opcional).`);
    }
  }
  process.exit(0);
}

const cabecera = esProduccion
  ? "::error::No se puede desplegar a produccion sin los datos de la entidad responsable:"
  : "::warning::Faltan datos legales (no bloquea fuera de produccion):";

console.error(cabecera);
for (const [nombre, descripcion] of faltan) {
  console.error(`  ${nombre}  —  ${descripcion}`);
}

if (esProduccion) {
  console.error(
    "\nSin estos datos, el aviso legal y la politica de privacidad se publican " +
      "sin responsable identificable. Definelos en las variables de entorno del " +
      "proyecto y vuelve a desplegar.\n" +
      "\nNO los rellenes con datos provisionales ni inventados: mientras la " +
      "sociedad no este constituida, lo correcto es no desplegar a produccion.",
  );
  process.exit(1);
}

console.error(
  "\nEn desarrollo y en previsualizacion los textos muestran " +
    '"[Entidad responsable pendiente de constituir e inscribir]" en vez de datos falsos.',
);
process.exit(0);
