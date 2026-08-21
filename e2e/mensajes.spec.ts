/**
 * /messages — Mensajes del portal, conducido como lo conduce un usuario.
 *
 * QUE VIGILA ESTA SUITE
 * ---------------------
 * La pantalla tenia dos fallos silenciosos, y los dos mentian en la misma
 * direccion —tranquilizar—:
 *
 *   1. La lista de conversaciones cargaba con
 *      `.then(r => r.ok ? r.json() : null)` seguido de `.catch(() => {})`.
 *      Con un 401, un 403, un 500 o la red caida, la pantalla mostraba
 *      **«No hay mensajes sin leer»**: exactamente lo contrario de lo que
 *      podia estar pasando.
 *
 *   2. Al abrir un hilo se disparaba un PUT al aire con `.catch(() => {})` y
 *      el contador bajaba en el acto. Como ese PUT exige `cases.update` —que
 *      un VIEWER NO tiene—, un VIEWER veia desaparecer el «3 sin leer» y al
 *      recargar volvia. El estado de lectura se falseaba.
 *
 * De ahi que cada camino de fallo se compruebe DOS veces: que el aviso
 * aparece, y que el estado vacio o el contador falso NO aparecen.
 */
import { type Page } from "@playwright/test";
import { test, expect, pantallaUtil, permitirFalloEn } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E, CIFRAS_AVISOS } from "./seed-e2e";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Devuelve los mensajes de la familia sin leer que hay EN LA BASE.
 *
 * Es lo que permite distinguir «el contador ha bajado» de «se ha guardado»:
 * la pantalla puede decir misa, pero esto es el estado real.
 */
async function sinLeerEnBase(ref: string): Promise<number> {
  return prisma.portalMessage.count({
    where: { case: { ref }, fromFamily: true, readAt: null },
  });
}

/** Deja la organizacion de avisos como la dejo el sembrado. */
async function restaurarMensajes() {
  // Los mensajes «sin leer» vuelven a estarlo…
  await prisma.portalMessage.updateMany({
    where: {
      case: { org: { slug: E2E.avisos.slug } },
      fromFamily: true,
      content: { startsWith: E2E.avisos.textoSinLeer },
    },
    data: { readAt: null },
  });
  // …y las respuestas que hayan escrito las pruebas se borran, porque cambian
  // el «ultimo mensaje» de la conversacion y su recuento.
  await prisma.portalMessage.deleteMany({
    where: { case: { org: { slug: E2E.avisos.slug } }, fromFamily: false },
  });
}

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

async function irAMensajes(page: Page) {
  // Por el enlace del menu, no con `goto`: asi se comprueba de paso que el
  // enlace existe y lleva donde dice.
  await page.getByRole("link", { name: "Mensajes portal" }).first().click();
  await page.waitForURL("**/messages");
  await pantallaUtil(page);
}

const conversacion = (page: Page, ref: string) => page.getByTestId(`conversacion-${ref}`);

