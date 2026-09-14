/**
 * SUBIDA DIRECTA AL ALMACENAMIENTO, contra MinIO REAL y PostgreSQL REAL.
 *
 * QUE SE COMPRUEBA AQUI Y POR QUE NO VALDRIA UN MOCK
 * ---------------------------------------------------
 * El archivo ya no pasa por la funcion —una funcion de Vercel admite 4,5 MB de
 * cuerpo y el maximo del producto son 20 MiB—, asi que el servidor firma una
 * politica de escritura y despues comprueba lo que de verdad ha quedado
 * escrito, copiandolo a una clave final nueva sólo si todo cuadra. Todo lo
 * interesante de esta arquitectura vive precisamente ahi: en si el almacen
 * impone el tamaño, en si el objeto inspeccionado es el mismo que se lee, y en
 * si dos operaciones concurrentes pueden pisarse. Con el almacenamiento
 * simulado, cualquiera de esas afirmaciones seria una suposicion.
 *
 * Se salta entero si no hay MinIO, para que un entorno sin Docker no de un
 * falso rojo. En CI el servicio existe y el job ademas FALLA si se salta, para
 * que "verde" no pueda significar "no se probo nada".
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { CreateBucketCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";

const ENDPOINT = process.env.S3_ENDPOINT;
const BUCKET = process.env.S3_BUCKET;
const hayMinio = Boolean(ENDPOINT && BUCKET && process.env.S3_ACCESS_KEY);
const describeSiHayMinio = hayMinio ? describe : describe.skip;

const MAX_BYTES = 20 * 1024 * 1024; // 20 971 520
const MENSAJE_413 = "El archivo supera el máximo de 20 MB.";

const CABECERA_PDF = Buffer.from("%PDF-1.7\n", "utf8");
const CABECERA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CABECERA_MZ = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);

let s3: typeof import("../../src/lib/s3");
let subidas: typeof import("../../src/lib/subida-directa");
let retencion: typeof import("../../src/lib/retention");

beforeAll(async () => {
  if (!hayMinio) return;
  s3 = await import("../../src/lib/s3");
  subidas = await import("../../src/lib/subida-directa");
  retencion = await import("../../src/lib/retention");

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
function pdfDe(bytes: number, relleno = 0x41): Buffer {
  const b = Buffer.alloc(bytes, relleno);
  CABECERA_PDF.copy(b, 0);
  return b;
}

/** El POST que hace el navegador: directo al almacenamiento, con la politica firmada. */
async function escribirEnAlmacen(
  politica: { url: string; fields: Record<string, string> },
  cuerpo: Buffer,
  camposExtra: Record<string, string> = {},
): Promise<{ status: number; codigo: string | null }> {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...politica.fields, ...camposExtra })) fd.append(k, v);
  // El archivo va el ULTIMO: el almacen ignora los campos que vienen detras.
  const bytes = new Uint8Array(cuerpo.length);
  bytes.set(cuerpo);
  fd.append("file", new Blob([bytes]), "f.pdf");
  const res = await fetch(politica.url, { method: "POST", body: fd });
  const texto = await res.text();
  const codigo = (/<Code>([^<]+)<\/Code>/.exec(texto) || [])[1] ?? null;
  return { status: res.status, codigo };
}

