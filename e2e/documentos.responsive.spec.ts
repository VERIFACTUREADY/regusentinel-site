/**
 * Documentos en las tres pantallas, contra MinIO REAL.
 *
 * POR QUE UN FICHERO APARTE
 * -------------------------
 * `playwright.config.ts` solo ejecuta en tablet y movil los ficheros
 * `*.responsive.spec.ts`. Lo que de verdad se rompe al estrechar la pantalla
 * son los controles —que se salgan, que queden tapados, que no se puedan
 * pulsar—, y eso es lo que se conduce aqui.
 *
 * Ningun control roto se sustituye por `page.goto`: si en movil no se puede
 * subir o descargar, esta prueba tiene que fallar, no rodearlo.
 */
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect, pantallaUtil } from "./vigilancia";
import { E2E } from "./seed-e2e";
import { exigirAlmacen, objetoExiste } from "./almacen";

const prisma = new PrismaClient();
const PDF_BYTES = readFileSync(path.join(__dirname, "fixtures", "documento-e2e.pdf"));

test.beforeAll(async () => {
  await exigirAlmacen();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

/**
 * Nada puede desbordar a lo ancho.
 *
 * Es el sintoma numero uno de una pantalla rota en movil: el contenido se sale
 * y los controles de la derecha —descargar, eliminar— quedan fuera del alcance
 * del pulgar.
 */
async function sinDesbordeHorizontal(page: Page) {
  const desborde = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(desborde, "la pagina no debe desplazarse en horizontal").toBeLessThanOrEqual(1);
}

async function casoPrincipal() {
  const c = await prisma.case.findFirst({
    where: { ref: E2E.caseRef },
    select: { id: true, ref: true },
  });
  if (!c) throw new Error("El expediente de pruebas no existe: revisa el sembrado");
  return c;
}

async function abrirPestanaDocumentos(page: Page, caseId: string) {
  await page.goto(`/cases/${caseId}`);
  const pestana = page.getByRole("button", { name: /^Documentos \(/ });
  await expect(pestana).toBeVisible({ timeout: 30_000 });
  await pantallaUtil(page);
  await pestana.click();
}

function nombreUnico(sufijo: string) {
  return `${E2E.documentos.prefijo}-movil-${sufijo}-${Date.now().toString().slice(-7)}.pdf`;
}

test.describe("Documentos en las tres pantallas", () => {
  test("la biblioteca se abre, se lee y no desborda", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);

    await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
    await expect(page.getByTestId("doc-nombre").first()).toBeVisible({ timeout: 20_000 });
    await sinDesbordeHorizontal(page);
  });

  test("la busqueda se puede usar con el dedo y filtra de verdad", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);

    // Se escribe donde esta: si el campo quedara fuera de pantalla o tapado,
    // `fill` fallaria por actionability.
    const [peticion] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/documents?"), { timeout: 25_000 }),
      page.getByLabel("Buscar documentos por nombre").fill("unico-escritura"),
    ]);
    expect(peticion.url()).toContain("search=unico-escritura");

    await expect(page.getByTestId("doc-nombre")).toHaveCount(1, { timeout: 20_000 });
    await sinDesbordeHorizontal(page);
  });

  test("los filtros de origen se pueden pulsar", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);

    const [peticion] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("source=portal"), { timeout: 25_000 }),
      page.getByRole("button", { name: "Familia", exact: true }).click(),
    ]);
    expect(peticion.url()).toContain("source=portal");
    await expect(page.getByRole("button", { name: "Familia", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await sinDesbordeHorizontal(page);
  });

  test("se abre el expediente de un documento desde la biblioteca", async ({ page }) => {
    const caso = await casoPrincipal();
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);

    await page.getByRole("link", { name: caso.ref }).first().click();
    await page.waitForURL(/\/cases\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /^Documentos \(/ })).toBeVisible({
      timeout: 30_000,
    });
    await pantallaUtil(page);
    await sinDesbordeHorizontal(page);
  });

  test("se sube un documento desde la ficha y llega al almacenamiento", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("subida");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);

    await page.getByLabel("Subir documento").setInputFiles({
      name: nombre,
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });

    await expect(page.getByTestId("toast-exito")).toContainText(/se ha subido/i, {
      timeout: 30_000,
    });
    const fila = await prisma.document.findFirst({ where: { fileName: nombre } });
    expect(fila).not.toBeNull();
    expect(await objetoExiste(fila!.fileKey), "el objeto debe estar en MinIO").toBe(true);
    await sinDesbordeHorizontal(page);
  });

  test("se descarga y se elimina desde la biblioteca", async ({ page }) => {
    const caso = await casoPrincipal();
    const nombre = nombreUnico("ciclo");

    await login(page, E2E.owner);
    await abrirPestanaDocumentos(page, caso.id);
    await page.getByLabel("Subir documento").setInputFiles({
      name: nombre,
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });
    await expect(page.getByTestId("toast-exito")).toBeVisible({ timeout: 30_000 });
    const fila = await prisma.document.findFirst({ where: { fileName: nombre } });

    await page.goto("/documents");
    await pantallaUtil(page);
    await page.getByLabel("Buscar documentos por nombre").fill(nombre);
    await expect(page.getByTestId("doc-nombre").filter({ hasText: nombre })).toHaveCount(1, {
      timeout: 20_000,
    });

    // Descarga con los mismos bytes, tambien en pantalla estrecha.
    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: `Descargar ${nombre}` }).click(),
    ]);
    expect((await readFile((await descarga.path())!)).equals(PDF_BYTES)).toBe(true);

    // Y borrado real.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: `Eliminar ${nombre}` }).click();
    await expect(page.getByTestId("aviso-documentos-ok")).toContainText(/se ha eliminado/i, {
      timeout: 20_000,
    });
    await expect(async () => {
      expect(await prisma.document.count({ where: { id: fila!.id } })).toBe(0);
    }).toPass({ timeout: 20_000 });
    expect(await objetoExiste(fila!.fileKey)).toBe(false);
    await sinDesbordeHorizontal(page);
  });

  test("la paginacion funciona con el dedo", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/documents");
    await pantallaUtil(page);

    await expect(page.getByTestId("rango-documentos")).toContainText("1–30", { timeout: 20_000 });
    const pagina1 = await page.getByTestId("doc-nombre").allTextContents();

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByTestId("rango-documentos")).toContainText("31–", { timeout: 20_000 });

    await page.getByRole("button", { name: "Anterior" }).click();
    await expect(page.getByTestId("rango-documentos")).toContainText("1–30", { timeout: 20_000 });
    await expect(async () => {
      expect(await page.getByTestId("doc-nombre").allTextContents()).toEqual(pagina1);
    }).toPass({ timeout: 20_000 });
    await sinDesbordeHorizontal(page);
  });

  test("el portal familiar deja subir desde el movil", async ({ page }) => {
    const PORTAL = E2E.documentos.portal;
    const nombre = nombreUnico("portal");

    await page.goto(`/portal/${PORTAL.token}`);

    // Se espera a que la pagina decida que pintar —la puerta del consentimiento
    // o el portal ya abierto— antes de mirar si hay casilla. Consultarla antes
    // de que exista hacia que la prueba fuera intermitente.
    const casilla = page.getByRole("checkbox", { name: /He le[ií]do y acepto/ });
    const subir = page.getByLabel(/Seleccionar archivo/);
    await expect(casilla.or(subir).first()).toBeAttached({ timeout: 30_000 });

    if (await casilla.count()) {
      // La etiqueta es lo que se pulsa: el input real va `sr-only` y el
      // recuadro dibujado encima intercepta el puntero.
      await page.getByText(/He le[ií]do y acepto el tratamiento/).click();
      await expect(casilla).toBeChecked();
      await page.getByRole("button", { name: /Aceptar y acceder al portal/ }).click();
    }
    await expect(page.getByLabel(/Seleccionar archivo/)).toBeAttached({
      timeout: 30_000,
    });
    await pantallaUtil(page);

    await page.getByLabel(/Seleccionar archivo/).setInputFiles({
      name: nombre,
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });

    await expect(page.getByTestId("portal-subida-ok")).toContainText(/se ha enviado/i, {
      timeout: 30_000,
    });
    const fila = await prisma.document.findFirst({ where: { fileName: nombre } });
    expect(await objetoExiste(fila!.fileKey)).toBe(true);
    await sinDesbordeHorizontal(page);
  });
});
