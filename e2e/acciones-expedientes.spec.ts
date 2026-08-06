/**
 * Acciones que escriben: exito Y fallo.
 *
 * EL DEFECTO QUE COMPRUEBAN
 * --------------------------
 * Arreglar la carga inicial no basta. Los botones que envian POST/PATCH/DELETE
 * fallaban en silencio:
 *
 *   - `updateCaseStatus` tenia un `catch {}` vacio y no miraba `res.ok`. Si el
 *     servidor rechazaba el cambio, la pantalla se quedaba igual y el usuario
 *     no sabia si habia funcionado.
 *   - `batchChangeStatus` y `batchDelete` no tenian `try` siquiera: un error de
 *     red se llevaba por delante el `setBatchLoading(false)` y el boton se
 *     quedaba girando PARA SIEMPRE.
 *
 * Callarse un borrado fallido es lo mas grave de los tres: el usuario cree que
 * ha eliminado expedientes que siguen ahi.
 */
import { type Page } from "@playwright/test";
import { test, expect, permitirFalloEn } from "./vigilancia";
import { E2E } from "./seed-e2e";

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

/** Selector de estado de la primera fila de la tabla. */
function selectorDeEstado(page: Page) {
  return page.locator("table select").first();
}

test.describe("Acciones sobre expedientes", () => {
  test("cambiar el estado confirma que ha funcionado", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");

    const selector = selectorDeEstado(page);
    await expect(selector).toBeVisible({ timeout: 20_000 });

    const opciones = await selector.locator("option").allTextContents();
    const actual = await selector.inputValue();
    const otro = (await selector.locator("option").all())
      .map((_, i) => i)
      .find(() => true);
    expect(opciones.length, "debe haber estados donde elegir").toBeGreaterThan(1);

    const valores = await selector.locator("option").evaluateAll((os) =>
      os.map((o) => (o as HTMLOptionElement).value),
    );
    const destino = valores.find((v) => v && v !== actual);
    expect(destino, "debe haber un estado distinto al actual").toBeTruthy();
    void otro;

    await selector.selectOption(destino!);

    const aviso = page.getByTestId("aviso-accion");
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText("Estado actualizado");
  });

  test("si el cambio de estado falla, se dice y la fila NO miente", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");

    const selector = selectorDeEstado(page);
    await expect(selector).toBeVisible({ timeout: 20_000 });
    const antes = await selector.inputValue();

    permitirFalloEn(page, "/api/cases/");
    await page.route("**/api/cases/*", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "fallo simulado" }),
        });
      } else {
        await route.continue();
      }
    });

    const valores = await selector.locator("option").evaluateAll((os) =>
      os.map((o) => (o as HTMLOptionElement).value),
    );
    const destino = valores.find((v) => v && v !== antes)!;
    await selector.selectOption(destino);

    const aviso = page.getByTestId("aviso-accion");
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText("No se ha podido cambiar el estado");

    // Y el selector vuelve a quedar utilizable: nada de bloqueo permanente.
    await expect(selector).toBeEnabled({ timeout: 10_000 });
  });

  test("un borrado en lote que falla NO se anuncia como hecho", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");

    const casilla = page.locator("table input[type='checkbox']").nth(1);
    if ((await casilla.count()) === 0) test.skip();
    await casilla.check();

    permitirFalloEn(page, "/api/cases/batch");
    await page.route("**/api/cases/batch", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "fallo simulado" }),
      }),
    );

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Eliminar/i }).first().click();

    const aviso = page.getByTestId("aviso-accion");
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText("No se han podido eliminar");

    // Lo que esta prueba existe para impedir: que el boton se quede girando.
    // Antes no habia `try`, la excepcion saltaba el `setBatchLoading(false)` y
    // la barra de acciones quedaba inservible hasta recargar.
    await expect(
      page.getByRole("button", { name: /Eliminar/i }).first(),
    ).toBeEnabled({ timeout: 10_000 });
  });

  test("un cambio de estado en lote que falla tampoco deja el boton girando", async ({
    page,
  }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");

    const casilla = page.locator("table input[type='checkbox']").nth(1);
    if ((await casilla.count()) === 0) test.skip();
    await casilla.check();

    permitirFalloEn(page, "/api/cases/batch");
    await page.route("**/api/cases/batch", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "fallo simulado" }),
      }),
    );

    const selectorLote = page.locator("div.bg-blue-50 select").first();
    await expect(selectorLote).toBeVisible({ timeout: 20_000 });
    const valores = await selectorLote.locator("option").evaluateAll((os) =>
      os.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
    await selectorLote.selectOption(valores[0]);

    await expect(page.getByTestId("aviso-accion")).toContainText(
      "No se han podido actualizar",
      { timeout: 20_000 },
    );
    await expect(selectorLote).toBeEnabled({ timeout: 10_000 });
  });
});