async function actorInterno(orgId: string, caseId: string, userId: string) {
  return { orgId, caseId, userId, isPortalUpload: false as const };
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
        `${ruta.nombre} — ${tamano.etiqueta} (${tamano.bytes} bytes) ${tamano.aceptado ? "se acepta" : "se rechaza antes o por politica de almacen"}`,
        async () => {
          const actor = {
            orgId,
            caseId,
            userId: ruta.portal ? null : userId,
            isPortalUpload: ruta.portal,
          };
          const nombre = `limite-${ruta.portal ? "portal" : "ficha"}-${tamano.bytes}.pdf`;

          const autorizacion = await subidas.autorizarSubida({ actor, fileName: nombre, size: tamano.bytes });

          if (!tamano.aceptado) {
            // Ni siquiera se entrega permiso de escritura: declarar un tamaño
            // por encima del máximo se corta ANTES de firmar política alguna.
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
          const escritura = await escribirEnAlmacen(
            { url: autorizacion.uploadUrl, fields: autorizacion.fields },
            contenido,
          );
          expect(escritura.status, JSON.stringify(escritura)).toBe(204);

          const confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
          expect(confirmacion.ok, JSON.stringify(confirmacion)).toBe(true);
          if (!confirmacion.ok) throw new Error("inalcanzable");

          const doc = confirmacion.documento;
          expect(doc.fileSize).toBe(tamano.bytes);
          expect(doc.isPortalUpload).toBe(ruta.portal);
          expect(doc.visibleToFamily).toBe(ruta.portal);
          expect(doc.uploadedBy).toBe(ruta.portal ? null : userId);

          const enBase = await prisma.document.findUnique({
            where: { id: doc.id },
            include: { case: { select: { orgId: true } } },
          });
          expect(enBase!.case.orgId).toBe(orgId);
          // La clave FINAL no es la de preparacion: la asigna el servidor.
          const pendienteFinal = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
          expect(enBase!.fileKey).toBe(pendienteFinal!.finalKey);
          expect(enBase!.fileKey).not.toBe(pendienteFinal!.stagingKey);
          expect(enBase!.fileKey.startsWith(`${orgId}/${caseId}/`)).toBe(true);

          const cabecera = await s3.inspeccionarObjeto(doc.fileKey);
          expect(cabecera).not.toBeNull();
          expect(cabecera!.tamano).toBe(tamano.bytes);
        },
        90_000,
      );
    }
  }
});

describeSiHayMinio("Subida directa: el ALMACEN impone el tamano exacto", () => {
  let orgId: string;
  let userId: string;
  let caseId: string;

  beforeEach(async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    orgId = org.id;
    userId = owner.id;
    const expediente = await createCase(org.id, "EXP-SUBIDA-POLITICA");
    caseId = expediente.id;
  });

  it("declarar 1 KB y enviar 21 MiB es rechazado por el ALMACEN, SIN llamar a confirmar", async () => {
    /*
     * El motivo del bloqueo original: una URL PUT desnuda no imponia ningun
     * tamaño, y "confirmar" era la UNICA barrera. Ahora la politica POST lleva
     * `content-length-range` en el tamaño exacto autorizado, y el almacen la
     * hace cumplir el mismo, ANTES de guardar nada — no se llama a
     * `confirmarSubida` en absoluto en esta prueba.
     */
    const actor = await actorInterno(orgId, caseId, userId);
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "mentira.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");

    const enorme = pdfDe(21 * 1024 * 1024);
    const escritura = await escribirEnAlmacen(
      { url: autorizacion.uploadUrl, fields: autorizacion.fields },
      enorme,
    );

    expect(escritura.status, JSON.stringify(escritura)).toBeGreaterThanOrEqual(400);
    expect(escritura.status).toBeLessThan(500);
    expect(escritura.codigo).toBe("EntityTooLarge");

    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(pendiente!.status, "confirmar no se ha llamado: sigue PENDING").toBe("PENDING");
    expect(await s3.inspeccionarObjeto(pendiente!.stagingKey), "el almacen no ha guardado nada").toBeNull();
    expect(await prisma.document.count({ where: { caseId } })).toBe(0);
  }, 90_000);

  it("declarar 1 KB y enviar 1 KB - 1 byte tambien es rechazado por el ALMACEN", async () => {
    const actor = await actorInterno(orgId, caseId, userId);
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "corto.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");

    const escritura = await escribirEnAlmacen(
      { url: autorizacion.uploadUrl, fields: autorizacion.fields },
      pdfDe(1023),
    );

    expect(escritura.codigo).toBe("EntityTooSmall");
    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(await s3.inspeccionarObjeto(pendiente!.stagingKey)).toBeNull();
  }, 90_000);

  it("una clave manipulada (distinta de la firmada) es rechazada por el ALMACEN", async () => {
    const actor = await actorInterno(orgId, caseId, userId);
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "x.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");

    const otraClave = autorizacion.fields.key.replace("preparacion", "portal");
    const escritura = await escribirEnAlmacen(
      { url: autorizacion.uploadUrl, fields: autorizacion.fields },
      pdfDe(1024),
      { key: otraClave },
    );

    expect(escritura.status).toBeGreaterThanOrEqual(400);
    expect(await s3.inspeccionarObjeto(otraClave)).toBeNull();
  }, 90_000);
});

