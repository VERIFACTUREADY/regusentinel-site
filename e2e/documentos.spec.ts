/**
 * Documentos, conducidos como los conduce una persona, contra MinIO REAL.
 *
 * REGLA DE ESTA SUITE
 * -------------------
 * Ningun clic ni formulario se sustituye por `page.goto` ni por una llamada al
 * API. La unica excepcion, declarada en cada caso, es cuando lo que se prueba
 * es EXPRESAMENTE la segunda mitad del control de acceso: que el servidor
 * rechaza aunque la interfaz no ofrezca el boton.
 *
 * NADA SE SIMULA
 * --------------
 * La subida escribe en el MinIO que levanta la CI, la descarga trae los bytes
 * de vuelta por la URL prefirmada real y el borrado se comprueba tambien en el
 * bucket. Que la fila exista en la base NO se acepta como prueba de que el
 * archivo esta: es justo el fallo que se busca.
 *
 * DONDE ESTA CADA COSA (inventario real, no supuesto)
 * ---------------------------------------------------
 * `/documents` es una BIBLIOTECA: lista, busca, filtra por origen, pagina,
 * descarga y borra. NO sube — no existe ahi ningun control de alta. Se sube
 * desde la pestana Documentos de la ficha del expediente y desde el portal
 * familiar. Lo que no existe esta declarado en QA_MATRIX y no se inventa aqui.
 */
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect, permitirFalloEn, pantallaUtil } from "./vigilancia";
import { E2E } from "./seed-e2e";
import { exigirAlmacen, objetoExiste, leerObjeto } from "./almacen";

const prisma = new PrismaClient();

const FIXTURES = path.join(__dirname, "fixtures");
const PDF_RUTA = path.join(FIXTURES, "documento-e2e.pdf");
const PDF_BYTES = readFileSync(PDF_RUTA);

test.afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Antes de nada, que haya almacenamiento.
 *
 * Sin esto el primer fallo seria un 500 opaco en mitad de una subida y costaria
 * entender que lo que falta es MinIO, no la aplicacion.
 */
test.beforeAll(async () => {
  await exigirAlmacen();
});

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

/** Id de la organizacion de pruebas. */
async function orgE2E(): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { slug: E2E.orgSlug },
    select: { id: true },
  });
  if (!org) throw new Error("La organizacion de pruebas no existe: revisa el sembrado");
  return org.id;
}

/** El expediente principal, donde se suben los documentos. */
async function casoPrincipal() {
  const c = await prisma.case.findFirst({
    where: { ref: E2E.caseRef, orgId: await orgE2E() },
    select: { id: true, ref: true },
  });
  if (!c) throw new Error("El expediente de pruebas no existe: revisa el sembrado");
  return c;
}

/**
 * Abre la pestana Documentos de la ficha usando los controles reales.
 *
 * La pestana lleva su contador en el nombre accesible ("Documentos (38)"), asi
 * que se pide por expresion regular y no por texto exacto.
 */
async function abrirPestanaDocumentos(page: Page, caseId: string) {
  await page.goto(`/cases/${caseId}`);
  const pestana = page.getByRole("button", { name: /^Documentos \(/ });
  await expect(pestana).toBeVisible({ timeout: 30_000 });
  await pantallaUtil(page);
  await pestana.click();
}

/** Nombre unico por ejecucion, para que dos pruebas no se pisen. */
function nombreUnico(sufijo: string) {
  return `${E2E.documentos.prefijo}-${sufijo}-${Date.now().toString().slice(-7)}.pdf`;
}

/**
 * Sube el PDF de prueba desde la ficha con el nombre indicado.
 *
 * `setInputFiles` con un `buffer` es la forma de conducir un `<input type=file>`
 * real: es exactamente lo que hace el navegador cuando el usuario elige un
 * archivo en el dialogo del sistema, que Playwright no puede abrir.
 */
async function subirDesdeFicha(page: Page, nombre: string, contenido: Buffer = PDF_BYTES) {
  await page.getByLabel("Subir documento").setInputFiles({
    name: nombre,
    mimeType: "application/pdf",
    buffer: contenido,
  });
}

/** La fila de la base correspondiente a un nombre de archivo. */
async function docEnBase(fileName: string) {
  return prisma.document.findFirst({
    where: { fileName },
    orderBy: { createdAt: "desc" },
  });
}

// ───────────────── Subida real: navegador → aplicacion → MinIO ─────────────────

test.describe("Documentos: subida real contra MinIO", () => {
  test("se sube desde la ficha y aparece en la interfaz, en la base y en el bucket", async ({
    page,
  }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("subida");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    await subirDesdeFicha(page, nombre);

    // 1. La interfaz lo confirma…
    await expect(page.getByTestId("toast-exito")).toContainText(/se ha subido/i, {
      timeout: 30_000,
    });

    // 2. …y lo enseña en la lista del expediente.
    await expect(page.getByTestId("doc-ficha-nombre").filter({ hasText: nombre })).toHaveCount(1, {
      timeout: 20_000,
    });

    // 3. Existe el registro, colgando de ESTE expediente.
    const fila = await docEnBase(nombre);
    expect(fila, "el documento debe existir en la base").not.toBeNull();
    expect(fila!.caseId).toBe(caso.id);

    // 4. Y —lo que de verdad importa— el objeto esta en MinIO con los bytes
    //    exactos que se subieron. Sin esto, una fila en la base "demuestra"
    //    una subida que pudo no llegar nunca al almacenamiento.
    expect(await objetoExiste(fila!.fileKey), "el objeto debe existir en MinIO").toBe(true);
    const enBucket = await leerObjeto(fila!.fileKey);
    expect(enBucket.equals(PDF_BYTES), "los bytes del bucket deben ser los del archivo original").toBe(
      true,
    );
  });

  test("el documento subido tambien aparece en la biblioteca /documents", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("biblioteca");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toContainText(/se ha subido/i, {
      timeout: 30_000,
    });

    // Se navega con el menu, no con page.goto.
    await page.getByRole("link", { name: "Documentos", exact: true }).first().click();
    await page.waitForURL("**/documents", { timeout: 30_000 });
    await pantallaUtil(page);

    await page.getByLabel("Buscar documentos por nombre").fill(nombre);
    await expect(page.getByTestId("doc-nombre").filter({ hasText: nombre })).toHaveCount(1, {
      timeout: 20_000,
    });
    // Y enlaza con su expediente.
    await expect(page.getByRole("link", { name: caso.ref }).first()).toBeVisible();
  });

  test("los metadatos guardados son los reales, no los que declara el cliente", async ({
    page,
  }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("metadatos");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });

    const fila = await docEnBase(nombre);
    const owner = await prisma.user.findUnique({
      where: { email: E2E.owner },
      select: { id: true },
    });

    expect(fila!.fileName).toBe(nombre);
    expect(fila!.fileSize, "el tamaño es el real del contenido").toBe(PDF_BYTES.length);
    // El tipo lo decide el CONTENIDO (%PDF), no la cabecera que manda el cliente.
    expect(fila!.mimeType).toBe("application/pdf");
    expect(fila!.caseId).toBe(caso.id);
    expect(fila!.uploadedBy, "queda quien lo subio").toBe(owner!.id);
    expect(fila!.isPortalUpload, "subido por el equipo, no por la familia").toBe(false);
    expect(fila!.visibleToFamily, "un documento interno es privado por defecto").toBe(false);
    // La clave no lleva el nombre del usuario ni es adivinable, y vive bajo el
    // ambito de su organizacion y su expediente.
    expect(fila!.fileKey.startsWith(`${await orgE2E()}/${caso.id}/interno/`)).toBe(true);
    expect(fila!.fileKey).not.toContain(nombre);

    // Y la fecha se ve en la ficha.
    await expect(
      page.getByTestId("doc-ficha-nombre").filter({ hasText: nombre }),
    ).toHaveCount(1);
  });
});

