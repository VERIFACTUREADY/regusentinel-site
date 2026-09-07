#!/usr/bin/env node
/**
 * Puerta de vulnerabilidades.
 *
 * POR QUE NO ES UN `npm audit --audit-level=critical` A SECAS
 * -----------------------------------------------------------
 * Ese comando mezcla dos cosas que no tienen el mismo riesgo:
 *
 *   - una vulnerabilidad crítica en una dependencia de PRODUCCIÓN viaja en el
 *     artefacto desplegado y la explota quien envíe una petición;
 *   - una en una herramienta de desarrollo sólo afecta a quien ejecuta esa
 *     herramienta, y a veces sólo en un modo que no usamos.
 *
 * Tratarlas igual lleva a uno de dos finales malos: o se bloquea el pipeline
 * por algo que no expone nada y acaba desactivándose la comprobación entera, o
 * se baja el umbral y deja de detectar lo que sí importa.
 *
 * Aquí:
 *   1. El árbol de PRODUCCIÓN debe tener CERO críticas. Sin excepciones.
 *   2. En desarrollo, cada crítica debe estar aceptada de forma explícita, con
 *      su identificador de aviso y el motivo. Una crítica nueva que no esté en
 *      la lista hace fallar el pipeline.
 *
 * Uso: node scripts/audit-gate.mjs
 */
import { execFileSync } from "node:child_process";

/**
 * Avisos ALTOS del árbol de PRODUCCIÓN cuya superficie vulnerable NO existe en
 * este despliegue.
 *
 * POR QUÉ ESTA LISTA Y NO UN UMBRAL
 * ---------------------------------
 * Antes esta puerta sólo miraba las CRÍTICAS. Con seis paquetes de producción
 * en ALTA, eso significaba que la CI estaba verde mientras el artefacto
 * desplegado arrastraba avisos que nadie había leído. Un semáforo que no mira
 * la mitad de lo que importa enseña a confiar en él sin motivo.
 *
 * Ahora cada ALTA de producción tiene que estar aquí, con su identificador y
 * el motivo por el que no nos alcanza —comprobado contra el código, no
 * supuesto—, o la puerta falla. Lo que NO se puede hacer es meter aquí un
 * aviso que sí nos afecta para que el pipeline pase: para eso está
 * `BLOQUEOS_DECLARADOS`, que falla a propósito.
 */
const ALTAS_NO_APLICABLES_EN_PRODUCCION = {
  /*
   * VACÍA A PROPÓSITO — y esa es la buena noticia.
   *
   * Hasta el 2026-08-23 esta lista tenía cinco avisos de `next@14.2.35`
   * (GHSA-c4j6-fc7j-m34r, GHSA-36qx-fr4f-26g5, GHSA-m99w-x7hq-7vfj,
   * GHSA-89xv-2m56-2m9x y GHSA-p9j2-gv94-2wf4), justificados uno a uno porque
   * su superficie —WebSocket upgrades, Pages Router con i18n, Server Actions,
   * servidor propio y `rewrites`— no existe en esta aplicación.
   *
   * Y `BLOQUEOS_DECLARADOS` tenía otros tres que SÍ nos alcanzaban: los DoS de
   * React Server Components. Esos no se podían justificar, así que esta puerta
   * fallaba a propósito y el release quedó marcado NO LISTO PARA MERGE.
   *
   * Las ocho han desaparecido **porque la dependencia está parcheada**:
   * `next` pasó de 14.2.35 a 15.5.21. No se ha movido ningún aviso de una
   * lista a otra, ni se ha bajado ningún umbral. Con el árbol nuevo,
   * `npm audit --omit=dev` no devuelve ninguna ALTA de producción.
   *
   * Vaciarla también endurece la puerta: si cualquiera de esos avisos
   * reapareciera, ya no estaría revisado y el pipeline volvería a fallar.
   */
};

