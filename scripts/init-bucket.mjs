#!/usr/bin/env node
/**
 * Crea el bucket de objetos si no existe.
 *
 * Se usa en CI antes de las pruebas de integracion con MinIO y sirve tambien
 * para preparar una instalacion nueva. Es idempotente: si el bucket ya existe
 * no hace nada y sale con 0.
 */
import { S3Client, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

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
