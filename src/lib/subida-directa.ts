/**
 * SUBIDA DIRECTA AL ALMACENAMIENTO: autorizar, y después verificar.
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * Una función de Vercel admite como máximo **4,5 MB** de cuerpo de petición.
 * El producto promete **20 MiB** por archivo. Mientras el multipart pasara por
 * la función, esa promesa era falsa en producción: el archivo ni siquiera
 * llegaba al código, lo cortaba la entrada de la plataforma. Que en local
 * funcionara no demostraba nada, porque en local no existe ese límite.
 *
 * `middlewareClientMaxBodySize` sólo evita que Next 15 trunque el cuerpo en un
 * servidor propio; no puede levantar el techo de la plataforma.
 *
 * LA FORMA DE LA SOLUCIÓN
 * -----------------------
 * El archivo no atraviesa la función: el navegador lo sube directamente al
 * almacenamiento con una URL prefirmada. La función sólo maneja JSON pequeño,
 * dos veces:
 *
 *   1. AUTORIZAR — comprueba permisos, tenencia y política, fija la clave y
 *      guarda un `PendingUpload` con lo que el servidor sabe. Devuelve la URL.
 *   2. CONFIRMAR — vuelve a autenticar, comprueba el objeto REAL (que existe,
 *      cuánto pesa y qué contiene) y sólo entonces crea el documento.
 *
 * LO QUE ESTE ARCHIVO NO SE CREE
 * ------------------------------
 * Nada de lo que diga el cliente al confirmar salvo el identificador de la
 * subida. Organización, expediente, actor, clave, nombre y tamaño esperado se
 * leen del `PendingUpload` que escribió el servidor. El tamaño y el tipo se
 * comprueban contra el objeto, no contra lo que el navegador declare.
 *
 * EL PRECIO, DICHO CLARO
 * ----------------------
 * Con multipart, un contenido falsificado se rechazaba ANTES de tocar S3. Aquí
 * el objeto ya está escrito cuando se le miran los bytes, así que el rechazo
 * implica BORRARLO. Por eso todo camino de descarte pasa por `descartar()`, y
 * por eso existe la limpieza por caducidad: una subida autorizada que nadie
 * confirma dejaría el objeto en el bucket sin ninguna fila que lo mencione.
 */

import type { Document } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getPresignedUploadUrl,
  headObject,
  downloadHead,
  deleteFile,
} from "./s3";
import { logAudit } from "./audit";
import { matchDocumentToTag, DOC_MATCH_RULES } from "./doc-task-matching";
import { findTaskInCase } from "./tenancy";
import {
  validateFile,
  validarNombreYTamano,
  sanitizeFileName,
  buildFileKey,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
} from "./file-policy";
import { triggerWorkflow, claveDeEvento } from "./workflow-engine";

/** Validez de la URL de escritura. Es un permiso: corto. */
const VALIDEZ_URL_SEGUNDOS = 15 * 60;

/**
 * Validez del registro pendiente. Más larga que la URL a propósito: una subida
 * que empieza en el minuto 14 y tarda en terminar debe poder confirmarse.
 */
const VALIDEZ_REGISTRO_MS = 60 * 60 * 1000;

/** Cabecera que se trae para decidir el tipo real. Igual que en multipart. */
const BYTES_DE_CABECERA = 4096;

/** Cuántas caducadas se barren al autorizar. Bajo: no es la garantía, es ayuda. */
const BARRIDO_OPORTUNISTA = 3;

export interface ContextoActor {
  orgId: string;
  caseId: string;
  /** Usuario del equipo. `null` cuando sube la familia desde el portal. */
  userId: string | null;
  isPortalUpload: boolean;
}

export type ResultadoAutorizacion =
  | {
      ok: true;
      uploadId: string;
      uploadUrl: string;
      fileName: string;
      expiresAt: Date;
    }
  | { ok: false; status: number; error: string };