describeSiHayMinio("Subida directa: reutilizar la autorizacion tras confirmar", () => {
  let orgId: string;
  let userId: string;
  let caseId: string;

  beforeEach(async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    orgId = org.id;
    userId = owner.id;
    const expediente = await createCase(org.id, "EXP-SUBIDA-REPLAY");
    caseId = expediente.id;
  });

  it("reescribir la preparacion despues de confirmar NO puede alterar el objeto final", async () => {
    /*
     * DEFECTO REPRODUCIDO CONTRA d899d2d (URL PUT desnuda sobre la clave
     * final): reutilizar la autorizacion tras confirmar sobrescribia el MISMO
     * objeto que el Document ya referenciaba. Con la separacion staging/final,
     * la politica reutilizada solo puede alcanzar la clave de preparacion, que
     * el Document nunca usa.
     */
    const actor = await actorInterno(orgId, caseId, userId);
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "valido.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    const original = pdfDe(1024);
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, original);

    const confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    if (!confirmacion.ok) throw new Error("la confirmacion deberia funcionar");
    const doc = confirmacion.documento;

    const antes = await s3.leerObjetoSiCoincide(
      doc.fileKey,
      (await s3.inspeccionarObjeto(doc.fileKey))!.etag,
      MAX_BYTES,
    );
    expect(antes.equals(original)).toBe(true);

    // Se reutiliza la MISMA politica de subida, con bytes distintos (mismo
    // tamaño exacto: la politica lo exige).
    const otroContenido = Buffer.alloc(1024, 0x00);
    CABECERA_MZ.copy(otroContenido, 0);
    const reintento = await escribirEnAlmacen(
      { url: autorizacion.uploadUrl, fields: autorizacion.fields },
      otroContenido,
    );
    expect(reintento.status, "la politica firmada sigue viva hasta que caduca").toBe(204);

    // El objeto FINAL, que es el que el documento referencia, no ha cambiado.
    const despues = await s3.leerObjetoSiCoincide(
      doc.fileKey,
      (await s3.inspeccionarObjeto(doc.fileKey))!.etag,
      MAX_BYTES,
    );
    expect(despues.equals(original), "el objeto final no se ha movido").toBe(true);

    const filaActual = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(filaActual!.fileSize).toBe(1024);
    expect(filaActual!.mimeType).toBe("application/pdf");

    // Confirmar otra vez devuelve el MISMO documento, sin volver a mirar el
    // almacen: reescribir la preparacion no reabre la verificacion.
    const reconfirmar = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    expect(reconfirmar.ok && reconfirmar.documento.id).toBe(doc.id);
  }, 90_000);
});

