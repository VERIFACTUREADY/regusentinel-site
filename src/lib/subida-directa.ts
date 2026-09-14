/**
 * SUBIDA DIRECTA AL ALMACENAMIENTO: autorizar, verificar y sólo ENTONCES fijar.
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * Una función de Vercel admite como máximo **4,5 MB** de cuerpo de petición.
 * El producto promete **20 MiB** por archivo. El navegador escribe directo en
 * el almacenamiento con una política de subida firmada; la función sólo maneja
 * JSON pequeño, dos veces:
 *
 *   1. AUTORIZAR — permisos, tenencia y política de nombre/tamaño. Fija una
 *      clave de PREPARACIÓN y guarda un `PendingUpload`. Devuelve la política.
 *   2. CONFIRMAR — vuelve a autenticar, inspecciona el objeto REAL en la clave
 *      de preparación, lee sus bytes de forma condicionada a que no hayan
 *      cambiado, y sólo si todo cuadra los COPIA a una clave FINAL nueva antes
 *      de crear el documento.
 *
 * POR QUÉ DOS CLAVES, NO UNA (revisión de seguridad tras d899d2d)
 * -----------------------------------------------------------------
 * La primera versión firmaba un PUT desnudo sobre la clave que el `Document`
 * acabaría usando. Dos huecos, ambos reproducidos contra MinIO real antes de
 * corregirlos:
 *
 *   A) La URL de escritura sigue siendo válida hasta que caduca (15 min). Tras
 *      confirmar, reutilizarla sobrescribía el MISMO objeto que el documento ya
 *      referenciaba: la fila decía "PDF verificado, 1024 bytes" mientras el
 *      bucket servía otra cosa. Ahora el documento sólo referencia la clave
 *      FINAL, que el navegador nunca ve ni puede volver a escribir: reutilizar
 *      la política de subida como mucho reescribe la preparación, que ya no le
 *      importa a nadie una vez confirmado.
 *
 *   B) Una URL PUT desnuda no impone ningún tamaño: declarar 1 KB al autorizar
 *      y escribir 21 MiB de verdad funcionaba —200 OK— sin que `complete`
 *      llegara a intervenir. Ahora se firma una POLÍTICA POST con
 *      `content-length-range` en el tamaño EXACTO autorizado: el propio
 *      almacén rechaza cualquier otro tamaño ANTES de guardar nada. Verificado
 *      contra la versión de MinIO fijada en la CI.
 *
 * LA CADENA DE INTEGRIDAD ENTRE INSPECCIONAR Y COPIAR
 * ------------------------------------------------------
 * Entre que se pregunta "¿qué hay ahí?" (`HeadObject`) y se lee el contenido,
 * la clave de preparación sigue siendo escribible por cualquiera con la
 * política. `leerObjetoSiCoincide` ata la lectura al ETag exacto que se acaba
 * de inspeccionar con `If-Match`: si el objeto cambió entre medias, el almacén
 * responde 412 y aquí se aborta, en vez de validar unos bytes y copiar otros.
 * `crearObjetoSiNoExiste` usa `If-None-Match: *` al escribir la clave final,
 * así que tampoco puede pisar un final ya existente.
 *
 * LO QUE ESTE ARCHIVO NO SE CREE
 * -------------------------------
 * Nada de lo que diga el cliente al confirmar salvo el identificador de la
 * subida. Organización, expediente, clave, nombre y tamaño esperado se leen
 * del `PendingUpload` que escribió el servidor. El actor también se ata: para
 * subidas internas, quien confirma debe ser el MISMO usuario que autorizó; para
 * el portal, la misma aceptación de consentimiento (ver `ContextoActor` más
 * abajo — el portal no tiene identidad por persona, y eso se documenta, no se
 * disimula).
 *
 * EL PRECIO, DICHO CLARO
 * ------------------------
 * El objeto de preparación se escribe antes de que nadie mire su contenido, así
 * que todo descarte implica borrarlo. Y una preparación autorizada que nadie
 * confirma dejaría un objeto sin ninguna fila útil que lo mencione: de eso se
 * ocupa `limpiarSubidasCaducadas`, con reclamación explícita (CAS) para que una
 * limpieza y una confirmación que llegan a la vez no puedan pisarse.
 *
 * LA GARANTÍA EXACTA TRAS UN FALLO, Y CÓMO SE SOSTIENE
 * -------------------------------------------------------
 * La afirmación es: todo fallo deja o un `Document` válido con su objeto
 * verificado, o ningún `Document` y ningún objeto huérfano. Nunca la
 * combinación contradictoria. Para que eso sea cierto hace falta más que
 * borrar el objeto final cuando la transacción falla EN CALIENTE —eso ya
 * estaba—: la fila tiene que recordar QUÉ clave final se intentó ANTES de que
 * exista nada que borrar, porque el proceso puede caerse entre escribir ese
 * objeto y comprometer la transacción, y en ese instante no hay ningún `catch`
 * que pueda ejecutarse. Por eso `confirmarSubida` apunta la clave final en la
 * fila con una escritura llana —a propósito NO una reclamación que pueda
 * hacer perder la carrera a una confirmación concurrente legítima, ver el
 * comentario junto a esa escritura— ANTES de llamar a `crearObjetoSiNoExiste`,
 * no después. Con eso, tres mecanismos —no uno solo— cubren las tres formas de
 * fallar:
 *
 *   - FALLO EN CALIENTE (la misma llamada sigue viva): el `catch` que envuelve
 *     la transacción borra el objeto final ya mismo, de forma síncrona. Es
 *     INMEDIATO: quien llama nunca ve un huérfano.
 *   - REINTENTO DEL CLIENTE tras un fallo (mismo `uploadId`, otra llamada): si
 *     el borrado síncrono de arriba también falló, la clave sigue en la fila;
 *     el intento siguiente la ve —es DISTINTA de la que él mismo genera— y la
 *     borra antes de escribir la suya. Es INMEDIATO en cuanto el cliente
 *     reintenta, no hace falta esperar a la limpieza.
 *   - NADIE VUELVE A LLAMAR (caída del proceso, o el cliente abandona): la fila
 *     sigue `PENDING` con esa clave. `limpiarSubidasCaducadas` la alcanza como
 *     a cualquier preparación caducada, pasado `VALIDEZ_REGISTRO_MS`, y borra
 *     también la clave final ahí. Esto SÍ es recuperación EVENTUAL, acotada
 *     por ese plazo más la cadencia del cron de limpieza —no inmediata—, y así
 *     queda dicho: no se afirma ausencia instantánea del huérfano en este
 *     caso, sólo su desaparición garantizada dentro de ese plazo.
 *
 * El mismo razonamiento cubre la preparación que queda sin borrar tras un
 * `complete` que sí tuvo éxito (pasada 3 de `limpiarSubidasCaducadas`): el
 * `Document` ya es válido y su objeto FINAL ya está verificado en ese momento;
 * lo único pendiente es un objeto de PREPARACIÓN sobrante, y su desaparición
 * también es eventual, no instantánea, tal como se documenta en esa función.
 */

