#!/usr/bin/env node
/**
 * Crea el bucket de objetos si no existe.
 *
 * Se usa en CI antes de las pruebas de integracion con MinIO y sirve tambien
 * para preparar una instalacion nueva. Es idempotente: si el bucket ya existe
 * no hace nada y sale con 0.
 */
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";

const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION } = process.env;

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
      console.error(`[init-bucket] No se pudo crear el bucket "${S3_BUCKET}":`, err);
      process.exit(1);
    }
  }
}

/*
 * CORS: sin esto el navegador NO puede subir directamente al bucket.
 *
 * POR QUE HACE FALTA
 * ------------------
 * El archivo ya no pasa por la funcion —una funcion de Vercel admite 4,5 MB de
 * cuerpo y el maximo del producto son 20 MiB—, asi que lo sube el navegador con
 * una URL prefirmada. La pagina se sirve desde un origen (el puerto 3000) y el
 * almacenamiento vive en otro (el 9000), y un PUT no es una peticion "simple":
 * el navegador manda antes un OPTIONS de comprobacion. Si el bucket no lo
 * contesta, la subida muere ANTES de empezar y el navegador, por diseno, no
 * deja ver el motivo.
 *
 * `ExposeHeaders: ETag` permite leer el identificador que devuelve el
 * almacenamiento al terminar. `AllowedOrigins: *` es aceptable AQUI porque este
 * script prepara entornos de desarrollo y de CI; en produccion debe limitarse
 * al dominio real de la aplicacion (queda anotado como requisito de despliegue).
 */
const CORS = {
  CORSRules: [
    {
      AllowedOrigins: ["*"],
      AllowedMethods: ["PUT", "GET", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3000,
    },
  ],
};

try {
  await cliente.send(new PutBucketCorsCommand({ Bucket: S3_BUCKET, CORSConfiguration: CORS }));
  console.log(`[init-bucket] CORS configurado en "${S3_BUCKET}".`);
} catch (err) {
  /*
   * No se aborta: hay implementaciones que no exponen PutBucketCors y aplican
   * una politica permisiva por defecto. Pero se AVISA, porque si el navegador
   * luego no puede subir, este es el primer sitio donde mirar.
   */
  console.warn(
    `[init-bucket] AVISO: no se ha podido configurar CORS en "${S3_BUCKET}" (${err?.name ?? err}).`,
  );
  console.warn(
    "[init-bucket] Si la subida desde el navegador falla sin dar motivo, la causa es esta.",
  );
}