// ───────────────────── Descarga: los mismos bytes de vuelta ─────────────────────

test.describe("Documentos: descarga de principio a fin", () => {
  test("descargar desde /documents devuelve exactamente los bytes subidos", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("descarga");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: "Documentos", exact: true }).first().click();
    await page.waitForURL("**/documents", { timeout: 30_000 });
    await page.getByLabel("Buscar documentos por nombre").fill(nombre);
    await expect(page.getByTestId("doc-nombre").filter({ hasText: nombre })).toHaveCount(1, {
      timeout: 20_000,
    });

    // Se pulsa el boton real; el flujo real pide la URL prefirmada al API y el
    // navegador se la descarga de MinIO.
    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: `Descargar ${nombre}` }).click(),
    ]);

    expect(descarga.suggestedFilename(), "el nombre del fichero descargado").toBe(nombre);

    const ruta = await descarga.path();
    expect(ruta, "la descarga debe producir un fichero").toBeTruthy();
    const bajado = await readFile(ruta!);

    // LO QUE IMPORTA: byte a byte.
    expect(bajado.length, "el tamaño debe coincidir").toBe(PDF_BYTES.length);
    expect(bajado.equals(PDF_BYTES), "los bytes descargados deben ser identicos").toBe(true);

    // Y no se ha anunciado ningun error por el camino.
    await expect(page.getByTestId("aviso-documentos-error")).toHaveCount(0);
  });

  test("descargar desde la ficha del expediente devuelve los mismos bytes", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("descarga-ficha");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });

    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("link", { name: `Descargar ${nombre}` }).click(),
    ]);

    const ruta = await descarga.path();
    const bajado = await readFile(ruta!);
    expect(bajado.equals(PDF_BYTES)).toBe(true);
  });

  test("si el servidor rechaza la descarga, se dice y no se finge exito", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("descarga-error");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: "Documentos", exact: true }).first().click();
    await page.waitForURL("**/documents", { timeout: 30_000 });
    await page.getByLabel("Buscar documentos por nombre").fill(nombre);
    await expect(page.getByTestId("doc-nombre").filter({ hasText: nombre })).toHaveCount(1, {
      timeout: 20_000,
    });

    permitirFalloEn(page, "/api/documents");
    await page.route("**/api/documents/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Fallo simulado del almacenamiento" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: `Descargar ${nombre}` }).click();

    await expect(page.getByTestId("aviso-documentos-error")).toContainText(
      /Fallo simulado del almacenamiento/i,
      { timeout: 20_000 },
    );
    // Y el boton vuelve a estar disponible: antes se quedaba apagado para
    // siempre porque `setDownloading(null)` no estaba en `finally`.
    await expect(page.getByRole("button", { name: `Descargar ${nombre}` })).toBeEnabled({
      timeout: 10_000,
    });
  });

  test("si la red se cae al descargar, se dice en vez de no hacer nada", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("descarga-red");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: "Documentos", exact: true }).first().click();
    await page.waitForURL("**/documents", { timeout: 30_000 });
    await page.getByLabel("Buscar documentos por nombre").fill(nombre);
    await expect(page.getByTestId("doc-nombre").filter({ hasText: nombre })).toHaveCount(1, {
      timeout: 20_000,
    });

    permitirFalloEn(page, "/api/documents");
    await page.route("**/api/documents/*", async (route) => {
      if (route.request().method() === "GET") await route.abort("failed");
      else await route.continue();
    });

    // El `catch {}` vacio hacia que esto no produjera absolutamente nada.
    await page.getByRole("button", { name: `Descargar ${nombre}` }).click();
    await expect(page.getByTestId("aviso-documentos-error")).toContainText(
      /No se ha podido descargar/i,
      { timeout: 20_000 },
    );
  });
});

// ───────────────────────────── Eliminacion ─────────────────────────────

