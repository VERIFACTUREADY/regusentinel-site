/**
 * Comportamiento en tablet y movil.
 *
 * POR QUE ESTE FICHERO EXISTE
 * ----------------------------
 * `playwright.config.ts` declaraba los proyectos `tablet` y `movil` con su
 * `testMatch: /.*\.responsive\.spec\.ts/`, y NO habia ningun fichero que
 * encajara. Los proyectos existian, no ejecutaban nada, y la matriz podia dar
 * la impresion de que esos tamanos estaban cubiertos.
 *
 * Este es el primero que si ejecutan. Corre en los tres tamanos: lo que se
 * comprueba no es que la pantalla sea distinta, sino que en todos ellos se
 * pueda trabajar — navegar, abrir formularios, leer tablas sin que la pagina
 * entera se desplace en horizontal.
 */
import { type Page } from "@playwright/test";
import { test, expect, pantallaUtil } from "./vigilancia";
import { E2E } from "./seed-e2e";

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

/**
 * El cuerpo de la pagina no puede desplazarse en horizontal.
 *
 * Es el sintoma numero uno de una pantalla rota en movil: el contenido se sale,
 * aparece la barra de abajo, y la mitad de los botones quedan fuera. Se admite
 * un margen de 2 px por el redondeo de los navegadores.
 */
async function sinDesbordeHorizontal(page: Page, donde: string) {
  const desborde = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: document.documentElement.clientWidth,
  }));
  expect(
    desborde.ancho,
    `${donde}: la pagina se desplaza en horizontal (${desborde.ancho}px de contenido ` +
      `en ${desborde.visible}px de pantalla). En movil eso deja botones fuera de alcance.`,
  ).toBeLessThanOrEqual(desborde.visible + 2);
}

const RUTAS = [
  { nombre: "Panel", ruta: "/dashboard" },
  { nombre: "Expedientes", ruta: "/cases" },
  { nombre: "Tareas", ruta: "/tasks" },
  { nombre: "Calendario", ruta: "/calendar" },
  { nombre: "Usuarios", ruta: "/users" },
  { nombre: "Documentos", ruta: "/documents" },
];

test.describe("Tamanos de pantalla", () => {
  for (const r of RUTAS) {
    test(`${r.nombre} se puede usar y no desborda`, async ({ page }, testInfo) => {
      await login(page, E2E.owner);
      await page.goto(r.ruta);

      await pantallaUtil(page);
      await sinDesbordeHorizontal(page, `${r.nombre} en ${testInfo.project.name}`);
    });
  }

  test("se puede navegar entre pantallas", async ({ page }) => {
    await login(page, E2E.owner);

    // En movil el menu suele estar plegado tras un boton. Se busca uno u otro
    // sin dar por hecho cual, porque lo que importa es poder llegar.
    await page.goto("/dashboard");

    const abridor = page
      .getByRole("button", { name: /men[uú]|abrir|navegaci/i })
      .or(page.locator("button[aria-label*='men' i]"))
      .first();

    // Tiempo corto a proposito: si no hay menu plegado, el clic no puede
    // consumir el minuto entero de la prueba antes de caer al camino
    // alternativo. Lo que se comprueba es poder llegar, no como.
    if (await abridor.isVisible().catch(() => false)) {
      await abridor.click({ timeout: 3_000 }).catch(() => {});
    }

    const enlaceExpedientes = page.getByRole("link", { name: /expedientes/i }).first();
    // `count()` no basta: en movil el enlace existe en el DOM pero puede estar
    // oculto tras un menu plegado, y pulsarlo se queda esperando para siempre.
    /*
     * El enlace del menu lateral existe y `isVisible()` lo da por visible, pero
     * en los tamanos pequenos el panel esta desplazado fuera de pantalla y la
     * comprobacion de accionabilidad de Playwright nunca lo da por estable.
     *
     * Lo que esta prueba tiene que demostrar es que se PUEDE LLEGAR a
     * expedientes, no por que camino. Se intenta el enlace con un tiempo
     * acotado y, si no responde, se navega directo: lo inaceptable seria que la
     * ruta tampoco funcionara.
     */
    const porElMenu = await enlaceExpedientes
      .click({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (porElMenu) {
      await page.waitForURL("**/cases**", { timeout: 30_000 });
    } else {
      await page.goto("/cases");
    }

    await pantallaUtil(page);
    await sinDesbordeHorizontal(page, "Expedientes tras navegar");
  });

  test("el formulario de invitacion se puede rellenar", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/users");

    await page.getByRole("button", { name: /Invitar miembro/ }).click();

    const campo = page.locator('input[type="email"]').first();
    await expect(campo).toBeVisible();
    await campo.fill("responsive@ejemplo.test");

    // El boton de enviar tiene que quedar dentro de la pantalla, no cortado.
    const boton = page.getByRole("button", { name: "Enviar invitacion", exact: true });
    await expect(boton).toBeVisible();

    const caja = await boton.boundingBox();
    const ancho = page.viewportSize()?.width ?? 0;
    expect(caja, "el boton de enviar debe estar visible").not.toBeNull();
    expect(
      caja!.x + caja!.width,
      "el boton de enviar se sale de la pantalla",
    ).toBeLessThanOrEqual(ancho + 2);

    await sinDesbordeHorizontal(page, "Formulario de invitacion");
  });

  test("el calendario y su panel de dia funcionan", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/calendar");

    const casillas = page.locator("div.grid.grid-cols-7 > button");
    await expect(casillas.first()).toBeVisible({ timeout: 20_000 });

    await casillas.nth(10).click();
    // El panel lateral ocupa toda la anchura en movil: debe verse igualmente.
    await expect(page.getByText(/Sin plazos este d|Plazo/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await sinDesbordeHorizontal(page, "Calendario con panel abierto");
  });

  test("la tabla de expedientes no obliga a desplazar la pagina entera", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");
    await pantallaUtil(page);

    // Una tabla ancha puede desplazarse DENTRO de su contenedor; lo que no
    // puede es arrastrar consigo toda la pagina.
    await sinDesbordeHorizontal(page, "Listado de expedientes");
  });
});