test.describe("Mensajes: listado de conversaciones", () => {
  test.afterEach(restaurarMensajes);

  test("el filtro «Sin leer» muestra solo las que tienen mensajes pendientes", async ({
    page,
  }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);

    // «Sin leer» es el filtro de partida.
    await expect(page.getByTestId("filtro-unread")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("recuento-conversaciones")).toContainText(
      `${CIFRAS_AVISOS.conversacionesSinLeer} conversaciones`,
    );

    await expect(conversacion(page, E2E.avisos.caseConDos)).toBeVisible();
    await expect(conversacion(page, E2E.avisos.caseConUno)).toBeVisible();
    // La que tiene todo leido no entra…
    await expect(conversacion(page, E2E.avisos.caseLeido)).toHaveCount(0);
    // …y la que no tiene ningun mensaje, tampoco.
    await expect(conversacion(page, E2E.avisos.caseSinMensajes)).toHaveCount(0);
  });

  test("el filtro «Todos» añade la conversacion ya leida", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);

    await page.getByTestId("filtro-all").click();

    await expect(page.getByTestId("recuento-conversaciones")).toContainText(
      `${CIFRAS_AVISOS.conversacionesTotales} conversaciones`,
    );
    await expect(conversacion(page, E2E.avisos.caseLeido)).toBeVisible();
    // El expediente sin ningun mensaje sigue sin aparecer: no hay conversacion.
    await expect(conversacion(page, E2E.avisos.caseSinMensajes)).toHaveCount(0);
  });

  test("el contador total de sin leer cuadra con la base", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);

    await expect(page.getByTestId("total-sin-leer")).toContainText(
      `${CIFRAS_AVISOS.totalSinLeer} sin leer`,
    );
  });

  test("cada conversacion muestra referencia, causante y ultimo mensaje", async ({
    page,
  }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);

    const fila = conversacion(page, E2E.avisos.caseConDos);
    await expect(fila).toContainText(E2E.avisos.caseConDos);
    await expect(fila).toContainText("Causante Dos Sin Leer");
    await expect(fila).toContainText(E2E.avisos.textoSinLeer);
    // Marca de cuantos sin leer.
    await expect(fila).toContainText("2");
  });

  test("se selecciona la primera conversacion al entrar", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);

    // El hilo de la derecha ya trae mensajes, sin tener que pulsar nada.
    await expect(page.getByTestId("hilo-mensajes")).toContainText(E2E.avisos.textoSinLeer);
  });

  test("se puede cambiar de conversacion y el hilo cambia con ella", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);

    await conversacion(page, E2E.avisos.caseConUno).click();
    // La cabecera del hilo pasa a ser la del otro expediente.
    await expect(
      page.getByRole("link", { name: E2E.avisos.caseConUno }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("hilo-mensajes")).toContainText(
      "Mensaje sin leer de la familia 1",
    );
  });

  test("el enlace «Ver expediente» abre el expediente", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);

    await page.getByRole("link", { name: "Ver expediente →" }).click();
    await page.waitForURL("**/cases/**");
  });
});

test.describe("Mensajes: la lista caida NO se disfraza de vacia", () => {
  test.afterEach(restaurarMensajes);

  for (const [codigo, esperado] of [
    [401, "Tu sesion ha caducado"],
    [403, "No tienes permiso para ver los mensajes"],
    [500, "El servidor ha respondido 500"],
  ] as const) {
    test(`un HTTP ${codigo} se explica y NO dice «No hay mensajes sin leer»`, async ({
      page,
    }) => {
      await login(page, E2E.avisos.owner);
      permitirFalloEn(page, "/api/messages");
      await page.route("**/api/messages*", (route) =>
        route.fulfill({ status: codigo, contentType: "application/json", body: "{}" }),
      );
      await irAMensajes(page);

      const aviso = page.getByTestId("carga-error");
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(esperado);
      await expect(aviso).toContainText("las conversaciones");
      // Lo que de verdad importa: el estado vacio NO esta.
      await expect(page.getByTestId("vacio-conversaciones")).toHaveCount(0);
      await expect(page.getByText("No hay mensajes sin leer")).toHaveCount(0);
      await expect(page.getByText("Sin conversaciones")).toHaveCount(0);

      await page.unroute("**/api/messages*");
    });
  }

  test("un fallo de red se explica igual que uno del servidor", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/api/messages");
    await page.route("**/api/messages*", (route) => route.abort("failed"));
    await irAMensajes(page);

    await expect(page.getByTestId("carga-error")).toBeVisible();
    await expect(page.getByTestId("vacio-conversaciones")).toHaveCount(0);
    await page.unroute("**/api/messages*");
  });

  test("una respuesta 200 con forma inesperada se detecta", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await page.route("**/api/messages*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        // Sin `conversations` ni `totalUnread`: antes dejaba la pantalla
        // reventando al recorrer `undefined`.
        body: JSON.stringify({ resultado: "vale" }),
      }),
    );
    await irAMensajes(page);

    await expect(page.getByTestId("carga-error")).toContainText("formato esperado");
    await expect(page.getByTestId("vacio-conversaciones")).toHaveCount(0);
    await page.unroute("**/api/messages*");
  });

  test("«Reintentar» vuelve a pedirlo y la lista aparece", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/api/messages");
    await page.route("**/api/messages*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await irAMensajes(page);
    await expect(page.getByTestId("carga-error")).toBeVisible();

    await page.unroute("**/api/messages*");
    await page.getByTestId("carga-error").getByRole("button", { name: "Reintentar" }).click();

    await expect(conversacion(page, E2E.avisos.caseConDos)).toBeVisible();
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("un estado vacio REAL sigue diciendo que no hay nada", async ({ page }) => {
    // Organizacion sin ninguna conversacion: aqui el vacio es cierto.
    await login(page, E2E.panelNueva.owner);
    await page.goto("/messages");
    await pantallaUtil(page);

    await expect(page.getByTestId("vacio-conversaciones")).toBeVisible();
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });
});

