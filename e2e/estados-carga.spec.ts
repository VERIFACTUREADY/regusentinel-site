/**
 * Exito, vacio y error en las pantallas que cargan datos.
 *
 * EL DEFECTO QUE COMPRUEBAN
 * --------------------------
 * Estas pantallas cargaban con `.catch(() => {})`. Cuando la peticion fallaba,
 * la lista se quedaba vacia y se pintaba el estado vacio: "No hay expedientes",
 * "Sin tareas". Indistinguible de que de verdad no hubiera nada, y significando
 * lo contrario: el usuario cerraba tranquilo una pantalla que le estaba
 * ocultando su trabajo.
 *
 * De ahi que cada pantalla se compruebe en los tres estados, y que en el de
 * error se exija ADEMAS que el estado vacio NO aparezca. Confundirlos es
 * exactamente el fallo.
 */
import { type Page } from "@playwright/test";
import { test, expect, permitirFalloEn, pantallaUtil } from "./vigilancia";
import { E2E } from "./seed-e2e";

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

interface Pantalla {
  nombre: string;
  ruta: string;
  api: string;
  apiClave: string;
  /** Accion que provoca la carga, si no ocurre sola al abrir la pantalla. */
  disparar?: (page: Page) => Promise<void>;
}

/** Pantallas con su ruta de datos y la ruta de navegador que las muestra. */
const PANTALLAS: Pantalla[] = [
  { nombre: "Expedientes", ruta: "/cases", api: "**/api/cases?**", apiClave: "/api/cases" },
  { nombre: "Tareas", ruta: "/tasks", api: "**/api/tasks?**", apiClave: "/api/tasks" },
  {
    nombre: "Aprobaciones",
    ruta: "/approvals",
    api: "**/api/approvals**",
    apiClave: "/api/approvals",
  },
  { nombre: "Auditoria", ruta: "/audit", api: "**/api/audit-logs?**", apiClave: "/api/audit-logs" },
  {
    nombre: "Automatizaciones",
    ruta: "/workflow-logs",
    api: "**/api/workflow-logs?**",
    apiClave: "/api/workflow-logs",
    /*
     * Esta pantalla recibe la primera pagina del componente de servidor y solo
     * llama al API al cambiar de filtro o de pagina. Interceptar la carga
     * inicial no dispara nada, asi que la prueba provoca la peticion como lo
     * haria una persona: pulsando el filtro de estado.
     *
     * El boton lleva dentro un contador, asi que su nombre accesible es "Error 3"
     * y no "Error": buscarlo con coincidencia exacta no lo encontraba.
     */
    disparar: async (page: Page) => {
      await page.getByRole("button", { name: /^Error/ }).first().click();
    },
  },
  {
    nombre: "Documentos",
    ruta: "/documents",
    api: "**/api/documents?**",
    apiClave: "/api/documents",
    // Como automatizaciones: la primera pagina llega del componente de
    // servidor y solo se llama al API al buscar o cambiar de pagina.
    disparar: async (page: Page) => {
      await page.locator('input[type="text"], input[type="search"]').first().fill("acta");
    },
  },
  { nombre: "Kanban", ruta: "/cases/kanban", api: "**/api/cases/kanban**", apiClave: "/api/cases/kanban" },
  {
    nombre: "Linea de tiempo",
    ruta: "/tasks/timeline",
    api: "**/api/tasks/timeline**",
    apiClave: "/api/tasks/timeline",
  },
  {
    nombre: "Avisos",
    ruta: "/notifications",
    api: "**/api/notifications?**",
    apiClave: "/api/notifications",
  },
];

test.describe("Estados de carga", () => {
  for (const p of PANTALLAS) {
    test(`${p.nombre}: carga correcta sin pantalla rota`, async ({ page }) => {
      await login(page, E2E.owner);
      await page.goto(p.ruta);

      // Ni pagina de error de Next, ni pantalla en blanco, ni carga infinita.
      await pantallaUtil(page);
      // Y sin aviso de error: la carga ha ido bien.
      await expect(page.getByTestId("carga-error")).toHaveCount(0);
    });

    test(`${p.nombre}: si la API falla, se ve el error y NO el estado vacio`, async ({
      page,
    }) => {
      await login(page, E2E.owner);

      // El 500 es el escenario, no un defecto del producto.
      permitirFalloEn(page, p.apiClave);
      await page.route(p.api, (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "fallo simulado" }),
        }),
      );

      await page.goto(p.ruta);
      if (p.disparar) await p.disparar(page);

      // Escritorio y movil pintan cada uno su bloque; el DOM contiene los dos.
      const aviso = page.getByTestId("carga-error").first();
      await expect(aviso).toBeVisible({ timeout: 20_000 });
      await expect(aviso).toContainText("No se han podido cargar");
      await expect(aviso.getByRole("button", { name: "Reintentar" })).toBeVisible();

      // Lo que no puede pasar: que se anuncie que no hay nada.
      await expect(page.getByTestId("carga-vacio")).toHaveCount(0);
    });

    test(`${p.nombre}: Reintentar vuelve a pedir los datos`, async ({ page }) => {
      await login(page, E2E.owner);

      permitirFalloEn(page, p.apiClave);
      let roto = true;
      await page.route(p.api, async (route) => {
        if (roto) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "fallo simulado" }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(p.ruta);
      if (p.disparar) await p.disparar(page);
      await expect(page.getByTestId("carga-error").first()).toBeVisible({ timeout: 20_000 });

      roto = false;
      await page.getByTestId("carga-error").first().getByRole("button", { name: "Reintentar" }).click();
      await expect(page.getByTestId("carga-error")).toHaveCount(0, { timeout: 20_000 });
    });

    test(`${p.nombre}: sin datos dice que no hay nada, no un error`, async ({ page }) => {
      await login(page, E2E.owner);

      // Respuesta valida y vacia: aqui SI toca el estado vacio.
      await page.route(p.api, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          /*
           * Cuerpo valido y vacio que sirve a todas: cada pantalla lee su clave
           * y las demas la ignoran. `columns` y `documents` son obligatorias
           * para kanban y documentos, que validan la forma de la respuesta y
           * tratarian su ausencia como un error — con razon.
           */
          body: JSON.stringify({
            cases: [],
            tasks: [],
            approvals: [],
            logs: [],
            documents: [],
            columns: {},
            items: [],
            total: 0,
          }),
        }),
      );

      await page.goto(p.ruta);
      await expect(page.getByTestId("carga-error")).toHaveCount(0);
      await pantallaUtil(page);
    });
  }

  test("una sesion caducada se explica, no se disfraza de lista vacia", async ({ page }) => {
    await login(page, E2E.owner);

    permitirFalloEn(page, "/api/cases");
    await page.route("**/api/cases?**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "No autenticado" }),
      }),
    );

    await page.goto("/cases");
    await expect(page.getByTestId("carga-error").first()).toContainText(/sesion ha caducado/i);
  });

  test("el buscador avisa si su busqueda falla", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/dashboard");

    permitirFalloEn(page, "/api/search");
    await page.route("**/api/search**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "fallo simulado" }),
      }),
    );

    // El buscador se abre con la tecla rapida o con su boton.
    await page.keyboard.press("Control+k");
    const caja = page.locator('input[placeholder*="Buscar"], input[type="search"]').first();
    if (await caja.count()) {
      await caja.fill("expediente");
      await expect(page.getByTestId("carga-error").first()).toBeVisible({ timeout: 20_000 });
    }
  });
});