test.describe("Documentos: eliminacion de principio a fin", () => {
  test("cancelar no borra; confirmar borra de la interfaz, de la base y del bucket", async ({
    page,
  }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("borrado");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });

    const fila = await docEnBase(nombre);
    const clave = fila!.fileKey;
    expect(await objetoExiste(clave)).toBe(true);

    await page.getByRole("link", { name: "Documentos", exact: true }).first().click();
    await page.waitForURL("**/documents", { timeout: 30_000 });
    await page.getByLabel("Buscar documentos por nombre").fill(nombre);
    const boton = page.getByRole("button", { name: `Eliminar ${nombre}` });
    await expect(boton).toBeVisible({ timeout: 20_000 });

    // 1. Pide confirmacion, y cancelar no borra nada.
    let mensaje = "";
    page.once("dialog", (d) => {
      mensaje = d.message();
      d.dismiss();
    });
    await boton.click();
    await expect(async () => {
      expect(mensaje, "el borrado debe pedir confirmacion").toContain(nombre);
    }).toPass({ timeout: 10_000 });
    expect(await prisma.document.count({ where: { id: fila!.id } })).toBe(1);
    expect(await objetoExiste(clave), "cancelar no puede tocar el bucket").toBe(true);
    await expect(boton).toBeVisible();

    // 2. Confirmar borra de verdad.
    page.once("dialog", (d) => d.accept());
    await boton.click();

    await expect(page.getByTestId("aviso-documentos-ok")).toContainText(/se ha eliminado/i, {
      timeout: 20_000,
    });
    await expect(boton).toHaveCount(0, { timeout: 20_000 });

    expect(await prisma.document.count({ where: { id: fila!.id } })).toBe(0);
    expect(await objetoExiste(clave), "el objeto debe desaparecer del bucket").toBe(false);
  });

  for (const caso of [
    { nombre: "un 403", estado: 403, cuerpo: { error: "No tienes permiso" }, texto: /No tienes permiso/i },
    { nombre: "un 404", estado: 404, cuerpo: { error: "Documento no encontrado" }, texto: /no encontrado/i },
    { nombre: "un 500", estado: 500, cuerpo: { error: "Error interno" }, texto: /Error interno/i },
  ]) {
    test(`si al eliminar llega ${caso.nombre}, se dice y la fila NO desaparece`, async ({
      page,
    }) => {
      const expediente = await casoPrincipal();
      const nombre = nombreUnico(`borrado${caso.estado}`);

      await login(page, E2E.owner);
      await abrirPestanaDocumentos(page, expediente.id);
      await subirDesdeFicha(page, nombre);
      await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });
      const fila = await docEnBase(nombre);

      await page.getByRole("link", { name: "Documentos", exact: true }).first().click();
      await page.waitForURL("**/documents", { timeout: 30_000 });
      await page.getByLabel("Buscar documentos por nombre").fill(nombre);
      const boton = page.getByRole("button", { name: `Eliminar ${nombre}` });
      await expect(boton).toBeVisible({ timeout: 20_000 });

      permitirFalloEn(page, "/api/documents");
      await page.route("**/api/documents/*", async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({
            status: caso.estado,
            contentType: "application/json",
            body: JSON.stringify(caso.cuerpo),
          });
        } else {
          await route.continue();
        }
      });

      page.once("dialog", (d) => d.accept());
      await boton.click();

      await expect(page.getByTestId("aviso-documentos-error")).toContainText(caso.texto, {
        timeout: 20_000,
      });
      await expect(page.getByTestId("aviso-documentos-ok")).toHaveCount(0);
      // Sigue en pantalla: un borrado que fallo no puede desaparecer visualmente.
      await expect(boton).toBeVisible();
      expect(await prisma.document.count({ where: { id: fila!.id } })).toBe(1);
      expect(await objetoExiste(fila!.fileKey)).toBe(true);
    });
  }

  test("si la red se cae al eliminar, se dice y el documento sigue ahi", async ({ page }) => {
    const expediente = await casoPrincipal();
    const nombre = nombreUnico("borrado-red");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, expediente.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });
    const fila = await docEnBase(nombre);

    await page.getByRole("link", { name: "Documentos", exact: true }).first().click();
    await page.waitForURL("**/documents", { timeout: 30_000 });
    await page.getByLabel("Buscar documentos por nombre").fill(nombre);
    const boton = page.getByRole("button", { name: `Eliminar ${nombre}` });
    await expect(boton).toBeVisible({ timeout: 20_000 });

    permitirFalloEn(page, "/api/documents");
    await page.route("**/api/documents/*", async (route) => {
      if (route.request().method() === "DELETE") await route.abort("failed");
      else await route.continue();
    });

    page.once("dialog", (d) => d.accept());
    await boton.click();

    await expect(page.getByTestId("aviso-documentos-error")).toContainText(
      /No se ha podido eliminar/i,
      { timeout: 20_000 },
    );
    await expect(boton).toBeVisible();
    expect(await prisma.document.count({ where: { id: fila!.id } })).toBe(1);
    expect(await objetoExiste(fila!.fileKey)).toBe(true);
  });

  test("si el almacenamiento no puede borrar, NO se anuncia el borrado", async ({ page }) => {
    /*
     * El caso mas traicionero: la aplicacion responde 502 porque el objeto
     * sigue en el bucket y por eso NO borra la fila. La interfaz tiene que
     * contarlo, no quitar la fila de la lista.
     */
    const expediente = await casoPrincipal();
    const nombre = nombreUnico("borrado-502");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, expediente.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });
    const fila = await docEnBase(nombre);

    await page.getByRole("link", { name: "Documentos", exact: true }).first().click();
    await page.waitForURL("**/documents", { timeout: 30_000 });
    await page.getByLabel("Buscar documentos por nombre").fill(nombre);
    const boton = page.getByRole("button", { name: `Eliminar ${nombre}` });
    await expect(boton).toBeVisible({ timeout: 20_000 });

    permitirFalloEn(page, "/api/documents");
    await page.route("**/api/documents/*", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({
            error:
              "No se pudo eliminar el archivo del almacenamiento. El documento queda marcado y se reintentará; no se ha borrado la referencia.",
          }),
        });
      } else {
        await route.continue();
      }
    });

    page.once("dialog", (d) => d.accept());
    await boton.click();

    await expect(page.getByTestId("aviso-documentos-error")).toContainText(
      /no se ha borrado la referencia/i,
      { timeout: 20_000 },
    );
    await expect(boton).toBeVisible();
    expect(await objetoExiste(fila!.fileKey)).toBe(true);
  });
});

// ───────────────────────── Errores de subida ─────────────────────────

