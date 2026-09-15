/**
 * /workflow-logs — el registro de ejecuciones de las automatizaciones.
 *
 * QUE VIGILA ESTA SUITE
 * ---------------------
 * Esta pantalla es un AGREGADO: cuenta ejecuciones, calcula una tasa de exito
 * y ofrece la unica accion correctiva que existe sobre un aviso que no llego.
 * Los defectos que se corrigen aqui son de ese tipo —numeros que no cuadran
 * con lo que hay al lado, y acciones que dicen haber hecho algo que no han
 * hecho—:
 *
 *   - «Total ejecuciones» dejaba fuera las que seguian en curso mientras el
 *     boton «En curso» de la fila de abajo las contaba. Dos numeros de la
 *     misma pantalla se contradecian.
 *   - Cada clic en un filtro lanzaba DOS peticiones identicas, porque el
 *     manejador recargaba a mano y ademas cambiaba el estado que disparaba el
 *     efecto que recargaba.
 *   - Volver de la pagina 2 a la 1 no recargaba nada: la tabla se quedaba con
 *     las filas de la pagina 2 mientras el pie decia «1-30 de N».
 *   - Los contadores venian congelados del render inicial. Reintentar una
 *     ejecucion fallida cambiaba su fila a «Exitoso» delante de tus ojos y la
 *     tarjeta «Con error» seguia marcando el numero de antes.
 *   - «No se pudo reintentar la ejecucion» se pintaba en la misma caja gris
 *     con `role="status"` que «3 de 3 recuperadas»: el fallo tenia el aspecto
 *     y el tono del acierto.
 *   - Cuando la regla ya no podia reconstruirse, el servidor devolvia
 *     `retried: 0` y la pantalla decia «No quedaban entregas pendientes de
 *     reintentar». Era falso: seguian pendientes y ya no habia forma de
 *     enviarlas.
 *   - El detalle por destinatario que devuelve el servidor —a quien SI y a
 *     quien NO le llego— se tiraba a la basura.
 *   - El boton «Reintentar fallidas» salia en toda ejecucion PARTIAL o FAILED,
 *     tuviera o no algo pendiente.
 *
 * El correo del reintento se comprueba contra el buzon de pruebas que arranca
 * `scripts/e2e.sh`. No se manda correo real a nadie.
 */
import { type Page, type APIRequestContext } from "@playwright/test";
import { test, expect, pantallaUtil, permitirFalloEn } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E, REGISTROS_POR_PAGINA } from "./seed-e2e";

const prisma = new PrismaClient();
const BANDEJA = process.env.BANDEJA_URL ?? "http://127.0.0.1:8025";

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

async function irAlRegistro(page: Page) {
  await page.goto("/workflow-logs");
  await pantallaUtil(page);
}

async function orgAuto() {
  return prisma.organization.findUniqueOrThrow({
    where: { slug: E2E.automatizaciones.slug },
    select: { id: true },
  });
}

/** Escapa un texto para meterlo dentro de una expresion regular. */
function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * La ejecucion SEMBRADA de la regla de correo, que es la que lleva entregas
 * reales: una FAILED y otra SENT.
 *
 * Se pide la MAS ANTIGUA a proposito. La regla se dispara con
 * `CASE_STATUS_CHANGED`, asi que otras suites que cambian el estado del
 * expediente le crean ejecuciones nuevas —exitosas, porque el SMTP de pruebas
 * acepta todo—. Sin fijar el orden, `findFirst` devolvia a veces una de esas,
 * que no tiene nada pendiente y por tanto no ofrece el boton de reintentar:
 * la prueba fallaba segun que suite se hubiera ejecutado antes.
 */
async function ejecucionConEntregas() {
  return prisma.workflowLog.findFirstOrThrow({
    where: {
      rule: { name: E2E.automatizaciones.reglaCorreo },
      deliveries: { some: { recipient: E2E.automatizaciones.destinatarioFallido } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true },
  });
}

/**
 * Devuelve las entregas de esa ejecucion al estado del sembrado: una FAILED y
 * otra SENT. Sin esto, la primera prueba de reintento deja las dos entregadas
 * y las siguientes no tendrian nada que reintentar.
 */
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
  await prisma.workflowDelivery.updateMany({
    where: { workflowLogId: log.id, recipient: E2E.automatizaciones.destinatarioEntregado },
    data: { status: "SENT", error: null, attempts: 1, lastTriedAt: ahora, sentAt: ahora },
  });
  await prisma.workflowLog.update({
    where: { id: log.id },
    data: { status: "FAILED", error: "SMTP 421: servicio no disponible" },
  });
}

