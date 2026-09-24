/**
 * /workflow-rules, /workflow-logs y /audit en las tres pantallas.
 *
 * POR QUE UN FICHERO APARTE
 * -------------------------
 * `playwright.config.ts` solo ejecuta en tablet y movil los ficheros
 * `*.responsive.spec.ts`. Repetir las suites enteras en tres tamanos
 * triplicaria el tiempo de CI sin encontrar nada nuevo: lo que de verdad se
 * rompe al estrechar la pantalla son los controles y las ramas de dibujado que
 * SOLO existen en movil.
 *
 * Y aqui habia una de esas ramas con un defecto propio: la vista de tarjetas
 * de `/audit` (`md:hidden`) no miraba el error de carga. La version de
 * escritorio se corrigio para que un fallo saliera como fallo; en el movil
 * seguia cayendo en «No hay registros», que en una auditoria significa «no ha
 * pasado nada en tu organizacion». Un fallo de red contado como tranquilidad.
 *
 * Ningun clic se sustituye por `page.goto`: si un control no se puede pulsar
 * en movil, la prueba tiene que fallar, no rodearlo.
 */
import { type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect, pantallaUtil, permitirFalloEn } from "./vigilancia";
import { E2E } from "./seed-e2e";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
  await page.getByRole("heading", { name: "Dashboard", level: 1 }).waitFor({ timeout: 30_000 });
}

/** Nada puede desbordar a lo ancho: es el sintoma numero uno de movil roto. */
async function sinDesbordeHorizontal(page: Page, donde: string) {
  const desborde = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(desborde, `${donde} no debe desplazarse en horizontal`).toBeLessThanOrEqual(1);
}

const enMovil = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

async function navegarPorElMenu(page: Page, nombre: string) {
  if (enMovil(page)) {
    await page.getByRole("button", { name: "Abrir navegacion" }).click();
  }
  await page
    .getByRole("link", { name: new RegExp(`^${nombre}`) })
    .first()
    .click();
}

/**
 * La ejecucion SEMBRADA de la regla de correo: la mas antigua. Otras suites
 * le crean ejecuciones nuevas al cambiar el estado del expediente, y esas no
 * tienen nada pendiente.
 */