test.describe("Documentos: errores de subida", () => {
  test("un archivo vacio se rechaza con un motivo comprensible", async ({ page }) => {
    const caso = await casoPrincipal();
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    const antes = await prisma.document.count({ where: { caseId: caso.id } });
    permitirFalloEn(page, "/documents");
    await page.getByLabel("Subir documento").setInputFiles({
      name: "vacio.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(0),
    });

    await expect(page.getByTestId("toast-error")).toContainText(/vac[ií]o/i, { timeout: 30_000 });
    expect(await prisma.document.count({ where: { caseId: caso.id } })).toBe(antes);
  });

  test("una extension no admitida se rechaza y dice cuales se aceptan", async ({ page }) => {
    const caso = await casoPrincipal();
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    const antes = await prisma.document.count({ where: { caseId: caso.id } });
    permitirFalloEn(page, "/documents");
    await page.getByLabel("Subir documento").setInputFiles({
      name: "hoja-de-calculo.xyz",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("contenido cualquiera"),
    });

    await expect(page.getByTestId("toast-error")).toContainText(/Formato no admitido/i, {
      timeout: 30_000,
    });
    expect(await prisma.document.count({ where: { caseId: caso.id } })).toBe(antes);
  });

  test("un ejecutable renombrado a .pdf se rechaza por su contenido", async ({ page }) => {
    /*
     * El cliente declara `application/pdf` y la extension es `.pdf`: lo unico
     * que lo delata son los bytes (MZ). Si esto pasara, cualquiera podria
     * guardar un binario en el almacenamiento de la gestoria.
     */
    const caso = await casoPrincipal();
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    const antes = await prisma.document.count({ where: { caseId: caso.id } });
    permitirFalloEn(page, "/documents");
    await page.getByLabel("Subir documento").setInputFiles({
      name: "factura.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x41, 0x42]),
    });

    await expect(page.getByTestId("toast-error")).toContainText(/ejecutable/i, { timeout: 30_000 });
    expect(await prisma.document.count({ where: { caseId: caso.id } })).toBe(antes);
  });

  test("un archivo demasiado grande se rechaza diciendo el limite", async ({ page }) => {
    // 21 MB de subida real: no entra en el tiempo por defecto de una prueba.
    test.setTimeout(150_000);
    const caso = await casoPrincipal();
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    const antes = await prisma.document.count({ where: { caseId: caso.id } });
    permitirFalloEn(page, "/documents");
    // 21 MB: por encima del maximo por defecto (20 MB).
    const grande = Buffer.alloc(21 * 1024 * 1024, 0x41);
    PDF_BYTES.copy(grande, 0);
    await page.getByLabel("Subir documento").setInputFiles({
      name: "enorme.pdf",
      mimeType: "application/pdf",
      buffer: grande,
    });

    await expect(page.getByTestId("toast-error")).toContainText(/supera el m[áa]ximo/i, {
      timeout: 60_000,
    });
    expect(await prisma.document.count({ where: { caseId: caso.id } })).toBe(antes);
  });

  test("un nombre con ruta y caracteres raros se limpia y no escapa del bucket", async ({
    page,
  }) => {
    const caso = await casoPrincipal();
    const marca = Date.now().toString().slice(-7);
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    await page.getByLabel("Subir documento").setInputFiles({
      name: `../../../etc/passwd-${marca}.pdf`,
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });

    const fila = await prisma.document.findFirst({
      where: { caseId: caso.id, fileName: { contains: marca } },
      orderBy: { createdAt: "desc" },
    });
    expect(fila, "el documento se guarda con el nombre saneado").not.toBeNull();
    expect(fila!.fileName).not.toContain("..");
    expect(fila!.fileName).not.toContain("/");
    // Y la clave sigue dentro del ambito de la organizacion y el expediente.
    expect(fila!.fileKey.startsWith(`${await orgE2E()}/${caso.id}/`)).toBe(true);
    expect(fila!.fileKey).not.toContain("..");
    expect(await objetoExiste(fila!.fileKey)).toBe(true);
  });

  test("si el servidor falla al subir, se dice y no aparece ningun documento", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("subida-500");
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    const antes = await prisma.document.count({ where: { caseId: caso.id } });
    permitirFalloEn(page, "/documents");
    /*
     * La subida ya no es una sola peticion: primero se pide permiso y luego se
     * confirma. Se intercepta el PRIMER salto, que es donde el servidor puede
     * negarse antes de que salga un solo byte.
     */
    await page.route(`**/api/cases/${caso.id}/documents/upload-url`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Error al subir archivo" }),
        });
      } else {
        await route.continue();
      }
    });

    await subirDesdeFicha(page, nombre);

    await expect(page.getByTestId("toast-error")).toContainText(/Error al subir archivo/i, {
      timeout: 30_000,
    });
    await expect(page.getByTestId("toast-exito")).toHaveCount(0);
    await expect(page.getByTestId("doc-ficha-nombre").filter({ hasText: nombre })).toHaveCount(0);
    expect(await prisma.document.count({ where: { caseId: caso.id } })).toBe(antes);
  });

  test("si la red se cae al subir, se dice y el control vuelve a estar disponible", async ({
    page,
  }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("subida-red");
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    permitirFalloEn(page, "/documents");
    await page.route(`**/api/cases/${caso.id}/documents/upload-url`, async (route) => {
      if (route.request().method() === "POST") await route.abort("failed");
      else await route.continue();
    });

    await subirDesdeFicha(page, nombre);

    await expect(page.getByTestId("toast-error")).toContainText(/No se ha podido subir/i, {
      timeout: 30_000,
    });
    // El control no se queda bloqueado en "Subiendo…".
    await expect(page.getByLabel("Subir documento")).toBeEnabled({ timeout: 15_000 });
  });

  test("si el almacenamiento no responde, se dice y no queda fila fantasma", async ({ page }) => {
    /*
     * MinIO caido se representa con el 502 que devuelve la aplicacion cuando el
     * almacenamiento no acepta el objeto. Lo que se comprueba es de la interfaz:
     * que lo cuenta y que no aparece un documento que no existe.
     */
    const caso = await casoPrincipal();
    const nombre = nombreUnico("subida-sin-almacen");
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    const antes = await prisma.document.count({ where: { caseId: caso.id } });
    permitirFalloEn(page, "/documents");
    /*
     * Se intercepta la CONFIRMACION, que es el paso que habla con el
     * almacenamiento (comprueba que el objeto esta y que pesa lo que debe).
     * El archivo llega a escribirse, pero sin confirmacion NO hay documento:
     * ese objeto queda como subida caducada y lo recoge la limpieza.
     */
    await page.route(`**/api/cases/${caso.id}/documents/complete`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ error: "El almacenamiento no esta disponible" }),
        });
      } else {
        await route.continue();
      }
    });

    await subirDesdeFicha(page, nombre);

    await expect(page.getByTestId("toast-error")).toContainText(
      /almacenamiento no esta disponible/i,
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("doc-ficha-nombre").filter({ hasText: nombre })).toHaveCount(0);
    expect(await prisma.document.count({ where: { caseId: caso.id } })).toBe(antes);
  });

  test("dos envios seguidos no suben el archivo dos veces", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("doble");
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    // El servidor retiene la subida seis segundos: asi el segundo intento cae
    // con seguridad mientras la primera sigue en vuelo, que es justo el doble
    // clic del usuario impaciente.
    let enVuelo = 0;
    /*
     * Se cuenta la AUTORIZACION: una por intento de subida. Un segundo clic
     * produciria una segunda, y eso es exactamente lo que no debe pasar.
     */
    await page.route(`**/api/cases/${caso.id}/documents/upload-url`, async (route) => {
      if (route.request().method() === "POST") {
        enVuelo++;
        await new Promise((r) => setTimeout(r, 6_000));
      }
      await route.continue();
    });

    const entrada = page.getByLabel("Subir documento");
    await entrada.setInputFiles({ name: nombre, mimeType: "application/pdf", buffer: PDF_BYTES });

    // Mientras sube, el control lo dice y no se deja usar: esa es la proteccion
    // que ve el usuario.
    await expect(page.getByText("Subiendo…")).toBeVisible({ timeout: 10_000 });

    // Y un segundo intento en ese momento no llega a ninguna parte.
    await entrada
      .setInputFiles(
        { name: nombre, mimeType: "application/pdf", buffer: PDF_BYTES },
        { timeout: 2_000 },
      )
      .catch(() => {
        // Esperado: el control esta deshabilitado mientras sube.
      });

    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });
    await expect(async () => {
      expect(await prisma.document.count({ where: { caseId: caso.id, fileName: nombre } })).toBe(1);
    }).toPass({ timeout: 20_000 });
    expect(enVuelo, "solo debe salir una peticion de subida").toBe(1);
  });
});

// ─────────────────────── Busqueda, filtros y paginacion ───────────────────────