describeSiHayMinio("Subida directa: integridad entre inspeccionar y copiar", () => {
  let orgId: string;
  let userId: string;
  let caseId: string;

  beforeEach(async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    orgId = org.id;
    userId = owner.id;
    const expediente = await createCase(org.id, "EXP-SUBIDA-TOCTOU");
    caseId = expediente.id;
  });

  it("si el objeto cambia entre inspeccionar y leer, no se copia nada a la clave final", async () => {
    /*
     * Simula la carrera real: entre el HeadObject inicial (dentro de
     * `confirmarSubida`) y la lectura condicionada, alguien reescribe la
     * preparacion mediante la politica, que sigue siendo valida. Se fuerza
     * determinísticamente interceptando el HeadObjectCommand real que emite
     * `inspeccionarObjeto`, para escribir el cambio justo despues de
     * inspeccionar y antes de leer.
     *
     * No se reasigna `inspeccionarObjeto` en si: es un export nombrado de un
     * modulo ES y sus bindings son de solo lectura (reasignarlo lanza
     * "has only a getter"). Se intercepta en el punto mutable real: el metodo
     * `send` del cliente S3, igual que en la prueba de la carrera de limpieza.
     */
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const actor = await actorInterno(orgId, caseId, userId);
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "carrera.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    const enviarOriginal = s3.s3Client.send.bind(s3.s3Client);
    (s3.s3Client as { send: unknown }).send = async (cmd: unknown, ...resto: unknown[]) => {
      const resultado = await (enviarOriginal as (...a: unknown[]) => unknown)(cmd, ...resto);
      if (cmd instanceof HeadObjectCommand) {
        // Justo despues de que `confirmarSubida` inspeccione, se reescribe.
        await escribirEnAlmacen(
          { url: autorizacion.uploadUrl, fields: autorizacion.fields },
          pdfDe(1024, 0x42),
        );
      }
      return resultado;
    };

    let confirmacion;
    try {
      confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    } finally {
      (s3.s3Client as { send: unknown }).send = enviarOriginal;
    }

    expect(confirmacion.ok).toBe(false);
    if (confirmacion.ok) throw new Error("inalcanzable");
    expect(confirmacion.status).toBe(409);
    expect(await prisma.document.count({ where: { caseId } })).toBe(0);

    // No se ha creado ninguna clave final: la lectura condicionada abortó
    // antes de que hubiera nada que copiar.
    const claves = await s3.s3Client.send(
      new (await import("@aws-sdk/client-s3")).ListObjectsV2Command({
        Bucket: BUCKET!,
        Prefix: `${orgId}/${caseId}/interno/`,
      }),
    );
    expect(claves.Contents ?? []).toHaveLength(0);
  }, 90_000);
});

