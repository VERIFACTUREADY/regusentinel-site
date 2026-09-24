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
/**
 * El `prisma` de `./helpers/db` es OTRA instancia de `PrismaClient` —conecta
 * a la misma base real, pero es un objeto distinto—. `subida-directa.ts`
 * importa el singleton de `src/lib/prisma.ts`: para inyectar un fallo
 * determinista en `$transaction` hay que interceptar ESE objeto, no el de los
 * helpers, o la intercepcion no tiene ningun efecto sobre el codigo bajo
 * prueba (se confirmó exactamente así al escribir estas pruebas).
 */
let prismaReal: typeof import("../../src/lib/prisma");

beforeAll(async () => {
  if (!hayMinio) return;
  s3 = await import("../../src/lib/s3");
  subidas = await import("../../src/lib/subida-directa");
  retencion = await import("../../src/lib/retention");
  prismaReal = await import("../../src/lib/prisma");

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

/**
 * LA GARANTÍA EXACTA: "todo fallo deja o un Document valido con su objeto
 * verificado, o ningun Document y ningun objeto huerfano", ventana por
 * ventana, contra MinIO y PostgreSQL reales.
 *
 * Las ventanas 4 y 5 (el proceso se cae de verdad) no se pueden reproducir
 * matando el proceso de pruebas: se reconstruye a mano, con las MISMAS
 * primitivas que usa `confirmarSubida` (`crearObjetoSiNoExiste`,
 * `uploadFile`, las mismas escrituras en la fila), el estado EXACTO que una
 * caida en ese punto deja. Es la unica forma honesta de probarlo sin mocks:
 * el objeto huerfano y la fila que se construyen son reales.
 */
describeSiHayMinio("Subida directa: la garantia tras un fallo, ventana por ventana", () => {
  it("ventana 2 (fallo simple) — la transaccion falla tras escribir el objeto final: el objeto queda vivo (ya NO se borra sincronamente, para no arriesgar la clave de una rama concurrente); la fila lo sigue apuntando y puede reintentar", async () => {
    /*
     * Antes de la segunda revision de concurrencia, un fallo de transaccion
     * SIN carrera de por medio borraba el objeto final de forma SINCRONA. Se
     * retiro ese borrado: con clave compartida entre confirmaciones
     * concurrentes, un borrado sincrono en CUALQUIER fallo de transaccion
     * —no solo al perder explicitamente contra otra— podria acertar sobre el
     * objeto que una rama concurrente esta a punto de comprometer. La
     * garantia pasa a ser: el objeto queda vivo AL INSTANTE (no se pierde
     * nada), la fila lo sigue apuntando (`finalKey`), y su recuperacion si
     * nadie llega a confirmar nunca es EVENTUAL, vía `limpiarSubidasCaducadas`
     * — la unica via, ya verificada aparte en "ventana 2 (doble fallo)".
     */
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-VENTANA-2");
    const actor = await actorInterno(org.id, expediente.id, owner.id);

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "tx-falla.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    // El objeto final se escribe de verdad (antes de `prisma.$transaction`);
    // solo la transaccion se inyecta para que falle.
    const transaccionOriginal = prismaReal.prisma.$transaction.bind(prismaReal.prisma);
    (prismaReal.prisma as unknown as { $transaction: unknown }).$transaction = async () => {
      throw new Error("base de datos caida (inyectado)");
    };

    let lanzo = false;
    try {
      await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    } catch {
      lanzo = true;
    } finally {
      (prismaReal.prisma as unknown as { $transaction: unknown }).$transaction = transaccionOriginal;
    }

    expect(lanzo, "el fallo operativo se propaga, no se disfraza de ok:false").toBe(true);
    expect(await prisma.document.count({ where: { caseId: expediente.id } })).toBe(0);

    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const claves = await s3.s3Client.send(
      new ListObjectsV2Command({ Bucket: BUCKET!, Prefix: `${org.id}/${expediente.id}/interno/` }),
    );
    expect(
      (claves.Contents ?? []).length,
      "el objeto sigue ahi AL INSTANTE: ya no hay borrado sincrono en ningun fallo de transaccion",
    ).toBe(1);

    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(pendiente!.status, "sigue PENDING: el cliente puede reintentar").toBe("PENDING");
    expect(pendiente!.finalKey, "la fila sigue apuntando al objeto que escribio").not.toBeNull();
    expect(await s3.inspeccionarObjeto(pendiente!.finalKey!)).not.toBeNull();

    // Recuperacion EVENTUAL: se envejece y se limpia, igual que en "ventana 2
    // (doble fallo)" — aqui sin necesitar inyectar un SEGUNDO fallo, porque ya
    // no hay ningun borrado sincrono que forzar a fallar.
    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const resumen = await subidas.limpiarSubidasCaducadas();
    expect(resumen.errores).toBe(0);
    expect(
      await s3.inspeccionarObjeto(pendiente!.finalKey!),
      "la limpieza recupera el objeto abandonado",
    ).toBeNull();
    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).toBeNull();
  }, 30_000);

  it("ventana 2 (doble fallo) — si el borrado compensatorio TAMBIEN falla, el huerfano no queda para siempre: la limpieza lo recupera al caducar", async () => {
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-VENTANA-2B");
    const actor = await actorInterno(org.id, expediente.id, owner.id);

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "doble-fallo.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    const transaccionOriginal = prismaReal.prisma.$transaction.bind(prismaReal.prisma);
    (prismaReal.prisma as unknown as { $transaction: unknown }).$transaction = async () => {
      throw new Error("base de datos caida (inyectado)");
    };
    const { DeleteObjectCommand, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const enviarOriginal = s3.s3Client.send.bind(s3.s3Client);
    (s3.s3Client as { send: unknown }).send = async (cmd: unknown, ...resto: unknown[]) => {
      if (cmd instanceof DeleteObjectCommand) throw new Error("almacen caido para el borrado (inyectado)");
      return (enviarOriginal as (...a: unknown[]) => unknown)(cmd, ...resto);
    };

    let lanzo = false;
    try {
      await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    } catch {
      lanzo = true;
    } finally {
      (prismaReal.prisma as unknown as { $transaction: unknown }).$transaction = transaccionOriginal;
      (s3.s3Client as { send: unknown }).send = enviarOriginal;
    }
    expect(lanzo).toBe(true);

    // Justo tras el doble fallo: el objeto final SIGUE en el almacen. Este es
    // el hueco que se documenta como recuperacion EVENTUAL, no instantanea.
    const prefijo = `${org.id}/${expediente.id}/interno/`;
    let claves = await s3.s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET!, Prefix: prefijo }));
    expect((claves.Contents ?? []).length, "el huerfano existe de verdad justo tras el doble fallo").toBe(1);

    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(pendiente!.status).toBe("PENDING");
    expect(pendiente!.finalKey, "la fila recuerda la clave huerfana").not.toBeNull();

    // Se envejece como cualquier otra preparacion abandonada.
    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const resumen = await subidas.limpiarSubidasCaducadas();
    expect(resumen.errores).toBe(0);

    claves = await s3.s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET!, Prefix: prefijo }));
    expect((claves.Contents ?? []).length, "la limpieza recupera el huerfano final al caducar").toBe(0);
    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).toBeNull();
    expect(await prisma.document.count({ where: { caseId: expediente.id } })).toBe(0);
  }, 30_000);

  it("un reintento SECUENCIAL REUTILIZA la MISMA clave final del intento anterior, no genera una nueva, y el objeto ya escrito se referencia directamente", async () => {
    /*
     * Con la clave compartida por fila (segunda revision de concurrencia), un
     * reintento tras un fallo de transaccion YA NO genera una clave nueva ni
     * necesita borrar nada "huerfano": la fila recuerda la UNICA clave que se
     * le asigno, la reutiliza, y si el objeto ya estaba escrito desde el
     * primer intento, `crearObjetoSiNoExiste` recibe una precondicion fallida
     * (la clave ya existe) que se trata como exito, no como error.
     */
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-VENTANA-2-REINTENTO");
    const actor = await actorInterno(org.id, expediente.id, owner.id);

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "reintento.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    // Primer intento: la transaccion falla tras escribir el objeto.
    const transaccionOriginal = prismaReal.prisma.$transaction.bind(prismaReal.prisma);
    (prismaReal.prisma as unknown as { $transaction: unknown }).$transaction = async () => {
      throw new Error("caida (inyectado)");
    };
    try {
      await expect(subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId })).rejects.toThrow();
    } finally {
      (prismaReal.prisma as unknown as { $transaction: unknown }).$transaction = transaccionOriginal;
    }

    const filaTrasFallo = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    const claveDelPrimerIntento = filaTrasFallo!.finalKey!;
    expect(claveDelPrimerIntento).not.toBeNull();
    expect(
      await s3.inspeccionarObjeto(claveDelPrimerIntento),
      "el objeto del primer intento existe de verdad",
    ).not.toBeNull();

    // Segundo intento, sin nada inyectado: el flujo normal.
    const segundo = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    expect(segundo.ok, JSON.stringify(segundo)).toBe(true);
    if (!segundo.ok) throw new Error("inalcanzable");

    // MISMA clave, no una nueva: no hay "huerfano del primer intento" que
    // borrar, porque nunca hubo una segunda clave que compitiera con ella.
    expect(
      segundo.documento.fileKey,
      "el reintento reutiliza la MISMA clave, no genera una segunda",
    ).toBe(claveDelPrimerIntento);
    expect(await s3.inspeccionarObjeto(segundo.documento.fileKey)).not.toBeNull();
    expect(await prisma.document.count({ where: { caseId: expediente.id } })).toBe(1);

    const filaFinal = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(filaFinal!.finalKey).toBe(claveDelPrimerIntento);
    expect(filaFinal!.documentId).toBe(segundo.documento.id);
  }, 30_000);

  it("ventana 3 — si el borrado de la preparacion falla tras confirmar, el Document es valido AL INSTANTE; la preparacion sobrante desaparece EVENTUALMENTE, no al instante", async () => {
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-VENTANA-3");
    const actor = await actorInterno(org.id, expediente.id, owner.id);

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "staging-no-borra.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const enviarOriginal = s3.s3Client.send.bind(s3.s3Client);
    (s3.s3Client as { send: unknown }).send = async (cmd: unknown, ...resto: unknown[]) => {
      if (cmd instanceof DeleteObjectCommand) throw new Error("almacen caido para el borrado (inyectado)");
      return (enviarOriginal as (...a: unknown[]) => unknown)(cmd, ...resto);
    };

    let confirmacion;
    try {
      confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    } finally {
      (s3.s3Client as { send: unknown }).send = enviarOriginal;
    }

    // INMEDIATO: el Document y su objeto final son validos ya, aunque el
    // borrado de la preparacion haya fallado.
    expect(confirmacion.ok, JSON.stringify(confirmacion)).toBe(true);
    if (!confirmacion.ok) throw new Error("inalcanzable");
    expect(await s3.inspeccionarObjeto(confirmacion.documento.fileKey)).not.toBeNull();

    const pendiente = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(pendiente!.status).toBe("COMPLETED");
    expect(pendiente!.stagingDeletedAt).toBeNull();
    expect(
      await s3.inspeccionarObjeto(pendiente!.stagingKey),
      "la preparacion sigue ahi justo tras el fallo: NO es un borrado instantaneo",
    ).not.toBeNull();

    const resumen = await subidas.limpiarSubidasCaducadas();
    expect(resumen.errores).toBe(0);
    expect(
      await s3.inspeccionarObjeto(pendiente!.stagingKey),
      "la limpieza borra la preparacion sobrante EVENTUALMENTE",
    ).toBeNull();
    const pendienteTrasLimpieza = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(pendienteTrasLimpieza!.stagingDeletedAt).not.toBeNull();
    expect(
      await s3.inspeccionarObjeto(confirmacion.documento.fileKey),
      "el objeto final del Document sigue intacto: la limpieza nunca toca la clave FINAL de un COMPLETED",
    ).not.toBeNull();
  }, 30_000);

  it("ventana 4 — el proceso se cae tras escribir el objeto final y antes de comprometer la transaccion: la limpieza recupera el huerfano y la fila", async () => {
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-VENTANA-4");
    const actor = await actorInterno(org.id, expediente.id, owner.id);

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "caida-antes-commit.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    const filaAntes = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    const stagingKey = filaAntes!.stagingKey;

    /*
     * Se reconstruye a mano lo que deja una caida EXACTAMENTE en ese punto:
     * el objeto final ya escrito de verdad (misma primitiva que usa
     * `confirmarSubida`) y la fila apuntandolo (la misma escritura previa a
     * la transaccion que la hace sobrevivir a la caida) — pero SIN que la
     * transaccion llegue a ejecutarse nunca.
     */
    const { buildFileKey } = await import("../../src/lib/file-policy");
    const finalKey = buildFileKey({ orgId: org.id, caseId: expediente.id, fileName: "caida-antes-commit.pdf" });
    await s3.crearObjetoSiNoExiste(finalKey, pdfDe(1024), "application/pdf");
    await prisma.pendingUpload.update({ where: { id: autorizacion.uploadId }, data: { finalKey } });

    expect(await s3.inspeccionarObjeto(finalKey), "el objeto final huerfano existe de verdad").not.toBeNull();

    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const resumen = await subidas.limpiarSubidasCaducadas();

    expect(resumen.errores).toBe(0);
    expect(await s3.inspeccionarObjeto(finalKey), "el objeto final huerfano desaparece").toBeNull();
    expect(await s3.inspeccionarObjeto(stagingKey), "la preparacion tambien desaparece").toBeNull();
    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).toBeNull();
    expect(await prisma.document.count({ where: { caseId: expediente.id } })).toBe(0);
  }, 30_000);

  it("ventana 5 — el proceso se cae tras comprometer la transaccion y antes de borrar la preparacion: la limpieza la recupera sin tocar el Document", async () => {
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-VENTANA-5");
    const actor = await actorInterno(org.id, expediente.id, owner.id);

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "caida-tras-commit.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    const confirmacion = await subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
    if (!confirmacion.ok) throw new Error("la confirmacion deberia funcionar");

    const filaConfirmada = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
    expect(filaConfirmada!.status).toBe("COMPLETED");

    /*
     * `confirmarSubida` ya borro la preparacion (caso normal, sin fallo). Para
     * reproducir el estado EXACTO que deja una caida justo ANTES de ese
     * borrado —Document y COMPLETED ya comprometidos, preparacion todavia en
     * el almacen—, se vuelve a escribir el mismo objeto de preparacion (misma
     * primitiva, `uploadFile`, que usa el resto del modulo) y se revierte
     * `stagingDeletedAt`, sin tocar nada del lado del Document.
     */
    await s3.uploadFile(filaConfirmada!.stagingKey, pdfDe(1024), "application/pdf");
    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { stagingDeletedAt: null },
    });
    expect(await s3.inspeccionarObjeto(filaConfirmada!.stagingKey)).not.toBeNull();

    const resumen = await subidas.limpiarSubidasCaducadas();

    expect(resumen.errores).toBe(0);
    expect(
      await s3.inspeccionarObjeto(filaConfirmada!.stagingKey),
      "la preparacion sobrante desaparece",
    ).toBeNull();
    expect(
      await s3.inspeccionarObjeto(confirmacion.documento.fileKey),
      "el objeto final del Document sigue intacto",
    ).not.toBeNull();
    const doc = await prisma.document.findUnique({ where: { id: confirmacion.documento.id } });
    expect(doc).not.toBeNull();
  }, 30_000);

  it("ventana 6 — repetir la limpieza tras recuperar un huerfano final es idempotente: la segunda pasada no encuentra nada que hacer ni falla", async () => {
    const { org, owner } = await createOrg();
    const expediente = await createCase(org.id, "EXP-VENTANA-6");
    const actor = await actorInterno(org.id, expediente.id, owner.id);

    const autorizacion = await subidas.autorizarSubida({ actor, fileName: "idempotencia.pdf", size: 1024 });
    if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
    await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

    const { buildFileKey } = await import("../../src/lib/file-policy");
    const finalKey = buildFileKey({ orgId: org.id, caseId: expediente.id, fileName: "idempotencia.pdf" });
    await s3.crearObjetoSiNoExiste(finalKey, pdfDe(1024), "application/pdf");
    await prisma.pendingUpload.update({ where: { id: autorizacion.uploadId }, data: { finalKey } });
    await prisma.pendingUpload.update({
      where: { id: autorizacion.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const primera = await subidas.limpiarSubidasCaducadas();
    expect(primera.errores).toBe(0);
    expect(await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } })).toBeNull();
    expect(await s3.inspeccionarObjeto(finalKey)).toBeNull();

    // Repetir de inmediato: la fila ya no existe, no hay nada que reclamar, y
    // no debe fallar ni contar nada de mas.
    const segunda = await subidas.limpiarSubidasCaducadas();
    expect(segunda.errores).toBe(0);
  }, 30_000);

  it(
    "RACE: una confirmacion RETRASADA que llega DESPUES de que la otra ya comprometio su transaccion no corrompe el puntero de la ganadora",
    async () => {
      /*
       * La asercion "confirmaciones simultaneas crean UN documento" (arriba)
       * usa Promise.all sin ningun control de orden: en la practica ambas
       * ramas avanzan casi a la par y el apunte previo de `finalKey` de cada
       * una llega ANTES de que la otra comprometa su transaccion. Eso no
       * demuestra nada sobre el orden CONTRARIO: una rama retrasada —se quedo
       * esperando en cualquiera de los `await` de camino, sin haber fallado
       * aun— cuyo apunte previo de `finalKey` llega DESPUES de que la otra ya
       * comprometio su `Document`. Se fuerza ese orden EXACTO con dos barreras
       * deterministas, sin sleeps, sobre llamadas reales a MinIO:
       *
       *   1. Se intercepta el PRIMER `HeadObjectCommand` real (la
       *      inspeccion inicial de `confirmarSubida`) y se detiene ahi: es la
       *      rama B, lanzada primero.
       *   2. Con B parada justo despues de leer la fila pero antes de tocarla
       *      mas, se deja correr A entera: escribe su objeto final, comete su
       *      transaccion (Document + COMPLETED + finalKey de A), y llega a
       *      borrar su preparacion — se intercepta ese PRIMER
       *      `DeleteObjectCommand` real y se detiene AHI TAMBIEN. Ese punto
       *      es la prueba de que la transaccion de A YA se comprometio (el
       *      borrado de preparacion, en el codigo, ocurre estrictamente
       *      DESPUES de comprometerla).
       *   3. Solo entonces se libera B: la preparacion sigue en el almacen
       *      (A esta parada justo antes de borrarla), asi que la lectura
       *      condicionada de B tiene exito y B sigue su camino normal:
       *      valida, apunta SU propia clave final, escribe su propio objeto,
       *      intenta su transaccion (pierde, `status` ya no es PENDING),
       *      borra su propio objeto y devuelve el documento de A.
       *   4. Se libera A al final, que termina de borrar su preparacion.
       *
       * Es el orden que la aseveracion original no cubria: ambas ramas SI
       * llegan a escribir su propio objeto final antes de disputar, pero el
       * apunte previo de B en la fila llega tarde a proposito.
       */
      const { org, owner } = await createOrg();
      const expediente = await createCase(org.id, "EXP-RACE-TARDIA");
      const actor = await actorInterno(org.id, expediente.id, owner.id);

      const autorizacion = await subidas.autorizarSubida({ actor, fileName: "carrera-tardia.pdf", size: 1024 });
      if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
      await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

      const { HeadObjectCommand, ListObjectsV2Command } = await import("@aws-sdk/client-s3");

      let soltarB!: () => void;
      const barreraB = new Promise<void>((r) => (soltarB = r));
      let bAlcanzoInspeccion!: () => void;
      const bAlcanzoInspeccionP = new Promise<void>((r) => (bAlcanzoInspeccion = r));

      let soltarABorradoStaging!: () => void;
      const barreraABorradoStaging = new Promise<void>((r) => (soltarABorradoStaging = r));
      let aAlcanzoBorradoStaging!: () => void;
      const aAlcanzoBorradoStagingP = new Promise<void>((r) => (aAlcanzoBorradoStaging = r));

      let primerHead = true;
      let primerDelete = true;
      const enviarOriginal = s3.s3Client.send.bind(s3.s3Client);
      (s3.s3Client as { send: unknown }).send = async (cmd: unknown, ...resto: unknown[]) => {
        if (primerHead && cmd instanceof HeadObjectCommand) {
          primerHead = false;
          bAlcanzoInspeccion();
          await barreraB;
        }
        if (primerDelete && cmd instanceof DeleteObjectCommand) {
          primerDelete = false;
          aAlcanzoBorradoStaging();
          await barreraABorradoStaging;
        }
        return (enviarOriginal as (...a: unknown[]) => unknown)(cmd, ...resto);
      };

      // B arranca primero y se para justo tras inspeccionar.
      const promesaB = subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
      await bAlcanzoInspeccionP;

      // A corre entera (su HeadObject NO se intercepta: ya se consumio el
      // "primerHead" con B) hasta quedarse parada justo antes de borrar SU
      // preparacion — lo que prueba que su transaccion YA se comprometio.
      const promesaA = subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
      await aAlcanzoBorradoStagingP;

      // Con la transaccion de A ya comprometida y su preparacion todavia sin
      // borrar, se libera B: su lectura condicionada de la preparacion (que
      // sigue ahi) tiene exito, y sigue su camino completo.
      soltarB();
      const b = await promesaB;

      // Se libera A al final.
      soltarABorradoStaging();
      const a = await promesaA;

      (s3.s3Client as { send: unknown }).send = enviarOriginal;

      // ── Aserciones exigidas ──────────────────────────────────────────────
      expect(a.ok, JSON.stringify(a)).toBe(true);
      expect(b.ok, JSON.stringify(b)).toBe(true);
      if (!a.ok || !b.ok) throw new Error("inalcanzable");

      expect(a.documento.id).toBe(b.documento.id);
      expect([a.yaConfirmada, b.yaConfirmada].filter(Boolean)).toHaveLength(1);

      // Exactamente UN Document para este expediente.
      expect(await prisma.document.count({ where: { caseId: expediente.id } })).toBe(1);

      // La fila apunta al Document ganador Y A SU OBJETO FINAL REAL — no al
      // de la rama retrasada, aunque el apunte previo de esta ultima llegara
      // despues de comprometida la transaccion.
      const filaFinal = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
      expect(filaFinal!.documentId).toBe(a.documento.id);
      expect(
        filaFinal!.finalKey,
        "el puntero de la fila no debe corromperse con la clave de la rama retrasada",
      ).toBe(a.documento.fileKey);
      expect(filaFinal!.status).toBe("COMPLETED");

      // Exactamente UN objeto final bajo el prefijo del expediente, y es el
      // del Document — nada de la rama que perdio queda sin rastro.
      const claves = await s3.s3Client.send(
        new ListObjectsV2Command({ Bucket: BUCKET!, Prefix: `${org.id}/${expediente.id}/interno/` }),
      );
      expect(
        (claves.Contents ?? []).length,
        "exactamente un objeto final: nada huerfano de la rama retrasada",
      ).toBe(1);
      expect(claves.Contents![0].Key).toBe(a.documento.fileKey);

      // El objeto final del Document es real y legible.
      expect(await s3.inspeccionarObjeto(a.documento.fileKey)).not.toBeNull();

      // La preparacion se borro (ambas ramas la dan por resuelta al confirmar
      // con exito).
      const pendienteOriginal = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
      if (pendienteOriginal?.stagingKey) {
        expect(await s3.inspeccionarObjeto(pendienteOriginal.stagingKey)).toBeNull();
      }

      // La limpieza, ejecutada dos veces tras la carrera, es idempotente y no
      // encuentra nada que reclamar: la fila esta COMPLETED y su clave final
      // es la correcta.
      const l1 = await subidas.limpiarSubidasCaducadas();
      expect(l1.errores).toBe(0);
      const l2 = await subidas.limpiarSubidasCaducadas();
      expect(l2.errores).toBe(0);
      expect(await s3.inspeccionarObjeto(a.documento.fileKey), "la limpieza no toca el objeto final vivo").not.toBeNull();
      expect(await prisma.document.findUnique({ where: { id: a.documento.id } })).not.toBeNull();
    },
    30_000,
  );

  it(
    "RACE COMPUESTA: dos confirmaciones RAPIDAS escriben cada una su propio objeto ANTES de disputar, y el borrado compensatorio de quien pierde TAMBIEN falla",
    async () => {
      /*
       * Composicion de dos propiedades ya establecidas por separado, no una
       * hipotesis nueva: (1) una carrera RAPIDA —dos confirmaciones que
       * arrancan a la vez pueden ambas superar la asignacion de `finalKey`
       * mientras `status` sigue PENDING—; (2) el `catch(YaReclamada)` de la
       * perdedora puede toparse con un borrado compensatorio que falla (ya se
       * probo aisladamente en la "ventana 2 (doble fallo)", antes de que
       * existiera clave compartida). Ninguna prueba anterior compone las dos:
       * si ambas ramas llegan a intentar escribir un objeto final ANTES de que
       * la transaccion se resuelva, y el borrado compensatorio de quien pierde
       * TAMBIEN falla, ¿queda algo sin rastro?
       *
       * Se fuerza con DOS BARRERAS DETERMINISTAS sobre `PutObjectCommand`
       * real —no con `Promise.all` a pelo ni con sleeps—, para no depender de
       * como el runtime decida entrelazar dos llamadas asincronas: se detiene
       * la PRIMERA y la SEGUNDA vez que `confirmarSubida` llega al intento de
       * escritura del objeto final (venga de quien venga), y sólo cuando
       * AMBAS han llegado ahi —comprobado, no asumido— se liberan. Así se
       * garantiza la precondicion exacta que pide la revision: las dos ramas
       * pasan la asignacion de `finalKey` mientras la fila sigue PENDING y
       * las dos intentan escribir, pase lo que pase despues con el orden de
       * sus transacciones.
       *
       * Ademas, se intercepta TODO `DeleteObjectCommand` sobre una clave que
       * NO sea de preparacion (la de preparacion tiene su propio mecanismo,
       * ya probado aparte) y se le hace fallar: bajo el flujo normal, sólo la
       * rama PERDEDORA llega a intentar ese borrado —la ganadora nunca borra
       * su propia clave final—, así que esto ataca exactamente el borrado
       * compensatorio de quien pierde, sea cual sea, sin necesidad de saber
       * de antemano cuál de las dos lo es.
       */
      const { org, owner } = await createOrg();
      const expediente = await createCase(org.id, "EXP-RACE-COMPUESTA-2");
      const actor = await actorInterno(org.id, expediente.id, owner.id);

      const autorizacion = await subidas.autorizarSubida({ actor, fileName: "compuesta-2.pdf", size: 1024 });
      if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
      await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

      const { PutObjectCommand, ListObjectsV2Command } = await import("@aws-sdk/client-s3");

      let intentosDeEscrituraFinal = 0;
      let soltarPrimero!: () => void;
      const barreraPrimero = new Promise<void>((r) => (soltarPrimero = r));
      let soltarSegundo!: () => void;
      const barreraSegundo = new Promise<void>((r) => (soltarSegundo = r));
      let primeroAlcanzado!: () => void;
      const primeroAlcanzadoP = new Promise<void>((r) => (primeroAlcanzado = r));
      let segundoAlcanzado!: () => void;
      const segundoAlcanzadoP = new Promise<void>((r) => (segundoAlcanzado = r));

      const enviarOriginal = s3.s3Client.send.bind(s3.s3Client);
      (s3.s3Client as { send: unknown }).send = async (cmd: unknown, ...resto: unknown[]) => {
        if (cmd instanceof PutObjectCommand) {
          intentosDeEscrituraFinal++;
          if (intentosDeEscrituraFinal === 1) {
            primeroAlcanzado();
            await barreraPrimero;
          } else if (intentosDeEscrituraFinal === 2) {
            segundoAlcanzado();
            await barreraSegundo;
          }
        }
        if (cmd instanceof DeleteObjectCommand) {
          const key = (cmd as unknown as { input?: { Key?: string } }).input?.Key;
          if (key && !key.includes("/preparacion/")) {
            throw new Error("almacen caido para el borrado compensatorio de la perdedora (inyectado)");
          }
        }
        return (enviarOriginal as (...a: unknown[]) => unknown)(cmd, ...resto);
      };

      const promesaA = subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });
      const promesaB = subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId });

      // Ninguna de las dos avanza mas alla de su propio intento de escritura
      // hasta que AMBAS lo hayan alcanzado — comprobado, no asumido.
      await primeroAlcanzadoP;
      await segundoAlcanzadoP;
      soltarPrimero();
      soltarSegundo();

      const [a, b] = await Promise.all([promesaA, promesaB]);

      (s3.s3Client as { send: unknown }).send = enviarOriginal;

      expect(
        intentosDeEscrituraFinal,
        "ambas ramas deben haber intentado escribir su objeto final",
      ).toBe(2);

      // ── Invariantes exigidos ─────────────────────────────────────────────
      expect(a.ok, JSON.stringify(a)).toBe(true);
      expect(b.ok, JSON.stringify(b)).toBe(true);
      if (!a.ok || !b.ok) throw new Error("inalcanzable");

      expect(a.documento.id).toBe(b.documento.id);
      expect([a.yaConfirmada, b.yaConfirmada].filter(Boolean)).toHaveLength(1);

      // Exactamente UN Document.
      expect(await prisma.document.count({ where: { caseId: expediente.id } })).toBe(1);

      // La fila apunta al Document ganador Y a su objeto final real.
      const filaFinal = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
      expect(filaFinal!.documentId).toBe(a.documento.id);
      expect(filaFinal!.finalKey).toBe(a.documento.fileKey);

      // El objeto del GANADOR sigue vivo e intacto: la perdedora nunca pudo
      // borrar bytes que no eran solo suyos.
      const cabeceraGanador = await s3.inspeccionarObjeto(a.documento.fileKey);
      expect(cabeceraGanador, "el objeto de la ganadora no lo borro la perdedora").not.toBeNull();
      expect(cabeceraGanador!.tamano).toBe(1024);

      // NINGUN objeto de la perdedora queda sin rastro: bajo el prefijo del
      // expediente sólo debe quedar el objeto del Document. Si la perdedora
      // hubiera escrito una clave DISTINTA y su borrado compensatorio fallara
      // sin ningun mecanismo de recuperacion, aqui aparecerian DOS objetos.
      const claves = await s3.s3Client.send(
        new ListObjectsV2Command({ Bucket: BUCKET!, Prefix: `${org.id}/${expediente.id}/interno/` }),
      );
      expect(
        (claves.Contents ?? []).length,
        "ningun objeto de la perdedora queda huerfano y sin rastro, ni siquiera con el borrado compensatorio fallando",
      ).toBe(1);
      expect(claves.Contents![0].Key).toBe(a.documento.fileKey);

      // La limpieza, tras la carrera, es idempotente y no toca el objeto vivo.
      const l1 = await subidas.limpiarSubidasCaducadas();
      expect(l1.errores).toBe(0);
      const l2 = await subidas.limpiarSubidasCaducadas();
      expect(l2.errores).toBe(0);
      expect(await s3.inspeccionarObjeto(a.documento.fileKey), "la limpieza no toca el objeto final vivo").not.toBeNull();
      expect(await prisma.document.findUnique({ where: { id: a.documento.id } })).not.toBeNull();
    },
    30_000,
  );

  it(
    "RACE COMPUESTA CON TRES: tres confirmaciones concurrentes convergen en UN documento, sin depender de quien gane",
    async () => {
      /*
       * La misma propiedad con N=3, sin ningun ajuste de temporizacion: si el
       * diseño depende de una carrera de exactamente dos, con tres deberia
       * romperse o dejar rastro. Se repite el mismo borrado compensatorio
       * fallido para TODAS las perdedoras a la vez.
       */
      const { org, owner } = await createOrg();
      const expediente = await createCase(org.id, "EXP-RACE-COMPUESTA-3");
      const actor = await actorInterno(org.id, expediente.id, owner.id);

      const autorizacion = await subidas.autorizarSubida({ actor, fileName: "compuesta-3.pdf", size: 1024 });
      if (!autorizacion.ok) throw new Error("la autorizacion deberia concederse");
      await escribirEnAlmacen({ url: autorizacion.uploadUrl, fields: autorizacion.fields }, pdfDe(1024));

      const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");

      const enviarOriginal = s3.s3Client.send.bind(s3.s3Client);
      (s3.s3Client as { send: unknown }).send = async (cmd: unknown, ...resto: unknown[]) => {
        if (cmd instanceof DeleteObjectCommand) {
          const key = (cmd as unknown as { input?: { Key?: string } }).input?.Key;
          if (key && !key.includes("/preparacion/")) {
            throw new Error("almacen caido para el borrado compensatorio de las perdedoras (inyectado)");
          }
        }
        return (enviarOriginal as (...a: unknown[]) => unknown)(cmd, ...resto);
      };

      const [a, b, c] = await Promise.all([
        subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId }),
        subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId }),
        subidas.confirmarSubida({ actor, uploadId: autorizacion.uploadId }),
      ]);

      (s3.s3Client as { send: unknown }).send = enviarOriginal;

      expect(a.ok, JSON.stringify(a)).toBe(true);
      expect(b.ok, JSON.stringify(b)).toBe(true);
      expect(c.ok, JSON.stringify(c)).toBe(true);
      if (!a.ok || !b.ok || !c.ok) throw new Error("inalcanzable");

      const ids = new Set([a.documento.id, b.documento.id, c.documento.id]);
      expect(ids.size, "las tres devuelven el MISMO documento").toBe(1);
      expect([a.yaConfirmada, b.yaConfirmada, c.yaConfirmada].filter(Boolean)).toHaveLength(2);

      expect(await prisma.document.count({ where: { caseId: expediente.id } })).toBe(1);

      const filaFinal = await prisma.pendingUpload.findUnique({ where: { id: autorizacion.uploadId } });
      expect(filaFinal!.documentId).toBe(a.documento.id);
      expect(filaFinal!.finalKey).toBe(a.documento.fileKey);
      expect(await s3.inspeccionarObjeto(a.documento.fileKey)).not.toBeNull();

      const claves = await s3.s3Client.send(
        new ListObjectsV2Command({ Bucket: BUCKET!, Prefix: `${org.id}/${expediente.id}/interno/` }),
      );
      expect(
        (claves.Contents ?? []).length,
        "con tres concurrentes, ningun objeto de las dos perdedoras queda huerfano",
      ).toBe(1);

      const l1 = await subidas.limpiarSubidasCaducadas();
      expect(l1.errores).toBe(0);
      const l2 = await subidas.limpiarSubidasCaducadas();
      expect(l2.errores).toBe(0);
    },
    30_000,
  );
});