test.describe("Documentos: busqueda y filtros", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);
  });

  test("la busqueda por nombre cambia la peticion Y los resultados", async ({ page }) => {
    const [peticion] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("/api/documents?") && r.url().includes("search="),
        { timeout: 25_000 },
      ),
      page.getByLabel("Buscar documentos por nombre").fill("unico-escritura"),
    ]);
    expect(peticion.url()).toContain("search=unico-escritura");

    await expect(async () => {
      const nombres = await page.getByTestId("doc-nombre").allTextContents();
      expect(nombres.length).toBeGreaterThan(0);
      expect(nombres).toContain(E2E.documentos.unico);
      // Y NO trae los que no casan.
      expect(nombres.every((n) => n.includes("unico-escritura"))).toBe(true);
    }).toPass({ timeout: 20_000 });
  });

  test("limpiar la busqueda devuelve la lista completa", async ({ page }) => {
    const total = await prisma.document.count({ where: { case: { orgId: await orgE2E() } } });

    await page.getByLabel("Buscar documentos por nombre").fill("unico-escritura");
    await expect(page.getByTestId("total-documentos")).toContainText("1 resultado", {
      timeout: 20_000,
    });

    await page.getByLabel("Buscar documentos por nombre").fill("");
    await expect(page.getByTestId("total-documentos")).toContainText(
      `${total.toLocaleString("es-ES")} resultado`,
      { timeout: 20_000 },
    );
  });

  test("el filtro Equipo cambia la peticion Y los resultados", async ({ page }) => {
    const [peticion] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("source=admin"), { timeout: 25_000 }),
      page.getByRole("button", { name: "Equipo", exact: true }).click(),
    ]);
    expect(peticion.url()).toContain("source=admin");

    const esperados = await prisma.document.count({
      where: { case: { orgId: await orgE2E() }, isPortalUpload: false },
    });
    await expect(page.getByTestId("total-documentos")).toContainText(
      `${esperados.toLocaleString("es-ES")} resultado`,
      { timeout: 20_000 },
    );
    // Ninguna fila visible puede venir de la familia. Se mira DENTRO de la
    // tabla: "Familia" es tambien el nombre de un boton de filtro, que sigue
    // ahi siempre.
    await expect(page.locator("tbody").getByText("Familia", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Equipo", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("el filtro Familia cambia la peticion Y los resultados", async ({ page }) => {
    const [peticion] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("source=portal"), { timeout: 25_000 }),
      page.getByRole("button", { name: "Familia", exact: true }).click(),
    ]);
    expect(peticion.url()).toContain("source=portal");

    const esperados = await prisma.document.count({
      where: { case: { orgId: await orgE2E() }, isPortalUpload: true },
    });
    await expect(page.getByTestId("total-documentos")).toContainText(
      `${esperados.toLocaleString("es-ES")} resultado`,
      { timeout: 20_000 },
    );
    // Y ninguna fila visible puede venir del equipo.
    await expect(page.locator("tbody").getByText("Equipo", { exact: true })).toHaveCount(0);
  });

  test("el filtro Todos vuelve a traerlo todo", async ({ page }) => {
    await page.getByRole("button", { name: "Familia", exact: true }).click();
    await expect(page.getByRole("button", { name: "Familia", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 20_000 },
    );

    await page.getByRole("button", { name: "Todos", exact: true }).click();
    const total = await prisma.document.count({ where: { case: { orgId: await orgE2E() } } });
    await expect(page.getByTestId("total-documentos")).toContainText(
      `${total.toLocaleString("es-ES")} resultado`,
      { timeout: 20_000 },
    );
  });

  test("busqueda y origen se combinan", async ({ page }) => {
    await page.getByRole("button", { name: "Equipo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Equipo", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 20_000 },
    );

    const [peticion] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("search=relleno") && r.url().includes("source=admin"),
        { timeout: 25_000 },
      ),
      page.getByLabel("Buscar documentos por nombre").fill("relleno"),
    ]);
    expect(peticion.url()).toContain("source=admin");

    const esperados = await prisma.document.count({
      where: {
        case: { orgId: await orgE2E() },
        isPortalUpload: false,
        fileName: { contains: "relleno", mode: "insensitive" },
      },
    });
    await expect(page.getByTestId("total-documentos")).toContainText(
      `${esperados.toLocaleString("es-ES")} resultado`,
      { timeout: 20_000 },
    );
  });

  test("sin resultados por filtro se dice que es por el filtro, no que no haya nada", async ({
    page,
  }) => {
    await page.getByLabel("Buscar documentos por nombre").fill("no-existe-este-documento-jamas");
    const vacio = page.getByTestId("carga-vacio");
    await expect(vacio).toBeVisible({ timeout: 20_000 });
    await expect(vacio).toContainText(/con los filtros aplicados/i);
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("un fallo del servidor NO se disfraza de biblioteca vacia", async ({ page }) => {
    permitirFalloEn(page, "/api/documents");
    await page.route("**/api/documents?**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Fallo del servidor" }),
      }),
    );

    await page.getByLabel("Buscar documentos por nombre").fill("relleno");

    await expect(page.getByTestId("carga-error")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("carga-vacio")).toHaveCount(0);
  });

  test("una sesion caducada se explica, no se disfraza de biblioteca vacia", async ({ page }) => {
    permitirFalloEn(page, "/api/documents");
    await page.route("**/api/documents?**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "No autenticado" }),
      }),
    );

    await page.getByLabel("Buscar documentos por nombre").fill("relleno");

    await expect(page.getByTestId("carga-error")).toContainText(/sesion ha caducado/i, {
      timeout: 20_000,
    });
  });
});

test.describe("Documentos: paginacion", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);
  });

  test("se recorren las paginas sin perder ni repetir documentos", async ({ page }) => {
    const total = await prisma.document.count({ where: { case: { orgId: await orgE2E() } } });
    expect(total, "el sembrado debe superar el limite de 30").toBeGreaterThan(30);
    const paginas = Math.ceil(total / 30);

    // Pagina 1.
    await expect(page.getByTestId("rango-documentos")).toContainText("1–30", { timeout: 20_000 });
    const pagina1 = await page.getByTestId("doc-nombre").allTextContents();
    expect(pagina1.length).toBe(30);

    // Siguiente.
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByTestId("rango-documentos")).toContainText("31–", { timeout: 20_000 });
    const pagina2 = await page.getByTestId("doc-nombre").allTextContents();
    // La ultima pagina trae el resto; una intermedia, otros treinta. El numero
    // de paginas depende de cuantos documentos hayan subido las pruebas
    // anteriores, asi que se calcula en vez de darlo por hecho.
    expect(pagina2.length).toBe(paginas === 2 ? total - 30 : 30);

    // Ni repetidos ni perdidos entre las dos primeras paginas.
    const repetidos = pagina2.filter((n) => pagina1.includes(n));
    expect(repetidos, "ningun documento puede salir en las dos paginas").toEqual([]);
    expect(new Set([...pagina1, ...pagina2]).size).toBe(pagina1.length + pagina2.length);

    /*
     * Anterior: EL DEFECTO. El `useEffect` solo pedia datos con `page > 1`, asi
     * que al volver a la primera pagina la tabla se quedaba con los documentos
     * de la segunda mientras el pie decia "1–30". Esta comprobacion falla con
     * el codigo anterior.
     */
    await page.getByRole("button", { name: "Anterior" }).click();
    await expect(page.getByTestId("rango-documentos")).toContainText("1–30", { timeout: 20_000 });
    await expect(async () => {
      const vuelta = await page.getByTestId("doc-nombre").allTextContents();
      expect(vuelta, "la primera pagina debe volver a mostrar SUS documentos").toEqual(pagina1);
    }).toPass({ timeout: 20_000 });
  });

  test("en la primera pagina no se puede ir atras, y en la ultima no adelante", async ({
    page,
  }) => {
    const total = await prisma.document.count({ where: { case: { orgId: await orgE2E() } } });
    const paginas = Math.ceil(total / 30);

    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled({ timeout: 20_000 });

    // Se avanza hasta la ultima, sea cual sea: el numero de paginas depende de
    // lo que hayan subido las pruebas anteriores.
    const siguiente = page.getByRole("button", { name: "Siguiente" });
    for (let i = 1; i < paginas; i++) {
      await siguiente.click();
      await expect(page.getByTestId("rango-documentos")).toContainText(
        `${i * 30 + 1}–`,
        { timeout: 20_000 },
      );
    }

    await expect(siguiente, "en la ultima pagina no se puede avanzar").toBeDisabled();
    await expect(page.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  test("al buscar, la paginacion se recalcula y vuelve a la primera pagina", async ({ page }) => {
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByTestId("rango-documentos")).toContainText("31–", { timeout: 20_000 });

    await page.getByLabel("Buscar documentos por nombre").fill("unico-escritura");

    await expect(page.getByTestId("total-documentos")).toContainText("1 resultado", {
      timeout: 20_000,
    });
    // Con un solo resultado no sobra pagina: el bloque desaparece.
    await expect(page.getByRole("button", { name: "Siguiente" })).toHaveCount(0);
    const nombres = await page.getByTestId("doc-nombre").allTextContents();
    expect(nombres).toEqual([E2E.documentos.unico]);
  });

  test("al filtrar por origen, la paginacion tambien se recalcula", async ({ page }) => {
    await page.getByRole("button", { name: "Familia", exact: true }).click();

    const esperados = await prisma.document.count({
      where: { case: { orgId: await orgE2E() }, isPortalUpload: true },
    });
    await expect(page.getByTestId("total-documentos")).toContainText(
      `${esperados.toLocaleString("es-ES")} resultado`,
      { timeout: 20_000 },
    );
    const nombres = await page.getByTestId("doc-nombre").allTextContents();
    expect(nombres.length).toBe(Math.min(30, esperados));
  });
});

