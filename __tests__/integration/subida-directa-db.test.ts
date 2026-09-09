/**
 * SUBIDA DIRECTA AL ALMACENAMIENTO, contra MinIO REAL y PostgreSQL REAL.
 *
 * QUE SE COMPRUEBA AQUI Y POR QUE NO VALDRIA UN MOCK
 * ---------------------------------------------------
 * El archivo ya no pasa por la funcion —una funcion de Vercel admite 4,5 MB de
 * cuerpo y el maximo del producto son 20 MiB—, asi que el servidor firma un
 * permiso de escritura y despues comprueba lo que de verdad ha quedado escrito.
 * Todo lo interesante de esta arquitectura vive precisamente ahi: en si el
 * objeto existe, cuanto pesa y que contiene. Con el almacenamiento simulado,
 * "el objeto se ha borrado" o "el tamano no coincide" serian suposiciones.
 *
 * Se salta entero si no hay MinIO, para que un entorno sin Docker no de un
 * falso rojo. En CI el servicio existe y el job ademas FALLA si se salta, para
 * que "verde" no pueda significar "no se probo nada".
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { CreateBucketCommand } from "@aws-sdk/client-s3";

import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";

const ENDPOINT = process.env.S3_ENDPOINT;
const BUCKET = process.env.S3_BUCKET;
const hayMinio = Boolean(ENDPOINT && BUCKET && process.env.S3_ACCESS_KEY);
const describeSiHayMinio = hayMinio ? describe : describe.skip;

const MAX_BYTES = 20 * 1024 * 1024; // 20 971 520
const MENSAJE_413 = "El archivo supera el máximo de 20 MB.";

const CABECERA_PDF = Buffer.from("%PDF-1.7\n", "utf8");
const CABECERA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let s3: typeof import("../../src/lib/s3");
let subidas: typeof import("../../src/lib/subida-directa");

beforeAll(async () => {
  if (!hayMinio) return;
  s3 = await import("../../src/lib/s3");
  subidas = await import("../../src/lib/subida-directa");

  await s3.s3Client
    .send(new CreateBucketCommand({ Bucket: BUCKET! }))
    .catch((err: { name?: string }) => {
      if (err?.name !== "BucketAlreadyOwnedByYou" && err?.name !== "BucketAlreadyExists") throw err;
    });

  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Un PDF valido de EXACTAMENTE `bytes` bytes. No se recorta ningun tamano. */
function pdfDe(bytes: number): Buffer {
  const b = Buffer.alloc(bytes, 0x41);
  CABECERA_PDF.copy(b, 0);
  return b;
}

/** El PUT que hace el navegador: directo al almacenamiento, sin la funcion. */
async function escribirEnAlmacen(url: string, cuerpo: Buffer): Promise<number> {
  /*
   * Se copia a un `Uint8Array` propio y se envuelve en `Blob`: los tipos del
   * DOM que usa este proyecto no admiten `Buffer` como cuerpo (su `buffer`
   * puede ser `SharedArrayBuffer`). Los bytes que viajan son los mismos.
   */
  const bytes = new Uint8Array(cuerpo.length);
  bytes.set(cuerpo);
  const res = await fetch(url, { method: "PUT", body: new Blob([bytes]) });
  return res.status;
}

