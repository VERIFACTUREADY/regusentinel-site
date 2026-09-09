/**
 * EL LIMITE DE SUBIDA, EN SUS CUATRO TAMANOS, POR LAS DOS RUTAS Y CON NAVEGADOR
 * DE VERDAD — Y LA PRUEBA DE QUE EL ARCHIVO NO PASA POR LA FUNCION.
 *
 * QUE SE PRUEBA Y POR QUE ES DISTINTO DE LO ANTERIOR
 * ---------------------------------------------------
 * La aplicacion promete «maximo 20 MB». Hasta ahora eso se comprobaba mandando
 * el archivo a la propia ruta de Next, y pasaba. Pero en produccion no podia
 * pasar: una funcion de Vercel admite **4,5 MB** de cuerpo de peticion, asi que
 * el archivo lo cortaba la entrada de la plataforma antes de llegar al codigo.
 * La prueba estaba comprobando algo que en el sitio donde importa no ocurre.
 *
 * Ahora el archivo va del NAVEGADOR al almacenamiento con una URL prefirmada, y
 * por la funcion solo pasa JSON pequeno. Estas pruebas lo conducen como una
 * persona —el control real de la pantalla, no una llamada al API— y ademas
 * vigilan el trafico para demostrar la propiedad que resuelve el bloqueo:
 *
 *   NINGUNA peticion al origen de la aplicacion supera los 4,5 MB de Vercel,
 *   y los bytes del archivo aparecen en un PUT dirigido al ALMACENAMIENTO.
 *
 * Si alguien volviera a hacer pasar el archivo por la funcion, esa vigilancia
 * lo caza aunque la subida siga «funcionando» en local.
 *
 * BYTES DE ARCHIVO, NO BYTES DE SOBRE
 * -----------------------------------
 * Los tamanos son los del ARCHIVO. El caso de 20 MiB EXACTOS es el que manda:
 * es el que la politica permite y el que un limite mal aplicado rechaza.
 *
 * NADA SE SIMULA
 * --------------
 * Navegador real, PostgreSQL real y MinIO real. La ausencia de un objeto se
 * demuestra comparando listados de claves que SI han funcionado, nunca con una
 * consulta fallida.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { type Page, type Request } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect, permitirFalloEn, pantallaUtil } from "./vigilancia";
import { E2E } from "./seed-e2e";
import { exigirAlmacen, objetoExiste, leerObjeto, listarClaves } from "./almacen";

const prisma = new PrismaClient();

const PDF_BYTES = readFileSync(path.join(__dirname, "fixtures", "documento-e2e.pdf"));

/** El maximo configurado: 20 * 1024 * 1024. Se escribe entero a proposito. */
const MAX_BYTES = 20 * 1024 * 1024; // 20 971 520

/** El texto exacto que la politica promete. Sin regex: se compara literal. */
const MENSAJE_413 = "El archivo supera el máximo de 20 MB.";

/** El techo de cuerpo de una funcion de Vercel. Es el motivo de todo esto. */
const LIMITE_VERCEL = Math.floor(4.5 * 1024 * 1024); // 4 718 592

const ALMACEN = process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000";