interface Mensaje {
  de: string;
  para: string[];
  asunto: string;
  cuerpo: string;
  recibidoEn: string;
}

async function bandeja(api: APIRequestContext, destinatario: string): Promise<Mensaje[]> {
  const res = await api.get(`${BANDEJA}/mensajes?para=${encodeURIComponent(destinatario)}`);
  if (!res.ok()) throw new Error(`La bandeja de pruebas respondio ${res.status()}.`);
  return (await res.json()) as Mensaje[];
}

/** Espera a que al destinatario le hayan llegado al menos `minimo` mensajes. */
async function esperarCorreos(
  api: APIRequestContext,
  destinatario: string,
  minimo: number,
): Promise<Mensaje[]> {
  const limite = Date.now() + 20_000;
  let ultimos: Mensaje[] = [];
  while (Date.now() < limite) {
    ultimos = await bandeja(api, destinatario);
    if (ultimos.length >= minimo) return ultimos;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(
    `No han llegado ${minimo} correo(s) a ${destinatario} en el tiempo previsto ` +
      `(hay ${ultimos.length}).`,
  );
}

// ─── Totales y tasa de exito ──────────────────────────────────────────────

test.describe("Registro: los numeros de arriba cuadran con la base", () => {
  test("las tarjetas coinciden con lo que hay en la base", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const org = await orgAuto();
    const porEstado = await prisma.workflowLog.groupBy({
      by: ["status"],
      where: { rule: { orgId: org.id } },
      _count: true,
    });
    const cuenta = (estado: string) => porEstado.find((s) => s.status === estado)?._count ?? 0;

    await expect(page.getByTestId("total-exitosas")).toHaveText(String(cuenta("SUCCESS")));
    await expect(page.getByTestId("total-parciales")).toHaveText(String(cuenta("PARTIAL")));
    await expect(page.getByTestId("total-fallidas")).toHaveText(String(cuenta("FAILED")));
  });

  test("«Total ejecuciones» no deja fuera a las que siguen en curso", async ({ page }) => {
    /*
     * El defecto: el total sumaba SUCCESS + PARTIAL + FAILED + SKIPPED y
     * olvidaba PROCESSING, pero el boton «En curso» de justo debajo si las
     * contaba. Con una ejecucion en curso, la suma de los botones superaba al
     * total que tenian encima.
     */
    const org = await orgAuto();
    const regla = await prisma.workflowRule.findFirstOrThrow({
      where: { orgId: org.id, name: E2E.automatizaciones.reglaActiva },
      select: { id: true },
    });
    const enCurso = await prisma.workflowLog.create({
      data: { ruleId: regla.id, status: "PROCESSING" },
    });

    try {
      await login(page, E2E.automatizaciones.owner);
      await irAlRegistro(page);

      const total = Number(await page.getByTestId("total-ejecuciones").innerText());
      const enBase = await prisma.workflowLog.count({ where: { rule: { orgId: org.id } } });
      expect(total, "el total incluye TODAS las ejecuciones registradas").toBe(enBase);

      // Y el boton «En curso» cuenta al menos la que acabamos de crear.
      await expect(page.getByTestId("filtro-estado-PROCESSING")).toContainText("En curso");
    } finally {
      await prisma.workflowLog.delete({ where: { id: enCurso.id } });
    }
  });

  test("una ejecucion en curso no hunde la tasa de exito", async ({ page }) => {
    /*
     * La tasa se mide sobre las TERMINADAS. Meter las que estan corriendo en
     * el denominador hace bajar el porcentaje por el mero hecho de mirar la
     * pantalla mientras se ejecutan, y volver a subir sola despues.
     */
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);
    const antes = await page.getByTestId("tasa-exito").innerText();

    const org = await orgAuto();
    const regla = await prisma.workflowRule.findFirstOrThrow({
      where: { orgId: org.id, name: E2E.automatizaciones.reglaActiva },
      select: { id: true },
    });
    const enCurso = await prisma.workflowLog.create({
      data: { ruleId: regla.id, status: "PROCESSING" },
    });

    try {
      await irAlRegistro(page);
      await expect(page.getByTestId("tasa-exito")).toHaveText(antes);
    } finally {
      await prisma.workflowLog.delete({ where: { id: enCurso.id } });
    }
  });

  test("una PARCIAL no se pinta ni se cuenta como exito", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);
    await page.getByTestId("filtro-estado-PARTIAL").click();
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

    const primera = page.locator("tbody tr").first();
    await expect(primera).toContainText("Parcial");
    await expect(primera).not.toContainText("Exitoso");

    const exitosas = Number(await page.getByTestId("total-exitosas").innerText());
    const parciales = Number(await page.getByTestId("total-parciales").innerText());
    const fallidas = Number(await page.getByTestId("total-fallidas").innerText());
    const org = await orgAuto();
    const omitidas = await prisma.workflowLog.count({
      where: { rule: { orgId: org.id }, status: "SKIPPED" },
    });
    const esperada = Math.round((exitosas / (exitosas + parciales + fallidas + omitidas)) * 100);
    await expect(page.getByTestId("tasa-exito")).toHaveText(`${esperada}%`);
    expect(parciales, "el sembrado tiene parciales que probar").toBeGreaterThan(0);
  });
});