async function ejecucionConEntregas() {
  return prisma.workflowLog.findFirstOrThrow({
    where: {
      rule: { name: E2E.automatizaciones.reglaCorreo },
      deliveries: { some: { recipient: E2E.automatizaciones.destinatarioFallido } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
}

/** Deja las entregas de la regla de correo como las dejo el sembrado. */
async function restaurarEntregas() {
  const log = await prisma.workflowLog.findFirst({
    where: {
      rule: { name: E2E.automatizaciones.reglaCorreo },
      deliveries: { some: { recipient: E2E.automatizaciones.destinatarioFallido } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!log) return;
  const ahora = new Date();
  await prisma.workflowDelivery.updateMany({
    where: { workflowLogId: log.id, recipient: E2E.automatizaciones.destinatarioFallido },
    data: {
      status: "FAILED",
      error: "SMTP 421: servicio no disponible",
      attempts: 1,
      lastTriedAt: ahora,
      sentAt: null,
    },
  });
  await prisma.workflowLog.update({
    where: { id: log.id },
    data: { status: "FAILED", error: "SMTP 421: servicio no disponible" },
  });
}

// ─── Reglas ────────────────────────────────────────────────────────────────

test.describe("Automatizaciones en las tres pantallas", () => {
  test("la lista de reglas se lee y no desborda", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await navegarPorElMenu(page, "Automatizaciones");
    await pantallaUtil(page);

    await expect(page.getByText(E2E.automatizaciones.reglaActiva)).toBeVisible();
    await sinDesbordeHorizontal(page, "/workflow-rules");
  });

  test("el formulario de nueva regla se abre y se puede rellenar", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await navegarPorElMenu(page, "Automatizaciones");
    await pantallaUtil(page);

    await page.getByTestId("nueva-regla").click();
    const modal = page.getByTestId("modal-regla");
    await expect(modal).toBeVisible();

    // Los campos se alcanzan y se escriben con la pantalla estrecha.
    await page.getByLabel("Nombre").fill("Regla desde movil");
    await expect(page.getByLabel("Nombre")).toHaveValue("Regla desde movil");
    await sinDesbordeHorizontal(page, "el formulario de regla");

    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(modal).toHaveCount(0);
    expect(
      await prisma.workflowRule.count({ where: { name: "Regla desde movil" } }),
      "cancelar no guarda nada",
    ).toBe(0);
  });
});

// ─── Registro de ejecuciones ──────────────────────────────────────────────

test.describe("Registro de automatizaciones en las tres pantallas", () => {
  test.afterEach(restaurarEntregas);

  /** Llega a /workflow-logs por el enlace, que es el unico camino que hay. */
  async function irAlRegistro(page: Page) {
    await navegarPorElMenu(page, "Automatizaciones");
    await pantallaUtil(page);
    await page.getByRole("link", { name: "Ver registro de ejecuciones" }).click();
    await page.waitForURL("**/workflow-logs");
    // En movil el primer pintado tarda: se espera al titulo antes de juzgar
    // si la pantalla esta vacia.
    await page
      .getByRole("heading", { name: "Registro de automatizaciones", level: 1 })
      .waitFor({ timeout: 30_000 });
    await pantallaUtil(page);
  }

  test("se llega por el enlace y las cinco tarjetas caben", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    // Las cinco cifras estan y se ven; la rejilla era de cuatro columnas para
    // cinco tarjetas.
    for (const id of [
      "total-ejecuciones",
      "total-exitosas",
      "total-parciales",
      "total-fallidas",
      "tasa-exito",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await sinDesbordeHorizontal(page, "/workflow-logs");
  });

  test("los filtros de estado se pulsan y filtran", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    await page.getByTestId("filtro-estado-FAILED").click();
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);
    await expect(page.locator("tbody tr").first().locator("td").first()).toHaveText("Error");
    await sinDesbordeHorizontal(page, "el registro filtrado");
  });

  test("se reintenta una entrega fallida desde una pantalla estrecha", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);
    await page.getByTestId("filtro-estado-FAILED").click();
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

    const log = await ejecucionConEntregas();
    const boton = page.getByTestId(`reintentar-${log.id}`);
    await boton.scrollIntoViewIfNeeded();
    await boton.click();

    await expect(page.getByTestId("reintento-exito")).toBeVisible();
    // Y el cambio es real, no solo un cartel.
    const despues = await prisma.workflowLog.findUniqueOrThrow({
      where: { id: log.id },
      select: { status: true },
    });
    expect(despues.status).toBe("SUCCESS");
  });

  test("un fallo de carga se explica tambien en movil", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    permitirFalloEn(page, "/api/workflow-logs");
    await page.route("**/api/workflow-logs?**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.getByTestId("filtro-estado-FAILED").click();

    await expect(page.getByTestId("carga-error")).toBeVisible();
    await expect(page.getByTestId("vacio-ejecuciones")).toHaveCount(0);
    await sinDesbordeHorizontal(page, "el aviso de error del registro");

    await page.unroute("**/api/workflow-logs?**");
  });
});

// ─── Auditoria ─────────────────────────────────────────────────────────────

test.describe("Auditoria en las tres pantallas", () => {
  test("la traza se lee y no desborda", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await navegarPorElMenu(page, "Audit Trail");
    await pantallaUtil(page);

    await expect(page.getByTestId("contador-auditoria")).toBeVisible();
    // En movil son tarjetas, en escritorio una tabla: en las dos hay contenido.
    await expect(page.locator("body")).toContainText("Owner Auto E2E");
    await sinDesbordeHorizontal(page, "/audit");
  });

  test("los filtros se usan con la pantalla estrecha", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await navegarPorElMenu(page, "Audit Trail");
    await pantallaUtil(page);

    await page.getByLabel("Categoria").selectOption("task.");
    await expect(page.getByTestId("contador-auditoria")).toContainText("(filtrado)");
    await sinDesbordeHorizontal(page, "la auditoria filtrada");

    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page.getByTestId("contador-auditoria")).not.toContainText("(filtrado)");
  });

  test("UN FALLO DE CARGA NO SE DISFRAZA DE «No hay registros» EN MOVIL", async ({ page }) => {
    /*
     * Este es el defecto que justifica el fichero. La rama `md:hidden` de
     * tarjetas no miraba `errorCarga`: con la peticion caida caia en
     * `logs.length === 0` y pintaba «No hay registros». En una traza de
     * auditoria eso no es un hueco, es la conclusion contraria a la verdadera,
     * y ademas no ofrecia forma de reintentar.
     */
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/audit-logs");
    await page.route("**/api/audit-logs?**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );

    await navegarPorElMenu(page, "Audit Trail");
    await pantallaUtil(page);

    await expect(page.getByTestId("carga-error")).toBeVisible();
    await expect(page.getByTestId("carga-error")).toContainText("El servidor ha respondido 500");
    // Ni rastro del texto que daba el fallo por normalidad.
    await expect(page.locator("body")).not.toContainText("No hay registros");
    await expect(page.getByTestId("vacio-auditoria")).toHaveCount(0);
    // Y hay forma de volver a intentarlo.
    await expect(page.getByRole("button", { name: /Reintentar/ })).toBeVisible();

    await page.unroute("**/api/audit-logs?**");
  });

  test("se pagina con la pantalla estrecha", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await navegarPorElMenu(page, "Audit Trail");
    await pantallaUtil(page);

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Pagina 2 de")).toBeVisible();
    await sinDesbordeHorizontal(page, "la auditoria en la pagina 2");
  });
});