/**
 * Avisos ALTOS de PRODUCCIÓN que SÍ nos alcanzan y que no tienen arreglo sin
 * una migración mayor.
 *
 * Están aquí para que el fallo diga QUÉ es y QUÉ hace falta, no para
 * silenciarlo: la puerta falla igual. Vaciar esta lista sin actualizar la
 * dependencia sería exactamente la trampa que esta puerta existe para impedir.
 *
 * Vacía desde el 2026-08-23: los tres DoS de React Server Components que la
 * ocupaban se resolvieron actualizando `next` a 15.5.21, que es justamente el
 * arreglo que esta lista pedía.
 */
const BLOQUEOS_DECLARADOS = {};

/**
 * Vulnerabilidades de HERRAMIENTAS DE DESARROLLO aceptadas conscientemente.
 *
 * Añadir una entrada aquí es una decisión que queda escrita, con fecha y
 * motivo. No vale "es de dev": hay que explicar por qué no nos alcanza.
 */
const ACEPTADAS_EN_DESARROLLO = {
  "GHSA-5xrq-8626-4rwp": {
    paquete: "vitest",
    motivo:
      "Sólo explotable con el servidor de UI de Vitest escuchando (`vitest --ui`). " +
      "Ni la CI ni el desarrollo local lo levantan: siempre se usa `vitest run`. " +
      "La corrección exige saltar de la 1.x a la 4.x, un cambio mayor que toca " +
      "las 1.044 pruebas y que no procede hacer al cierre de una fase de " +
      "seguridad. Pendiente de planificar aparte.",
    revisadaEl: "2026-08-05",
  },
};

/**
 * Fallo OPERATIVO de la auditoría: no hemos podido saber si hay
 * vulnerabilidades. Es distinto de «hay vulnerabilidades», y se trata distinto.
 */
class ErrorDeAuditoria extends Error {
  constructor(etapa, motivo) {
    super(`${etapa}: ${motivo}`);
    this.etapa = etapa;
    this.motivo = motivo;
  }
}

/**
 * Ejecuta `npm audit --json` y devuelve un informe QUE DE VERDAD LO SEA.
 *
 * EL DEFECTO QUE CORRIGE — LA PUERTA SE ABRÍA SOLA
 * ------------------------------------------------
 * `npm audit` sale con código != 0 en dos situaciones que no se parecen en
 * nada: cuando ENCUENTRA vulnerabilidades y cuando NO HA PODIDO MIRAR (registro
 * caído, 401, sin red). Esta función trataba las dos igual: parseaba
 * `err.stdout` y devolvía lo que saliera.
 *
 * El problema es que un fallo operativo también devuelve JSON válido, sólo que
 * con esta forma:
 *
 *     { "error": { "code": "E401", "summary": "Unable to authenticate…" } }
 *
 * Eso no tiene `vulnerabilities`, así que aguas abajo `informe.vulnerabilities
 * ?? {}` daba `{}` y la puerta anunciaba «0 vulnerabilidades criticas, 0
 * altas» y salía con 0. Reproducido con un `npm` de prueba que responde
 * exactamente eso: la puerta pasaba en verde sin haber auditado nada.
 *
 * Una puerta de seguridad que se abre sola cuando falla la red es peor que no
 * tenerla: da una garantía que no está prestando, y nadie vuelve a mirarla.
 *
 * Ahora sólo se acepta un informe con la forma de un informe. Todo lo demás
 * —error de npm, JSON inválido, estructura incompleta— aborta con un
 * diagnóstico accionable. No se vuelca la salida cruda: un mensaje del registro
 * puede arrastrar cabeceras o URLs con credenciales.
 */
