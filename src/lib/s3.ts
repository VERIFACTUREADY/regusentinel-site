import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_ENDPOINT = process.env.S3_ENDPOINT!;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY!;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY!;
const S3_BUCKET = process.env.S3_BUCKET!;
const S3_REGION = process.env.S3_REGION || "us-east-1";

export const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

/**
 * Upload a file to S3/MinIO.
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | ReadableStream | string,
  contentType: string
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * URL prefirmada de descarga, temporal y forzada a descarga.
 *
 * POR QUE LLEVA `ResponseContentDisposition`
 * ------------------------------------------
 * Antes se firmaba un GET pelado: el objeto se servía con su propio
 * Content-Type y SIN cabecera de descarga, así que el navegador abría en línea
 * el contenido subido por terceros —incluida la familia desde el portal—. El
 * repositorio ya tenía `downloadHeaders()` en `file-policy.ts` justamente para
 * evitarlo, pero esta ruta lo saltaba por completo.
 *
 * S3 y MinIO permiten sobrescribir las cabeceras de respuesta en la propia
 * firma. Al ir dentro de la URL firmada, no se pueden manipular desde fuera sin
 * invalidar la firma.
 *
 * `expiresIn` por defecto: una hora. No son enlaces públicos permanentes.
 */
export async function getPresignedUrl(
  key: string,
  opciones: { fileName?: string | null; mimeType?: string | null; expiresIn?: number } = {},
): Promise<string> {
  const { fileName, mimeType, expiresIn = 3600 } = opciones;

  // El nombre viaja entre comillas y además codificado, para que un nombre con
  // acentos, comas o comillas no rompa la cabecera.
  const nombre = (fileName ?? "documento").replace(/["\r\n]/g, "");
  const disposition = `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ResponseContentDisposition: disposition,
    // `octet-stream` salvo que el tipo esté confirmado: no se reenvía al
    // navegador un tipo que él pueda decidir ejecutar.
    ResponseContentType: mimeType ?? "application/octet-stream",
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete a file from S3/MinIO.
 */
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
}

/**
 * Download a file from S3/MinIO into memory.
 * Used by the bank pack generator to merge stored documents.
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const res = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
  );
  if (!res.Body) throw new Error(`S3 object ${key} has empty body`);

  // Body is a ReadableStream (node) or web stream depending on runtime.
  // transformToByteArray() is available on both in AWS SDK v3.
  const bytes = await (res.Body as any).transformToByteArray();
  return Buffer.from(bytes);
}