test.describe("Mensajes: marcar como leido", () => {
  test.afterEach(restaurarMensajes);

  test("al abrir el hilo se marca de verdad y persiste tras recargar", async ({ page }) => {
    expect(await sinLeerEnBase(E2E.avisos.caseConDos)).toBe(2);

    await login(page, E2E.avisos.owner);
    await irAMensajes(page);

    // Se abre la conversacion con dos sin leer.
    await conversacion(page, E2E.avisos.caseConDos).click();
    await expect(page.getByTestId("hilo-mensajes")).toContainText(E2E.avisos.textoSinLeer);

    // El contador baja…
    await expect(page.getByTestId("total-sin-leer")).toContainText(
      `${CIFRAS_AVISOS.totalSinLeer - 2} sin leer`,
    );
    // …y el servidor lo ha guardado de verdad.
    await expect(async () => {
      expect(await sinLeerEnBase(E2E.avisos.caseConDos)).toBe(0);
    }).toPass({ timeout: 10_000 });

    // Persiste: al recargar sigue leido.
    await page.reload();
    await pantallaUtil(page);
    await page.getByTestId("filtro-all").click();
    await expect(conversacion(page, E2E.avisos.caseConDos)).toBeVisible();
    expect(await sinLeerEnBase(E2E.avisos.caseConDos)).toBe(0);
  });

  test("un VIEWER no puede marcar leido, y el contador NO miente", async ({ page }) => {
    /*
     * Esta es la prueba central del defecto.
     *
     * La politica REAL: `PUT /api/cases/[id]/portal-messages` exige
     * `cases.update`, que el VIEWER no tiene (si tiene `cases.read`, asi que
     * puede leer el hilo). Antes la interfaz bajaba el contador igualmente y
     * al recargar volvia: el estado de lectura se falseaba.
     */
    expect(await sinLeerEnBase(E2E.avisos.caseConDos)).toBe(2);

    await login(page, E2E.avisos.viewer);
    permitirFalloEn(page, "/portal-messages");
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    // El hilo SÍ se ve: el VIEWER tiene permiso de lectura.
    await expect(page.getByTestId("hilo-mensajes")).toContainText(E2E.avisos.textoSinLeer);

    // Pero el marcado se rechaza, y se dice.
    const aviso = page.getByTestId("error-marcar-leido");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("No tienes permiso");
    await expect(aviso).toContainText("Siguen contando como sin leer");

    // El contador NO ha bajado…
    await expect(page.getByTestId("total-sin-leer")).toContainText(
      `${CIFRAS_AVISOS.totalSinLeer} sin leer`,
    );
    // …y en la base siguen sin leer, que es la verdad.
    expect(await sinLeerEnBase(E2E.avisos.caseConDos)).toBe(2);
  });

  test("un 500 al marcar avisa, deja reintentar y no toca el contador", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/portal-messages");
    await page.route("**/api/cases/*/portal-messages", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "La base de datos no responde" }),
        });
        return;
      }
      await route.continue();
    });
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    await expect(page.getByTestId("error-marcar-leido")).toContainText(
      "La base de datos no responde",
    );
    await expect(page.getByTestId("total-sin-leer")).toContainText(
      `${CIFRAS_AVISOS.totalSinLeer} sin leer`,
    );
    expect(await sinLeerEnBase(E2E.avisos.caseConDos)).toBe(2);

    // Quitado el fallo, «Reintentar» lo arregla.
    await page.unroute("**/api/cases/*/portal-messages");
    await page
      .getByTestId("error-marcar-leido")
      .getByRole("button", { name: "Reintentar" })
      .click();
    await expect(page.getByTestId("error-marcar-leido")).toHaveCount(0);
    await expect(page.getByTestId("total-sin-leer")).toContainText(
      `${CIFRAS_AVISOS.totalSinLeer - 2} sin leer`,
    );
  });

  test("un fallo de red al marcar tampoco falsea el contador", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/portal-messages");
    await page.route("**/api/cases/*/portal-messages", (route) =>
      route.request().method() === "PUT" ? route.abort("failed") : route.continue(),
    );
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    await expect(page.getByTestId("error-marcar-leido")).toContainText("error de red");
    await expect(page.getByTestId("total-sin-leer")).toContainText(
      `${CIFRAS_AVISOS.totalSinLeer} sin leer`,
    );
    expect(await sinLeerEnBase(E2E.avisos.caseConDos)).toBe(2);
    await page.unroute("**/api/cases/*/portal-messages");
  });

  test("el hilo caido NO aparenta que la familia no haya escrito", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/portal-messages");
    await page.route("**/api/cases/*/portal-messages", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
        return;
      }
      await route.continue();
    });
    await irAMensajes(page);

    await expect(page.getByTestId("carga-error")).toBeVisible();
    await expect(page.getByText("Sin mensajes en este expediente.")).toHaveCount(0);
    await page.unroute("**/api/cases/*/portal-messages");
  });

  test("tras leer, el filtro «Sin leer» deja de mostrar esa conversacion", async ({
    page,
  }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);

    await conversacion(page, E2E.avisos.caseConDos).click();
    await expect(async () => {
      expect(await sinLeerEnBase(E2E.avisos.caseConDos)).toBe(0);
    }).toPass({ timeout: 10_000 });

    // Se fuerza una recarga de la lista cambiando de filtro y volviendo.
    await page.getByTestId("filtro-all").click();
    await expect(conversacion(page, E2E.avisos.caseConDos)).toBeVisible();
    await page.getByTestId("filtro-unread").click();

    await expect(conversacion(page, E2E.avisos.caseConDos)).toHaveCount(0);
    await expect(conversacion(page, E2E.avisos.caseConUno)).toBeVisible();
    await expect(page.getByTestId("total-sin-leer")).toContainText(
      `${CIFRAS_AVISOS.totalSinLeer - 2} sin leer`,
    );
  });
});