import type { Document } from "@prisma/client";
import { prisma } from "./prisma";
import {
  crearPoliticaDeSubida,
  inspeccionarObjeto,
  leerObjetoSiCoincide,
  crearObjetoSiNoExiste,
  deleteFile,
  ErrorDePrecondicion,
  type PoliticaDeSubida,
} from "./s3";
import { logAudit } from "./audit";
import { matchDocumentToTag, DOC_MATCH_RULES } from "./doc-task-matching";
import { findTaskInCase } from "./tenancy";
import {
  validateFile,
  validarNombreYTamano,
  sanitizeFileName,
  buildFileKey,
  buildStagingKey,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
} from "./file-policy";
import { triggerWorkflow, claveDeEvento } from "./workflow-engine";

/** Validez de la política de subida. Es un permiso: corto. */
const VALIDEZ_URL_SEGUNDOS = 15 * 60;

/**
 * Validez del registro pendiente. Más larga que la política a propósito: una
 * subida que empieza en el minuto 14 y tarda en terminar debe poder
 * confirmarse.
 */
const VALIDEZ_REGISTRO_MS = 60 * 60 * 1000;

/**
 * Cuánto se conserva una fila ya COMPLETED. Sólo sostiene la idempotencia de
 * reintentos tras un corte de red; el `Document` y su objeto viven aparte y no
 * dependen de esta fila. Pasado el plazo, sólo desaparece la FILA.
 */
const RETENCION_COMPLETADAS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Antigüedad a partir de la cual una reclamación de limpieza (`CLEANING`) se
 * considera abandonada —el proceso se cayó a mitad— y otra pasada puede volver
 * a reclamarla. Así una caída no deja la fila huérfana para siempre.
 */
const RECLAMACION_ABANDONADA_MS = 10 * 60 * 1000;

/** Cuántas caducadas/abandonadas se barren al autorizar. Ayuda, no garantía. */
const BARRIDO_OPORTUNISTA = 3;