describeSiHayMinio("Subida directa: los cuatro tamanos en las dos rutas", () => {
  let orgId: string;
  let userId: string;
  let caseId: string;

  beforeEach(async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    orgId = org.id;
    userId = owner.id;
    const expediente = await createCase(org.id, "EXP-SUBIDA-1");
    caseId = expediente.id;
  });

  const TAMANOS = [
    { etiqueta: "19,9 MiB", bytes: Math.floor(19.9 * 1024 * 1024), aceptado: true },
    { etiqueta: "20 MiB exactos (el limite)", bytes: MAX_BYTES, aceptado: true },
    { etiqueta: "20,5 MiB", bytes: Math.floor(20.5 * 1024 * 1024), aceptado: false },
    { etiqueta: "21 MiB", bytes: 21 * 1024 * 1024, aceptado: false },
  ];

  const RUTAS = [
    { nombre: "ficha del expediente", portal: false },
    { nombre: "portal familiar", portal: true },
  ];

  for (const ruta of RUTAS) {
    for (const tamano of TAMANOS) {
      it(
        `${ruta.nombre} — ${tamano.etiqueta} (${tamano.bytes} bytes) ${tamano.aceptado ? "se acepta" : "se rechaza con 413"}`,
        async () => {
          const actor = {
            orgId,
            caseId,
            userId: ruta.portal ? null : userId,
            isPortalUpload: ruta.portal,
          };
          const nombre = `limite-${ruta.portal ? "portal" : "ficha"}-${tamano.bytes}.pdf`;

          const autorizacion = await subidas.autorizarSubida({
            actor,
            fileName: nombre,
            size: tamano.bytes,
          });

          if (!tamano.aceptado) {
            // Ni siquiera se entrega el permiso de escritura.
            expect(autorizacion.ok).toBe(false);
            if (autorizacion.ok) throw new Error("inalcanzable");
            expect(autorizacion.status).toBe(413);
            expect(autorizacion.error).toBe(MENSAJE_413);
            expect(await prisma.pendingUpload.count({ where: { caseId } })).toBe(0);
            expect(await prisma.document.count({ where: { caseId } })).toBe(0);
            return;
          }

          expect(autorizacion.ok).toBe(true);
          if (!autorizacion.ok) throw new Error("inalcanzable");

          const contenido = pdfDe(tamano.bytes);
          expect(contenido.length).toBe(tamano.bytes);
          expect(await escribirEnAlmacen(autorizacion.uploadUrl, contenido)).toBe(200);

          const confirmacion = await subidas.confirmarSubida({
            actor,
            uploadId: autorizacion.uploadId,
          });
          expect(confirmacion.ok, JSON.stringify(confirmacion)).toBe(true);
          if (!confirmacion.ok) throw new Error("inalcanzable");

          const doc = confirmacion.documento;
          expect(doc.fileSize).toBe(tamano.bytes);
          expect(doc.isPortalUpload).toBe(ruta.portal);
          // Lo que sube la familia lo ve la familia; lo interno es privado.
          expect(doc.visibleToFamily).toBe(ruta.portal);
          expect(doc.uploadedBy).toBe(ruta.portal ? null : userId);

          // La fila cuelga del expediente correcto, y ese de la organizacion.
          const enBase = await prisma.document.findUnique({
            where: { id: doc.id },
            include: { case: { select: { orgId: true } } },
          });
          expect(enBase!.case.orgId).toBe(orgId);
          expect(enBase!.fileKey.startsWith(`${orgId}/${caseId}/`)).toBe(true);

          // Y el objeto esta DE VERDAD, con los bytes que se enviaron.
          const cabecera = await s3.headObject(doc.fileKey);
          expect(cabecera).not.toBeNull();
          expect(cabecera!.contentLength).toBe(tamano.bytes);
        },
        90_000,
      );
    }
  }
});