// ─── Filtros ───────────────────────────────────────────────────────────────

test.describe("Registro: filtros", () => {
  for (const estado of ["SUCCESS", "PARTIAL", "FAILED", "SKIPPED"] as const) {
    test(`el filtro ${estado} deja solo filas de ese estado`, async ({ page }) => {
      await login(page, E2E.automatizaciones.owner);
      await irAlRegistro(page);

      await page.getByTestId(`filtro-estado-${estado}`).click();
      await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

      const etiqueta = {
        SUCCESS: "Exitoso",
        PARTIAL: "Parcial",
        FAILED: "Error",
        SKIPPED: "Omitido",
      }[estado];
      const filas = page.locator("tbody tr");
      const n = await filas.count();
      expect(n, "el filtro deja filas que comprobar").toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        await expect(filas.nth(i).locator("td").first()).toHaveText(etiqueta);
      }

      // El boton activo se anuncia como pulsado, no solo con un color.
      await expect(page.getByTestId(`filtro-estado-${estado}`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByTestId("filtro-estado-todos")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
  }

  test("el selector de regla filtra y tiene nombre accesible", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    // Antes era una lista sin rotulo de ningun tipo.
    const selector = page.getByLabel("Regla", { exact: true });
    await expect(selector).toBeVisible();

    const regla = await prisma.workflowRule.findFirstOrThrow({
      where: { name: E2E.automatizaciones.reglaCorreo },
      select: { id: true },
    });
    await selector.selectOption(regla.id);
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

    const enBase = await prisma.workflowLog.count({ where: { ruleId: regla.id } });
    await expect(page.locator("tbody tr")).toHaveCount(Math.min(enBase, REGISTROS_POR_PAGINA));
  });

  test("estado y regla se combinan", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const regla = await prisma.workflowRule.findFirstOrThrow({
      where: { name: E2E.automatizaciones.reglaActiva },
      select: { id: true },
    });
    await page.getByLabel("Regla", { exact: true }).selectOption(regla.id);
    await page.getByTestId("filtro-estado-FAILED").click();
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

    const enBase = await prisma.workflowLog.count({
      where: { ruleId: regla.id, status: "FAILED" },
    });
    await expect(page.locator("tbody tr")).toHaveCount(Math.min(enBase, REGISTROS_POR_PAGINA));
    expect(enBase, "hay filas que comprobar").toBeGreaterThan(0);
  });

  test("cada clic en un filtro lanza UNA sola peticion", async ({ page }) => {
    /*
     * El defecto: `handleFilter` llamaba a `fetchLogs` y ademas cambiaba el
     * estado que disparaba el efecto que llamaba a `fetchLogs`. Dos peticiones
     * identicas por clic, y con ellas la posibilidad de que la respuesta vieja
     * llegara despues de la nueva y pintara la tabla equivocada.
     */
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const peticiones: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/workflow-logs?")) peticiones.push(r.url());
    });

    await page.getByTestId("filtro-estado-FAILED").click();
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    // Margen para que una segunda peticion, si existiera, hubiera salido ya.
    await page.waitForTimeout(500);

    expect(peticiones, `peticiones observadas: ${peticiones.join(" | ")}`).toHaveLength(1);
  });

  test("un filtro sin resultados lo dice, y sin sugerir que no hay nada", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    // La regla borrable no se ha ejecutado nunca.
    const regla = await prisma.workflowRule.findFirstOrThrow({
      where: { name: E2E.automatizaciones.reglaBorrable },
      select: { id: true },
    });
    expect(await prisma.workflowLog.count({ where: { ruleId: regla.id } })).toBe(0);

    await page.getByLabel("Regla", { exact: true }).selectOption(regla.id);
    const vacio = page.getByTestId("vacio-ejecuciones");
    await expect(vacio).toBeVisible();
    await expect(vacio).toContainText("No hay registros con los filtros seleccionados");
    // Y NO el texto de «tus reglas no se han disparado nunca».
    await expect(vacio).not.toContainText("aparecerán aquí cuando se disparen");
  });
});