export interface ContextoActor {
  orgId: string;
  caseId: string;
  /** Usuario del equipo. `null` cuando sube la familia desde el portal. */
  userId: string | null;
  isPortalUpload: boolean;
  /**
   * Identidad del consentimiento del portal vigente, cuando `isPortalUpload`.
   * El portal no distingue personas —el enlace es compartido por la familia—,
   * así que esto ata la operación a la ACEPTACIÓN concreta bajo la que actúa,
   * no a un individuo. Es la atadura más fuerte que el modelo de datos actual
   * puede ofrecer; queda documentada como límite, no disimulada.
   */
  portalConsentId?: string | null;
}

export type ResultadoAutorizacion =
  | {
      ok: true;
      uploadId: string;
      uploadUrl: string;
      fields: Record<string, string>;
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
 * Paso 1: autorizar. Devuelve una política de escritura acotada a UNA clave de
 * preparación y a UN tamaño exacto.
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
   * Nombre y tamaño DECLARADOS: lo único comprobable sin bytes. Evita entregar
   * un permiso de escritura a algo ya inadmisible. La palabra final la tiene
   * el ALMACÉN (política content-length-range) y, después, la confirmación
   * contra el objeto real.
   */
  const previo = validarNombreYTamano({ fileName, size });
  if (!previo.ok) {
    return {
      ok: false,
      status: previo.reason === "too_large" ? 413 : 400,
      error: previo.message!,
    };
  }

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

  // Clave de PREPARACIÓN, generada por el servidor. Nunca la usará el Document.
  const stagingKey = buildStagingKey({ orgId: actor.orgId, caseId: actor.caseId, fileName });

  const pendiente = await prisma.pendingUpload.create({
    data: {
      orgId: actor.orgId,
      caseId: actor.caseId,
      stagingKey,
      fileName,
      expectedSize: size,
      uploadedBy: actor.userId,
      portalConsentId: actor.isPortalUpload ? (actor.portalConsentId ?? null) : null,
      isPortalUpload: actor.isPortalUpload,
      taskId,
      expiresAt: new Date(Date.now() + VALIDEZ_REGISTRO_MS),
    },
  });

  const politica: PoliticaDeSubida = await crearPoliticaDeSubida(
    stagingKey,
    size,
    VALIDEZ_URL_SEGUNDOS,
  );

  // Barrido oportunista: no es la garantía (lo es el cron), sólo evita que se
  // acumulen mientras la función se usa. Un fallo aquí no bloquea la subida.
  try {
    await limpiarSubidasCaducadas({ limite: BARRIDO_OPORTUNISTA });
  } catch (err) {
    console.error("Barrido de subidas caducadas fallido:", err);
  }

  return {
    ok: true,
    uploadId: pendiente.id,
    uploadUrl: politica.url,
    fields: politica.fields,
    fileName,
    expiresAt: pendiente.expiresAt,
  };
}

/**
 * Borra el objeto de preparación y marca el motivo, sin lanzar.
 *
 * `finalKeyHuerfano`: si un intento ANTERIOR de esta misma subida llegó a
 * reclamar y quizá escribir una clave final antes de fallar —la fila lo
 * recuerda en `finalKey` aunque la transacción de ese intento nunca
 * comprometiera nada—, hay que borrarla AQUÍ. Esta función deja la fila en
 * `FAILED`, el único estado final que no pasa por la limpieza periódica de
 * `PENDING`/`CLEANING` (ver `limpiarSubidasCaducadas`): si no se borra ahora,
 * nada volverá a intentarlo nunca.
 */
async function descartar(
  pendienteId: string,
  stagingKey: string,
  motivo: string,
  finalKeyHuerfano?: string | null,
): Promise<void> {
  try {
    await deleteFile(stagingKey);
  } catch (err) {
    console.error("No se pudo borrar el objeto de preparación descartado:", stagingKey, err);
  }
  if (finalKeyHuerfano) {
    await deleteFile(finalKeyHuerfano).catch((err) =>
      console.error(
        "No se pudo borrar el objeto final huérfano de un intento anterior descartado:",
        finalKeyHuerfano,
        err,
      ),
    );
  }
  await prisma.pendingUpload
    .update({ where: { id: pendienteId }, data: { status: "FAILED", failureReason: motivo } })
    .catch((err) => console.error("No se pudo marcar la subida como fallida:", err));
}

/** Señal interna: otra confirmación simultánea se llevó la subida. */
class YaReclamada extends Error {}
/** Señal interna: la limpieza la reclamó justo antes (CLEANING). */
class EnLimpieza extends Error {}

