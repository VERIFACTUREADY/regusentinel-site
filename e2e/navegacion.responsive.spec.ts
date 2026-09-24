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

  test("el menu de navegacion se abre, navega, se cierra y se vuelve a abrir", async ({
    page,
  }, testInfo) => {
    /*
     * SIN ATAJOS.
     *
     * La version anterior caia a `page.goto("/cases")` cuando el clic del menu
     * fallaba. Eso permitia que el menu movil estuviera roto y la prueba
     * siguiera en verde: comprobaba que la RUTA existe, no que una persona
     * pueda llegar. Aqui no hay salida alternativa — si el menu no se puede
     * pulsar, la prueba falla.
     */
    await login(page, E2E.owner);
    await page.goto("/dashboard");

    const enPantallaPequena = (page.viewportSize()?.width ?? 0) < 1024;

    // Nombres accesibles exactos: un patron amplio capturaba tambien el boton
    // de cerrar, que vive dentro del panel plegado y nunca esta accionable.
    const abridor = page.getByRole("button", { name: "Abrir navegacion" });
    const cerrador = page.getByRole("button", { name: "Cerrar navegacion" });

    if (enPantallaPequena) {
      await expect(
        abridor,
        "en pantalla pequena tiene que haber un boton que abra la navegacion",
      ).toBeVisible({ timeout: 15_000 });

      // Abrir.
      await abridor.click();
      await expect(
        page.getByRole("link", { name: /expedientes/i }).first(),
      ).toBeVisible({ timeout: 15_000 });

      // Cerrar y volver a abrir ANTES de navegar: un menu que solo funciona la
      // primera vez esta roto igual. Se comprueba aqui porque al pulsar un
      // enlace el panel se cierra solo —que es lo correcto— y entonces ya no
      // habria nada que cerrar.
      await expect(cerrador).toBeVisible({ timeout: 15_000 });
      await cerrador.click({ timeout: 10_000 });
      await expect(cerrador).toBeHidden({ timeout: 15_000 });

      await abridor.click();
      await expect(cerrador, "el menu debe poder abrirse una segunda vez").toBeVisible({
        timeout: 15_000,
      });
    }

    const enlace = page.getByRole("link", { name: /expedientes/i }).first();

    // Visible Y accionable: un enlace que existe en el DOM pero esta fuera de
    // pantalla no sirve de nada a quien lo intenta pulsar.
    await expect(
      enlace,
      `${testInfo.project.name}: el enlace de expedientes debe verse en el menu`,
    ).toBeVisible({ timeout: 15_000 });

    await enlace.click({ timeout: 15_000 });
    await page.waitForURL("**/cases**", { timeout: 30_000 });
    await pantallaUtil(page);
    await sinDesbordeHorizontal(page, "Expedientes tras navegar por el menu");

    // Y una segunda navegacion completa desde el menu, ya en otra pantalla.
    if (enPantallaPequena) {
      await expect(abridor).toBeVisible({ timeout: 15_000 });
      await abridor.click();
    }
    const enlaceTareas = page.getByRole("link", { name: /tareas/i }).first();
    await expect(enlaceTareas).toBeVisible({ timeout: 15_000 });
    await enlaceTareas.click({ timeout: 15_000 });
    await page.waitForURL("**/tasks**", { timeout: 30_000 });

    await pantallaUtil(page);
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

  test("el menu cerrado no deja enlaces alcanzables por teclado", async ({ page }) => {
    /*
     * El panel se apartaba con `-translate-x-full`, que lo saca de la vista
     * pero NO del arbol de accesibilidad ni del orden de tabulacion: con el
     * menu cerrado, quien navega con teclado tabulaba por todos los enlaces sin
     * verlos, y un lector de pantalla se los anunciaba.
     */
    const enPantallaPequena = (page.viewportSize()?.width ?? 0) < 1024;
    test.skip(!enPantallaPequena, "En escritorio el panel esta siempre visible a proposito.");

    await login(page, E2E.owner);
    await page.goto("/dashboard");

    /*
     * Se localiza por CSS, NO por rol.
     *
     * `getByRole` excluye lo que esta fuera del arbol de accesibilidad, que es
     * justo lo que esta correccion consigue: usarlo aqui haria que la prueba
     * pasara por no encontrar nada, sin demostrar nada. Con el selector de CSS
     * el enlace se encuentra siempre y se puede comprobar su estado real.
     */
    const enlace = page
      .locator('aside[aria-label="Navegacion principal"] a[href="/cases"]')
      .first();

    await expect(enlace, "el enlace debe seguir en el DOM").toHaveCount(1);
    await expect(
      enlace,
      "con el menu cerrado, sus enlaces no pueden estar visibles",
    ).toBeHidden({ timeout: 15_000 });

    // Y tampoco enfocables: `toBeHidden` mira estilos, esto mira el foco real,
    // que es lo que rompia para quien navega con teclado.
    const enfocable = await enlace.evaluate((el) => {
      (el as HTMLElement).focus();
      return document.activeElement === el;
    });
    expect(enfocable, "un enlace del menu cerrado no debe poder recibir el foco").toBe(false);
  });
});