// ─── Paginacion ────────────────────────────────────────────────────────────

test.describe("Registro: paginacion", () => {
  test("volver de la pagina 2 a la 1 recarga de verdad", async ({ page }) => {
    /*
     * EL DEFECTO: el efecto solo recargaba si `page !== 1 || filterStatus ||
     * filterRule`. Sin filtros, volver a la pagina 1 no cumplia la condicion:
     * la tabla seguia con las filas de la pagina 2 mientras el pie ya decia
     * «1-30 de N». Dos paginas distintas con el mismo contenido.
     */
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const total = await prisma.workflowLog.count({
      where: { rule: { orgId: (await orgAuto()).id } },
    });
    expect(total, "hacen falta mas de una pagina").toBeGreaterThan(REGISTROS_POR_PAGINA);

    // La identidad de la fila, no su texto: dos ejecuciones del mismo estado
    // y la misma regla se ven igual.
    const idDeLaPrimeraFila = () => page.locator("tbody tr").first().getAttribute("data-testid");

    const pagina1 = await idDeLaPrimeraFila();
    await expect(page.getByTestId("rango-ejecuciones")).toContainText(`1–${REGISTROS_POR_PAGINA}`);

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByTestId("rango-ejecuciones")).toContainText(
      `${REGISTROS_POR_PAGINA + 1}–`,
    );
    const pagina2 = await idDeLaPrimeraFila();
    expect(pagina2).not.toBe(pagina1);

    await page.getByRole("button", { name: "Anterior" }).click();
    await expect(page.getByTestId("rango-ejecuciones")).toContainText(`1–${REGISTROS_POR_PAGINA}`);
    // Lo que fallaba: el pie decia «1-30» y la tabla seguia en la pagina 2.
    await expect
      .poll(idDeLaPrimeraFila, {
        message: "volver a la pagina 1 tiene que traer de vuelta sus filas",
      })
      .toBe(pagina1);
  });

  test("la ultima pagina trae el resto y «Siguiente» se inhabilita", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const total = await prisma.workflowLog.count({
      where: { rule: { orgId: (await orgAuto()).id } },
    });
    const paginas = Math.ceil(total / REGISTROS_POR_PAGINA);

    await expect(page.locator("tbody tr")).toHaveCount(REGISTROS_POR_PAGINA);
    for (let i = 1; i < paginas; i++) {
      await page.getByRole("button", { name: "Siguiente" }).click();
    }
    await expect(page.locator("tbody tr")).toHaveCount(
      total - (paginas - 1) * REGISTROS_POR_PAGINA,
    );
    await expect(page.getByTestId("rango-ejecuciones")).toContainText(`de ${total}`);
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });
});

// ─── Fallos de carga ───────────────────────────────────────────────────────

test.describe("Registro: un fallo de carga no se disfraza de «Sin ejecuciones»", () => {
  for (const [codigo, esperado] of [
    [401, "Tu sesion ha caducado"],
    [403, "No tienes permiso para ver el registro"],
    [500, "El servidor ha respondido 500"],
  ] as const) {
    test(`un HTTP ${codigo} al filtrar se explica`, async ({ page }) => {
      await login(page, E2E.automatizaciones.owner);
      await irAlRegistro(page);

      permitirFalloEn(page, "/api/workflow-logs");
      await page.route("**/api/workflow-logs?**", (route) =>
        route.fulfill({ status: codigo, contentType: "application/json", body: "{}" }),
      );
      await page.getByTestId("filtro-estado-FAILED").click();

      const aviso = page.getByTestId("carga-error");
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(esperado);
      await expect(page.getByTestId("vacio-ejecuciones")).toHaveCount(0);
      await expect(page.getByText("Sin ejecuciones")).toHaveCount(0);

      await page.unroute("**/api/workflow-logs?**");
    });
  }

  test("un fallo de red se explica en espanol, sin «Failed to fetch»", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    permitirFalloEn(page, "/api/workflow-logs");
    await page.route("**/api/workflow-logs?**", (route) => route.abort("failed"));
    await page.getByTestId("filtro-estado-FAILED").click();

    const aviso = page.getByTestId("carga-error");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("No se han podido cargar las ejecuciones");
    await expect(page.locator("body")).not.toContainText("Failed to fetch");
    await expect(page.getByTestId("vacio-ejecuciones")).toHaveCount(0);

    await page.unroute("**/api/workflow-logs?**");
  });

  test("una respuesta con forma inesperada no se toma por buena", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    permitirFalloEn(page, "/api/workflow-logs");
    await page.route("**/api/workflow-logs?**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ resultados: [] }),
      }),
    );
    await page.getByTestId("filtro-estado-FAILED").click();

    await expect(page.getByTestId("carga-error")).toContainText("formato esperado");
    await expect(page.getByTestId("vacio-ejecuciones")).toHaveCount(0);

    await page.unroute("**/api/workflow-logs?**");
  });

  test("el boton de reintentar del aviso vuelve a cargar", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    permitirFalloEn(page, "/api/workflow-logs");
    let fallar = true;
    await page.route("**/api/workflow-logs?**", (route) => {
      if (fallar) {
        fallar = false;
        return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      }
      return route.continue();
    });
    await page.getByTestId("filtro-estado-FAILED").click();
    await expect(page.getByTestId("carga-error")).toBeVisible();

    await page.getByRole("button", { name: /Reintentar/ }).click();
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
    await expect(page.locator("tbody tr").first()).toBeVisible();

    await page.unroute("**/api/workflow-logs?**");
  });
});