describeSiHayMinio("Subida directa: lo que no puede colarse", () => {
  let orgId: string;
  let userId: string;
  let caseId: string;
  let actor: {
    orgId: string;
    caseId: string;
    userId: string | null;
    isPortalUpload: boolean;
  };

  beforeEach(async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    orgId = org.id;
    userId = owner.id;
    const expediente = await createCase(org.id, "EXP-SUBIDA-2");
    caseId = expediente.id;
    actor = { orgId, caseId, userId, isPortalUpload: false };
  });

  it("un objeto MAS GRANDE que el maximo se rechaza con 413 aunque se declarara pequeno", async () => {
    /*
     * El tamano de la autorizacion lo dice el cliente y puede mentir. La
     * comprobacion que cuenta es la del objeto real: si no existiera, bastaria
     * declarar 1 KB para colar 21 MiB.
     */
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "mentira.pdf",
      size: 1024,
    });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");

    const enorme = pdfDe(21 * 1024 * 1024);
    expect(await escribirEnAlmacen(autorizacion.uploadUrl, enorme)).toBe(200);

    const confirmacion = await subidas.confirmarSubida({
      actor,
      uploadId: autorizacion.uploadId,
    });

    expect(confirmacion.ok).toBe(false);
    if (confirmacion.ok) throw new Error("inalcanzable");
    expect(confirmacion.status).toBe(413);
    expect(confirmacion.error).toBe(MENSAJE_413);

    expect(await prisma.document.count({ where: { caseId } })).toBe(0);
    // Y el objeto NO se queda en el bucket.
    const pendiente = await prisma.pendingUpload.findUnique({
      where: { id: autorizacion.uploadId },
    });
    expect(pendiente!.status).toBe("FAILED");
    expect(await s3.headObject(pendiente!.fileKey)).toBeNull();
  }, 90_000);

  it("un objeto de tamano distinto al autorizado se descarta y se borra", async () => {
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "cambiado.pdf",
      size: 2048,
    });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");

    // Se autorizo 2048 y se escriben 4096: no es la operacion permitida.
    expect(await escribirEnAlmacen(autorizacion.uploadUrl, pdfDe(4096))).toBe(200);

    const confirmacion = await subidas.confirmarSubida({
      actor,
      uploadId: autorizacion.uploadId,
    });
    expect(confirmacion.ok).toBe(false);
    if (confirmacion.ok) throw new Error("inalcanzable");
    expect(confirmacion.status).toBe(400);

    expect(await prisma.document.count({ where: { caseId } })).toBe(0);
    const pendiente = await prisma.pendingUpload.findUnique({
      where: { id: autorizacion.uploadId },
    });
    expect(await s3.headObject(pendiente!.fileKey)).toBeNull();
  });

  it("un contenido que no corresponde a la extension se descarta y se borra", async () => {
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "factura.pdf",
      size: CABECERA_PNG.length,
    });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");

    // Bytes de PNG dentro de un `.pdf`. Ya no hay Content-Type que falsificar:
    // deciden los bytes reales.
    expect(await escribirEnAlmacen(autorizacion.uploadUrl, CABECERA_PNG)).toBe(200);

    const confirmacion = await subidas.confirmarSubida({
      actor,
      uploadId: autorizacion.uploadId,
    });
    expect(confirmacion.ok).toBe(false);
    if (confirmacion.ok) throw new Error("inalcanzable");
    expect(confirmacion.status).toBe(400);
    expect(confirmacion.error).toMatch(/no corresponde a un PDF/i);

    expect(await prisma.document.count({ where: { caseId } })).toBe(0);
    const pendiente = await prisma.pendingUpload.findUnique({
      where: { id: autorizacion.uploadId },
    });
    expect(await s3.headObject(pendiente!.fileKey)).toBeNull();
  });

  it("un formato no admitido no llega a recibir permiso de escritura", async () => {
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "programa.exe",
      size: 1024,
    });
    expect(autorizacion.ok).toBe(false);
    if (autorizacion.ok) throw new Error("inalcanzable");
    expect(autorizacion.error).toMatch(/Formato no admitido/);
    expect(await prisma.pendingUpload.count({ where: { caseId } })).toBe(0);
  });

  it("otra organizacion no puede confirmar una subida ajena", async () => {
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "privado.pdf",
      size: 1024,
    });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen(autorizacion.uploadUrl, pdfDe(1024));

    // Organizacion y expediente ajenos, con el identificador robado.
    const { org: otra, owner: otroUsuario } = await createOrg();
    const casoAjeno = await createCase(otra.id, "EXP-AJENO-1");

    const confirmacion = await subidas.confirmarSubida({
      actor: {
        orgId: otra.id,
        caseId: casoAjeno.id,
        userId: otroUsuario.id,
        isPortalUpload: false,
      },
      uploadId: autorizacion.uploadId,
    });

    expect(confirmacion.ok).toBe(false);
    if (confirmacion.ok) throw new Error("inalcanzable");
    // Mismo 404 que si no existiera: no se confirma ni se desmiente.
    expect(confirmacion.status).toBe(404);
    expect(await prisma.document.count()).toBe(0);
  });

  it("una subida interna no se puede confirmar como si fuera del portal", async () => {
    /*
     * El origen decide autoria y visibilidad. Si se pudiera cambiar al
     * confirmar, un documento interno acabaria marcado como visible para la
     * familia.
     */
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "interno.pdf",
      size: 1024,
    });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen(autorizacion.uploadUrl, pdfDe(1024));

    const confirmacion = await subidas.confirmarSubida({
      actor: { orgId, caseId, userId: null, isPortalUpload: true },
      uploadId: autorizacion.uploadId,
    });

    expect(confirmacion.ok).toBe(false);
    if (confirmacion.ok) throw new Error("inalcanzable");
    expect(confirmacion.status).toBe(404);
    expect(await prisma.document.count({ where: { caseId } })).toBe(0);
  });

  it("una tarea de otro expediente no se puede vincular al autorizar", async () => {
    const { org: otra } = await createOrg();
    const casoAjeno = await createCase(otra.id, "EXP-AJENO-2");
    const tareaAjena = await prisma.task.create({
      data: { caseId: casoAjeno.id, category: "OTROS", title: "Tarea ajena", sortOrder: 1 },
    });

    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "documento.pdf",
      size: 1024,
      taskId: tareaAjena.id,
    });

    expect(autorizacion.ok).toBe(false);
    if (autorizacion.ok) throw new Error("inalcanzable");
    expect(autorizacion.status).toBe(404);
    expect(await prisma.pendingUpload.count({ where: { caseId } })).toBe(0);
  });
});