// ─────────────────── Aislamiento entre organizaciones ───────────────────

test.describe("Documentos: aislamiento entre organizaciones", () => {
  /** El documento que pertenece a la OTRA organizacion. */
  async function documentoAjeno() {
    const doc = await prisma.document.findFirst({
      where: { fileName: E2E.orgAjena.documento },
      select: { id: true, fileKey: true, fileName: true, caseId: true },
    });
    if (!doc) throw new Error("El documento ajeno no existe: revisa el sembrado");
    return doc;
  }

  test("la biblioteca no lista ni un solo documento de la otra organizacion", async ({ page }) => {
    const ajeno = await documentoAjeno();

    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);

    // Ni buscandolo por su nombre exacto.
    await page.getByLabel("Buscar documentos por nombre").fill(E2E.orgAjena.documento);
    await expect(page.getByTestId("carga-vacio")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("doc-nombre").filter({ hasText: ajeno.fileName })).toHaveCount(0);
  });

  test("el servidor niega descargar, modificar y borrar un documento ajeno", async ({ page }) => {
    /*
     * Segunda mitad de la autorizacion: aqui NO hay boton que pulsar —el
     * documento no se lista siquiera—, asi que se llama al API directamente
     * desde la sesion ya iniciada. Es la excepcion declarada de esta suite.
     */
    const ajeno = await documentoAjeno();

    await login(page, E2E.owner);
    permitirFalloEn(page, "/api/documents");

    const get = await page.request.get(`/api/documents/${ajeno.id}`);
    expect(get.status(), "no se puede obtener enlace de descarga ajeno").toBe(404);
    const cuerpoGet = await get.text();
    // Y no se filtra ni el nombre del archivo ni la clave del bucket.
    expect(cuerpoGet).not.toContain(ajeno.fileName);
    expect(cuerpoGet).not.toContain(ajeno.fileKey);
    expect(cuerpoGet).not.toContain("downloadUrl");

    const patch = await page.request.patch(`/api/documents/${ajeno.id}`, {
      data: { visibleToFamily: true },
    });
    expect(patch.status()).toBe(404);

    const del = await page.request.delete(`/api/documents/${ajeno.id}`);
    expect(del.status()).toBe(404);

    // Nada de esto puede haber cambiado el documento ajeno.
    const sigue = await prisma.document.findUnique({ where: { id: ajeno.id } });
    expect(sigue, "el documento ajeno sigue existiendo").not.toBeNull();
    expect(sigue!.visibleToFamily).toBe(false);
  });

  test("tampoco se puede listar ni subir en un expediente de la otra organizacion", async ({
    page,
  }) => {
    const ajeno = await documentoAjeno();

    await login(page, E2E.owner);
    permitirFalloEn(page, "/api/cases");

    const lista = await page.request.get(`/api/cases/${ajeno.caseId}/documents`);
    // El listado filtra por organizacion: nunca puede traer el documento ajeno.
    if (lista.ok()) {
      expect(await lista.text()).not.toContain(ajeno.fileName);
    } else {
      expect([403, 404]).toContain(lista.status());
    }

    /*
     * La subida ya no manda el archivo a la funcion: primero se pide permiso.
     * La barrera de tenencia esta ahi, que es donde se entrega la URL de
     * escritura. Sin permiso no hay a donde escribir.
     */
    const subida = await page.request.post(
      `/api/cases/${ajeno.caseId}/documents/upload-url`,
      { data: { fileName: "intruso.pdf", size: PDF_BYTES.length } },
    );
    expect(subida.status(), "no se puede subir a un expediente ajeno").toBe(404);
    expect(
      await prisma.document.count({ where: { caseId: ajeno.caseId, fileName: "intruso.pdf" } }),
    ).toBe(0);
  });
});

// ───────────────────────────────── Roles ─────────────────────────────────

test.describe("Documentos: roles", () => {
  /*
   * Politica REAL, comprobada en src/lib/rbac.ts antes de escribir nada:
   *   OWNER, MANAGER, OPERATOR y MANAGED_OPS → create, read, update y delete.
   *   VIEWER → solo los permisos que acaban en `.read`, es decir solo leer.
   * No se cambia el modelo para que encaje con una prueba.
   */
  for (const rol of [
    { nombre: "MANAGER", email: E2E.manager },
    { nombre: "OPERATOR", email: E2E.operador },
  ]) {
    test(`${rol.nombre} puede subir, descargar y eliminar`, async ({ page }) => {
      const caso = await casoPrincipal();
      const nombre = nombreUnico(`rol-${rol.nombre}`);

      await login(page, rol.email);
      await abrirPestanaDocumentos(page, caso.id);

      await subirDesdeFicha(page, nombre);
      await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });
      const fila = await docEnBase(nombre);
      expect(await objetoExiste(fila!.fileKey)).toBe(true);

      // Descarga con los mismos bytes.
      const [descarga] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.getByRole("link", { name: `Descargar ${nombre}` }).click(),
      ]);
      expect((await readFile((await descarga.path())!)).equals(PDF_BYTES)).toBe(true);

      // Y borrado.
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: `Eliminar documento: ${nombre}` }).click();
      await expect(page.getByTestId("toast-exito")).toContainText(/se ha eliminado/i, {
        timeout: 20_000,
      });
      await expect(async () => {
        expect(await prisma.document.count({ where: { id: fila!.id } })).toBe(0);
      }).toPass({ timeout: 20_000 });
      expect(await objetoExiste(fila!.fileKey)).toBe(false);
    });
  }

  test("VIEWER consulta y descarga, pero no se le ofrece subir ni borrar", async ({ page }) => {
    const caso = await casoPrincipal();

    await login(page, E2E.viewer);
    await abrirPestanaDocumentos(page, caso.id);

    // Ve los documentos…
    await expect(page.getByTestId("doc-ficha-nombre").first()).toBeVisible({ timeout: 20_000 });
    // …pero no tiene con que escribir.
    await expect(page.getByLabel("Subir documento")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Eliminar documento: / })).toHaveCount(0);

    await page.goto("/documents");
    await pantallaUtil(page);
    await expect(page.getByTestId("doc-nombre").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /^Eliminar / })).toHaveCount(0);
    // Descargar SI, porque `documents.read` lo permite.
    await expect(page.getByRole("button", { name: /^Descargar / }).first()).toBeVisible();
  });

  test("VIEWER: el servidor rechaza aunque vaya por la URL directa", async ({ page }) => {
    /*
     * Excepcion declarada: se comprueba la segunda mitad de la autorizacion.
     * Ocultar los botones no es autorizar, y esto es lo que lo demuestra.
     */
    const caso = await casoPrincipal();
    const doc = await prisma.document.findFirst({
      where: { caseId: caso.id },
      select: { id: true, fileKey: true },
    });

    await login(page, E2E.viewer);
    permitirFalloEn(page, "/api/");

    const subida = await page.request.post(`/api/cases/${caso.id}/documents/upload-url`, {
      data: { fileName: "viewer.pdf", size: PDF_BYTES.length },
    });
    expect(subida.status(), "un VIEWER no puede subir").toBe(403);

    const borrado = await page.request.delete(`/api/documents/${doc!.id}`);
    expect(borrado.status(), "un VIEWER no puede borrar").toBe(403);

    const patch = await page.request.patch(`/api/documents/${doc!.id}`, {
      data: { visibleToFamily: true },
    });
    expect(patch.status(), "un VIEWER no puede compartir con la familia").toBe(403);

    // Leer si puede.
    const lectura = await page.request.get(`/api/documents/${doc!.id}`);
    expect(lectura.status()).toBe(200);

    // Y nada ha cambiado.
    expect(await prisma.document.count({ where: { id: doc!.id } })).toBe(1);
    expect(await prisma.document.count({ where: { fileName: "viewer.pdf" } })).toBe(0);
  });
});

