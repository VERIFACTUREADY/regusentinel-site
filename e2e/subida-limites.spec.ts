/**
 * EL LIMITE DE SUBIDA, EN SUS CUATRO TAMANOS, CONTRA LAS DOS RUTAS REALES.
 *
 * QUE SE PRUEBA Y POR QUE NO BASTABA LO QUE HABIA
 * ------------------------------------------------
 * La aplicacion promete «maximo 20 MB». Hasta ahora eso solo se comprobaba con
 * UN caso —21 MB desde la ficha— y mirando el aviso de la pantalla y que el
 * numero de documentos no cambiara. Eso deja sin demostrar lo que de verdad
 * importa:
 *
 *   - que el codigo HTTP sea 413 y no un 500 disfrazado de mensaje amable;
 *   - que el texto sea exactamente el que promete la politica;
 *   - que un archivo JUSTO EN EL LIMITE se acepte, y no se rechace de rebote;
 *   - que un rechazo no deje NADA: ni fila en la base ni objeto en el bucket.
 *
 * Y ese hueco ocultaba un defecto real. Next 15 trae un techo propio para el
 * cuerpo de la peticion —10 MB, `DEFAULT_BODY_CLONE_SIZE_LIMIT`— que Next 14 no
 * tenia, y al superarlo no responde un error: TRUNCA el cuerpo. `req.formData()`
 * recibia un multipart cortado y lanzaba. Medido contra estas mismas rutas,
 * antes de la correccion de `next.config.js`:
 *
 *   19,9 MiB  → 500 «Error al subir archivo»
 *   20 MiB    → 413 «El archivo supera el maximo de 20 MB»   ← EN EL LIMITE
 *
 * Es decir: no se admitia nada por encima de 10 MB, y el archivo de exactamente
 * 20 MB —permitido por la politica— se rechazaba. La prueba de 21 MB seguia en
 * verde porque el mensaje que esperaba salia igual, por el motivo equivocado.
 *
 * BYTES DE ARCHIVO, NO BYTES DE SOBRE
 * -----------------------------------
 * Los tamanos de aqui son los del ARCHIVO. El multipart anade su propio armazon
 * —separadores, cabeceras, nombre del campo— que viaja con el y no es archivo.
 * Por eso el caso de 20 MiB EXACTOS es el que manda: su sobre pasa del maximo
 * mientras el archivo no, y solo se acepta si el limite se aplica a lo que
 * corresponde.
 *
 * NADA SE SIMULA
 * --------------
 * Peticiones HTTP reales contra la aplicacion construida, PostgreSQL real y
 * MinIO real. No se mockea `req.formData()`, ni la respuesta, ni la base, ni el
 * almacenamiento. Que una consulta a S3 falle NO se acepta como prueba de que
 * el objeto no existe: se listan las claves del prefijo antes y despues y se
 * comparan, de modo que la ausencia se demuestra con un listado que SI ha
 * funcionado.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect, permitirFalloEn } from "./vigilancia";
import { E2E } from "./seed-e2e";
import { exigirAlmacen, objetoExiste, leerObjeto, listarClaves } from "./almacen";

const prisma = new PrismaClient();

const PDF_BYTES = readFileSync(path.join(__dirname, "fixtures", "documento-e2e.pdf"));

/** El maximo configurado: 20 * 1024 * 1024. Se escribe entero a proposito. */
const MAX_BYTES = 20 * 1024 * 1024; // 20 971 520

/** El texto exacto que la politica promete. Sin regex: se compara literal. */
const MENSAJE_413 = "El archivo supera el máximo de 20 MB.";

interface Tamano {
  etiqueta: string;
  bytes: number;
  /** `true` si la politica obliga a ACEPTARLO. */
  aceptado: boolean;
}

const TAMANOS: Tamano[] = [
  { etiqueta: "19,9 MiB", bytes: Math.floor(19.9 * 1024 * 1024), aceptado: true }, // 20 866 662
  { etiqueta: "20 MiB exactos (el limite)", bytes: MAX_BYTES, aceptado: true }, //     20 971 520
  { etiqueta: "20,5 MiB", bytes: Math.floor(20.5 * 1024 * 1024), aceptado: false }, // 21 495 808
  { etiqueta: "21 MiB", bytes: 21 * 1024 * 1024, aceptado: false }, //                 22 020 096
];