test.describe("Mensajes: enviar respuesta", () => {
  test.afterEach(restaurarMensajes);

  test("se escribe, se envia, aparece y persiste tras recargar", async ({ page }) => {
    const texto = `Respuesta del despacho ${Date.now()}`;

    await login(page, E2E.avisos.owner);
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    await page.getByTestId("campo-respuesta").fill(texto);
    await page.getByTestId("boton-enviar-mensaje").click();

    await expect(page.getByTestId("hilo-mensajes")).toContainText(texto);
    // El campo se vacia: senal de que se ha ido.
    await expect(page.getByTestId("campo-respuesta")).toHaveValue("");

    // Persiste de verdad.
    await page.reload();
    await pantallaUtil(page);
    await expect(page.getByTestId("hilo-mensajes")).toContainText(texto);
    expect(
      await prisma.portalMessage.count({
        where: { case: { ref: E2E.avisos.caseConDos }, content: texto, fromFamily: false },
      }),
    ).toBe(1);
  });

  test("⌘Enter tambien envia", async ({ page }) => {
    const texto = `Enviado con teclado ${Date.now()}`;

    await login(page, E2E.avisos.owner);
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    await page.getByTestId("campo-respuesta").fill(texto);
    await page.getByTestId("campo-respuesta").press("ControlOrMeta+Enter");

    await expect(page.getByTestId("hilo-mensajes")).toContainText(texto);
  });

  test("la familia lo ve en su portal", async ({ page, context }) => {
    /*
     * La mitad que de verdad importa: que el mensaje llegue a quien va
     * dirigido. Se comprueba abriendo el portal con su token, como haria el
     * familiar desde el enlace de su correo.
     */
    const texto = `Para la familia ${Date.now()}`;
    const caso = await prisma.case.findFirstOrThrow({
      where: { ref: E2E.avisos.caseConDos },
      select: { portalToken: true },
    });

    await login(page, E2E.avisos.owner);
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();
    await page.getByTestId("campo-respuesta").fill(texto);
    await page.getByTestId("boton-enviar-mensaje").click();
    await expect(page.getByTestId("hilo-mensajes")).toContainText(texto);

    // Navegador limpio: la familia no tiene sesion de gestor.
    const familia = await context.browser()!.newContext();
    const paginaFamilia = await familia.newPage();
    await paginaFamilia.goto(`/portal/${caso.portalToken}`);
    await expect(paginaFamilia.getByText(texto)).toBeVisible({ timeout: 20_000 });
    await familia.close();
  });

  test("el texto vacio no se envia", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    // Con el campo vacio el boton esta inhabilitado.
    await expect(page.getByTestId("boton-enviar-mensaje")).toBeDisabled();
    // Y con solo espacios, tambien.
    await page.getByTestId("campo-respuesta").fill("   ");
    await expect(page.getByTestId("boton-enviar-mensaje")).toBeDisabled();
  });

  test("el doble envio no duplica el mensaje", async ({ page }) => {
    const texto = `Sin duplicar ${Date.now()}`;
    let llamadas = 0;

    await login(page, E2E.avisos.owner);
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    await page.route("**/api/cases/*/portal-messages", async (route) => {
      if (route.request().method() === "POST") {
        llamadas++;
        // Lenta a proposito: da tiempo al segundo disparo.
        await new Promise((r) => setTimeout(r, 1200));
      }
      await route.continue();
    });

    await page.getByTestId("campo-respuesta").fill(texto);
    await page.getByTestId("boton-enviar-mensaje").click();
    // Mientras vuela, ⌘Enter no debe colar un segundo envio.
    await page.getByTestId("campo-respuesta").press("ControlOrMeta+Enter");

    await expect(page.getByTestId("hilo-mensajes")).toContainText(texto, { timeout: 15_000 });
    expect(llamadas).toBe(1);
    expect(
      await prisma.portalMessage.count({
        where: { case: { ref: E2E.avisos.caseConDos }, content: texto },
      }),
    ).toBe(1);
    await page.unroute("**/api/cases/*/portal-messages");
  });

  for (const [codigo, cuerpo, esperado] of [
    [400, { error: "El mensaje no puede estar vacio" }, "El mensaje no puede estar vacio"],
    [403, {}, "No tienes permiso para responder"],
    [500, { error: "Fallo del servidor" }, "Fallo del servidor"],
  ] as const) {
    test(`un HTTP ${codigo} al enviar avisa y NO pinta el mensaje`, async ({ page }) => {
      const texto = `No deberia aparecer ${codigo} ${Date.now()}`;

      await login(page, E2E.avisos.owner);
      permitirFalloEn(page, "/portal-messages");
      await irAMensajes(page);
      await conversacion(page, E2E.avisos.caseConDos).click();

      await page.route("**/api/cases/*/portal-messages", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: codigo,
            contentType: "application/json",
            body: JSON.stringify(cuerpo),
          });
          return;
        }
        await route.continue();
      });

      await page.getByTestId("campo-respuesta").fill(texto);
      await page.getByTestId("boton-enviar-mensaje").click();

      await expect(page.getByTestId("error-enviar-mensaje")).toContainText(esperado);
      // Ver el mensaje en pantalla ES, para el usuario, la prueba de que se ha
      // enviado. Si no se guardo, no puede aparecer.
      await expect(page.getByTestId("hilo-mensajes")).not.toContainText(texto);
      // Y el texto sigue en el campo, para no perder lo escrito.
      await expect(page.getByTestId("campo-respuesta")).toHaveValue(texto);

      await page.unroute("**/api/cases/*/portal-messages");
    });
  }

  test("un fallo de red al enviar avisa y conserva el texto", async ({ page }) => {
    const texto = `Se cae la red ${Date.now()}`;

    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/portal-messages");
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    await page.route("**/api/cases/*/portal-messages", (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );

    await page.getByTestId("campo-respuesta").fill(texto);
    await page.getByTestId("boton-enviar-mensaje").click();

    await expect(page.getByTestId("error-enviar-mensaje")).toBeVisible();
    await expect(page.getByTestId("hilo-mensajes")).not.toContainText(texto);
    await expect(page.getByTestId("campo-respuesta")).toHaveValue(texto);
    await page.unroute("**/api/cases/*/portal-messages");
  });

  test("una respuesta que no es JSON no ensena «Unexpected token»", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/portal-messages");
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    await page.route("**/api/cases/*/portal-messages", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 502,
          contentType: "text/html",
          body: "<!DOCTYPE html><h1>502</h1>",
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId("campo-respuesta").fill("Hola");
    await page.getByTestId("boton-enviar-mensaje").click();

    const aviso = page.getByTestId("error-enviar-mensaje");
    await expect(aviso).toBeVisible();
    await expect(aviso).not.toContainText("Unexpected token");
    await expect(aviso).toContainText("502");
    await page.unroute("**/api/cases/*/portal-messages");
  });

  test("un 200 sin cuerpo valido no se da por enviado", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);
    await conversacion(page, E2E.avisos.caseConDos).click();

    await page.route("**/api/cases/*/portal-messages", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId("campo-respuesta").fill("Sin confirmacion");
    await page.getByTestId("boton-enviar-mensaje").click();

    await expect(page.getByTestId("error-enviar-mensaje")).toContainText(
      "no ha confirmado el envio",
    );
    await page.unroute("**/api/cases/*/portal-messages");
  });
});