// ─── Reintentar entregas fallidas ─────────────────────────────────────────

test.describe("Registro: reintentar entregas fallidas", () => {
  test.afterEach(restaurarEntregas);

  test("el boton solo sale donde queda algo pendiente", async ({ page }) => {
    /*
     * Antes salia en TODA ejecucion PARTIAL o FAILED. Las del sembrado que no
     * tienen entregas —porque su accion es un comentario, que no tiene
     * destinatarios— ofrecian un boton que no podia hacer nada.
     */
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);
    await page.getByTestId("filtro-estado-FAILED").click();
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

    const conEntregas = await ejecucionConEntregas();
    await expect(page.getByTestId(`reintentar-${conEntregas.id}`)).toBeVisible();

    const sinEntregas = await prisma.workflowLog.findFirstOrThrow({
      where: {
        rule: { name: E2E.automatizaciones.reglaActiva },
        status: "FAILED",
        deliveries: { none: {} },
      },
      select: { id: true },
    });
    await expect(page.getByTestId(`ejecucion-${sinEntregas.id}`)).toBeVisible();
    await expect(page.getByTestId(`reintentar-${sinEntregas.id}`)).toHaveCount(0);
  });

  test("el reintento escribe al que fallo y NO al que ya lo recibio", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);

    const antesFallido = (await bandeja(page.request, E2E.automatizaciones.destinatarioFallido))
      .length;
    const antesEntregado = (
      await bandeja(page.request, E2E.automatizaciones.destinatarioEntregado)
    ).length;

    await irAlRegistro(page);
    const log = await ejecucionConEntregas();
    await page.getByTestId(`reintentar-${log.id}`).click();

    const aviso = page.getByTestId("reintento-exito");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("1 de 1 entrega(s) recuperada(s)");
    await expect(aviso).toContainText("Estado: Exitoso");

    // El correo llego de verdad.
    const correos = await esperarCorreos(
      page.request,
      E2E.automatizaciones.destinatarioFallido,
      antesFallido + 1,
    );
    expect(correos[correos.length - 1].asunto).toContain(E2E.automatizaciones.asuntoCorreo);

    // Y al que ya lo tenia NO se le ha vuelto a escribir.
    const entregado = await bandeja(page.request, E2E.automatizaciones.destinatarioEntregado);
    expect(entregado.length, "quien ya recibio el aviso no lo recibe otra vez").toBe(
      antesEntregado,
    );

    // La base refleja el cambio.
    const despues = await prisma.workflowLog.findUniqueOrThrow({
      where: { id: log.id },
      select: { status: true },
    });
    expect(despues.status).toBe("SUCCESS");
  });

  test("el aviso dice a QUIEN le llego", async ({ page }) => {
    // El servidor devuelve el resultado por destinatario y la pantalla lo tiraba.
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const log = await ejecucionConEntregas();
    await page.getByTestId(`reintentar-${log.id}`).click();

    const entregas = page.getByTestId("entregas-reintento");
    await expect(entregas).toBeVisible();
    await expect(entregas).toContainText(E2E.automatizaciones.destinatarioFallido);
    await expect(entregas).toContainText("entregada");
  });

  test("los contadores se actualizan tras el reintento", async ({ page }) => {
    // Antes venian congelados del render inicial: la fila pasaba a «Exitoso» y
    // la tarjeta «Con error» seguia marcando el numero de antes.
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const fallidasAntes = Number(await page.getByTestId("total-fallidas").innerText());
    const exitosasAntes = Number(await page.getByTestId("total-exitosas").innerText());

    const log = await ejecucionConEntregas();
    await page.getByTestId(`reintentar-${log.id}`).click();
    await expect(page.getByTestId("reintento-exito")).toBeVisible();

    await expect(page.getByTestId("total-fallidas")).toHaveText(String(fallidasAntes - 1));
    await expect(page.getByTestId("total-exitosas")).toHaveText(String(exitosasAntes + 1));
    // Y el boton desaparece: ya no queda nada pendiente.
    await expect(page.getByTestId(`reintentar-${log.id}`)).toHaveCount(0);
  });

  test("un fallo del reintento se ve como fallo, no como aviso amable", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const log = await ejecucionConEntregas();
    permitirFalloEn(page, "/retry");
    await page.route(`**/api/workflow-logs/${log.id}/retry`, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.getByTestId(`reintentar-${log.id}`).click();

    const aviso = page.getByTestId("reintento-error");
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveAttribute("role", "alert");
    await expect(aviso).toContainText("No se pudo reintentar");
    // El aviso de exito NO esta.
    await expect(page.getByTestId("reintento-exito")).toHaveCount(0);
    // Y la ejecucion sigue fallida en la base.
    const despues = await prisma.workflowLog.findUniqueOrThrow({
      where: { id: log.id },
      select: { status: true },
    });
    expect(despues.status).toBe("FAILED");

    await page.unroute(`**/api/workflow-logs/${log.id}/retry`);
  });

  test("un fallo de red del reintento no dice «Failed to fetch»", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const log = await ejecucionConEntregas();
    permitirFalloEn(page, "/retry");
    await page.route(`**/api/workflow-logs/${log.id}/retry`, (route) => route.abort("failed"));
    await page.getByTestId(`reintentar-${log.id}`).click();

    const aviso = page.getByTestId("reintento-error");
    await expect(aviso).toContainText("Error de conexion");
    await expect(page.locator("body")).not.toContainText("Failed to fetch");

    await page.unroute(`**/api/workflow-logs/${log.id}/retry`);
  });

  test("una ejecucion que ya no existe se dice", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const log = await ejecucionConEntregas();
    permitirFalloEn(page, "/retry");
    await page.route(`**/api/workflow-logs/${log.id}/retry`, (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Ejecución no encontrada" }),
      }),
    );
    await page.getByTestId(`reintentar-${log.id}`).click();

    await expect(page.getByTestId("reintento-error")).toContainText("no encontrada");
    await page.unroute(`**/api/workflow-logs/${log.id}/retry`);
  });

  test("el doble clic no manda el correo dos veces", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const antes = (await bandeja(page.request, E2E.automatizaciones.destinatarioFallido)).length;
    await irAlRegistro(page);

    const log = await ejecucionConEntregas();
    const boton = page.getByTestId(`reintentar-${log.id}`);
    await boton.click();
    // Segundo clic inmediato: el boton se deshabilita y el manejador ademas
    // corta de entrada mientras haya uno en vuelo.
    await boton.click({ force: true, timeout: 2000 }).catch(() => {
      // Si ya ha desaparecido del DOM, mejor: no hay segundo envio posible.
    });
    await expect(page.getByTestId("reintento-exito")).toBeVisible();

    // Margen para que un segundo correo, si hubiera salido, hubiera llegado.
    await page.waitForTimeout(1500);
    const despues = await bandeja(page.request, E2E.automatizaciones.destinatarioFallido);
    expect(despues.length, "un solo correo por reintento").toBe(antes + 1);
  });

  test("si la regla ya no puede reconstruirse, se dice que NO se puede", async ({ page }) => {
    /*
     * EL DEFECTO: el servidor devolvia `retried: 0` tanto cuando no quedaba
     * nada pendiente como cuando quedaba pero era irrecuperable, y la pantalla
     * mostraba en los dos casos «No quedaban entregas pendientes de
     * reintentar». En el segundo caso eso da por resuelto un aviso que sigue
     * sin llegar a su destinatario.
     *
     * Se provoca cambiando la accion de la regla a una que no es de correo:
     * entonces no hay envio que reconstruir.
     */
    const log = await ejecucionConEntregas();
    const regla = await prisma.workflowRule.findFirstOrThrow({
      where: { name: E2E.automatizaciones.reglaCorreo },
      select: { id: true, action: true, actionConfig: true },
    });
    await prisma.workflowRule.update({
      where: { id: regla.id },
      data: { action: "ADD_CASE_COMMENT", actionConfig: { comment: "ya no manda correo" } },
    });

    try {
      await login(page, E2E.automatizaciones.owner);
      await irAlRegistro(page);
      await page.getByTestId(`reintentar-${log.id}`).click();

      const aviso = page.getByTestId("reintento-error");
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText("ya no se pueden reintentar");
      // Y NO el mensaje que daba el aviso por resuelto.
      await expect(page.locator("body")).not.toContainText(
        "No quedaban entregas pendientes de reintentar",
      );
    } finally {
      await prisma.workflowRule.update({
        where: { id: regla.id },
        data: { action: regla.action, actionConfig: regla.actionConfig ?? {} },
      });
    }
  });
});