test.beforeAll(async () => {
  await exigirAlmacen();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Un PDF valido de EXACTAMENTE `bytes` bytes.
 *
 * La cabecera real va delante para que pase la validacion por contenido (los
 * primeros 4096 bytes son los que se miran); el resto es relleno. No se recorta
 * ningun tamano para que una prueba pase: son los cuatro que pide la politica.
 */
function pdfDe(bytes: number): Buffer {
  const b = Buffer.alloc(bytes, 0x41);
  PDF_BYTES.copy(b, 0);
  return b;
}

function nombreDe(ruta: string, bytes: number): string {
  return `limite-${ruta}-${bytes}-${Date.now().toString().slice(-7)}.pdf`;
}

async function orgE2E(): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { slug: E2E.orgSlug },
    select: { id: true },
  });
  if (!org) throw new Error("La organizacion de pruebas no existe: revisa el sembrado");
  return org.id;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', E2E.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

/** Estado del expediente antes de intentar la subida. */
async function foto(caseId: string, orgId: string) {
  return {
    documentos: await prisma.document.count({ where: { caseId } }),
    claves: (await listarClaves(`${orgId}/${caseId}/`)).sort(),
  };
}

/**
 * Comprobaciones comunes de un RECHAZO.
 *
 * Un 413 solo vale si ademas no ha dejado rastro: ni fila ni objeto. Un archivo
 * que llega a S3 y luego falla no es un rechazo limpio.
 */
async function exigirRechazoLimpio(params: {
  estado: number;
  cuerpo: { error?: string };
  nombre: string;
  caseId: string;
  antes: { documentos: number; claves: string[] };
  despues: { documentos: number; claves: string[] };
}) {
  const { estado, cuerpo, nombre, caseId, antes, despues } = params;

  expect(estado, "el limite se comunica con 413, no con un 500 generico").toBe(413);
  expect(cuerpo.error, "el mensaje es el que promete la politica, literal").toBe(MENSAJE_413);

  const fila = await prisma.document.findFirst({ where: { caseId, fileName: nombre } });
  expect(fila, "un intento rechazado no puede crear documento").toBeNull();
  expect(despues.documentos, "el numero de documentos no cambia").toBe(antes.documentos);

  // La ausencia se demuestra con un listado que ha funcionado, no con un fallo.
  expect(despues.claves, "un intento rechazado no deja ningun objeto nuevo").toEqual(antes.claves);
}

test.describe("Limite de subida: ficha del expediente", () => {
  async function casoPrincipal() {
    const c = await prisma.case.findFirst({
      where: { ref: E2E.caseRef, orgId: await orgE2E() },
      select: { id: true },
    });
    if (!c) throw new Error("El expediente de pruebas no existe: revisa el sembrado");
    return c;
  }

  for (const tamano of TAMANOS) {
    test(`${tamano.etiqueta} (${tamano.bytes} bytes) — ${tamano.aceptado ? "se acepta" : "se rechaza con 413"}`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const orgId = await orgE2E();
      const caso = await casoPrincipal();
      const contenido = pdfDe(tamano.bytes);
      expect(contenido.length, "el fixture mide exactamente lo declarado").toBe(tamano.bytes);

      const nombre = nombreDe("ficha", tamano.bytes);
      await login(page, E2E.owner);
      permitirFalloEn(page, "/documents");

      const antes = await foto(caso.id, orgId);

      const respuesta = await page.request.post(`/api/cases/${caso.id}/documents`, {
        multipart: {
          file: { name: nombre, mimeType: "application/pdf", buffer: contenido },
        },
        timeout: 180_000,
      });
      const estado = respuesta.status();
      const cuerpo = await respuesta.json().catch(() => ({}) as Record<string, unknown>);
      const despues = await foto(caso.id, orgId);

      if (!tamano.aceptado) {
        await exigirRechazoLimpio({ estado, cuerpo, nombre, caseId: caso.id, antes, despues });
        return;
      }

      expect(estado, `un archivo de ${tamano.bytes} bytes esta permitido`).toBe(201);

      const fila = await prisma.document.findFirst({
        where: { caseId: caso.id, fileName: nombre },
        include: { case: { select: { orgId: true } } },
      });
      expect(fila, "el documento aceptado se guarda").not.toBeNull();
      expect(fila!.case.orgId, "queda bajo la organizacion correcta").toBe(orgId);
      expect(fila!.fileSize, "el tamano guardado es el real").toBe(tamano.bytes);
      expect(fila!.fileKey.startsWith(`${orgId}/${caso.id}/`), "la clave no escapa del ambito").toBe(
        true,
      );

      // El objeto existe DE VERDAD y mide lo que debe.
      expect(await objetoExiste(fila!.fileKey), "el objeto esta en el bucket").toBe(true);
      const guardado = await leerObjeto(fila!.fileKey);
      expect(guardado.length, "el objeto mide los bytes enviados").toBe(tamano.bytes);
      expect(guardado.equals(contenido), "los bytes guardados son los enviados").toBe(true);

      // Y la recarga y la descarga que ya existian siguen valiendo.
      const listado = await page.request.get(`/api/cases/${caso.id}/documents`);
      expect(listado.status()).toBe(200);
      const docs = (await listado.json()) as Array<{
        fileName: string;
        downloadUrl: string;
      }>;
      const enListado = docs.find((d) => d.fileName === nombre);
      expect(enListado, "el documento aparece al recargar la lista").toBeTruthy();

      const descarga = await page.request.get(enListado!.downloadUrl);
      expect(descarga.status()).toBe(200);
      expect(
        (await descarga.body()).length,
        "la descarga trae el archivo entero",
      ).toBe(tamano.bytes);
    });
  }
});

