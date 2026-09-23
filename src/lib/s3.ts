import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

/**
 * Resolucion de configuracion de almacenamiento: S3_* explicito primero,
 * Tigris (integracion gestionada de Vercel) como respaldo.
 *
 * POR QUE HACE FALTA ESTO
 * ------------------------
 * Las cinco variables `S3_*` (heredadas de MinIO/producción propia) estaban
 * puestas en "Todos los entornos" en Vercel con valores de PRUEBA
 * (`S3_ENDPOINT=https://placeholder.r2.cloudflarestorage.com`,
 * `S3_ACCESS_KEY=placeholder`, bucket de la marca anterior). Eso hacia que el
 * Preview real firmara subidas contra un host que ni siquiera completa el
 * TLS, mientras la integracion de Tigris -ya conectada y con variables
 * gestionadas reales- se ignoraba por completo, porque este fichero solo
 * leia `S3_*`.
 *
 * LA REGLA DE PRECEDENCIA
 * ------------------------
 *   1. Si CUALQUIER variable S3_* esta definida, es la UNICA fuente posible.
 *      Tiene que estar COMPLETA y no parecer un valor de prueba, o falla.
 *      Nunca se completa lo que falte con Tigris: eso enmascararia
 *      exactamente el problema que esto corrige (production ya usa S3_*
 *      completo y valido; el Preview con S3_* puesto pero roto NO debe
 *      arrancar en silencio con otra cosa).
 *   2. Solo cuando las cinco S3_* estan COMPLETAMENTE ausentes se prueba
 *      Tigris. Si Tigris tampoco esta completo, falla igual.
 *
 * Consecuencia deliberada: mientras `S3_*` siga puesto (con el valor que
 * sea) en el entorno de Preview de Vercel, este codigo NO usara Tigris. El
 * primer despliegue tras este cambio seguira rechazando la subida -por
 * diseño- hasta que alguien con acceso al panel quite o corrija esas cinco
 * variables en Preview.
 */
export interface ConfiguracionAlmacenamiento {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export type ResultadoConfiguracionAlmacenamiento =
  | { ok: true; config: ConfiguracionAlmacenamiento }
  | { ok: false; error: string };

/** Host fijo de Tigris (integracion de Vercel): no es una variable de entorno. */
const TIGRIS_ENDPOINT = "https://fly.storage.tigris.dev";
const TIGRIS_REGION = "auto";

function vacio(valor: string | undefined): boolean {
  return valor === undefined || valor.trim() === "";
}

/**
 * Detecta valores de prueba obvios sin necesidad de una lista cerrada: el
 * caso real que motiva esto llevaba literalmente la palabra "placeholder" en
 * el access key y en el propio host del endpoint.
 */
function pareceValorDePrueba(valor: string): boolean {
  return /placeholder/i.test(valor);
}

/**
 * Resuelve la configuracion de almacenamiento segun la precedencia de arriba.
 *
 * Pura y sin memorizar: lee `process.env` en cada llamada, para que se pueda
 * probar con distintas combinaciones sin reimportar el modulo. Nunca lanza:
 * devuelve `{ ok: false, error }` con el motivo, mencionando siempre NOMBRES
 * de variable, nunca sus valores.
 */
export function resolverConfiguracionAlmacenamiento(): ResultadoConfiguracionAlmacenamiento {
  const legacy = {
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_REGION: process.env.S3_REGION,
  };
  const camposLegacyRequeridos = ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"] as const;
  const legacyCompletamenteAusente = camposLegacyRequeridos.every((campo) => vacio(legacy[campo]));

  if (!legacyCompletamenteAusente) {
    // Hay AL MENOS una S3_* definida: es la unica fuente posible a partir de
    // aqui. No se completa con Tigris bajo ningun concepto.
    const faltantes = camposLegacyRequeridos.filter((campo) => vacio(legacy[campo]));
    if (faltantes.length > 0) {
      return {
        ok: false,
        error:
          `Configuracion de almacenamiento incompleta: falta ${faltantes.join(", ")}. ` +
          `Hay alguna variable S3_* definida, asi que no se completa con Tigris: ` +
          `una configuracion S3_* parcial se trata como invalida, no como ausente.`,
      };
    }
    const sospechosos = camposLegacyRequeridos.filter((campo) => pareceValorDePrueba(legacy[campo]!));
    if (sospechosos.length > 0) {
      return {
        ok: false,
        error:
          `Configuracion de almacenamiento invalida: ${sospechosos.join(", ")} tiene ` +
          `un valor de prueba ("placeholder"). Corrige el valor real en Vercel; no se ` +
          `usan credenciales de ejemplo.`,
      };
    }
    return {
      ok: true,
      config: {
        endpoint: legacy.S3_ENDPOINT!,
        accessKeyId: legacy.S3_ACCESS_KEY!,
        secretAccessKey: legacy.S3_SECRET_KEY!,
        bucket: legacy.S3_BUCKET!,
        region: vacio(legacy.S3_REGION) ? "us-east-1" : legacy.S3_REGION!,
      },
    };
  }

  // Las cinco S3_* estan completamente ausentes: se intenta Tigris.
  const tigris = {
    TIGRIS_STORAGE_ACCESS_KEY_ID: process.env.TIGRIS_STORAGE_ACCESS_KEY_ID,
    TIGRIS_STORAGE_SECRET_ACCESS_KEY: process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY,
    TIGRIS_STORAGE_BUCKET: process.env.TIGRIS_STORAGE_BUCKET,
  };
  const camposTigrisRequeridos = [
    "TIGRIS_STORAGE_ACCESS_KEY_ID",
    "TIGRIS_STORAGE_SECRET_ACCESS_KEY",
    "TIGRIS_STORAGE_BUCKET",
  ] as const;
  const tigrisFaltantes = camposTigrisRequeridos.filter((campo) => vacio(tigris[campo]));
  if (tigrisFaltantes.length > 0) {
    return {
      ok: false,
      error:
        `No hay configuracion de almacenamiento: no hay ninguna variable S3_* y, ` +
        `de Tigris, falta ${tigrisFaltantes.join(", ")}.`,
    };
  }
  return {
    ok: true,
    config: {
      endpoint: TIGRIS_ENDPOINT,
      accessKeyId: tigris.TIGRIS_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: tigris.TIGRIS_STORAGE_SECRET_ACCESS_KEY!,
      bucket: tigris.TIGRIS_STORAGE_BUCKET!,
      region: TIGRIS_REGION,
    },
  };
}

/** Se lanza cuando la configuracion de almacenamiento no es valida. */
export class ErrorDeConfiguracionDeAlmacenamiento extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeConfiguracionDeAlmacenamiento";
  }
}