interface Tamano {
  etiqueta: string;
  bytes: number;
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

/** Un PDF valido de EXACTAMENTE `bytes` bytes. No se recorta ningun tamano. */
function pdfDe(bytes: number): Buffer {
  const b = Buffer.alloc(bytes, 0x41);
  PDF_BYTES.copy(b, 0);
  return b;
}

interface Vigilancia {
  /** PUT dirigidos al almacenamiento. */
  escriturasEnAlmacen: string[];
  /** Mayor cuerpo enviado al origen de la APLICACION. */
  mayorCuerpoALaApp: number;
}

/**
 * Anota el trafico para poder demostrar por donde van los bytes.
 *
 * Solo se mide el cuerpo de las peticiones a la aplicacion: leer el de un PUT
 * de 20 MiB al almacenamiento no aporta nada y cuesta memoria.
 */
function vigilarTrafico(page: Page): Vigilancia {
  const v: Vigilancia = { escriturasEnAlmacen: [], mayorCuerpoALaApp: 0 };

  page.on("request", (peticion: Request) => {
    const url = peticion.url();
    if (url.startsWith(ALMACEN)) {
      if (peticion.method() === "PUT") v.escriturasEnAlmacen.push(url);
      return;
    }
    if (!url.startsWith("http://127.0.0.1:3000")) return;
    try {
      const cuerpo = peticion.postDataBuffer();
      if (cuerpo && cuerpo.length > v.mayorCuerpoALaApp) v.mayorCuerpoALaApp = cuerpo.length;
    } catch {
      // Playwright no siempre expone el cuerpo. No se inventa un tamano.
    }
  });

  return v;
}

/** Lo que hay en el expediente antes de intentar la subida. */
async function foto(caseId: string, orgId: string) {
  return {
    documentos: await prisma.document.count({ where: { caseId } }),
    claves: (await listarClaves(`${orgId}/${caseId}/`)).sort(),
  };
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
    test(`${tamano.etiqueta} (${tamano.bytes} bytes) — ${tamano.aceptado ? "se acepta" : "se rechaza con el limite"}`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const orgId = await orgE2E();
      const caso = await casoPrincipal();
      const contenido = pdfDe(tamano.bytes);
      expect(contenido.length, "el fixture mide exactamente lo declarado").toBe(tamano.bytes);
      const nombre = `limite-ficha-${tamano.bytes}-${Date.now().toString().slice(-7)}.pdf`;

      await login(page, E2E.owner);
      const trafico = vigilarTrafico(page);
      permitirFalloEn(page, "/documents");

      await page.goto(`/cases/${caso.id}`);
      const pestana = page.getByRole("button", { name: /^Documentos \(/ });
      await expect(pestana).toBeVisible({ timeout: 30_000 });
      await pantallaUtil(page);
      await pestana.click();

      const antes = await foto(caso.id, orgId);

      // El control REAL de la pantalla, como lo usa una persona.
      await page.getByLabel("Subir documento").setInputFiles({
        name: nombre,
        mimeType: "application/pdf",
        buffer: contenido,
      });

      if (!tamano.aceptado) {
        await expect(page.getByTestId("toast-error")).toContainText(MENSAJE_413, {
          timeout: 60_000,
        });

        const despues = await foto(caso.id, orgId);
        expect(
          await prisma.document.findFirst({ where: { caseId: caso.id, fileName: nombre } }),
          "un intento rechazado no puede crear documento",
        ).toBeNull();
        expect(despues.documentos).toBe(antes.documentos);
        expect(despues.claves, "no deja ningun objeto nuevo").toEqual(antes.claves);
        // Se rechaza al pedir permiso: el archivo no llega ni a salir del navegador.
        expect(
          trafico.escriturasEnAlmacen,
          "un archivo por encima del maximo no debe escribirse en el almacen",
        ).toHaveLength(0);
        return;
      }

      await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 120_000 });

      const fila = await prisma.document.findFirst({
        where: { caseId: caso.id, fileName: nombre },
        include: { case: { select: { orgId: true } } },
      });
      expect(fila, "el documento aceptado se guarda").not.toBeNull();
      expect(fila!.case.orgId).toBe(orgId);
      expect(fila!.fileSize, "el tamano guardado es el real").toBe(tamano.bytes);
      expect(fila!.fileKey.startsWith(`${orgId}/${caso.id}/`)).toBe(true);

      expect(await objetoExiste(fila!.fileKey), "el objeto esta en el bucket").toBe(true);
      const guardado = await leerObjeto(fila!.fileKey);
      expect(guardado.length).toBe(tamano.bytes);
      expect(guardado.equals(contenido), "los bytes guardados son los enviados").toBe(true);

      // LA PROPIEDAD QUE RESUELVE EL BLOQUEO DE PRODUCCION.
      expect(
        trafico.escriturasEnAlmacen.length,
        "el archivo debe escribirse directamente en el almacenamiento",
      ).toBeGreaterThanOrEqual(1);
      expect(
        trafico.mayorCuerpoALaApp,
        `ninguna peticion a la aplicacion puede superar los ${LIMITE_VERCEL} bytes de Vercel`,
      ).toBeLessThan(LIMITE_VERCEL);

      // Y la lista y la descarga que ya existian siguen valiendo.
      const listado = await page.request.get(`/api/cases/${caso.id}/documents`);
      expect(listado.status()).toBe(200);
      const docs = (await listado.json()) as Array<{ fileName: string; downloadUrl: string }>;
      const enListado = docs.find((d) => d.fileName === nombre);
      expect(enListado, "el documento aparece al recargar la lista").toBeTruthy();
      const descarga = await page.request.get(enListado!.downloadUrl);
      expect(descarga.status()).toBe(200);
      expect((await descarga.body()).length, "la descarga trae el archivo entero").toBe(
        tamano.bytes,
      );
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
    test(`${tamano.etiqueta} (${tamano.bytes} bytes) — ${tamano.aceptado ? "se acepta" : "se rechaza con el limite"}`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const caso = await casoPortal();
      const contenido = pdfDe(tamano.bytes);
      expect(contenido.length, "el fixture mide exactamente lo declarado").toBe(tamano.bytes);
      const nombre = `limite-portal-${tamano.bytes}-${Date.now().toString().slice(-7)}.pdf`;

      permitirFalloEn(page, "/portal");
      const trafico = vigilarTrafico(page);
      await abrirPortal(page);

      const antes = await foto(caso.id, caso.orgId);

      await page.getByLabel(/Seleccionar archivo/).setInputFiles({
        name: nombre,
        mimeType: "application/pdf",
        buffer: contenido,
      });

      if (!tamano.aceptado) {
        await expect(page.getByTestId("portal-subida-error")).toContainText(MENSAJE_413, {
          timeout: 60_000,
        });

        const despues = await foto(caso.id, caso.orgId);
        expect(
          await prisma.document.findFirst({ where: { caseId: caso.id, fileName: nombre } }),
          "un intento rechazado no puede crear documento",
        ).toBeNull();
        expect(despues.documentos).toBe(antes.documentos);
        expect(despues.claves, "no deja ningun objeto nuevo").toEqual(antes.claves);
        expect(trafico.escriturasEnAlmacen).toHaveLength(0);
        return;
      }

      await expect(page.getByTestId("portal-subida-ok")).toContainText(/se ha enviado/i, {
        timeout: 120_000,
      });

      const fila = await prisma.document.findFirst({
        where: { caseId: caso.id, fileName: nombre },
        include: { case: { select: { orgId: true } } },
      });
      expect(fila, "el documento aceptado se guarda").not.toBeNull();
      expect(fila!.case.orgId).toBe(caso.orgId);
      expect(fila!.isPortalUpload, "el origen real queda registrado").toBe(true);
      expect(fila!.visibleToFamily, "lo ha subido la familia: puede verlo").toBe(true);
      expect(fila!.uploadedBy, "no lo ha subido ningun usuario del equipo").toBeNull();
      expect(fila!.fileSize).toBe(tamano.bytes);
      expect(fila!.fileKey).toContain(`/${caso.id}/portal/`);

      expect(await objetoExiste(fila!.fileKey)).toBe(true);
      const guardado = await leerObjeto(fila!.fileKey);
      expect(guardado.length).toBe(tamano.bytes);
      expect(guardado.equals(contenido)).toBe(true);

      expect(
        trafico.escriturasEnAlmacen.length,
        "el archivo debe escribirse directamente en el almacenamiento",
      ).toBeGreaterThanOrEqual(1);
      expect(
        trafico.mayorCuerpoALaApp,
        `ninguna peticion a la aplicacion puede superar los ${LIMITE_VERCEL} bytes de Vercel`,
      ).toBeLessThan(LIMITE_VERCEL);

      // La familia lo ve al recargar y se lo puede descargar entero.
      const listado = await page.request.get(`/api/portal/${PORTAL.token}/documents`);
      expect(listado.status()).toBe(200);
      const docs = (await listado.json()) as Array<{ fileName: string; downloadUrl: string }>;
      const enListado = docs.find((d) => d.fileName === nombre);
      expect(enListado, "el documento aparece al recargar el portal").toBeTruthy();
      const descarga = await page.request.get(enListado!.downloadUrl);
      expect(descarga.status()).toBe(200);
      expect((await descarga.body()).length).toBe(tamano.bytes);
    });
  }
});