export type ResultadoConfirmacion =
  | {
      ok: true;
      documento: Document;
      taskUpdated: boolean;
      suggestions?: string[];
      /** `true` si esta confirmación no creó nada: ya estaba hecha. */
      yaConfirmada: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * Paso 1: autorizar. Devuelve una URL de escritura acotada a UNA clave.
 *
 * Todo lo que aquí se decide queda escrito en `PendingUpload`, porque es lo
 * único que la confirmación va a creerse después.
 */
export async function autorizarSubida(params: {
  actor: ContextoActor;
  fileName: unknown;
  size: unknown;
  taskId?: unknown;
}): Promise<ResultadoAutorizacion> {
  const { actor } = params;

  const nombreCrudo = typeof params.fileName === "string" ? params.fileName : "";
  if (!nombreCrudo.trim()) {
    return { ok: false, status: 400, error: "Falta el nombre del archivo." };
  }

  const size = typeof params.size === "number" ? params.size : Number(params.size);
  if (!Number.isFinite(size) || !Number.isInteger(size)) {
    return { ok: false, status: 400, error: "Falta el tamaño del archivo." };
  }

  const fileName = sanitizeFileName(nombreCrudo);

  /*
   * Nombre y tamaño, que es lo único comprobable sin bytes. El tamaño llega
   * declarado por el cliente y podría mentir: por eso NO es la comprobación
   * definitiva, sólo evita entregar un permiso de escritura para algo que ya
   * se sabe inadmisible. La palabra final la tiene la confirmación contra el
   * objeto real.
   */
  const previo = validarNombreYTamano({ fileName, size });
  if (!previo.ok) {
    return {
      ok: false,
      status: previo.reason === "too_large" ? 413 : 400,
      error: previo.message!,
    };
  }

  // La tarea se valida AHORA, contra expediente y organización. Si se dejara
  // para la confirmación, el cliente podría cambiarla por el camino.
  let taskId: string | null = null;
  if (typeof params.taskId === "string" && params.taskId) {
    const tarea = await findTaskInCase(params.taskId, actor.caseId, actor.orgId);
    if (!tarea) {
      return {
        ok: false,
        status: 404,
        error: "La tarea indicada no pertenece a este expediente",
      };
    }
    taskId = tarea.id;
  }

  // La clave la genera el servidor. El cliente no la propone ni la ve venir.
  const fileKey = buildFileKey({
    orgId: actor.orgId,
    caseId: actor.caseId,
    fileName,
    fromPortal: actor.isPortalUpload,
  });

  const pendiente = await prisma.pendingUpload.create({
    data: {
      orgId: actor.orgId,
      caseId: actor.caseId,
      fileKey,
      fileName,
      expectedSize: size,
      uploadedBy: actor.userId,
      isPortalUpload: actor.isPortalUpload,
      taskId,
      expiresAt: new Date(Date.now() + VALIDEZ_REGISTRO_MS),
    },
  });

  const uploadUrl = await getPresignedUploadUrl(fileKey, {
    expiresIn: VALIDEZ_URL_SEGUNDOS,
  });

  /*
   * Barrido oportunista. La garantía es el cron; esto sólo hace que, mientras
   * la función se use, las caducadas no se acumulen. Un fallo aquí no puede
   * impedir una subida legítima.
   */
  try {
    await limpiarSubidasCaducadas({ limite: BARRIDO_OPORTUNISTA });
  } catch (err) {
    console.error("Barrido de subidas caducadas fallido:", err);
  }

  return {
    ok: true,
    uploadId: pendiente.id,
    uploadUrl,
    fileName,
    expiresAt: pendiente.expiresAt,
  };
}

/** Borra el objeto y deja constancia de por qué no se guardó. */
async function descartar(
  pendienteId: string,
  fileKey: string,
  motivo: string,
): Promise<void> {
  try {
    await deleteFile(fileKey);
  } catch (err) {
    // La fila queda en FAILED y sin caducar todavía: la recoge el barrido.
    console.error("No se pudo borrar el objeto descartado:", fileKey, err);
  }
  await prisma.pendingUpload
    .update({
      where: { id: pendienteId },
      data: { status: "FAILED", failureReason: motivo },
    })
    .catch((err) => console.error("No se pudo marcar la subida como fallida:", err));
}

/** Señal interna: otra confirmación simultánea se llevó la subida. */
class YaReclamada extends Error {}

/**
 * Paso 2: confirmar. Comprueba el objeto real y crea el documento.
 *
 * Es idempotente y resistente a llamadas simultáneas: la reclamación del
 * registro pendiente va DENTRO de la misma transacción que crea el documento,
 * así que dos confirmaciones a la vez no pueden producir dos filas — la segunda
 * se queda esperando el bloqueo de fila, ve el estado ya cambiado y devuelve el
 * documento que creó la primera.
 */
export async function confirmarSubida(params: {
  actor: ContextoActor;
  uploadId: unknown;
}): Promise<ResultadoConfirmacion> {
  const { actor } = params;
  const uploadId = typeof params.uploadId === "string" ? params.uploadId : "";
  if (!uploadId) {
    return { ok: false, status: 400, error: "Falta el identificador de la subida." };
  }

  const pendiente = await prisma.pendingUpload.findUnique({ where: { id: uploadId } });

  /*
   * Mismo 404 para "no existe" y "no es tuya": responder distinto convertiría
   * este endpoint en un oráculo para saber qué subidas hay en otras
   * organizaciones.
   */
  if (
    !pendiente ||
    pendiente.orgId !== actor.orgId ||
    pendiente.caseId !== actor.caseId
  ) {
    return { ok: false, status: 404, error: "Subida no encontrada" };
  }

  // Una subida del portal no se confirma desde la aplicación interna ni al
  // revés: el origen decide visibilidad y autoría, y no puede cambiarse aquí.
  if (pendiente.isPortalUpload !== actor.isPortalUpload) {
    return { ok: false, status: 404, error: "Subida no encontrada" };
  }

  // Ya confirmada: se devuelve lo mismo que la primera vez. Reintentar tras un
  // corte de red no puede duplicar el documento.
  if (pendiente.status === "COMPLETED" && pendiente.documentId) {
    const existente = await prisma.document.findUnique({
      where: { id: pendiente.documentId },
    });
    if (existente) {
      return { ok: true, documento: existente, taskUpdated: false, yaConfirmada: true };
    }
  }

  if (pendiente.status === "FAILED") {
    return {
      ok: false,
      status: 400,
      error: pendiente.failureReason ?? "La subida no se pudo completar.",
    };
  }

  if (pendiente.expiresAt.getTime() < Date.now()) {
    await descartar(pendiente.id, pendiente.fileKey, "La subida ha caducado.");
    return {
      ok: false,
      status: 410,
      error: "La subida ha caducado. Vuelve a intentarlo.",
    };
  }

  // ¿Está el objeto de verdad? Un fallo de consulta LANZA en `headObject`; sólo
  // un 404 real devuelve null.
  const cabecera = await headObject(pendiente.fileKey);
  if (!cabecera) {
    return {
      ok: false,
      status: 400,
      error: "No se ha recibido el archivo. Vuelve a intentarlo.",
    };
  }

  const tamanoReal = cabecera.contentLength;

  // La política, contra el tamaño REAL. Esta es la comprobación que cuenta: la
  // de la autorización se apoyaba en lo que declaró el cliente.
  if (tamanoReal > MAX_FILE_BYTES) {
    await descartar(
      pendiente.id,
      pendiente.fileKey,
      `El archivo supera el máximo de ${MAX_FILE_MB} MB.`,
    );
    return {
      ok: false,
      status: 413,
      error: `El archivo supera el máximo de ${MAX_FILE_MB} MB.`,
    };
  }

  /*
   * Y contra lo que se autorizó. Que quepan 20 MiB no significa que valga
   * cualquier cosa: se autorizó un archivo concreto de un tamaño concreto, y
   * subir otro distinto con esa URL no es la operación autorizada.
   */
  if (tamanoReal !== pendiente.expectedSize) {
    await descartar(
      pendiente.id,
      pendiente.fileKey,
      "El archivo recibido no coincide con el que se autorizó.",
    );
    return {
      ok: false,
      status: 400,
      error: "El archivo recibido no coincide con el que se autorizó.",
    };
  }

  // Contenido real. `declaredMime` no se pasa: aquí no hay nada que declarar
  // ningún cliente, deciden los bytes.
  const cabeceraBytes = await downloadHead(pendiente.fileKey, BYTES_DE_CABECERA);
  const veredicto = validateFile({
    fileName: pendiente.fileName,
    size: tamanoReal,
    head: cabeceraBytes,
  });
  if (!veredicto.ok) {
    await descartar(pendiente.id, pendiente.fileKey, veredicto.message!);
    return {
      ok: false,
      status: veredicto.reason === "too_large" ? 413 : 400,
      error: veredicto.message!,
    };
  }

  // Vinculación a tarea: la manual ya venía validada desde la autorización; si
  // no la hay, se intenta por nombre, siempre dentro de este expediente.
  let linkedTaskId: string | null = pendiente.taskId;
  if (!linkedTaskId) {
    const docTag = matchDocumentToTag(pendiente.fileName);
    if (docTag) {
      const tarea = await prisma.task.findFirst({
        where: {
          caseId: pendiente.caseId,
          docTag,
          status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
        },
        orderBy: { sortOrder: "asc" },
      });
      if (tarea) linkedTaskId = tarea.id;
    }
  }

  let documento: Document;
  try {
    documento = await prisma.$transaction(async (tx) => {
      /*
       * La reclamación y la creación, juntas. Si esto se hiciera en dos pasos,
       * un fallo entre ambos dejaría la subida marcada como completada sin
       * documento, y el reintento no podría arreglarlo.
       */
      const reclamo = await tx.pendingUpload.updateMany({
        where: { id: pendiente.id, status: "PENDING" },
        data: { status: "COMPLETED" },
      });
      if (reclamo.count === 0) throw new YaReclamada();

      const creado = await tx.document.create({
        data: {
          caseId: pendiente.caseId,
          taskId: linkedTaskId,
          fileName: pendiente.fileName,
          fileKey: pendiente.fileKey,
          mimeType: veredicto.detectedType,
          fileSize: tamanoReal,
          uploadedBy: pendiente.uploadedBy,
          isPortalUpload: pendiente.isPortalUpload,
          // Lo que sube la familia es suyo y lo ve; lo interno es privado.
          visibleToFamily: pendiente.isPortalUpload,
        },
      });

      await tx.pendingUpload.update({
        where: { id: pendiente.id },
        data: { documentId: creado.id },
      });

      return creado;
    });
  } catch (err) {
    if (err instanceof YaReclamada) {
      // Otra confirmación simultánea ganó la carrera. Ya ha comprometido su
      // transacción, así que su documento existe: se devuelve ese.
      const actual = await prisma.pendingUpload.findUnique({
        where: { id: pendiente.id },
      });
      if (actual?.documentId) {
        const existente = await prisma.document.findUnique({
          where: { id: actual.documentId },
        });
        if (existente) {
          return {
            ok: true,
            documento: existente,
            taskUpdated: false,
            yaConfirmada: true,
          };
        }
      }
      return {
        ok: false,
        status: 409,
        error: "La subida se está confirmando. Vuelve a intentarlo.",
      };
    }
    throw err;
  }

  /*
   * A partir de aquí, la transacción ya está comprometida. Lo que sigue son
   * efectos: si algo falla, el documento sigue existiendo y es correcto.
   */
  let taskUpdated = false;
  if (linkedTaskId) {
    const tarea = await findTaskInCase(linkedTaskId, pendiente.caseId, pendiente.orgId);
    if (tarea && (tarea.status === "PENDING" || tarea.status === "IN_PROGRESS")) {
      await prisma.task.update({ where: { id: tarea.id }, data: { status: "READY" } });
      taskUpdated = true;

      /*
       * Las acciones de auditoría del portal y de la ficha son DISTINTAS y
       * llevan siéndolo desde antes: se conservan tal cual. Renombrarlas
       * rompería las consultas y el histórico ya escrito.
       */
      await logAudit({
        orgId: pendiente.orgId,
        userId: pendiente.uploadedBy ?? undefined,
        caseId: pendiente.caseId,
        action: pendiente.isPortalUpload ? "task.auto_updated_portal" : "task.auto_updated",
        details: pendiente.isPortalUpload
          ? `Tarea "${tarea.title}" actualizada a READY por un documento del portal`
          : `Tarea "${tarea.title}" actualizada a READY por documento "${pendiente.fileName}"`,
      });
    }
  }

  await logAudit({
    orgId: pendiente.orgId,
    userId: pendiente.uploadedBy ?? undefined,
    caseId: pendiente.caseId,
    action: pendiente.isPortalUpload ? "portal.document_uploaded" : "document.uploaded",
    details: pendiente.isPortalUpload
      ? `Documento subido desde el portal familiar${linkedTaskId ? " (vinculado a tarea)" : ""}`
      : `Archivo "${pendiente.fileName}" subido${linkedTaskId ? " (vinculado a tarea)" : ""}`,
  });

  let suggestions: string[] | undefined;
  if (!linkedTaskId && !pendiente.isPortalUpload) {
    const pendientes = await prisma.task.findMany({
      where: {
        caseId: pendiente.caseId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        docTag: { not: null },
      },
      select: { docTag: true, title: true },
      take: 5,
    });
    if (pendientes.length > 0) {
      suggestions = pendientes.map((t) => {
        const regla = DOC_MATCH_RULES.find((r) => r.docTag === t.docTag);
        return `${regla?.keywords[0] || t.docTag} → ${t.title}`;
      });
    }
  }

  triggerWorkflow({
    type: "DOCUMENT_UPLOADED",
    orgId: pendiente.orgId,
    caseId: pendiente.caseId,
    userId: pendiente.uploadedBy ?? undefined,
    eventKey: claveDeEvento.documentoSubido(documento.id),
  }).catch(console.error);

  return { ok: true, documento, taskUpdated, suggestions, yaConfirmada: false };
}

export interface ResumenLimpieza {
  revisadas: number;
  objetosBorrados: number;
  filasBorradas: number;
  errores: number;
}

/**
 * Borra los objetos de subidas autorizadas que nunca llegaron a confirmarse.
 *
 * POR QUÉ NO BASTA CON BORRAR LA FILA
 * -----------------------------------
 * Si se borrara la fila sin haber borrado el objeto, el objeto quedaría en el
 * bucket para siempre y ya no habría nada que dijera que está ahí. Por eso la
 * fila sólo desaparece DESPUÉS de que el objeto se haya podido borrar; si el
 * borrado falla, la fila se queda y el siguiente barrido lo reintenta.
 */
export async function limpiarSubidasCaducadas(
  opciones: { limite?: number; ahora?: Date } = {},
): Promise<ResumenLimpieza> {
  const { limite = 100, ahora = new Date() } = opciones;

  const caducadas = await prisma.pendingUpload.findMany({
    where: { status: { not: "COMPLETED" }, expiresAt: { lt: ahora } },
    take: limite,
    select: { id: true, fileKey: true },
  });

  const resumen: ResumenLimpieza = {
    revisadas: caducadas.length,
    objetosBorrados: 0,
    filasBorradas: 0,
    errores: 0,
  };

  for (const caducada of caducadas) {
    try {
      // Borrar una clave inexistente no es un error: la subida pudo
      // autorizarse y no llegar a escribirse nunca.
      await deleteFile(caducada.fileKey);
      resumen.objetosBorrados++;
    } catch (err) {
      resumen.errores++;
      console.error(
        "No se pudo borrar el objeto de una subida caducada:",
        caducada.fileKey,
        err,
      );
      continue;
    }
    try {
      await prisma.pendingUpload.delete({ where: { id: caducada.id } });
      resumen.filasBorradas++;
    } catch (err) {
      resumen.errores++;
      console.error("No se pudo borrar la subida caducada:", caducada.id, err);
    }
  }

  return resumen;
}
