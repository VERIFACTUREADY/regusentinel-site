import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

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

/** Lo que el navegador necesita para escribir: dónde y con qué campos firmados. */
export interface PoliticaDeSubida {
  url: string;
  fields: Record<string, string>;
}

/**
 * Permiso de escritura para UNA clave y UN tamaño exacto, impuesto por el
 * ALMACÉN, no por la aplicación.
 *
 * POR QUÉ UNA POLÍTICA POST Y NO UNA URL PUT
 * ------------------------------------------
 * La URL PUT prefirmada que había antes sólo firmaba bucket y clave. Con ella el
 * almacén aceptaba cualquier cuerpo: se reprodujo contra MinIO real autorizando
 * 1 KB y escribiendo 22 020 096 bytes, con respuesta 200 y sin que nadie llamara
 * a la confirmación. Que la confirmación lo rechazara después no evitaba nada:
 * el objeto ya estaba escrito, y si el cliente no confirmaba, se quedaba ahí.
 *
 * Una política POST lleva condiciones que el almacén evalúa ANTES de guardar.
 * `content-length-range` con mínimo y máximo iguales exige el tamaño exacto
 * autorizado, que a su vez nunca supera `MAX_FILE_BYTES` porque se comprueba al
 * autorizar. Comprobado contra MinIO real (la versión fijada en la CI): un byte
 * de menos da `400 EntityTooSmall`, uno de más `400 EntityTooLarge`, y 21 MiB con
 * 1 KB autorizado `400 EntityTooLarge`; en los tres casos no queda objeto. Una
 * clave distinta o un campo que la política no nombra dan `403 AccessDenied`. Es
 * el mecanismo estándar de S3 para formularios del navegador.
 *
 * LO QUE ESTO NO CUBRE, DICHO CLARO
 * ---------------------------------
 * La política es REUTILIZABLE hasta que caduca: quien la tenga puede volver a
 * escribir la misma clave con otros bytes del mismo tamaño. Por eso esta clave
 * es sólo de PREPARACIÓN y el documento nunca la referencia (ver
 * `subida-directa.ts`).
 */
export async function crearPoliticaDeSubida(
  key: string,
  tamano: number,
  expiresInSegundos: number,
): Promise<PoliticaDeSubida> {
  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: S3_BUCKET,
    Key: key,
    Conditions: [["content-length-range", tamano, tamano]],
    Expires: expiresInSegundos,
  });
  return { url, fields };
}

/** El almacén ha rechazado una operación condicional: el objeto no es el esperado. */
export class ErrorDePrecondicion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDePrecondicion";
  }
}

function estadoHttp(err: unknown): number | undefined {
  return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

function esNoEncontrado(err: unknown): boolean {
  const nombre = (err as { name?: string })?.name ?? "";
  return nombre === "NotFound" || nombre === "NoSuchKey" || estadoHttp(err) === 404;
}

function esPrecondicion(err: unknown): boolean {
  const nombre = (err as { name?: string })?.name ?? "";
  const estado = estadoHttp(err);
  return (
    nombre === "PreconditionFailed" ||
    nombre === "ConditionalRequestConflict" ||
    estado === 412 ||
    estado === 409
  );
}

/**
 * Tamaño y ETag del objeto, o `null` si no existe.
 *
 * Se distingue "no está" de "no se ha podido preguntar": un fallo de red o de
 * credenciales LANZA. Tratar un error de consulta como "no existe" es
 * exactamente la confusión que deja documentos fantasma en la base.
 *
 * El ETag sólo se usa por IGUALDAD, como identidad del objeto inspeccionado. No
 * se interpreta como hash de nada.
 */
export async function inspeccionarObjeto(
  key: string,
): Promise<{ tamano: number; etag: string } | null> {
  try {
    const res = await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    if (!res.ETag) {
      throw new Error("El almacenamiento no ha devuelto la identidad del objeto (ETag).");
    }
    return { tamano: Number(res.ContentLength ?? 0), etag: res.ETag };
  } catch (err) {
    if (esNoEncontrado(err)) return null;
    throw err;
  }
}

/** Compatibilidad: sólo el tamaño. */
export async function headObject(key: string): Promise<{ contentLength: number } | null> {
  const r = await inspeccionarObjeto(key);
  return r ? { contentLength: r.tamano } : null;
}

/**
 * Lee el objeto ENTERO, pero sólo si sigue siendo el que se inspeccionó.
 *
 * `If-Match` hace que el almacén responda `412` si entre la inspección y la
 * lectura alguien ha reescrito la clave. Comprobado contra MinIO real. Así los
 * bytes que se validan son exactamente los del objeto inspeccionado, y no los
 * de una escritura posterior.
 *
 * Se lee entero, no sólo la cabecera, porque son estos mismos bytes —ya
 * validados y en poder del servidor— los que se escriben en la clave final.
 * Esto NO pasa por el límite de 4,5 MB de Vercel: ese techo es del cuerpo de la
 * petición y de la respuesta de la función, no de las conexiones que la función
 * abre hacia el almacén.
 */
export async function leerObjetoSiCoincide(
  key: string,
  etag: string,
  maxBytes: number,
): Promise<Buffer> {
  try {
    const res = await s3Client.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key, IfMatch: etag }),
    );
    if (res.ETag && res.ETag !== etag) {
      throw new ErrorDePrecondicion("El objeto ha cambiado desde que se inspeccionó.");
    }
    if (Number(res.ContentLength ?? 0) > maxBytes) {
      throw new ErrorDePrecondicion("El objeto supera el tamaño permitido.");
    }
    if (!res.Body) throw new Error(`El objeto ${key} no tiene contenido`);
    const bytes = await (
      res.Body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  } catch (err) {
    if (err instanceof ErrorDePrecondicion) throw err;
    if (esPrecondicion(err)) {
      throw new ErrorDePrecondicion("El objeto ha cambiado desde que se inspeccionó.");
    }
    throw err;
  }
}

/**
 * Crea el objeto sólo si la clave NO existe.
 *
 * `If-None-Match: *` hace que el almacén responda `412` en vez de sobrescribir.
 * Comprobado contra MinIO real en `PutObject`.
 *
 * POR QUÉ NO `CopyObject`
 * -----------------------
 * La copia en servidor sería más barata, pero la versión de MinIO fijada en la
 * CI IGNORA `If-None-Match` en `CopyObject` y sobrescribe el destino
 * (reproducido). Con copia no habría forma de impedir en el almacén que se
 * pisara una clave final existente. Con `PutObject` sí la hay.
 */
export async function crearObjetoSiNoExiste(
  key: string,
  cuerpo: Buffer,
  contentType: string,
): Promise<void> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: cuerpo,
        ContentType: contentType,
        IfNoneMatch: "*",
      }),
    );
  } catch (err) {
    if (esPrecondicion(err)) {
      throw new ErrorDePrecondicion("La clave de destino ya existe.");
    }
    throw err;
  }
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