// ───────────────────────── URLs de descarga ─────────────────────────

test.describe("Documentos: URLs de descarga", () => {
  test("la URL viene firmada, caduca y fuerza descarga sin exponer credenciales", async ({
    page,
  }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("url");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });
    const fila = await docEnBase(nombre);

    const res = await page.request.get(`/api/documents/${fila!.id}`);
    expect(res.status()).toBe(200);
    const { downloadUrl } = await res.json();

    // Firmada y temporal: no es un enlace publico permanente.
    expect(downloadUrl).toContain("X-Amz-Signature");
    expect(downloadUrl).toMatch(/X-Amz-Expires=\d+/);
    const expira = Number(new URL(downloadUrl).searchParams.get("X-Amz-Expires"));
    expect(expira).toBeGreaterThan(0);
    expect(expira, "no puede durar mas de una hora").toBeLessThanOrEqual(3600);

    // No lleva la clave secreta dentro (la firma no es la contraseña).
    expect(downloadUrl).not.toContain("minioadmin123");
    expect(downloadUrl).not.toContain(process.env.S3_SECRET_KEY ?? "@@sin-clave@@");

    // Fuerza descarga en vez de abrirse dentro del navegador.
    const disposicion = new URL(downloadUrl).searchParams.get("response-content-disposition");
    expect(disposicion, "debe forzar descarga").toContain("attachment");

    // Y sirve el contenido correcto.
    const bajado = await page.request.get(downloadUrl);
    expect(bajado.status()).toBe(200);
    expect(Buffer.from(await bajado.body()).equals(PDF_BYTES)).toBe(true);
  });

  test("una URL manipulada no sirve el objeto", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("url-mala");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await subirDesdeFicha(page, nombre);
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });
    const fila = await docEnBase(nombre);

    const res = await page.request.get(`/api/documents/${fila!.id}`);
    const { downloadUrl } = await res.json();

    const manipulada = downloadUrl.replace(/X-Amz-Signature=[0-9a-f]+/, `X-Amz-Signature=${"0".repeat(64)}`);
    const fallo = await page.request.get(manipulada);
    expect(fallo.status()).toBeGreaterThanOrEqual(400);

    // Cambiar la clave del objeto tampoco vale: la firma cubre la ruta.
    const otraClave = downloadUrl.replace(fila!.fileKey, "otra/clave/inventada.pdf");
    if (otraClave !== downloadUrl) {
      const fallo2 = await page.request.get(otraClave);
      expect(fallo2.status()).toBeGreaterThanOrEqual(400);
    }
  });
});

// ───────────────────────────── Accesibilidad ─────────────────────────────

