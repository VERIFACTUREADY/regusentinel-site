#!/usr/bin/env node
/**
 * Crea el bucket de objetos si no existe y, si se le indica, le aplica CORS.
 *
 * Se usa en CI antes de las pruebas de integracion con MinIO y sirve tambien
 * para preparar una instalacion nueva. Es idempotente: si el bucket ya existe
 * no hace nada y sale con 0.
 *
 * NO ES LA HERRAMIENTA PARA EL BUCKET DE PRODUCCION. Para comprobar un bucket
 * real, sin modificarlo, esta `scripts/verificar-cors-almacen.mjs`.
 */
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";

const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION, S3_CORS_ORIGINS } =
  process.env;

if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) {
  console.error(
    "[init-bucket] Faltan variables: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET.",
  );
  process.exit(1);
}

const cliente = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION || "us-east-1",
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  forcePathStyle: true,
});

try {
  await cliente.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  console.log(`[init-bucket] El bucket "${S3_BUCKET}" ya existe.`);
} catch {
  try {
    await cliente.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`[init-bucket] Bucket "${S3_BUCKET}" creado.`);
  } catch (err) {
    const nombre = err?.name ?? "";
    if (nombre === "BucketAlreadyOwnedByYou" || nombre === "BucketAlreadyExists") {
      console.log(`[init-bucket] El bucket "${S3_BUCKET}" ya existe.`);
    } else {
      console.error(`[init-bucket] No se pudo crear el bucket "${S3_BUCKET}":`, err?.name ?? err);
      process.exit(1);
    }
  }
}

/*
 * CORS: el navegador escribe en el almacen desde OTRO origen.
 *
 * EL DEFECTO ANTERIOR
 * -------------------
 * Este script aplicaba `AllowedOrigins: ["*"]` a cualquier bucket al que se
 * apuntara, incluido uno de produccion, y cuando el proveedor respondia
 * `NotImplemented` lo contaba como un aviso mas. MinIO, de hecho, responde
 * `501 NotImplemented` a `PutBucketCors` y su politica por defecto acepta
 * CUALQUIER origen —comprobado con un origen inventado—, asi que en CI la subida
 * funcionaba sin que hubiera ninguna CORS configurada. Eso no prueba nada sobre
 * el bucket real.
 *
 * AHORA
 * -----
 *   - Los origenes se declaran de forma EXPLICITA en `S3_CORS_ORIGINS`
 *     (separados por comas). Sin esa variable no se configura CORS.
 *   - `*` se rechaza: un comodin en un permiso de escritura no es aceptable.
 *   - Solo `POST`, que es lo unico que usa la subida. Las descargas son
 *     navegaciones con enlace y no necesitan CORS.
 *   - Si el proveedor no aplica la configuracion, se dice exactamente eso: NO
 *     esta configurada. La politica efectiva sera la que el proveedor tenga por
 *     defecto, y hay que verificarla con `verificar-cors-almacen.mjs`.
 */
const origenes = (S3_CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (origenes.length === 0) {
  console.warn(
    "[init-bucket] CORS NO configurado: falta S3_CORS_ORIGINS. " +
      "El navegador no podra subir a este bucket salvo que el proveedor lo permita por su cuenta.",
  );
  process.exit(0);
}

for (const origen of origenes) {
  let valido = false;
  try {
    valido = origen !== "*" && new URL(origen).origin === origen;
  } catch {
    valido = false;
  }
  if (!valido) {
    console.error(
      `[init-bucket] S3_CORS_ORIGINS contiene un origen no valido o un comodin: "${origen}". ` +
        "Se esperan origenes exactos, p. ej. https://app.ejemplo.es",
    );
    process.exit(1);
  }
}

const CORS = {
  CORSRules: [
    {
      AllowedOrigins: origenes,
      AllowedMethods: ["POST"],
      MaxAgeSeconds: 600,
    },
  ],
};

try {
  await cliente.send(new PutBucketCorsCommand({ Bucket: S3_BUCKET, CORSConfiguration: CORS }));
  console.log(
    `[init-bucket] CORS aplicado en "${S3_BUCKET}": solo POST, para ${origenes.join(", ")}.`,
  );
} catch (err) {
  const nombre = err?.name ?? "error desconocido";
  console.warn(
    `[init-bucket] CORS NO CONFIGURADO en "${S3_BUCKET}": el proveedor ha respondido ${nombre}.`,
  );
  console.warn(
    "[init-bucket] No se ha aplicado ninguna regla. La politica efectiva es la que el proveedor " +
      "tenga por defecto; compruebala con scripts/verificar-cors-almacen.mjs.",
  );
}
