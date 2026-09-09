/**
 * /dashboard y /today en las tres pantallas.
 *
 * El panel es la pantalla mas densa de la aplicacion: seis indicadores, dos
 * widgets anchos, un calendario, una tabla y varias listas. Es donde el
 * desbordamiento horizontal aparece antes, y donde peor se ve —el usuario
 * arrastra la pagina entera de lado buscando una columna que se salio—.
 *
 * Ningun control se sustituye por `page.goto`: se pulsa lo que pulsaria el
 * usuario, incluido el menu hamburguesa en movil.
 */
import { type Page } from "@playwright/test";
import { test, expect, pantallaUtil } from "./vigilancia";
import { E2E, CIFRAS_PANEL } from "./seed-e2e";

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
  /*
   * Se espera al encabezado antes de seguir.
   *
   * `waitForURL` solo garantiza que la URL ha cambiado. En movil el primer
   * pintado tarda mas —el panel lateral esta plegado y el contenido llega
   * despues—, y `pantallaUtil` lee `body.innerText` UNA vez, sin reintentar:
   * cogia la pagina a medio pintar y la daba por vacia. No se relaja el
   * vigilante; simplemente se espera a que haya pagina, que es lo que hace un
   * usuario.
   */
  await page.getByRole("heading", { name: "Dashboard", level: 1 }).waitFor({
    timeout: 30_000,
  });
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

/**
 * Abre el menu lateral si hace falta y pulsa un enlace de navegacion.
 *
 * En escritorio el panel esta siempre visible; por debajo de 1024 px hay que
 * abrirlo con el boton hamburguesa. Se hace asi, con clics, en vez de navegar
 * por URL: el enlace del menu en movil es un control distinto y si se rompiera
 * ninguna prueba se enteraria.
 */
async function navegarPorElMenu(page: Page, nombre: string) {
  if (enMovil(page)) {
    await page.getByRole("button", { name: "Abrir navegacion" }).click();
  }
  await page.getByRole("link", { name: nombre, exact: true }).first().click();
}

test.describe("Panel y resumen en las tres pantallas", () => {
  test("el panel no se desplaza en horizontal", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);
    await sinDesbordeHorizontal(page, "El panel");
  });

  test("los seis indicadores se leen enteros, con su cifra", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    for (const id of [
      "expedientes-activos",
      "tareas-pendientes",
      "tareas-bloqueadas",
      "tareas-listas",
      "aprobaciones-pendientes",
      "cerrados-este-mes",
    ]) {
      const tarjeta = page.getByTestId(`kpi-${id}`);
      await expect(tarjeta).toBeVisible();
      // La tarjeta cabe dentro de la ventana: nada recortado por el borde.
      const caja = await tarjeta.boundingBox();
      const ancho = page.viewportSize()?.width ?? 0;
      expect(caja, `el indicador ${id} debe tener caja`).not.toBeNull();
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho + 1);
    }

    await expect(page.getByTestId("kpi-expedientes-activos")).toContainText(
      String(CIFRAS_PANEL.expedientesActivos),
    );
  });

  test("el calendario del panel cabe y sus casillas se pueden pulsar", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const calendario = page.getByRole("heading", { name: /^Plazos —/ });
    await expect(calendario).toBeVisible();
    await sinDesbordeHorizontal(page, "El panel con el calendario");

    // Se pulsa una casilla real y se llega al calendario completo.
    await page.locator('a[href^="/calendar#"]').first().click();
    await page.waitForURL(/\/calendar/);
  });

  test("la tabla de expedientes recientes no arrastra la pagina de lado", async ({
    page,
  }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    await expect(page.getByRole("heading", { name: "Expedientes recientes" })).toBeVisible();
    // Una tabla ancha puede desplazarse DENTRO de su contenedor; lo que no
    // puede es llevarse consigo el documento entero.
    await sinDesbordeHorizontal(page, "El panel con la tabla de expedientes");
  });

  test("el aviso de datos incompletos se lee entero en movil", async ({ page, context }) => {
    await login(page, E2E.panel.owner);
    await context.addCookies([
      {
        name: "e2e-fallos",
        value: "expedientesActivos,aprobacionesPendientes",
        url: "http://127.0.0.1:3000",
      },
    ]);
    await page.reload();
    await pantallaUtil(page);

    const aviso = page.getByTestId("aviso-datos-incompletos");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("los expedientes activos");
    // El estado de error tambien tiene que caber: si desborda, el usuario no
    // llega a leer QUE le falta.
    await sinDesbordeHorizontal(page, "El panel con el aviso de fallo");

    await context.clearCookies({ name: "e2e-fallos" });
  });

  test("el resumen del día se alcanza desde el menu y no desborda", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    await navegarPorElMenu(page, "Resumen del día");
    await page.waitForURL("**/today");
    await page.getByRole("heading", { name: "Resumen del día", level: 1 }).waitFor({
      timeout: 30_000,
    });
    await pantallaUtil(page);

    await expect(page.getByRole("heading", { name: "Resumen del día" })).toBeVisible();
    await sinDesbordeHorizontal(page, "El resumen del día");
  });

  test("las secciones del resumen se leen enteras y sus enlaces se pulsan", async ({
    page,
  }) => {
    await login(page, E2E.panel.owner);
    await navegarPorElMenu(page, "Resumen del día");
    await page.waitForURL("**/today");
    await page.getByRole("heading", { name: "Resumen del día", level: 1 }).waitFor({
      timeout: 30_000,
    });
    await pantallaUtil(page);

    const vencidas = page
      .locator("div.bg-white.border.rounded-xl")
      .filter({ hasText: "Mis tareas vencidas" })
      .first();
    await expect(vencidas).toBeVisible();

    const caja = await vencidas.boundingBox();
    const ancho = page.viewportSize()?.width ?? 0;
    expect(caja).not.toBeNull();
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho + 1);

    // Un enlace real de la lista, pulsado con el dedo.
    await vencidas.getByRole("link", { name: /vencida hace/ }).first().click();
    await page.waitForURL("**/cases/**");
  });

  test("la franja roja de accion inmediata cabe en la pantalla", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await navegarPorElMenu(page, "Resumen del día");
    await page.waitForURL("**/today");
    await page.getByRole("heading", { name: "Resumen del día", level: 1 }).waitFor({
      timeout: 30_000,
    });
    await pantallaUtil(page);

    const franja = page.getByTestId("franja-accion-inmediata");
    await expect(franja).toBeVisible();
    await sinDesbordeHorizontal(page, "El resumen con la franja de urgencias");
  });

  test("los titulos largos se recortan en vez de estirar la pagina", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    // El widget de mis tareas trunca los titulos con `truncate`.
    const widget = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: "Mis tareas asignadas" }) })
      .first();
    await expect(widget).toBeVisible();
    await sinDesbordeHorizontal(page, "El panel con el widget de tareas");
  });

  test("el boton de completar tarea se puede pulsar con el dedo", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const boton = page
      .getByRole("button", { name: /^Marcar completada:/ })
      .first();
    await expect(boton).toBeVisible();

    // Area de pulsacion utilizable en movil.
    const caja = await boton.boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.width).toBeGreaterThanOrEqual(20);
    expect(caja!.height).toBeGreaterThanOrEqual(20);
  });
});