// Resuelta UNA VEZ al cargar el modulo: las variables de entorno no cambian
// mientras el proceso vive.
const RESOLUCION = resolverConfiguracionAlmacenamiento();

/*
 * El CLIENTE se construye siempre, aunque la configuracion no sea valida.
 *
 * El SDK de AWS no valida nada al construir `S3Client` -ni endpoint ni
 * credenciales-, solo al mandar de verdad un comando. Lanzar aqui, al cargar
 * el modulo, tumbaria cualquier cosa que importe este fichero sin ninguna
 * S3_* ni Tigris definida, incluido `next build` (scripts/build-sin-base-de-datos.sh
 * lo comprueba exactamente sin ninguna S3_*, a proposito). El fallo tiene que
 * llegar en el primer intento REAL de subir, bajar o borrar algo -ver
 * `configuracionValidada()`-, no al importar el modulo.
 */
const CONFIG_PARA_CLIENTE: ConfiguracionAlmacenamiento = RESOLUCION.ok
  ? RESOLUCION.config
  : { endpoint: "", region: "us-east-1", accessKeyId: "", secretAccessKey: "", bucket: "" };

export const s3Client = new S3Client({
  endpoint: CONFIG_PARA_CLIENTE.endpoint,
  region: CONFIG_PARA_CLIENTE.region,
  credentials: {
    accessKeyId: CONFIG_PARA_CLIENTE.accessKeyId,
    secretAccessKey: CONFIG_PARA_CLIENTE.secretAccessKey,
  },
  forcePathStyle: true, // Required for MinIO
});

/**
 * Bucket activo, o lanza si la configuracion de almacenamiento no es valida.
 *
 * Se llama al PRINCIPIO de cada operacion de este fichero: es el punto donde
 * de verdad falla-rapido, con un mensaje que nombra las variables, nunca sus
 * valores.
 */
function configuracionValidada(): ConfiguracionAlmacenamiento {
  if (!RESOLUCION.ok) {
    throw new ErrorDeConfiguracionDeAlmacenamiento(RESOLUCION.error);
  }
  return RESOLUCION.config;
}

/**
 * Upload a file to S3/MinIO.
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | ReadableStream | string,
  contentType: string
): Promise<void> {
  const { bucket } = configuracionValidada();
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
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
  const { bucket } = configuracionValidada();
  const { fileName, mimeType, expiresIn = 3600 } = opciones;

  // El nombre viaja entre comillas y además codificado, para que un nombre con
  // acentos, comas o comillas no rompa la cabecera.
  const nombre = (fileName ?? "documento").replace(/["\r\n]/g, "");
  const disposition = `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;

  const command = new GetObjectCommand({
    Bucket: bucket,
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
  const { bucket } = configuracionValidada();
  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: bucket,
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
  const { bucket } = configuracionValidada();
  try {
    const res = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
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
  const { bucket } = configuracionValidada();
  try {
    const res = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: etag }),
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
  const { bucket } = configuracionValidada();
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
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
  const { bucket } = configuracionValidada();
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Download a file from S3/MinIO into memory.
 * Used by the bank pack generator to merge stored documents.
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const { bucket } = configuracionValidada();
  const res = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!res.Body) throw new Error(`S3 object ${key} has empty body`);

  // Body is a ReadableStream (node) or web stream depending on runtime.
  // transformToByteArray() is available on both in AWS SDK v3.
  const bytes = await (res.Body as any).transformToByteArray();
  return Buffer.from(bytes);
}