test.describe("Documentos: accesibilidad", () => {
  test("la busqueda y los filtros tienen nombre accesible y estado", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);

    // Antes solo tenia `placeholder`, que no es una etiqueta.
    const busqueda = page.getByLabel("Buscar documentos por nombre");
    await expect(busqueda).toHaveCount(1);
    await expect(busqueda).toBeEditable();

    const grupo = page.getByRole("group", { name: "Filtrar por origen" });
    await expect(grupo).toHaveCount(1);
    for (const etiqueta of ["Todos", "Equipo", "Familia"]) {
      await expect(page.getByRole("button", { name: etiqueta, exact: true })).toHaveCount(1);
    }
    // El filtro aplicado se anuncia, no solo se colorea.
    await expect(page.getByRole("button", { name: "Todos", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("cada boton de accion dice a que documento pertenece", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);

    await page.getByLabel("Buscar documentos por nombre").fill(E2E.documentos.unico);
    await expect(page.getByTestId("doc-nombre")).toHaveCount(1, { timeout: 20_000 });

    // Con treinta filas, "Descargar" a secas no dice cual.
    await expect(
      page.getByRole("button", { name: `Descargar ${E2E.documentos.unico}` }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: `Eliminar ${E2E.documentos.unico}` }),
    ).toHaveCount(1);
  });

  test("el control de subida de la ficha tiene nombre accesible y se maneja con teclado", async ({
    page,
  }) => {
    const caso = await casoPrincipal();
    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    const entrada = page.getByLabel("Subir documento");
    await expect(entrada, "el input de fichero debe tener etiqueta asociada").toHaveCount(1);
    await expect(entrada).toBeEnabled();

    // La pestaña de documentos se alcanza con el teclado.
    const pestana = page.getByRole("button", { name: /^Documentos \(/ });
    await pestana.focus();
    await expect(pestana).toBeFocused();
  });
});

// ─────────────────────────── Portal familiar ───────────────────────────

test.describe("Documentos: portal familiar", () => {
  const PORTAL = E2E.documentos.portal;

  /** El expediente que cuelga del portal de estas pruebas. */
  async function casoPortal() {
    const c = await prisma.case.findFirst({
      where: { ref: PORTAL.caseRef },
      select: { id: true, ref: true },
    });
    if (!c) throw new Error("El expediente del portal no existe: revisa el sembrado");
    return c;
  }

  /**
   * Abre el portal y pasa la puerta del consentimiento si aparece.
   *
   * El consentimiento es parte del flujo real: sin aceptarlo el API responde
   * 403 y no se puede subir nada.
   */
  async function abrirPortal(page: Page) {
    await page.goto(`/portal/${PORTAL.token}`);

    /*
     * Primero se espera a que la pagina decida QUE pintar: o la puerta del
     * consentimiento o el portal ya abierto. Sin esto se consultaba la casilla
     * antes de que existiera, se daba por hecho que no hacia falta consentir y
     * luego se esperaba en vano un formulario de subida que estaba detras de la
     * puerta. Era la causa de que esta prueba fuera intermitente.
     */
    const casilla = page.getByRole("checkbox", { name: /He le[ií]do y acepto/ });
    const subir = page.getByLabel(/Seleccionar archivo/);
    await expect(casilla.or(subir).first()).toBeAttached({ timeout: 30_000 });

    if (await casilla.count()) {
      /*
       * Se pulsa la ETIQUETA, que es donde pulsa una persona.
       *
       * El `<input>` real va con `sr-only` —presente en el arbol de
       * accesibilidad y alcanzable con teclado, pero clipado— y encima se
       * dibuja el recuadro visible, que intercepta el puntero. Hacer `.check()`
       * sobre el input oculto no es lo que hace nadie y ademas no se puede.
       */
      await page.getByText(/He le[ií]do y acepto el tratamiento/).click();
      await expect(casilla).toBeChecked();
      await page.getByRole("button", { name: /Aceptar y acceder al portal/ }).click();
    }
    await expect(page.getByLabel(/Seleccionar archivo/)).toBeAttached({
      timeout: 30_000,
    });
  }

  test("la familia sube un documento y el equipo lo ve marcado como Familia", async ({ page }) => {
    const caso = await casoPortal();
    const nombre = `${E2E.documentos.prefijo}-familia-${Date.now().toString().slice(-7)}.pdf`;

    // 1. Portal: consentimiento y subida, con los controles reales.
    await abrirPortal(page);
    await page.getByLabel(/Seleccionar archivo/).setInputFiles({
      name: nombre,
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });

    await expect(page.getByTestId("portal-subida-ok")).toContainText(/se ha enviado/i, {
      timeout: 30_000,
    });
    // `exact` porque el nombre sale tambien dentro del aviso de exito; el de la
    // lista es el que lo lleva como texto completo.
    await expect(page.getByText(nombre, { exact: true })).toBeVisible({ timeout: 20_000 });

    // 2. Esta de verdad en el almacenamiento, bajo el ambito del portal.
    const fila = await docEnBase(nombre);
    expect(fila).not.toBeNull();
    expect(fila!.caseId).toBe(caso.id);
    expect(fila!.isPortalUpload, "el origen real queda registrado").toBe(true);
    expect(fila!.visibleToFamily, "lo ha subido la familia: puede verlo").toBe(true);
    expect(fila!.uploadedBy, "no lo ha subido ningun usuario del equipo").toBeNull();
    expect(fila!.fileKey).toContain(`/${caso.id}/portal/`);
    expect(await objetoExiste(fila!.fileKey)).toBe(true);
    expect((await leerObjeto(fila!.fileKey)).equals(PDF_BYTES)).toBe(true);

    // 3. El equipo lo ve, marcado como Familia, y se lo descarga entero.
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);
    await page.getByLabel("Buscar documentos por nombre").fill(nombre);
    await expect(page.getByTestId("doc-nombre").filter({ hasText: nombre })).toHaveCount(1, {
      timeout: 20_000,
    });
    // La insignia se busca DENTRO de la fila de este documento: la tabla puede
    // traer mas documentos de familia y "Familia" a secas casa con todos.
    await expect(
      page.locator("tr").filter({ hasText: nombre }).getByText("Familia", { exact: true }),
    ).toBeVisible();

    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: `Descargar ${nombre}` }).click(),
    ]);
    const bajado = await readFile((await descarga.path())!);
    expect(bajado.equals(PDF_BYTES), "los bytes deben ser los que envio la familia").toBe(true);
  });

  test("el portal solo ve los documentos que le corresponden", async ({ page }) => {
    await abrirPortal(page);

    // El compartido si.
    await expect(page.getByText(PORTAL.compartido)).toBeVisible({ timeout: 20_000 });
    // El interno NO, ni por asomo.
    await expect(page.getByText(PORTAL.interno)).toHaveCount(0);

    // Y tampoco viaja en la respuesta del API.
    const respuesta = await page.request.get(`/api/portal/${PORTAL.token}/documents`);
    expect(respuesta.status()).toBe(200);
    const cuerpo = await respuesta.text();
    expect(cuerpo).toContain(PORTAL.compartido);
    expect(cuerpo, "un documento interno no puede filtrarse al portal").not.toContain(
      PORTAL.interno,
    );
  });

  test("un archivo invalido se rechaza y la familia entiende por que", async ({ page }) => {
    const caso = await casoPortal();
    const antes = await prisma.document.count({ where: { caseId: caso.id } });

    await abrirPortal(page);
    permitirFalloEn(page, "/portal");
    await page.getByLabel(/Seleccionar archivo/).setInputFiles({
      name: "virus.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
    });

    // Antes esto no producia absolutamente nada en pantalla.
    await expect(page.getByTestId("portal-subida-error")).toContainText(/ejecutable/i, {
      timeout: 30_000,
    });
    expect(await prisma.document.count({ where: { caseId: caso.id } })).toBe(antes);
  });

  test("si el almacenamiento falla, la familia se entera", async ({ page }) => {
    const caso = await casoPortal();
    const antes = await prisma.document.count({ where: { caseId: caso.id } });

    await abrirPortal(page);
    permitirFalloEn(page, "/portal");
    await page.route(`**/api/portal/${PORTAL.token}/documents/upload-url`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Error al subir archivo" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByLabel(/Seleccionar archivo/).setInputFiles({
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });

    await expect(page.getByTestId("portal-subida-error")).toContainText(/Error al subir archivo/i, {
      timeout: 30_000,
    });
    await expect(page.getByTestId("portal-subida-ok")).toHaveCount(0);
    expect(await prisma.document.count({ where: { caseId: caso.id } })).toBe(antes);
  });

  test("un token invalido no abre el portal ni deja subir", async ({ page }) => {
    permitirFalloEn(page, "/portal");
    await page.goto("/portal/token-que-no-existe-en-ninguna-parte");

    await expect(page.getByText(/Enlace no valido|no encontrado/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByLabel(/Seleccionar archivo/)).toHaveCount(0);

    // Un token inexistente no recibe ni permiso de escritura.
    const subida = await page.request.post(
      "/api/portal/token-que-no-existe/documents/upload-url",
      { data: { fileName: "intruso.pdf", size: PDF_BYTES.length } },
    );
    expect(subida.status()).toBeGreaterThanOrEqual(400);
    expect(await prisma.document.count({ where: { fileName: "intruso.pdf" } })).toBe(0);
  });

  test("un token revocado deja de servir documentos", async ({ page }) => {
    const caso = await casoPortal();
    await prisma.case.update({
      where: { id: caso.id },
      data: { portalTokenRevokedAt: new Date() },
    });
    try {
      permitirFalloEn(page, "/portal");
      const lectura = await page.request.get(`/api/portal/${PORTAL.token}/documents`);
      expect(lectura.status(), "un token revocado no sirve documentos").toBeGreaterThanOrEqual(400);

      const subida = await page.request.post(
        `/api/portal/${PORTAL.token}/documents/upload-url`,
        { data: { fileName: "revocado.pdf", size: PDF_BYTES.length } },
      );
      expect(subida.status()).toBeGreaterThanOrEqual(400);
      expect(await prisma.document.count({ where: { fileName: "revocado.pdf" } })).toBe(0);
    } finally {
      // Se deja como estaba: otras pruebas usan este portal.
      await prisma.case.update({
        where: { id: caso.id },
        data: { portalTokenRevokedAt: null },
      });
    }
  });

  test("el portal de un expediente no da acceso a los documentos de otro", async ({ page }) => {
    const ajeno = await prisma.document.findFirst({
      where: { fileName: E2E.orgAjena.documento },
      select: { id: true, fileName: true },
    });

    // Se abre el portal de verdad primero: sin consentimiento el API responde
    // 403 y la prueba dependeria del orden en que corran las demas.
    await abrirPortal(page);

    permitirFalloEn(page, "/portal");
    const respuesta = await page.request.get(`/api/portal/${PORTAL.token}/documents`);
    expect(respuesta.status()).toBe(200);
    const cuerpo = await respuesta.text();
    expect(cuerpo).not.toContain(ajeno!.fileName);
    expect(cuerpo).not.toContain(ajeno!.id);
  });
});