describeSiHayMinio("Subida directa: lo que no puede colarse", () => {
  let orgId: string;
  let userId: string;
  let caseId: string;
  let actor: { orgId: string; caseId: string; userId: string | null; isPortalUpload: boolean };

  beforeEach(async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    orgId = org.id;
    userId = owner.id;
    const expediente = await createCase(org.id, "EXP-SUBIDA-2");
    caseId = expediente.id;
    actor = { orgId, caseId, userId, isPortalUpload: false };
  });

  it("un contenido que no corresponde a la extension se descarta y se borra", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "factura.pdf", size: CABECERA_PNG.length });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, CABECERA_PNG);

    const confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    expect(confirmacion.ok).toBe(false);
    if (confirmacion.ok) throw new Error("inalcanzable");
    expect(confirmacion.status).toBe(400);
    expect(confirmacion.error).toMatch(/no corresponde a un PDF/i);

    expect(await prisma.document.count({ where: { caseId } })).toBe(0);
    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(await s3.inspeccionarObjeto(pendiente!.stagingKey)).toBeNull();
  });

  it("un formato no admitido no llega a recibir permiso de escritura", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "programa.exe", size: 1024 });
    expect(autorizacion.ok).toBe(false);
    if (autorizacion.ok) throw new Error("inalcanzable");
    expect(autorizacion.error).toMatch(/Formato no admitido/);
    expect(await prisma.pendingUpload.count({ where: { caseId } })).toBe(0);
  });

  it("otra organizacion no puede confirmar una subida ajena", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "privado.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    const { org: otra, owner: otroUsuario } = await createOrg();
    const casoAjeno = await createCase(otra.id, "EXP-AJENO-1");

    const confirmacion = await subidas.confirmarSubida({
      actor: { orgId: otra.id, caseId: casoAjeno.id, userId: otroUsuario.id, isPortalUpload: false },
      uploadId: autorizacion.uploadId,
    });

    expect(confirmacion.ok).toBe(false);
    if (confirmacion.ok) throw new Error("inalcanzable");
    expect(confirmacion.status).toBe(404);
    expect(await prisma.document.count()).toBe(0);
  });

  it("un usuario DISTINTO de la MISMA organizacion y expediente no puede confirmar la subida de otro", async () => {
    /*
     * ATADURA DEL ACTOR. Antes de esta revision, cualquiera con permiso
     * `documents.create` en el mismo expediente podia confirmar el uploadId de
     * OTRO usuario -si lo conocia- y la auditoria terminaba atribuyendole un
     * documento que no subio. Se exige ahora que sea el MISMO usuario.
     */
    const { owner: otroUsuarioMismaOrg } = await (async () => {
      const otro = await prisma.user.create({
        data: { email: `otro-${Date.now()}@ejemplo.test`, name: "Otro" },
      });
      await prisma.membership.create({ data: { userId: otro.id, orgId, role: "MANAGER" } });
      return { owner: otro };
    })();

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "de-otro.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    const confirmacion = await subidas.confirmarSubida({
      actor: { orgId, caseId, userId: otroUsuarioMismaOrg.id, isPortalUpload: false },
      uploadId: autorizacion.uploadId,
    });

    expect(confirmacion.ok).toBe(false);
    if (confirmacion.ok) throw new Error("inalcanzable");
    expect(confirmacion.status).toBe(404);
    expect(await prisma.document.count({ where: { caseId } })).toBe(0);

    // El USUARIO ORIGINAL si puede confirmarla: la atadura no es un cerrojo roto.
    const confirmacionCorrecta = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    expect(confirmacionCorrecta.ok).toBe(true);
    if (!confirmacionCorrecta.ok) throw new Error("inalcanzable");
    expect(confirmacionCorrecta.documento.uploadedBy).toBe(userId);
  });

  it("una subida interna no se puede confirmar como si fuera del portal", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "interno.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

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

  it("una tarea borrada entre autorizar y confirmar: respuesta honesta, sin 500, sin objeto huerfano, sin vinculo fantasma", async () => {
    const tarea = await prisma.task.create({
      data: { caseId, category: "OTROS", title: "Tarea que desaparece", sortOrder: 1 },
    });
    const autorizacion = await subidas.autorizarSubida({
      actor,
      fileName: "con-tarea.pdf",
      size: 1024,
      taskId: tarea.id,
    });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    // La tarea desaparece DESPUES de autorizar, ANTES de confirmar.
    await prisma.task.delete({ where: { id: tarea.id } });

    const confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });

    // No hay 500: se confirma igual, sin vincular a ninguna tarea.
    expect(confirmacion.ok, JSON.stringify(confirmacion)).toBe(true);
    if (!confirmacion.ok) throw new Error("inalcanzable");
    expect(confirmacion.documento.taskId).toBeNull();
    expect(confirmacion.taskUpdated).toBe(false);

    // El objeto final existe de verdad: no es huerfano, tiene su Document.
    expect(await s3.inspeccionarObjeto(confirmacion.documento.fileKey)).not.toBeNull();
    expect(await prisma.document.count({ where: { caseId } })).toBe(1);
  }, 90_000);
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
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));
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

  it("dos confirmaciones SIMULTANEAS crean UN documento y no dejan un objeto final huerfano", async () => {
    /*
     * Es el caso real del doble clic y del reintento automatico. Cada rama
     * copia SU PROPIO objeto final antes de disputar la reclamacion en base de
     * datos (asi es como tiene que ser: la copia no puede depender de haber
     * ganado ya). La perdedora debe borrar el objeto final que creo de mas.
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
    expect([a.yaConfirmada, b.yaConfirmada].filter(Boolean)).toHaveLength(1);

    // Solo debe quedar UN objeto bajo el ambito de este expediente con el
    // contenido final (mas la preparacion, que se borra por separado).
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const claves = await s3.s3Client.send(
      new ListObjectsV2Command({ Bucket: BUCKET!, Prefix: `${actor.orgId}/${caseId}/interno/` }),
    );
    expect((claves.Contents ?? []).length, "ningun objeto final huerfano de la carrera").toBe(1);
    expect(claves.Contents![0].Key).toBe(a.documento.fileKey);
  }, 90_000);
});

describeSiHayMinio("Subida directa: limpieza con reclamacion explicita (CAS)", () => {
  let actor: { orgId: string; caseId: string; userId: string | null; isPortalUpload: boolean };
  let caseId: string;

  beforeEach(async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-SUBIDA-4");
    caseId = expediente.id;
    actor = { orgId: org.id, caseId, userId: owner.id, isPortalUpload: false };
  });

  it("una subida caducada pierde su objeto de preparacion y su fila", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "abandonado.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(await s3.inspeccionarObjeto(pendiente!.stagingKey)).not.toBeNull();

    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const resumen = await subidas.limpiarSubidasCaducadas();

    expect(resumen.objetosBorrados).toBeGreaterThanOrEqual(1);
    expect(resumen.errores).toBe(0);
    expect(await s3.inspeccionarObjeto(pendiente!.stagingKey)).toBeNull();
    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).toBeNull();
  });

  it("una subida vigente NO se toca", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "en-curso.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    await subidas.limpiarSubidasCaducadas();

    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(pendiente).not.toBeNull();
    expect(pendiente!.status).toBe("PENDING");
    expect(await s3.inspeccionarObjeto(pendiente!.stagingKey)).not.toBeNull();
  });

  it("una subida ya confirmada NO se limpia por caducidad, aunque su expiresAt haya pasado", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "confirmado.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));
    const confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    if (!confirmacion.ok) throw new Error("la confirmacion deberia funcionar");

    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await subidas.limpiarSubidasCaducadas();

    expect(await s3.inspeccionarObjeto(confirmacion.documento.fileKey)).not.toBeNull();
    expect(await prisma.document.findUnique({ where: { id: confirmacion.documento.id } })).not.toBeNull();
  });

  it(
    "limpieza y confirmacion a la vez: o el documento existe con su objeto, o no hay documento y no hay huerfano",
    async () => {
      /*
       * Se fuerza el entrelazado con una barrera determinista (sin sleeps): se
       * intercepta el PRIMER DeleteObject que la limpieza intenta emitir —tras
       * haber reclamado la fila con CAS— y se le hace esperar a que la
       * confirmacion, que llega justo despues, termine su intento.
       *
       * La propiedad que se demuestra es la del enunciado: cualquiera de los
       * dos resultados es valido, pero NUNCA un documento sin objeto ni un
       * objeto sin ninguna fila que lo explique.
       */
      const autorizacion = await subidas.autorizarSubida({ actor, fileName: "carrera-limpieza.pdf", size: 1024 });
      if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
      await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

      // Se envejece para que la limpieza la seleccione como caducada.
      await prisma.pendingUpload.update({
        where: { id: autorizacion.uploadId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      let soltarBorrado!: () => void;
      const barreraBorrado = new Promise<void>((r) => (soltarBorrado = r));
      let borradoAlcanzado!: () => void;
      const borradoAlcanzadoP = new Promise<void>((r) => (borradoAlcanzado = r));

      const enviarOriginal = s3.s3Client.send.bind(s3.s3Client);
      (s3.s3Client as { send: unknown }).send = async (cmd: unknown, ...resto: unknown[]) => {
        if (cmd instanceof DeleteObjectCommand) {
          borradoAlcanzado();
          await barreraBorrado;
        }
        return (enviarOriginal as (...a: unknown[]) => unknown)(cmd, ...resto);
      };

      const limpieza = subidas.limpiarSubidasCaducadas();
      await borradoAlcanzadoP; // la limpieza ya reclamo (CAS) y va a borrar
      const confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
      soltarBorrado();
      const resumenLimpieza = await limpieza;
      (s3.s3Client as { send: unknown }).send = enviarOriginal;

      if (confirmacion.ok) {
        // La confirmacion ganó: el documento existe y su objeto tambien.
        const doc = await prisma.document.findUnique({ where: { id: confirmacion.documento.id } });
        expect(doc).not.toBeNull();
        expect(await s3.inspeccionarObjeto(doc!.fileKey)).not.toBeNull();
        // La limpieza no debio poder reclamar (la confirmacion ya habia
        // movido el estado): no se ha borrado el objeto de preparacion de
        // una subida que ahora tiene documento.
      } else {
        // La limpieza ganó: no hay documento, y tampoco objeto huerfano.
        expect(await prisma.document.count({ where: { caseId } })).toBe(0);
        const pendienteFinal = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
        expect(pendienteFinal).toBeNull();
        expect(resumenLimpieza.objetosBorrados).toBeGreaterThanOrEqual(1);
      }
    },
    90_000,
  );

  it("una reclamacion de limpieza abandonada (CLEANING) se puede reintentar pasado el margen", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "abandonada-en-limpieza.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    // Simula un proceso que reclamo y se cayo: CLEANING con claimedAt viejo.
    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: {
        status: "CLEANING",
        claimedAt: new Date(Date.now() - 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const resumen = await subidas.limpiarSubidasCaducadas();

    expect(resumen.filasBorradas).toBeGreaterThanOrEqual(1);
    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).toBeNull();
    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(pendiente).toBeNull();
  });

  it("la retencion borra filas COMPLETED viejas, pero NUNCA el Document ni su objeto", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "viejo-confirmado.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));
    const confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    if (!confirmacion.ok) throw new Error("la confirmacion deberia funcionar");

    // La preparacion ya deberia haberse borrado en la confirmacion (best
    // effort e inmediato); se espera un instante determinista consultando el
    // estado en vez de dormir a ciegas.
    for (let i = 0; i < 20; i++) {
      const fila = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
      if (fila?.stagingDeletedAt) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    await subidas.limpiarSubidasCaducadas();

    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).toBeNull();
    // El Document y su objeto final: intactos.
    const doc = await prisma.document.findUnique({ where: { id: confirmacion.documento.id } });
    expect(doc).not.toBeNull();
    expect(await s3.inspeccionarObjeto(doc!.fileKey)).not.toBeNull();
  }, 90_000);

  it("una fila COMPLETED reciente NO se borra por retencion", async () => {
    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "reciente.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));
    const confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    if (!confirmacion.ok) throw new Error("la confirmacion deberia funcionar");

    await subidas.limpiarSubidasCaducadas();

    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).not.toBeNull();
  }, 90_000);
});

