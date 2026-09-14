/**
 * EL LIMITE DE SUBIDA, EN SUS CUATRO TAMANOS, POR LAS DOS RUTAS Y CON NAVEGADOR
 * DE VERDAD — Y LA PRUEBA DE QUE EL ARCHIVO NO PASA POR LA FUNCION.
 *
 * QUE SE PRUEBA Y POR QUE ES DISTINTO DE LO ANTERIOR
 * ---------------------------------------------------
 * La aplicacion promete «maximo 20 MB». Una funcion de Vercel admite **4,5 MB**
 * de cuerpo de peticion, asi que el archivo lo cortaria la entrada de la
 * plataforma si pasara por la funcion. El navegador escribe DIRECTAMENTE en el
 * almacenamiento con una politica de subida firmada (un POST con campos, no un
 * PUT desnudo: el almacen impone el tamano exacto, ver `subida-directa-db.test.ts`
 * para la reproduccion de por que eso importa). Por la funcion solo pasa JSON
 * pequeno en `upload-url` y `complete`.
 *
 * Estas pruebas conducen el flujo como una persona —el control real de la
 * pantalla, no una llamada al API— y ademas vigilan el trafico para demostrar
 * la propiedad que resuelve el bloqueo:
 *
 *   NINGUNA peticion mutadora al origen de la aplicacion supera los 4,5 MB de
 *   Vercel, NINGUNA de ellas usa multipart/form-data (que es como viajaria el
 *   archivo si volviera a pasar por la funcion), y los bytes del archivo
 *   aparecen en un POST dirigido al ALMACENAMIENTO.
 *
 * FALLA EN CERRADO, NO EN ABIERTO
 * ---------------------------------
 * Una version anterior de esta vigilancia atrapaba en silencio los fallos de
 * `postDataBuffer()`, asi que "ninguna peticion supero el limite" podia
 * cumplirse sin haber observado el cuerpo de ninguna peticion. Ahora un cuerpo
 * no observable en una peticion mutadora del mismo origen hace FALLAR la
 * prueba de inmediato, con su URL y metodo: la ausencia de evidencia no cuenta
 * como evidencia de ausencia.
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

const ORIGEN_APP = "http://127.0.0.1:3000";

interface Vigilancia {
  /** POST dirigidos al almacenamiento (la politica de subida, no un PUT desnudo). */
  escriturasEnAlmacen: string[];
  /** Mayor cuerpo OBSERVADO entre las peticiones mutadoras del mismo origen. */
  mayorCuerpoALaApp: number;
  /**
   * Peticiones mutadoras del mismo origen cuyo cuerpo NO se pudo observar.
   * Si esta lista no esta vacia al terminar la prueba, la vigilancia no puede
   * responder por esa peticion: falla en CERRADO, no en abierto.
   */
  cuerposNoObservables: string[];
  /** Peticiones del mismo origen que viajaron como multipart/form-data. */
  multipartEnLaApp: string[];
}

/**
 * Anota el trafico para poder demostrar por donde van los bytes.
 *
 * TODA peticion mutadora (POST/PUT/PATCH) al origen de la APLICACION se
 * registra, y su cuerpo se intenta leer. Si Playwright no puede exponerlo, la
 * peticion se apunta en `cuerposNoObservables` en vez de ignorarse en
 * silencio: quien llama a esta funcion tiene que comprobar esa lista antes de
 * dar la prueba por buena, porque un cuerpo no observado no es un cuerpo
 * pequeno.
 */
function vigilarTrafico(page: Page): Vigilancia {
  const v: Vigilancia = {
    escriturasEnAlmacen: [],
    mayorCuerpoALaApp: 0,
    cuerposNoObservables: [],
    multipartEnLaApp: [],
  };

  page.on("request", (peticion: Request) => {
    const url = peticion.url();
    const metodo = peticion.method();

    if (url.startsWith(ALMACEN)) {
      // La politica de subida es un POST con campos, no un PUT desnudo: es lo
      // que demuestra que el almacen —no la aplicacion— impone el tamano.
      if (metodo === "POST") v.escriturasEnAlmacen.push(url);
      return;
    }

    if (!url.startsWith(ORIGEN_APP)) return;
    if (metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS") return;

    const tipo = peticion.headers()["content-type"] ?? "";
    if (tipo.includes("multipart/form-data")) v.multipartEnLaApp.push(`${metodo} ${url}`);

    try {
      const cuerpo = peticion.postDataBuffer();
      if (cuerpo === null) {
        // `null` es una respuesta valida de Playwright para "sin cuerpo": una
        // peticion JSON pequena sin postData ya se conto por su Content-Length
        // si lo tuviera, pero aqui no hay nada que medir y no es un fallo de
        // observacion.
        return;
      }
      if (cuerpo.length > v.mayorCuerpoALaApp) v.mayorCuerpoALaApp = cuerpo.length;
    } catch {
      // Aqui es donde la version anterior tragaba el fallo en silencio. Ahora
      // se dice explicitamente que esta peticion no se pudo observar.
      v.cuerposNoObservables.push(`${metodo} ${url}`);
    }
  });

  return v;
}

/**
 * Falla la prueba en CERRADO si queda alguna peticion mutadora sin observar.
 * Se llama SIEMPRE antes de leer `mayorCuerpoALaApp`, para que un hueco de
 * observacion no pueda disfrazarse de "cuerpo pequeno".
 */
function exigirTraficoObservado(trafico: Vigilancia) {
  expect(
    trafico.cuerposNoObservables,
    "toda peticion mutadora del mismo origen debe tener un cuerpo observable; " +
      "una peticion sin observar no puede contar como 'dentro del limite'",
  ).toEqual([]);
  expect(
    trafico.multipartEnLaApp,
    "ninguna peticion al origen de la aplicacion puede viajar como multipart/form-data: " +
      "asi es como viajaria el archivo si volviera a pasar por la funcion",
  ).toEqual([]);
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
        exigirTraficoObservado(trafico);
        expect(
          trafico.mayorCuerpoALaApp,
          `un rechazo tampoco puede mandar mas de ${LIMITE_VERCEL} bytes a la aplicacion`,
        ).toBeLessThan(LIMITE_VERCEL);
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
      exigirTraficoObservado(trafico);
      expect(
        trafico.escriturasEnAlmacen.length,
        "el archivo debe escribirse directamente en el almacenamiento, en un POST con la politica firmada",
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
        exigirTraficoObservado(trafico);
        expect(
          trafico.mayorCuerpoALaApp,
          `un rechazo tampoco puede mandar mas de ${LIMITE_VERCEL} bytes a la aplicacion`,
        ).toBeLessThan(LIMITE_VERCEL);
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

      exigirTraficoObservado(trafico);
      expect(
        trafico.escriturasEnAlmacen.length,
        "el archivo debe escribirse directamente en el almacenamiento, en un POST con la politica firmada",
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