test.describe("Mensajes: roles y aislamiento", () => {
  test.afterEach(restaurarMensajes);

  // Politica REAL: `/api/messages` exige `cases.read`, que tienen los cuatro
  // roles. No se inventa ninguna restriccion que no exista.
  for (const rol of ["owner", "manager", "operador", "viewer"] as const) {
    test(`un ${rol.toUpperCase()} entra y ve las conversaciones`, async ({ page }) => {
      await login(page, E2E.avisos[rol]);
      // El VIEWER recibe un 403 al marcar leido, que es la politica real.
      if (rol === "viewer") permitirFalloEn(page, "/portal-messages");
      await irAMensajes(page);
      await expect(conversacion(page, E2E.avisos.caseConDos)).toBeVisible();
    });
  }

  test("no se ve ni una conversacion de la organizacion vecina", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);
    await page.getByTestId("filtro-all").click();

    const cuerpo = page.locator("body");
    await expect(cuerpo).not.toContainText(E2E.avisosVecina.caseRef);
    await expect(cuerpo).not.toContainText(E2E.avisosVecina.mensaje);
    await expect(cuerpo).not.toContainText(E2E.avisosVecina.autor);
  });

  test("el contador tampoco suma los mensajes de la vecina", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAMensajes(page);
    // La vecina tiene 1 sin leer: si se colara, esta cifra subiria.
    await expect(page.getByTestId("total-sin-leer")).toContainText(
      `${CIFRAS_AVISOS.totalSinLeer} sin leer`,
    );
  });

  test("el servidor rechaza leer, marcar y escribir en un expediente ajeno", async ({
    page,
  }) => {
    /*
     * La segunda mitad de la autorizacion: esconder la conversacion no basta.
     * Se piden las tres operaciones directamente contra el expediente de la
     * vecina, con la sesion de la organizacion de avisos.
     */
    await login(page, E2E.avisos.owner);
    const ajeno = await prisma.case.findFirstOrThrow({
      where: { ref: E2E.avisosVecina.caseRef },
      select: { id: true },
    });

    const leer = await page.request.get(`/api/cases/${ajeno.id}/portal-messages`);
    expect(leer.status(), "leer el hilo ajeno").toBe(404);

    const marcar = await page.request.put(`/api/cases/${ajeno.id}/portal-messages`);
    expect(marcar.status(), "marcar leido el hilo ajeno").toBe(404);

    const escribir = await page.request.post(`/api/cases/${ajeno.id}/portal-messages`, {
      data: { content: "Intento de escribir en la organizacion vecina" },
    });
    expect(escribir.status(), "escribir en el hilo ajeno").toBe(404);

    // Y no se ha creado nada.
    expect(
      await prisma.portalMessage.count({
        where: { caseId: ajeno.id, fromFamily: false },
      }),
    ).toBe(0);

    // El mensaje de la vecina sigue sin leer: no se ha tocado.
    expect(await sinLeerEnBase(E2E.avisosVecina.caseRef)).toBe(1);
  });
});