describeSiHayMinio("Purga de expediente con subida sin confirmar: sin huerfanos", () => {
  it("una subida sin confirmar bloquea el borrado directo del Case (RESTRICT) y purgeCase la resuelve primero", async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-PURGA-1");
    const actor = { orgId: org.id, caseId: expediente.id, userId: owner.id, isPortalUpload: false as const };

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "sin-confirmar.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));
    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(await s3.inspeccionarObjeto(pendiente!.stagingKey)).not.toBeNull();

    // RESTRICT: intentar borrar el Case a pelo, sin resolver la subida
    // pendiente, falla en la base de datos. Es la prueba real de que la FK
    // impide perder el puntero.
    await expect(prisma.case.delete({ where: { id: expediente.id } })).rejects.toThrow();
    expect(await prisma.case.findUnique({ where: { id: expediente.id } })).not.toBeNull();

    // El camino correcto: purgeCase resuelve la subida sin confirmar ANTES de
    // borrar el expediente.
    const resultado = await retencion.purgeCase(expediente.id, prisma as any);

    expect(resultado.ok, JSON.stringify(resultado)).toBe(true);
    expect(await prisma.case.findUnique({ where: { id: expediente.id } })).toBeNull();
    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).toBeNull();
    expect(await s3.inspeccionarObjeto(pendiente!.stagingKey), "sin objeto huerfano").toBeNull();
  }, 90_000);

  it("si el almacen falla al borrar la preparacion, la purga NO continua y el puntero no se pierde", async () => {
    await resetDatabase();
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-PURGA-2");
    const actor = { orgId: org.id, caseId: expediente.id, userId: owner.id, isPortalUpload: false as const };

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "sin-confirmar-2.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    // Se simula el fallo del almacen SOLO para el borrado, inyectando un
    // DeleteObjectCommand que lanza. El resto de operaciones siguen siendo
    // reales.
    const enviarOriginal = s3.s3Client.send.bind(s3.s3Client);
    (s3.s3Client as { send: unknown }).send = async (cmd: unknown, ...resto: unknown[]) => {
      if (cmd instanceof DeleteObjectCommand) throw new Error("almacen caido (inyectado)");
      return (enviarOriginal as (...a: unknown[]) => unknown)(cmd, ...resto);
    };

    let resultado;
    try {
      resultado = await retencion.purgeCase(expediente.id, prisma as any);
    } finally {
      (s3.s3Client as { send: unknown }).send = enviarOriginal;
    }

    expect(resultado.ok).toBe(false);
    // El Case y el PendingUpload SIGUEN existiendo: no se ha perdido el puntero.
    expect(await prisma.case.findUnique({ where: { id: expediente.id } })).not.toBeNull();
    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).not.toBeNull();
  }, 90_000);
});