// ─── Enlaces ───────────────────────────────────────────────────────────────

test.describe("Registro: enlaces", () => {
  test("la referencia del expediente lleva a su ficha", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    await page.getByRole("link", { name: E2E.automatizaciones.caseRef }).first().click();
    await page.waitForURL(/\/cases\//);
    await pantallaUtil(page);
    await expect(page.getByText(E2E.automatizaciones.caseRef).first()).toBeVisible();
  });

  test("el nombre de la regla filtra por esa regla", async ({ page }) => {
    // Antes llevaba a /workflow-rules sin decir cual: habia que buscarla otra vez.
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    await page
      .getByRole("button", {
        name: `Ver solo las ejecuciones de ${E2E.automatizaciones.reglaCorreo}`,
      })
      .first()
      .click();
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

    const regla = await prisma.workflowRule.findFirstOrThrow({
      where: { name: E2E.automatizaciones.reglaCorreo },
      select: { id: true },
    });
    await expect(page.getByLabel("Regla", { exact: true })).toHaveValue(regla.id);
    await expect(page.locator("tbody tr")).toHaveCount(
      Math.min(
        await prisma.workflowLog.count({ where: { ruleId: regla.id } }),
        REGISTROS_POR_PAGINA,
      ),
    );
  });
});

// ─── Roles y aislamiento ───────────────────────────────────────────────────

