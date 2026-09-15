#!/usr/bin/env node
/**
 * COMPROBACION DE RELEASE, DE SOLO LECTURA: ¿puede el navegador de la
 * aplicacion subir a este bucket, y SOLO el de la aplicacion?
 *
 * POR QUE EXISTE
 * --------------
 * La subida de documentos va del navegador al almacen sin pasar por la funcion.
 * Si el bucket no responde bien al preflight CORS, la subida muere antes de
 * empezar y el navegador, por diseno, no deja ver por que. Y si responde a
 * cualquier origen, cualquier web puede usar un permiso de subida filtrado.
 *
 * En CI se usa MinIO, que no implementa `PutBucketCors` y por defecto acepta
 * CUALQUIER origen. Que la subida funcione alli no demuestra nada sobre el
 * bucket real. Este script se ejecuta contra el bucket de verdad y distingue
 * «configurado para la aplicacion» de «permisivo con todo».
 *
 * QUE HACE
 * --------
 *   1. Exige que el endpoint del almacen y el origen de la aplicacion sean
 *      HTTPS (el endpoint tiene que ser visible y alcanzable desde los
 *      navegadores de los usuarios).
 *   2. Si hay credenciales, lee la configuracion CORS (`GetBucketCors`). Nunca
 *      la modifica.
 *   3. Lanza dos preflight reales `OPTIONS`: uno con el origen de la aplicacion,
 *      que debe autorizarse para `POST`, y otro con un origen inventado, que NO
 *      debe autorizarse.
 *
 * No firma nada, no crea objetos y no imprime credenciales ni URL firmadas.
 *
 * USO
 * ---
 *   APP_ORIGIN=https://app.ejemplo.es \
 *   S3_ENDPOINT=https://s3.eu-west-1.amazonaws.com S3_BUCKET=... S3_REGION=... \
 *   [S3_ACCESS_KEY=... S3_SECRET_KEY=...] \
 *   node scripts/verificar-cors-almacen.mjs [--permitir-http-local]
 *
 * Sale con 0 solo si todo queda VERIFICADO. Cualquier otra cosa es un bloqueo
 * de release: sale con 1 y dice por que.
 */
import { pathToFileURL } from "node:url";

const ORIGEN_AJENO = "https://origen-no-autorizado.invalid";

function esLocal(url) {
  return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}

function incluyeMetodo(cabecera, metodo) {
  return (cabecera ?? "")
    .split(",")
    .map((m) => m.trim().toUpperCase())
    .includes(metodo);
}

/**
 * Decide con los hechos observados. Pura: la prueban las unitarias.
 *
 * @param {{
 *   endpoint: string,
 *   appOrigin: string,
 *   permitirHttpLocal?: boolean,
 *   preflightApp: { status: number, allowOrigin: string | null, allowMethods: string | null } | null,
 *   preflightAjeno: { status: number, allowOrigin: string | null, allowMethods: string | null } | null,
 *   reglas: Array<{ AllowedOrigins?: string[], AllowedMethods?: string[] }> | null,
 *   lecturaReglas: "ok" | "sin-configuracion" | "no-implementado" | "sin-credenciales" | "error",
 * }} h
 */
export function evaluarCors(h) {
  const problemas = [];
  const avisos = [];

  let endpoint;
  let app;
  try {
    endpoint = new URL(h.endpoint);
  } catch {
    problemas.push("S3_ENDPOINT no es una URL valida.");
  }
  try {
    app = new URL(h.appOrigin);
    if (app.origin !== h.appOrigin) {
      problemas.push(`APP_ORIGIN debe ser un origen exacto, sin ruta: ${app.origin}`);
    }
  } catch {
    problemas.push("APP_ORIGIN no es un origen valido.");
  }

  for (const [nombre, url] of [
    ["S3_ENDPOINT", endpoint],
    ["APP_ORIGIN", app],
  ]) {
    if (!url) continue;
    if (url.protocol === "https:") continue;
    if (h.permitirHttpLocal && url.protocol === "http:" && esLocal(url)) {
      avisos.push(`${nombre} usa HTTP local: aceptado solo por --permitir-http-local.`);
      continue;
    }
    problemas.push(`${nombre} debe ser HTTPS y alcanzable desde los navegadores de los usuarios.`);
  }

  if (!h.preflightApp) {
    problemas.push("El preflight con el origen de la aplicacion no ha obtenido respuesta.");
  } else {
    if (h.preflightApp.status < 200 || h.preflightApp.status >= 300) {
      problemas.push(`El preflight con el origen de la aplicacion ha respondido ${h.preflightApp.status}.`);
    }
    if (h.preflightApp.allowOrigin === "*") {
      problemas.push("El almacen responde Access-Control-Allow-Origin: * (permisivo con cualquier web).");
    } else if (h.preflightApp.allowOrigin !== h.appOrigin) {
      problemas.push("El preflight no autoriza el origen de la aplicacion.");
    }
    if (!incluyeMetodo(h.preflightApp.allowMethods, "POST")) {
      problemas.push("El preflight no autoriza POST, que es el metodo de la subida.");
    }
  }

  if (!h.preflightAjeno) {
    problemas.push("El preflight con un origen ajeno no ha obtenido respuesta: no se puede descartar CORS permisivo.");
  } else {
    const ajenoAutorizado =
      h.preflightAjeno.status >= 200 &&
      h.preflightAjeno.status < 300 &&
      (h.preflightAjeno.allowOrigin === "*" || h.preflightAjeno.allowOrigin === ORIGEN_AJENO);
    if (ajenoAutorizado) {
      problemas.push(
        "El almacen autoriza tambien un origen inventado: la CORS es PERMISIVA, no una configuracion para la aplicacion.",
      );
    }
  }

  if (h.lecturaReglas === "ok") {
    const reglas = h.reglas ?? [];
    const cubre = reglas.some(
      (r) => (r.AllowedOrigins ?? []).includes(h.appOrigin) && (r.AllowedMethods ?? []).includes("POST"),
    );
    if (!cubre) problemas.push("La configuracion CORS leida no tiene una regla POST para APP_ORIGIN.");
    if (reglas.some((r) => (r.AllowedOrigins ?? []).includes("*"))) {
      problemas.push("La configuracion CORS leida contiene el comodin *.");
    }
  } else if (h.lecturaReglas === "sin-configuracion") {
    problemas.push("El bucket no tiene configuracion CORS (NoSuchCORSConfiguration).");
  } else if (h.lecturaReglas === "no-implementado") {
    avisos.push("El proveedor no permite leer la configuracion CORS: solo cuenta el comportamiento observado.");
  } else if (h.lecturaReglas === "sin-credenciales") {
    avisos.push("Sin credenciales: no se ha leido la configuracion, solo el comportamiento observado.");
  } else {
    avisos.push("No se ha podido leer la configuracion CORS.");
  }

  return { verificado: problemas.length === 0, problemas, avisos };
}