describeSiHayMinio("Subida directa: confirmar dos veces, y a la vez", () => {
  let actor: { orgId: string; caseId: string; userId: string | null; isPortalUpload: boolean };
  let caseId: string;

  beforeEach(async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-SUBIDA-3");
    caseId = expediente.id;
    actor = { orgId: org.id, caseId, userId: owner.id, isPortalUpload: false };
  });

  async function subidaLista(nombre = "documento.pdf") {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: nombre, size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen(autorizacion.uploadUrl, pdfDe(1024));
    return autorizacion.uploadId;
  }

  it("confirmar dos veces devuelve el MISMO documento y no crea otro", async () => {
    const uploadId = await subidaLista();

    const primera = await subidas.confirmarSubida({ actor, uploadId });
    const segunda = await subidas.confirmarSubida({ actor, uploadId });

    expect(primera.ok).toBe(true);
    expect(segunda.ok).toBe(true);
    if (!primera.ok || !segunda.ok) throw new Error("inalcanzable");

    expect(segunda.documento.id).toBe(primera.documento.id);
    expect(segunda.yaConfirmada).toBe(true);
    expect(await prisma.document.count({ where: { caseId } })).toBe(1);
  });

  it("dos confirmaciones SIMULTANEAS no crean dos documentos", async () => {
    /*
     * Es el caso real del doble clic y del reintento automatico. La
     * reclamacion del registro pendiente va dentro de la misma transaccion que
     * crea la fila, asi que la segunda se queda esperando el bloqueo, ve el
     * estado ya cambiado y devuelve el documento de la primera.
     */
    const uploadId = await subidaLista("simultaneo.pdf");

    const [a, b] = await Promise.all([
      subidas.confirmarSubida({ actor, uploadId }),
      subidas.confirmarSubida({ actor, uploadId }),
    ]);

    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    if (!a.ok || !b.ok) throw new Error("inalcanzable");
    expect(a.documento.id).toBe(b.documento.id);

    expect(await prisma.document.count({ where: { caseId } })).toBe(1);
    // Exactamente una de las dos hizo el trabajo.
    expect([a.yaConfirmada, b.yaConfirmada].filter(Boolean)).toHaveLength(1);
  });
});

describeSiHayMinio("Subida directa: limpieza de las que nadie confirmo", () => {
  let actor: { orgId: string; caseId: string; userId: string | null; isPortalUpload: boolean };

  beforeEach(async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-SUBIDA-4");
    actor = {
      orgId: org.id,
      caseId: expediente.id,
      userId: owner.id,
      isPortalUpload: false,
    };
  });

  it("una subida caducada pierde su objeto y su fila", async () => {
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "abandonado.pdf",
      size: 1024,
    });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen(autorizacion.uploadUrl, pdfDe(1024));

    const pendiente = await prisma.pendingUpload.findUnique({
      where: { id: autorizacion.uploadId },
    });
    // El objeto esta ahi y nadie lo ha confirmado: es exactamente el huerfano.
    expect(await s3.headObject(pendiente!.fileKey)).not.toBeNull();

    // Se envejece el registro en lugar de esperar una hora.
    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const resumen = await subidas.limpiarSubidasCaducadas();

    expect(resumen.objetosBorrados).toBeGreaterThanOrEqual(1);
    expect(resumen.errores).toBe(0);
    expect(await s3.headObject(pendiente!.fileKey)).toBeNull();
    expect(
      await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } }),
    ).toBeNull();
  });

  it("una subida vigente NO se toca", async () => {
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "en-curso.pdf",
      size: 1024,
    });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen(autorizacion.uploadUrl, pdfDe(1024));

    await subidas.limpiarSubidasCaducadas();

    const pendiente = await prisma.pendingUpload.findUnique({
      where: { id: autorizacion.uploadId },
    });
    expect(pendiente).not.toBeNull();
    expect(await s3.headObject(pendiente!.fileKey)).not.toBeNull();
  });

  it("una subida ya confirmada NO se limpia aunque este caducada", async () => {
    // Su objeto pertenece a un documento vivo: borrarlo seria perder el archivo.
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "confirmado.pdf",
      size: 1024,
    });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen(autorizacion.uploadUrl, pdfDe(1024));
    const confirmacion = await subidas.confirmarSubida({
      actor,
      uploadId: autorizacion.uploadId,
    });
    if (!confirmacion.ok) throw new Error("la confirmacion deberia funcionar");

    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await subidas.limpiarSubidasCaducadas();

    expect(await s3.headObject(confirmacion.documento.fileKey)).not.toBeNull();
    expect(
      await prisma.document.findUnique({ where: { id: confirmacion.documento.id } }),
    ).not.toBeNull();
  });
});
