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
  "GHSA-c4j6-fc7j-m34r": {
    paquete: "next",
    motivo:
      "SSRF en aplicaciones que usan actualizaciones a WebSocket. Esta " +
      "aplicacion no abre ninguna: no hay `upgrade`, ni `ws`, ni socket.io, y " +
      "las funciones de Vercel no atienden la actualizacion de protocolo.",
    revisadaEl: "2026-08-23",
  },
  "GHSA-36qx-fr4f-26g5": {
    paquete: "next",
    motivo:
      "Bypass de middleware en aplicaciones del PAGES ROUTER que usan i18n. " +
      "Aqui todo es App Router (`src/app`), no existe `src/pages`, y " +
      "`next.config.js` no declara `i18n`.",
    revisadaEl: "2026-08-23",
  },
  "GHSA-m99w-x7hq-7vfj": {
    paquete: "next",
    motivo:
      "DoS en App Router a traves de Server Actions. No se usa ninguna: " +
      "`grep -rl '\"use server\"' src/` no devuelve nada; las mutaciones van " +
      "por manejadores de ruta.",
    revisadaEl: "2026-08-23",
  },
  "GHSA-89xv-2m56-2m9x": {
    paquete: "next",
    motivo:
      "SSRF en Server Actions sobre SERVIDORES PERSONALIZADOS. No hay Server " +
      "Actions ni servidor propio: el despliegue es el runtime gestionado de " +
      "Vercel.",
    revisadaEl: "2026-08-23",
  },
  "GHSA-p9j2-gv94-2wf4": {
    paquete: "next",
    motivo:
      "SSRF mediante `rewrites` con destino controlado por el atacante. " +
      "`next.config.js` no define `rewrites` ni `redirects`; solo `headers` e " +
      "`images.remotePatterns`.",
    revisadaEl: "2026-08-23",
  },
};

/**
 * Avisos ALTOS de PRODUCCIÓN que SÍ nos alcanzan y que no tienen arreglo sin
 * una migración mayor.
 *
 * Están aquí para que el fallo diga QUÉ es y QUÉ hace falta, no para
 * silenciarlo: la puerta falla igual. Vaciar esta lista sin actualizar la
 * dependencia sería exactamente la trampa que esta puerta existe para impedir.
 */
const BLOQUEOS_DECLARADOS = {
  "GHSA-h25m-26qc-wcjf": {
    paquete: "next",
    motivo:
      "DoS por deserializacion de la peticion en React Server Components. " +
      "La aplicacion es App Router con RSC, asi que la superficie existe.",
    arreglo: "next >= 15.5.21",
  },
  "GHSA-q4gf-8mx6-v5v3": {
    paquete: "next",
    motivo: "DoS con Server Components. Misma superficie: App Router con RSC.",
    arreglo: "next >= 15.5.21",
  },
  "GHSA-8h8q-6873-q5fj": {
    paquete: "next",
    motivo: "DoS con Server Components (segundo aviso). Misma superficie.",
    arreglo: "next >= 15.5.21",
  },
};

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

function auditar(argumentos) {
  try {
    const salida = execFileSync("npm", ["audit", "--json", ...argumentos], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
    return JSON.parse(salida);
  } catch (err) {
    // `npm audit` sale con código != 0 cuando encuentra algo: eso no es un
    // fallo de ejecución, es el resultado.
    if (err.stdout) return JSON.parse(err.stdout);
    throw err;
  }
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

let fallo = false;

const informeProduccion = auditar(["--omit=dev"]);

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
const todas = criticasDe(auditar([]));
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