/**
 * Paso 2: confirmar. Inspecciona la preparación, la copia a una clave final
 * nueva sólo si todo cuadra, y crea el documento.
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
   * organizaciones o de qué persona.
   */
  const perteneceAlAmbito =
    pendiente &&
    pendiente.orgId === actor.orgId &&
    pendiente.caseId === actor.caseId &&
    pendiente.isPortalUpload === actor.isPortalUpload;

  if (!perteneceAlAmbito) {
    return { ok: false, status: 404, error: "Subida no encontrada" };
  }

  /*
   * ATADURA DEL ACTOR.
   *
   * Sin esto, cualquier persona con permiso de subida EN EL MISMO expediente
   * podía confirmar el `uploadId` de otra —adivinable sólo si se conoce, pero
   * la barrera de tenencia no bastaba— y la auditoría atribuía el documento a
   * quien nunca lo subió.
   *
   * Interno: el confirmador debe ser el MISMO usuario que autorizó.
   * Portal: debe seguir vigente la MISMA aceptación de consentimiento bajo la
   * que se autorizó. El portal no tiene identidad por persona —cualquier
   * miembro de la familia con el enlace puede actuar—, así que esto no
   * distingue personas dentro de la familia; distingue una sesión de portal
   * autorizada de una petición que llega con sólo el `uploadId` adivinado o
   * filtrado, y detecta si el consentimiento se retiró y se volvió a aceptar
   * entre medias.
   */
  if (!pendiente!.isPortalUpload && pendiente!.uploadedBy !== actor.userId) {
    return { ok: false, status: 404, error: "Subida no encontrada" };
  }
  if (pendiente!.isPortalUpload && pendiente!.portalConsentId !== (actor.portalConsentId ?? null)) {
    return { ok: false, status: 404, error: "Subida no encontrada" };
  }

  const pu = pendiente!;

  // Ya confirmada: se devuelve lo mismo que la primera vez.
  if (pu.status === "COMPLETED" && pu.documentId) {
    const existente = await prisma.document.findUnique({ where: { id: pu.documentId } });
    if (existente) {
      return { ok: true, documento: existente, taskUpdated: false, yaConfirmada: true };
    }
  }

  if (pu.status === "FAILED") {
    return { ok: false, status: 400, error: pu.failureReason ?? "La subida no se pudo completar." };
  }

  if (pu.status === "CLEANING") {
    return { ok: false, status: 410, error: "La subida ha caducado. Vuelve a intentarlo." };
  }

  if (pu.expiresAt.getTime() < Date.now()) {
    await descartar(pu.id, pu.stagingKey, "La subida ha caducado.", pu.finalKey);
    return { ok: false, status: 410, error: "La subida ha caducado. Vuelve a intentarlo." };
  }

  // ¿Está el objeto de preparación de verdad? Un fallo de consulta LANZA en
  // `inspeccionarObjeto`; sólo un 404 real del almacén devuelve null.
  const cabecera = await inspeccionarObjeto(pu.stagingKey);
  if (!cabecera) {
    return { ok: false, status: 400, error: "No se ha recibido el archivo. Vuelve a intentarlo." };
  }

  const tamanoReal = cabecera.tamano;

  if (tamanoReal > MAX_FILE_BYTES) {
    await descartar(
      pu.id,
      pu.stagingKey,
      `El archivo supera el máximo de ${MAX_FILE_MB} MB.`,
      pu.finalKey,
    );
    return { ok: false, status: 413, error: `El archivo supera el máximo de ${MAX_FILE_MB} MB.` };
  }
  if (tamanoReal !== pu.expectedSize) {
    await descartar(
      pu.id,
      pu.stagingKey,
      "El archivo recibido no coincide con el que se autorizó.",
      pu.finalKey,
    );
    return {
      ok: false,
      status: 400,
      error: "El archivo recibido no coincide con el que se autorizó.",
    };
  }

  // Lectura condicionada al ETag exacto inspeccionado: si el objeto cambia
  // entre medias, el almacén responde 412 y aquí se aborta sin copiar nada.
  let bytes: Buffer;
  try {
    bytes = await leerObjetoSiCoincide(pu.stagingKey, cabecera.etag, MAX_FILE_BYTES);
  } catch (err) {
    if (err instanceof ErrorDePrecondicion) {
      // No se marca FAILED: puede ser una carrera legítima con un reintento en
      // vuelo. El cliente puede reintentar confirmar.
      return {
        ok: false,
        status: 409,
        error: "El archivo ha cambiado mientras se verificaba. Vuelve a intentarlo.",
      };
    }
    throw err;
  }

  const veredicto = validateFile({ fileName: pu.fileName, size: tamanoReal, head: bytes });
  if (!veredicto.ok) {
    await descartar(pu.id, pu.stagingKey, veredicto.message!, pu.finalKey);
    return {
      ok: false,
      status: veredicto.reason === "too_large" ? 413 : 400,
      error: veredicto.message!,
    };
  }

  // Vinculación a tarea: se revalida AHORA, porque pudo borrarse entre la
  // autorización y la confirmación.
  let linkedTaskId: string | null = null;
  if (pu.taskId) {
    const tarea = await findTaskInCase(pu.taskId, pu.caseId, pu.orgId);
    linkedTaskId = tarea?.id ?? null;
  } else {
    const docTag = matchDocumentToTag(pu.fileName);
    if (docTag) {
      const tarea = await prisma.task.findFirst({
        where: { caseId: pu.caseId, docTag, status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] } },
        orderBy: { sortOrder: "asc" },
      });
      linkedTaskId = tarea?.id ?? null;
    }
  }

  // Clave FINAL, nueva y aleatoria: el navegador nunca la ve.
  const finalKey = buildFileKey({
    orgId: pu.orgId,
    caseId: pu.caseId,
    fileName: pu.fileName,
    fromPortal: pu.isPortalUpload,
  });

  /*
   * DEJA CONSTANCIA DE LA CLAVE FINAL EN LA FILA ANTES DE ESCRIBIR NADA EN EL
   * ALMACÉN — pero SIN convertirlo en una reclamación que pueda hacer perder
   * la carrera a una confirmación concurrente legítima.
   *
   * EL HUECO QUE CIERRA
   * --------------------
   * Antes, `finalKey` sólo se guardaba DENTRO de la transacción de más abajo,
   * junto con `documentId`. Dos fallos quedaban sin ninguna forma de
   * recuperarse:
   *
   *   - el objeto final se escribe bien, pero la transacción falla Y el
   *     borrado compensatorio del `catch` de más abajo TAMBIÉN falla (dos
   *     fallos de almacén seguidos, en vez de uno);
   *   - el proceso se cae justo después de escribir el objeto final y antes
   *     de que la transacción llegue siquiera a empezar.
   *
   * En los dos casos, nada en la fila decía que esa clave se había intentado:
   * ninguna limpieza posterior podía encontrarla ni borrarla. Ahora la fila lo
   * sabe ANTES de que se escriba el objeto, así que sobrevive a la caída.
   *
   * POR QUÉ NO ES UN CAS QUE PUEDA HACER ABORTAR AQUÍ
   * -----------------------------------------------------
   * Dos confirmaciones SIMULTÁNEAS para el mismo `uploadId` —doble clic,
   * reintento del cliente que se cruza con el original— tienen que poder
   * escribir CADA UNA su propio objeto final y disputar el resultado DESPUÉS,
   * en la transacción de más abajo (que ya lo hace bien: la perdedora borra su
   * objeto y devuelve el documento de la ganadora). Convertir este apunte en
   * una reclamación que aborta con `count === 0` haría perder la carrera a la
   * perdedora ANTES de que la ganadora haya llegado a crear el `Document` —se
   * comprobó con la prueba de concurrencia real: la perdedora encontraba la
   * fila todavía sin `documentId` y devolvía un 409 en vez del documento ya
   * creado, una regresión de "confirmación concurrente crea exactamente uno".
   * Por eso es una escritura llana, sin condición de carrera que arbitrar
   * aquí: la única disputa real sigue siendo la de la transacción.
   */
  await prisma.pendingUpload
    .update({ where: { id: pu.id }, data: { finalKey } })
    .catch((e) => console.error("No se pudo apuntar la clave final antes de escribirla:", finalKey, e));

  /*
   * Si la fila ya traía una clave final DISTINTA de un intento ANTERIOR de
   * esta MISMA subida que nunca llegó a confirmarse —no de una confirmación
   * concurrente: ésas parten de `pu.finalKey === null`, igual que ésta—, ese
   * objeto anterior, si se llegó a escribir, está huérfano: ningún `Document`
   * lo referencia y nunca lo hará. Se borra ya, en vez de esperar a la
   * limpieza periódica. Borrar una clave que nunca llegó a escribirse (la
   * transacción anterior falló ANTES del `PutObject`) no es un error: el
   * almacén lo trata como éxito.
   */
  if (pu.finalKey && pu.finalKey !== finalKey) {
    await deleteFile(pu.finalKey).catch((e) =>
      console.error(
        "No se pudo borrar el objeto final huérfano de un intento anterior de la misma subida:",
        pu.finalKey,
        e,
      ),
    );
  }

  // Escribe el final SÓLO si no existe ya (If-None-Match: *). Con clave
  // aleatoria la colisión es prácticamente imposible; la comprobación es la
  // garantía, no la probabilidad.
  await crearObjetoSiNoExiste(finalKey, bytes, veredicto.detectedType ?? "application/octet-stream");

  let documento: Document;
  try {
    documento = await prisma.$transaction(async (tx) => {
      /*
       * Reclamación y creación juntas, para que dos confirmaciones a la vez no
       * puedan producir dos filas: la segunda ve el estado ya cambiado.
       */
      const reclamo = await tx.pendingUpload.updateMany({
        where: { id: pu.id, status: "PENDING" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      if (reclamo.count === 0) throw new YaReclamada();

      /*
       * La tarea pudo borrarse en el instante entre la revalidación de arriba
       * y este `create` (ventana real, aunque estrecha). Si el `create` con
       * `taskId` viola la clave foránea, se reintenta SIN vincular —nunca a
       * otra tarea distinta— en vez de devolver un 500 o dejar el objeto final
       * huérfano.
       */
      let creado: Document;
      try {
        creado = await tx.document.create({
          data: {
            caseId: pu.caseId,
            taskId: linkedTaskId,
            fileName: pu.fileName,
            fileKey: finalKey,
            mimeType: veredicto.detectedType,
            fileSize: tamanoReal,
            uploadedBy: pu.uploadedBy,
            isPortalUpload: pu.isPortalUpload,
            visibleToFamily: pu.isPortalUpload,
          },
        });
      } catch (err) {
        const prismaErr = err as { code?: string; meta?: { field_name?: unknown } };
        const nombreCampo = prismaErr.meta?.field_name;
        const esFkTarea =
          prismaErr.code === "P2003" &&
          typeof nombreCampo === "string" &&
          nombreCampo.toLowerCase().includes("taskid");
        if (!esFkTarea) throw err;
        linkedTaskId = null;
        creado = await tx.document.create({
          data: {
            caseId: pu.caseId,
            taskId: null,
            fileName: pu.fileName,
            fileKey: finalKey,
            mimeType: veredicto.detectedType,
            fileSize: tamanoReal,
            uploadedBy: pu.uploadedBy,
            isPortalUpload: pu.isPortalUpload,
            visibleToFamily: pu.isPortalUpload,
          },
        });
      }

      await tx.pendingUpload.update({
        where: { id: pu.id },
        data: { finalKey, documentId: creado.id },
      });

      return creado;
    });
  } catch (err) {
    if (err instanceof YaReclamada) {
      /*
       * Otra confirmación simultánea ganó la carrera y ya comprometió su
       * transacción. El objeto final que ACABAMOS de crear nosotros no lo usa
       * nadie: sin borrarlo quedaría huérfano —dos objetos finales para una
       * sola subida—. Se borra y se devuelve el documento de la ganadora.
       */
      await deleteFile(finalKey).catch((e) =>
        console.error("No se pudo borrar el objeto final perdedor de la carrera:", finalKey, e),
      );
      const actual = await prisma.pendingUpload.findUnique({ where: { id: pu.id } });
      if (actual?.documentId) {
        const existente = await prisma.document.findUnique({ where: { id: actual.documentId } });
        if (existente) {
          return { ok: true, documento: existente, taskUpdated: false, yaConfirmada: true };
        }
      }
      return {
        ok: false,
        status: 409,
        error: "La subida se está confirmando. Vuelve a intentarlo.",
      };
    }
    // Cualquier otro fallo: el objeto final que se acaba de crear no tiene
    // documento que lo reclame. Se limpia antes de propagar el error.
    await deleteFile(finalKey).catch((e) =>
      console.error("No se pudo limpiar el objeto final tras un fallo de confirmación:", finalKey, e),
    );
    throw err;
  }

  /*
   * El objeto de preparación ya no hace falta: se borra ahora mismo. Se
   * ESPERA (no es fire-and-forget): dejarlo suelto competía de forma real con
   * la siguiente operación sobre la misma fila —incluida la propia limpieza
   * por caducidad, que puede correr en cualquier momento— y el resultado era
   * indistinguible de un fallo real. Si falla, no es grave: la limpieza lo
   * reintentará (ver `limpiarSubidasCaducadas`, pasada de "preparación sin
   * borrar tras confirmar"), y NO se retrasa la respuesta más que ese borrado.
   */
  try {
    await deleteFile(pu.stagingKey);
    await prisma.pendingUpload
      .update({ where: { id: pu.id }, data: { stagingDeletedAt: new Date() } })
      .catch(() => {});
  } catch (err) {
    console.error("No se pudo borrar la preparación tras confirmar:", pu.stagingKey, err);
  }

  /*
   * A partir de aquí la transacción ya está comprometida: lo que sigue son
   * efectos. Si algo falla, el documento sigue existiendo y es correcto.
   */
  let taskUpdated = false;
  if (linkedTaskId) {
    const tarea = await findTaskInCase(linkedTaskId, pu.caseId, pu.orgId);
    if (tarea && (tarea.status === "PENDING" || tarea.status === "IN_PROGRESS")) {
      await prisma.task.update({ where: { id: tarea.id }, data: { status: "READY" } });
      taskUpdated = true;

      // Las acciones de auditoría del portal y de la ficha son DISTINTAS y lo
      // llevan siendo desde antes: se conservan tal cual.
      await logAudit({
        orgId: pu.orgId,
        userId: pu.uploadedBy ?? undefined,
        caseId: pu.caseId,
        action: pu.isPortalUpload ? "task.auto_updated_portal" : "task.auto_updated",
        details: pu.isPortalUpload
          ? `Tarea "${tarea.title}" actualizada a READY por un documento del portal`
          : `Tarea "${tarea.title}" actualizada a READY por documento "${pu.fileName}"`,
      });
    }
  }

  await logAudit({
    orgId: pu.orgId,
    userId: pu.uploadedBy ?? undefined,
    caseId: pu.caseId,
    action: pu.isPortalUpload ? "portal.document_uploaded" : "document.uploaded",
    details: pu.isPortalUpload
      ? `Documento subido desde el portal familiar${linkedTaskId ? " (vinculado a tarea)" : ""}`
      : `Archivo "${pu.fileName}" subido${linkedTaskId ? " (vinculado a tarea)" : ""}`,
  });

  let suggestions: string[] | undefined;
  if (!linkedTaskId && !pu.isPortalUpload) {
    const pendientes = await prisma.task.findMany({
      where: { caseId: pu.caseId, status: { in: ["PENDING", "IN_PROGRESS"] }, docTag: { not: null } },
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
    orgId: pu.orgId,
    caseId: pu.caseId,
    userId: pu.uploadedBy ?? undefined,
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
 * Recoge lo que nadie confirmó y lo que se confirmó hace mucho.
 *
 * TRES PASADAS, CADA UNA CON SU PROPIA GARANTÍA
 * ------------------------------------------------
 *  1. CADUCADAS SIN CONFIRMAR: reclama con CAS (`PENDING` → `CLEANING`) antes
 *     de tocar nada. Si una confirmación gana la carrera —ya reclamó a
 *     `COMPLETED`—, la reclamación de limpieza no encuentra fila que actualizar
 *     y se salta esa subida sin haber borrado su objeto. Sólo tras reclamar se
 *     borra el objeto de preparación y, si la fila trae una clave FINAL de un
 *     intento que nunca llegó a comprometerse (`confirmarSubida` la reclama en
 *     la fila ANTES de escribir el objeto: ver el comentario de esa función),
 *     se borra también — es la red de seguridad EVENTUAL para un objeto final
 *     huérfano que ninguna caída del proceso puede dejar sin recuperación. Sólo
 *     si ambos borrados funcionan se borra la fila.
 *
 *  2. RECLAMACIONES ABANDONADAS: una reclamación (`CLEANING`) de la que nadie
 *     volvió a saber —el proceso se cayó entre reclamar y borrar— vuelve a
 *     intentarse pasado `RECLAMACION_ABANDONADA_MS`. Así una caída no deja la
 *     fila huérfana para siempre.
 *
 *  3. PREPARACIÓN SIN BORRAR TRAS CONFIRMAR: si el borrado inmediato al
 *     confirmar falló, aquí se reintenta. Sólo toca `COMPLETED` con
 *     `stagingDeletedAt IS NULL`, nunca la clave FINAL: borrar la preparación
 *     de un documento ya vivo es seguro porque son claves DISTINTAS.
 *
 * Y, aparte, RETENCIÓN: filas `COMPLETED` más viejas que
 * `RETENCION_COMPLETADAS_MS` se borran —sólo la FILA; el `Document` y su objeto
 * final no dependen de esta tabla y no se tocan—.
 */
export async function limpiarSubidasCaducadas(
  opciones: { limite?: number; ahora?: Date } = {},
): Promise<ResumenLimpieza> {
  const { limite = 100, ahora = new Date() } = opciones;
  const resumen: ResumenLimpieza = { revisadas: 0, objetosBorrados: 0, filasBorradas: 0, errores: 0 };

  // ── 1 y 2: candidatas a limpiar (caducadas sin confirmar + reclamaciones abandonadas) ──
  const candidatas = await prisma.pendingUpload.findMany({
    where: {
      OR: [
        { status: "PENDING", expiresAt: { lt: ahora } },
        {
          status: "CLEANING",
          claimedAt: { lt: new Date(ahora.getTime() - RECLAMACION_ABANDONADA_MS) },
        },
      ],
    },
    take: limite,
    select: { id: true, stagingKey: true, finalKey: true, status: true },
  });
  resumen.revisadas += candidatas.length;

  for (const candidata of candidatas) {
    try {
      // CAS: sólo se reclama si sigue en el estado que se leyó. Si una
      // confirmación ganó entre medias, `count` será 0 y no se toca el objeto.
      const reclamo = await prisma.pendingUpload.updateMany({
        where: { id: candidata.id, status: candidata.status },
        data: { status: "CLEANING", claimedAt: ahora },
      });
      if (reclamo.count === 0) continue;
    } catch (err) {
      resumen.errores++;
      console.error("No se pudo reclamar la subida para limpieza:", candidata.id, err);
      continue;
    }

    try {
      // Borrar una clave inexistente no es un error: la preparación pudo
      // autorizarse y no llegar a escribirse nunca.
      await deleteFile(candidata.stagingKey);
      resumen.objetosBorrados++;
    } catch (err) {
      resumen.errores++;
      console.error("No se pudo borrar el objeto de una subida caducada:", candidata.stagingKey, err);
      // Se queda en CLEANING: la próxima pasada, pasado el margen, la reintenta.
      continue;
    }

    /*
     * RED DE SEGURIDAD PARA LA CLAVE FINAL, NO SÓLO LA DE PREPARACIÓN.
     *
     * `confirmarSubida` reclama la clave final en esta misma fila ANTES de
     * escribir el objeto (ver el comentario en esa función). Si un intento se
     * cayó o falló por completo —la transacción no llegó a comprometerse Y el
     * cliente nunca reintentó dentro de `VALIDEZ_REGISTRO_MS`—, la fila sigue
     * PENDING con `finalKey` apuntando a un objeto que, si se llegó a
     * escribir, no tiene ni tendrá nunca ningún `Document` que lo reclame: la
     * reclamación CAS de arriba ya demostró que ninguna confirmación en curso
     * lo necesita. Se borra aquí, con la misma tolerancia a clave inexistente
     * que la de preparación.
     */
    if (candidata.finalKey) {
      try {
        await deleteFile(candidata.finalKey);
        resumen.objetosBorrados++;
      } catch (err) {
        resumen.errores++;
        console.error(
          "No se pudo borrar el objeto final huérfano de una subida caducada:",
          candidata.finalKey,
          err,
        );
        // Igual que arriba: se queda en CLEANING para reintentarlo despues,
        // en vez de borrar la fila y perder el único puntero a ese objeto.
        continue;
      }
    }

    try {
      await prisma.pendingUpload.delete({ where: { id: candidata.id } });
      resumen.filasBorradas++;
    } catch (err) {
      resumen.errores++;
      console.error("No se pudo borrar la subida caducada:", candidata.id, err);
    }
  }

  // ── 3: preparación de COMPLETED que no se pudo borrar al confirmar ──
  const preparacionesPendientes = await prisma.pendingUpload.findMany({
    where: { status: "COMPLETED", stagingDeletedAt: null },
    take: limite,
    select: { id: true, stagingKey: true },
  });
  for (const p of preparacionesPendientes) {
    resumen.revisadas++;
    try {
      await deleteFile(p.stagingKey);
      await prisma.pendingUpload.update({ where: { id: p.id }, data: { stagingDeletedAt: ahora } });
      resumen.objetosBorrados++;
    } catch (err) {
      resumen.errores++;
      console.error("No se pudo borrar la preparación de una subida ya confirmada:", p.stagingKey, err);
    }
  }

  // ── Retención: filas COMPLETED viejas. Sólo la fila; nunca el Document. ──
  const retiro = await prisma.pendingUpload.deleteMany({
    where: {
      status: "COMPLETED",
      completedAt: { lt: new Date(ahora.getTime() - RETENCION_COMPLETADAS_MS) },
    },
  });
  resumen.filasBorradas += retiro.count;

  return resumen;
}