function auditar(argumentos, etapa) {
  let salida;
  try {
    salida = execFileSync("npm", ["audit", "--json", ...argumentos], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    // Código != 0 con informe por stdout es el camino NORMAL cuando hay
    // hallazgos. Sin stdout no hay nada que interpretar.
    if (typeof err.stdout !== "string" || err.stdout.trim() === "") {
      throw new ErrorDeAuditoria(
        etapa,
        `npm audit no ha devuelto ningun informe (${err.code ?? "fallo de ejecucion"})`,
      );
    }
    salida = err.stdout;
  }

  let informe;
  try {
    informe = JSON.parse(salida);
  } catch {
    throw new ErrorDeAuditoria(etapa, "la salida de npm audit no es JSON valido");
  }

  // Sólo el código del error: el resumen puede traer datos del registro.
  if (informe && informe.error) {
    const codigo =
      typeof informe.error === "object" ? (informe.error.code ?? "sin codigo") : "sin codigo";
    throw new ErrorDeAuditoria(etapa, `npm audit ha fallado con ${codigo}`);
  }

  // Un informe de verdad SIEMPRE trae estas dos claves, incluso cuando está
  // limpio (`vulnerabilities: {}`). Su ausencia significa que esto no es un
  // informe, no que no haya nada.
  const tieneVulns = informe && typeof informe.vulnerabilities === "object" && informe.vulnerabilities !== null;
  const tieneMeta =
    informe && informe.metadata && typeof informe.metadata.vulnerabilities === "object";
  if (!tieneVulns || !tieneMeta) {
    throw new ErrorDeAuditoria(etapa, "el informe de npm audit no tiene la forma esperada");
  }

  return informe;
}

/** Avisos de la severidad pedida, con su identificador GHSA. */
function porSeveridad(informe, severidades) {
  return Object.entries(informe.vulnerabilities ?? {})
    .filter(([, v]) => severidades.includes(v.severity))
    .map(([nombre, v]) => ({
      nombre,
      avisos: (v.via ?? [])
        .filter((x) => typeof x === "object" && x.url && severidades.includes(x.severity))
        .map((x) => ({ id: x.url.split("/").pop(), titulo: x.title })),
    }));
}

function criticasDe(informe) {
  return porSeveridad(informe, ["critical"]);
}

/**
 * Un fallo operativo aborta con un mensaje que dice qué hacer, no con una
 * traza. Y NUNCA con código 0: si no hemos podido auditar, no hay garantía que
 * dar.
 */
function abortarPorFalloOperativo(err) {
  console.error(`::error::La auditoria de dependencias no ha podido ejecutarse (${err.etapa}).`);
  console.error(`  Motivo: ${err.motivo}`);
  console.error(
    "\nEsto NO significa que no haya vulnerabilidades: significa que no se han\n" +
      "podido comprobar. La puerta falla a proposito.\n" +
      "\nComprueba el acceso al registro de npm y vuelve a ejecutar:\n" +
      "  npm audit --json --omit=dev\n",
  );
  process.exit(1);
}

let fallo = false;

let informeProduccion;
try {
  informeProduccion = auditar(["--omit=dev"], "produccion");
} catch (err) {
  if (err instanceof ErrorDeAuditoria) abortarPorFalloOperativo(err);
  throw err;
}

// ── 1. Producción: tolerancia cero ──────────────────────────────────────────
const produccion = criticasDe(informeProduccion);

if (produccion.length > 0) {
  fallo = true;
  console.error("::error::Vulnerabilidades CRITICAS en dependencias de produccion:");
  for (const v of produccion) {
    console.error(`  ${v.nombre}`);
    for (const a of v.avisos) console.error(`    ${a.id}  ${a.titulo}`);
  }
  console.error(
    "\nEstas viajan en el artefacto desplegado. Actualiza la dependencia o " +
      "sustitúyela; no hay excepción posible.",
  );
} else {
  console.log("Produccion: 0 vulnerabilidades criticas.");
}

// ── 2. Producción: cada ALTA, revisada una por una ──────────────────────────
//
// No se cuentan paquetes: se cuentan AVISOS. Un mismo paquete puede traer diez
// avisos de los que nueve no nos alcancen y uno sí, y lo que decide es ese uno.
const altas = porSeveridad(informeProduccion, ["high"]);
const sinRevisar = [];
const bloqueando = [];

for (const v of altas) {
  for (const a of v.avisos) {
    if (ALTAS_NO_APLICABLES_EN_PRODUCCION[a.id]) {
      console.log(
        `Produccion ALTA ${a.id} (${v.nombre}) no aplicable — ` +
          ALTAS_NO_APLICABLES_EN_PRODUCCION[a.id].motivo,
      );
    } else if (BLOQUEOS_DECLARADOS[a.id]) {
      bloqueando.push({ ...a, paquete: v.nombre, ...BLOQUEOS_DECLARADOS[a.id] });
    } else {
      sinRevisar.push({ ...a, paquete: v.nombre });
    }
  }
}

if (bloqueando.length > 0) {
  fallo = true;
  console.error("::error::BLOQUEO: vulnerabilidades ALTAS que SI afectan a este despliegue:");
  for (const b of bloqueando) {
    console.error(`  ${b.paquete}  ${b.id}  ${b.titulo}`);
    console.error(`    ${b.motivo}`);
    console.error(`    Arreglo: ${b.arreglo}`);
  }
  console.error(
    "\nNo se arreglan con una actualizacion compatible: exigen una migracion " +
      "mayor del framework.\n" +
      "Esta puerta falla A PROPOSITO. Marcarlas como no aplicables para que el " +
      "pipeline pase seria mentir sobre el riesgo que se despliega.",
  );
}

if (sinRevisar.length > 0) {
  fallo = true;
  console.error("::error::Vulnerabilidades ALTAS de produccion sin revisar:");
  for (const a of sinRevisar) console.error(`  ${a.paquete}  ${a.id}  ${a.titulo}`);
  console.error(
    "\nActualiza la dependencia. Si de verdad la superficie vulnerable no " +
      "existe aqui, añadela a ALTAS_NO_APLICABLES_EN_PRODUCCION en " +
      "scripts/audit-gate.mjs explicando —comprobado contra el codigo— por que.",
  );
}

if (altas.length === 0) {
  console.log("Produccion: 0 vulnerabilidades altas.");
}

// ── 3. Desarrollo: cada crítica debe estar aceptada por escrito ─────────────
let informeCompleto;
try {
  informeCompleto = auditar([], "arbol completo (con desarrollo)");
} catch (err) {
  // La segunda auditoria tampoco puede fallar en silencio: si no se ejecuta,
  // las criticas de herramientas de desarrollo dejan de vigilarse.
  if (err instanceof ErrorDeAuditoria) abortarPorFalloOperativo(err);
  throw err;
}

const todas = criticasDe(informeCompleto);
const soloDesarrollo = todas.filter((v) => !produccion.some((p) => p.nombre === v.nombre));

const noAceptadas = [];
for (const v of soloDesarrollo) {
  const conocida = v.avisos.every((a) => ACEPTADAS_EN_DESARROLLO[a.id]);
  if (conocida && v.avisos.length > 0) {
    for (const a of v.avisos) {
      console.log(`Desarrollo: ${a.id} (${v.nombre}) aceptada — ${ACEPTADAS_EN_DESARROLLO[a.id].motivo}`);
    }
  } else {
    noAceptadas.push(v);
  }
}

if (noAceptadas.length > 0) {
  fallo = true;
  console.error("::error::Vulnerabilidades CRITICAS nuevas en herramientas de desarrollo:");
  for (const v of noAceptadas) {
    console.error(`  ${v.nombre}`);
    for (const a of v.avisos) console.error(`    ${a.id}  ${a.titulo}`);
  }
  console.error(
    "\nActualiza la herramienta o, si de verdad no os alcanza, añádela a " +
      "ACEPTADAS_EN_DESARROLLO en scripts/audit-gate.mjs explicando por que.",
  );
}

process.exit(fallo ? 1 : 0);
