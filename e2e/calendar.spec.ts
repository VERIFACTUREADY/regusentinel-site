/**
 * Calendario de plazos, conducido como lo conduce un usuario.
 *
 * El navegador corre en `Europe/Madrid` (ver playwright.config.ts). No es un
 * detalle: el calendario calculaba las claves de dia con `toISOString()`, que
 * pasa a UTC, y en Espana medianoche local es el dia ANTERIOR en UTC. El
 * calendario entero salia desplazado veinticuatro horas —las tareas del dia 15
 * en la casilla del 14, el circulo de "hoy" en la casilla de manana— y ninguna
 * comprobacion lo veia, porque los servidores y la CI corren en UTC.
 *
 * De ahi que estas pruebas comprueben la POSICION REAL de la tarea dentro de la
 * rejilla, no solo que el numero aparezca en algun sitio de la pagina.
 */
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
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
}

/** La casilla de la rejilla que muestra ese numero de dia. */
function casillaDelDia(page: Page, dia: number) {
  return page
    .locator("div.grid.grid-cols-7 > button")
    .filter({ has: page.locator(`span:text-is("${dia}")`) })
    .first();
}

test.describe("Calendario", () => {
  test("una tarea aparece en la casilla de su dia, no en la del dia anterior", async ({
    page,
  }) => {
    // Vencimiento a mediodia UTC: asi la fecha es la misma en UTC y en Madrid y,
    // si se ilumina la casilla equivocada, la culpa es del cliente y no de una
    // ambiguedad del dato.
    const hoy = new Date();
    const vencimiento = new Date(
      Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 15, 12, 0, 0),
    );

    const expediente = await prisma.case.findFirst({
      where: { org: { slug: E2E.orgSlug } },
      select: { id: true },
    });
    expect(expediente, "el seed debe dejar un expediente").not.toBeNull();

    const tarea = await prisma.task.create({
      data: {
        caseId: expediente!.id,
        title: "Plazo de prueba del calendario",
        category: "FISCAL",
        status: "PENDING",
        deadline: vencimiento,
      },
    });

    try {
      await login(page, E2E.owner);
      await page.goto("/calendar");

      await expect(casillaDelDia(page, 15)).toContainText(/vencid|proxim|próxim|tarea/i);
      // Y la casilla del 14 no debe haberse quedado la tarea.
      await expect(casillaDelDia(page, 14)).not.toContainText(/vencid|proxim|próxim|tarea/i);

      // Al abrir el dia, el detalle trae la tarea y lleva al expediente.
      await casillaDelDia(page, 15).click();
      const enPanel = page.getByText("Plazo de prueba del calendario");
      await expect(enPanel).toBeVisible();
      await enPanel.click();
      await expect(page).toHaveURL(new RegExp(`/cases/${expediente!.id}`));
    } finally {
      await prisma.task.delete({ where: { id: tarea.id } }).catch(() => {});
    }
  });

  test("el circulo de hoy cae en el dia de hoy en horario espanol", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/calendar");

    // Dia de hoy tal y como lo ve el navegador, que esta en Madrid.
    const diaHoy = await page.evaluate(() => new Date().getDate());

    const marcado = page.locator("div.grid.grid-cols-7 > button span.bg-primary");
    await expect(marcado).toHaveCount(1);
    await expect(marcado).toHaveText(String(diaHoy));
  });

  test("cambia de mes y el boton Hoy devuelve al mes actual", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/calendar");

    const titulo = page.locator("h2").first();
    const mesInicial = await titulo.textContent();

    // Mientras se ve el mes actual, "Hoy" no se ofrece: no haria nada.
    await expect(page.getByRole("button", { name: "Hoy" })).toHaveCount(0);

    await page.locator("button:has(path[d='M9 5l7 7-7 7'])").click();
    await expect(titulo).not.toHaveText(mesInicial!);

    await page.getByRole("button", { name: "Hoy" }).click();
    await expect(titulo).toHaveText(mesInicial!);
  });

  test("navegar hacia atras cruzando enero cambia de ano", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/calendar");

    const titulo = page.locator("h2").first();
    const anioInicial = Number((await titulo.textContent())!.match(/\d{4}/)![0]);

    for (let i = 0; i < 12; i++) {
      await page.locator("button:has(path[d='M15 19l-7-7 7-7'])").click();
    }

    const anioFinal = Number((await titulo.textContent())!.match(/\d{4}/)![0]);
    expect(anioFinal).toBe(anioInicial - 1);
  });

  test("si la API falla, muestra un error con Reintentar y no un mes vacio", async ({
    page,
  }) => {
    await login(page, E2E.owner);

    let roto = true;
    await page.route("**/api/tasks/calendar**", async (route) => {
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

    await page.goto("/calendar");

    const aviso = page.getByTestId("calendario-error");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("No se han podido cargar los plazos");

    // Un mes sin plazos diria esto. Un mes que ha fallado no puede decirlo.
    await expect(page.getByText("Ningun plazo en este mes.")).toHaveCount(0);

    // Y los contadores no pueden decir cero cuando no se sabe.
    await expect(page.locator("text=—")).toHaveCount(3);

    // Reintentar tiene que recuperar de verdad la vista.
    roto = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByTestId("calendario-error")).toHaveCount(0);
    await expect(page.locator("div.grid.grid-cols-7 > button").first()).toBeVisible();
  });

  test("una sesion caducada se distingue de un error de servidor", async ({ page }) => {
    await login(page, E2E.owner);

    await page.route("**/api/tasks/calendar**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "No autenticado" }),
      }),
    );

    await page.goto("/calendar");
    await expect(page.getByTestId("calendario-error")).toContainText(/sesion ha caducado/i);
  });

  test("una respuesta 200 con forma inesperada tampoco pasa por buena", async ({ page }) => {
    await login(page, E2E.owner);

    // Un 200 con cuerpo de error dejaba `byDate` sin definir y pintaba el mes
    // vacio, que es la peor forma de fallar.
    await page.route("**/api/tasks/calendar**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: "algo" }),
      }),
    );

    await page.goto("/calendar");
    await expect(page.getByTestId("calendario-error")).toBeVisible();
  });

  test("el estado vacio dice que no hay plazos, y distingue si es por el filtro", async ({
    page,
  }) => {
    await page.route("**/api/tasks/calendar**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          byDate: {},
          stats: { overdue: 0, thisWeek: 0, thisMonth: 0 },
        }),
      }),
    );

    await login(page, E2E.owner);
    await page.goto("/calendar");

    await expect(page.getByText("Ningun plazo en este mes.")).toBeVisible();

    await page.selectOption("select >> nth=0", "me");
    await expect(page.getByText(/con los filtros aplicados/)).toBeVisible();

    // Y ofrece deshacer el filtro, en vez de dejar al usuario adivinando.
    await page.getByRole("button", { name: "Quitar los filtros" }).click();
    await expect(page.getByText("Ningun plazo en este mes.")).toBeVisible();
  });

  test("la exportacion .ics entrega lo que se esta viendo", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/calendar");

    const exportar = page.getByRole("link", { name: /Exportar \.ics/ });

    // Por defecto se ven los plazos de todo el equipo.
    await expect(exportar).toHaveAttribute("href", "/api/tasks/ical?scope=all");

    await page.selectOption("select >> nth=0", "me");
    await expect(exportar).toHaveAttribute("href", "/api/tasks/ical?scope=me");
  });

  test("el fichero .ics descargado es un calendario valido", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/calendar");

    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: /Exportar \.ics/ }).click(),
    ]);

    const ruta = await descarga.path();
    expect(ruta).toBeTruthy();

    const contenido = readFileSync(ruta!, "utf8");
    expect(contenido).toContain("BEGIN:VCALENDAR");
    expect(contenido).toContain("END:VCALENDAR");
  });

  test("filtrar nunca deja la pantalla en blanco", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/calendar");

    await page.selectOption("select >> nth=1", "FISCAL");

    // Pase lo que pase, la rejilla sigue ahi.
    await expect(page.locator("div.grid.grid-cols-7 > button").first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