test.describe("Registro: roles y aislamiento", () => {
  test.afterEach(restaurarEntregas);

  /*
   * Politica REAL de `src/lib/rbac.ts`:
   *   - `workflow.read`   → OWNER, MANAGER, OPERATOR, VIEWER.
   *   - `workflow.manage` → solo OWNER y MANAGER, y es la que exige el
   *     reintento porque provoca envios reales.
   */
  for (const rol of ["owner", "manager", "operador", "viewer"] as const) {
    test(`un ${rol.toUpperCase()} entra y ve el registro`, async ({ page }) => {
      await login(page, E2E.automatizaciones[rol]);
      await irAlRegistro(page);
      await expect(
        page.getByRole("heading", { name: "Registro de automatizaciones" }),
      ).toBeVisible();
      await expect(page.locator("tbody tr").first()).toBeVisible();
    });
  }

  for (const rol of ["operador", "viewer"] as const) {
    test(`un ${rol.toUpperCase()} no ve el boton de reintentar`, async ({ page }) => {
      await login(page, E2E.automatizaciones[rol]);
      await irAlRegistro(page);
      await page.getByTestId("filtro-estado-FAILED").click();
      await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

      const log = await ejecucionConEntregas();
      await expect(page.getByTestId(`ejecucion-${log.id}`)).toBeVisible();
      await expect(page.getByTestId(`reintentar-${log.id}`)).toHaveCount(0);
    });

    test(`el servidor rechaza el reintento de un ${rol.toUpperCase()}`, async ({ page }) => {
      // Esconder el boton no es un control de seguridad.
      await login(page, E2E.automatizaciones[rol]);
      const log = await ejecucionConEntregas();
      const antes = (await bandeja(page.request, E2E.automatizaciones.destinatarioFallido)).length;

      const res = await page.request.post(`/api/workflow-logs/${log.id}/retry`);
      expect(res.status(), "reintentar sin workflow.manage").toBe(403);

      // Y no ha salido ningun correo.
      await page.waitForTimeout(1000);
      expect(
        (await bandeja(page.request, E2E.automatizaciones.destinatarioFallido)).length,
      ).toBe(antes);
      const despues = await prisma.workflowLog.findUniqueOrThrow({
        where: { id: log.id },
        select: { status: true },
      });
      expect(despues.status).toBe("FAILED");
    });
  }

  test("no se ve ni una ejecucion de la organizacion vecina", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);
    await expect(page.locator("body")).not.toContainText(E2E.automatizacionesVecina.regla);
    await expect(page.locator("body")).not.toContainText(E2E.automatizacionesVecina.caseRef);
  });

  test("el servidor rechaza filtrar por una regla ajena", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const ajena = await prisma.workflowRule.findFirstOrThrow({
      where: { name: E2E.automatizacionesVecina.regla },
      select: { id: true },
    });

    const res = await page.request.get(`/api/workflow-logs?ruleId=${ajena.id}`);
    expect(res.status(), "una regla de otra organizacion no existe para mi").toBe(404);
  });

  test("el servidor rechaza reintentar una ejecucion ajena", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const ajena = await prisma.workflowLog.findFirstOrThrow({
      where: { rule: { name: E2E.automatizacionesVecina.regla } },
      select: { id: true },
    });

    const res = await page.request.post(`/api/workflow-logs/${ajena.id}/retry`);
    expect(res.status()).toBe(404);
  });
});

