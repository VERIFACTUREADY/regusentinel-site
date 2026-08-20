/**
 * Acceso al almacenamiento de objetos REAL desde las pruebas.
 *
 * POR QUE EXISTE
 * --------------
 * Comprobar que la fila esta en la base no demuestra que el archivo exista: el
 * bug clasico de esta funcionalidad es justo ese, que la referencia se guarda y
 * el contenido no llega —o al reves, que se borra la fila y el objeto se queda
 * huerfano en el bucket para siempre—. Estas funciones hablan con el MinIO de
 * verdad que levanta la CI, con las mismas credenciales que la aplicacion.
 *
 * NO hay simulador ni respaldo en memoria a proposito: si MinIO no responde,
 * las pruebas que lo usan deben fallar y decirlo, no pasar contra un doble.
 */
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const ENDPOINT = process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000";
const BUCKET = process.env.S3_BUCKET ?? "heredia-e2e";

export const almacenConfigurado = Boolean(
  process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY,
);

const cliente = new S3Client({
  endpoint: ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin123",
  },
  forcePathStyle: true,
});

/** Falla con un mensaje util si el almacenamiento no esta disponible. */
export async function exigirAlmacen(): Promise<void> {
  const res = await fetch(`${ENDPOINT}/minio/health/live`).catch(() => null);
  if (!res || !res.ok) {
    throw new Error(
      `No hay almacenamiento de objetos en ${ENDPOINT}. ` +
        `Las pruebas de documentos necesitan MinIO real; no se sustituye por un doble.`,
    );
  }
}

/** ¿Existe el objeto en el bucket? */
export async function objetoExiste(key: string): Promise<boolean> {
  try {
    await cliente.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Contenido real del objeto, para comparar byte a byte. */
export async function leerObjeto(key: string): Promise<Buffer> {
  const res = await cliente.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) throw new Error(`El objeto ${key} no tiene contenido`);
  const bytes = await (res.Body as { transformToByteArray: () => Promise<Uint8Array> })
    .transformToByteArray();
  return Buffer.from(bytes);
}

/** Claves que cuelgan de un prefijo. Sirve para detectar huerfanos. */
export async function listarClaves(prefijo: string): Promise<string[]> {
  const res = await cliente.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefijo }),
  );
  return (res.Contents ?? []).map((o) => o.Key!).filter(Boolean);
}
