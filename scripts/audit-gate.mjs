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

function criticasDe(informe) {
  return Object.entries(informe.vulnerabilities ?? {})
    .filter(([, v]) => v.severity === "critical")
    .map(([nombre, v]) => ({
      nombre,
      avisos: (v.via ?? [])
        .filter((x) => typeof x === "object" && x.url)
        .map((x) => ({ id: x.url.split("/").pop(), titulo: x.title })),
    }));
}

let fallo = false;

// ── 1. Producción: tolerancia cero ──────────────────────────────────────────
const produccion = criticasDe(auditar(["--omit=dev"]));

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

// ── 2. Desarrollo: cada crítica debe estar aceptada por escrito ─────────────
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