// ─── Robustez del API ──────────────────────────────────────────────────────

test.describe("Registro: el API no se cae con parametros raros", () => {
  test("una pagina que no es un numero no devuelve 500", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const res = await page.request.get("/api/workflow-logs?page=abc");
    expect(res.status(), "`skip: NaN` hacia que Prisma lanzara").toBe(200);
    const cuerpo = (await res.json()) as { page: number; logs: unknown[] };
    expect(cuerpo.page).toBe(1);
    expect(Array.isArray(cuerpo.logs)).toBe(true);
  });

  test("un limite negativo no devuelve las ultimas filas al reves", async ({ page }) => {
    /*
     * `take` negativo en Prisma NO es un error: significa «las ultimas N en
     * orden inverso». La respuesta parecia normal y el orden estaba invertido.
     */
    await login(page, E2E.automatizaciones.owner);
    const res = await page.request.get("/api/workflow-logs?limit=-5");
    expect(res.status()).toBe(200);
    const cuerpo = (await res.json()) as { limit: number; logs: { createdAt: string }[] };
    expect(cuerpo.limit).toBeGreaterThan(0);
    // Y sigue viniendo de la mas reciente a la mas antigua.
    const fechas = cuerpo.logs.map((l) => new Date(l.createdAt).getTime());
    expect([...fechas].sort((a, b) => b - a)).toEqual(fechas);
  });

  test("un estado inventado se rechaza con 400, no con 500", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const res = await page.request.get("/api/workflow-logs?status=NO_EXISTE");
    expect(res.status()).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("NO_EXISTE");
  });

  test("sin sesion no se lee nada", async ({ page }) => {
    const res = await page.request.get("/api/workflow-logs");
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Accesibilidad ─────────────────────────────────────────────────────────

test.describe("Registro: accesibilidad", () => {
  test("los filtros de estado forman un grupo con nombre", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);
    await expect(page.getByRole("group", { name: "Filtrar por estado" })).toBeVisible();
  });

  test("la tabla tiene titulo y cabeceras declaradas", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);

    const sinScope = await page.locator("table thead th:not([scope])").count();
    expect(sinScope, "toda cabecera declara su ambito").toBe(0);
    await expect(page.locator("table caption")).toHaveCount(1);
  });

  test("el boton de reintentar dice de que regla y cuantas entregas", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);
    await page.getByTestId("filtro-estado-FAILED").click();
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

    const log = await ejecucionConEntregas();
    await expect(page.getByTestId(`reintentar-${log.id}`)).toHaveAttribute(
      "aria-label",
      new RegExp(
        `Reintentar las 1 entrega\\(s\\) pendientes de ${escapar(
          E2E.automatizaciones.reglaCorreo,
        )}`,
      ),
    );
  });

  test("el mensaje de error de una fila se lee entero, sin depender del raton", async ({
    page,
  }) => {
    // Estaba en un `truncate` con el texto completo solo en `title`.
    await login(page, E2E.automatizaciones.owner);
    await irAlRegistro(page);
    await page.getByTestId("filtro-estado-FAILED").click();
    await expect(page.getByTestId("cargando-ejecuciones")).toHaveCount(0);

    const celda = page.locator("tbody tr").first().locator("td").nth(4);
    await expect(celda).toContainText("SMTP");
    const truncadas = await page.locator("tbody td .truncate").count();
    expect(truncadas, "ninguna celda recorta el texto sin recurso").toBe(0);
  });
});