test.describe("Limite de subida: portal familiar", () => {
  const PORTAL = E2E.documentos.portal;

  async function casoPortal() {
    const c = await prisma.case.findFirst({
      where: { ref: PORTAL.caseRef },
      select: { id: true, orgId: true },
    });
    if (!c) throw new Error("El expediente del portal no existe: revisa el sembrado");
    return c;
  }

  /**
   * Consentimiento aceptado por el camino real, con los controles del portal.
   *
   * No se escribe en la tabla a mano: la subida esta detras de esa puerta y
   * saltarsela probaria una ruta que en produccion nadie puede alcanzar.
   */
  async function abrirPortal(page: Page) {
    await page.goto(`/portal/${PORTAL.token}`);
    const casilla = page.getByRole("checkbox", { name: /He le[ií]do y acepto/ });
    const subir = page.getByLabel(/Seleccionar archivo/);
    await expect(casilla.or(subir).first()).toBeAttached({ timeout: 30_000 });

    if (await casilla.count()) {
      await page.getByText(/He le[ií]do y acepto el tratamiento/).click();
      await expect(casilla).toBeChecked();
      await page.getByRole("button", { name: /Aceptar y acceder al portal/ }).click();
    }
    await expect(page.getByLabel(/Seleccionar archivo/)).toBeAttached({ timeout: 30_000 });
  }

  for (const tamano of TAMANOS) {
    test(`${tamano.etiqueta} (${tamano.bytes} bytes) — ${tamano.aceptado ? "se acepta" : "se rechaza con 413"}`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const caso = await casoPortal();
      const contenido = pdfDe(tamano.bytes);
      expect(contenido.length, "el fixture mide exactamente lo declarado").toBe(tamano.bytes);

      const nombre = nombreDe("portal", tamano.bytes);
      permitirFalloEn(page, "/portal");
      await abrirPortal(page);

      const antes = await foto(caso.id, caso.orgId);

      const respuesta = await page.request.post(`/api/portal/${PORTAL.token}/documents`, {
        multipart: {
          file: { name: nombre, mimeType: "application/pdf", buffer: contenido },
        },
        timeout: 180_000,
      });
      const estado = respuesta.status();
      const cuerpo = await respuesta.json().catch(() => ({}) as Record<string, unknown>);
      const despues = await foto(caso.id, caso.orgId);

      if (!tamano.aceptado) {
        await exigirRechazoLimpio({ estado, cuerpo, nombre, caseId: caso.id, antes, despues });
        return;
      }

      expect(estado, `un archivo de ${tamano.bytes} bytes esta permitido`).toBe(201);

      const fila = await prisma.document.findFirst({
        where: { caseId: caso.id, fileName: nombre },
        include: { case: { select: { orgId: true } } },
      });
      expect(fila, "el documento aceptado se guarda").not.toBeNull();
      expect(fila!.case.orgId, "queda bajo la organizacion del expediente").toBe(caso.orgId);
      expect(fila!.isPortalUpload, "el origen real queda registrado").toBe(true);
      expect(fila!.fileSize, "el tamano guardado es el real").toBe(tamano.bytes);
      expect(fila!.fileKey).toContain(`/${caso.id}/portal/`);

      expect(await objetoExiste(fila!.fileKey), "el objeto esta en el bucket").toBe(true);
      const guardado = await leerObjeto(fila!.fileKey);
      expect(guardado.length, "el objeto mide los bytes enviados").toBe(tamano.bytes);
      expect(guardado.equals(contenido), "los bytes guardados son los enviados").toBe(true);

      // La familia lo ve al recargar y se lo puede descargar entero.
      const listado = await page.request.get(`/api/portal/${PORTAL.token}/documents`);
      expect(listado.status()).toBe(200);
      const docs = (await listado.json()) as Array<{ fileName: string; downloadUrl: string }>;
      const enListado = docs.find((d) => d.fileName === nombre);
      expect(enListado, "el documento aparece al recargar el portal").toBeTruthy();

      const descarga = await page.request.get(enListado!.downloadUrl);
      expect(descarga.status()).toBe(200);
      expect((await descarga.body()).length, "la descarga trae el archivo entero").toBe(
        tamano.bytes,
      );
    });
  }
});