async function preflight(urlBucket, origen) {
  try {
    const res = await fetch(urlBucket, {
      method: "OPTIONS",
      headers: { Origin: origen, "Access-Control-Request-Method": "POST" },
    });
    return {
      status: res.status,
      allowOrigin: res.headers.get("access-control-allow-origin"),
      allowMethods: res.headers.get("access-control-allow-methods"),
    };
  } catch {
    return null;
  }
}

async function leerReglas() {
  const { S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY } = process.env;
  if (!S3_ACCESS_KEY || !S3_SECRET_KEY) return { lecturaReglas: "sin-credenciales", reglas: null };
  const { S3Client, GetBucketCorsCommand } = await import("@aws-sdk/client-s3");
  const cliente = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION || "us-east-1",
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    forcePathStyle: true,
  });
  try {
    const r = await cliente.send(new GetBucketCorsCommand({ Bucket: S3_BUCKET }));
    return { lecturaReglas: "ok", reglas: r.CORSRules ?? [] };
  } catch (err) {
    const nombre = err?.name ?? "";
    if (nombre === "NoSuchCORSConfiguration") return { lecturaReglas: "sin-configuracion", reglas: null };
    if (nombre === "NotImplemented") return { lecturaReglas: "no-implementado", reglas: null };
    return { lecturaReglas: "error", reglas: null };
  }
}

async function principal() {
  const permitirHttpLocal = process.argv.includes("--permitir-http-local");
  const appOrigin = process.env.APP_ORIGIN ?? "";
  const endpoint = process.env.S3_ENDPOINT ?? "";
  const bucket = process.env.S3_BUCKET ?? "";

  if (!appOrigin || !endpoint || !bucket) {
    console.error("[cors] Faltan APP_ORIGIN, S3_ENDPOINT o S3_BUCKET.");
    process.exit(1);
  }

  // El navegador escribe en la URL de estilo ruta que genera la politica POST.
  const urlBucket = `${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(bucket)}`;

  const [preflightApp, preflightAjeno, lectura] = await Promise.all([
    preflight(urlBucket, appOrigin),
    preflight(urlBucket, ORIGEN_AJENO),
    leerReglas(),
  ]);

  const r = evaluarCors({
    endpoint,
    appOrigin,
    permitirHttpLocal,
    preflightApp,
    preflightAjeno,
    reglas: lectura.reglas,
    lecturaReglas: lectura.lecturaReglas,
  });

  console.log(`[cors] Bucket: ${bucket}  Origen de la aplicacion: ${appOrigin}`);
  console.log(
    `[cors] Preflight aplicacion: ${preflightApp ? `${preflightApp.status}, allow-origin=${preflightApp.allowOrigin ?? "(ninguno)"}, allow-methods=${preflightApp.allowMethods ?? "(ninguno)"}` : "sin respuesta"}`,
  );
  console.log(
    `[cors] Preflight origen ajeno: ${preflightAjeno ? `${preflightAjeno.status}, allow-origin=${preflightAjeno.allowOrigin ?? "(ninguno)"}` : "sin respuesta"}`,
  );
  console.log(`[cors] Lectura de la configuracion: ${lectura.lecturaReglas}`);
  for (const a of r.avisos) console.log(`[cors] AVISO: ${a}`);
  for (const p of r.problemas) console.log(`[cors] PROBLEMA: ${p}`);

  if (r.verificado) {
    console.log("[cors] VERIFICADO: el bucket autoriza POST solo para el origen de la aplicacion.");
    process.exit(0);
  }
  console.log("[cors] NO VERIFICADO: es un bloqueo de release hasta resolverlo.");
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
