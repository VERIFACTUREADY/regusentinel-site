/**
 * /audit — la traza de auditoria de la organizacion.
 *
 * QUE VIGILA ESTA SUITE
 * ---------------------
 * Una auditoria vale exactamente lo que valga su peor mentira. Los defectos
 * corregidos aqui son todos del mismo tipo: la pantalla ensenaba algo que
 * parecia un dato y no lo era.
 *
 *   - El filtro de fechas trabajaba en dias UTC. Para alguien en Madrid eso
 *     PERDIA los registros de entre las 00:00 y las 02:00 del dia que pedias y
 *     ademas te COLABA los del dia siguiente. Las dos mitades del rango
 *     desplazadas, y en sentidos contrarios.
 *   - El CSV se construia con `logs`, que es solo la pagina a la vista: te
 *     llevabas 30 registros de los que hubiera, sin truncamiento visible y con
 *     un fichero que parece completo.
 *   - En movil, la rama de tarjetas no miraba el error de carga: una auditoria
 *     que no habia podido cargarse decia «No hay registros», que es la
 *     conclusion contraria.
 *   - La columna «Detalles» estaba en un `truncate` sin `title` siquiera: el
 *     texto se cortaba y no habia ninguna forma de ver el resto.
 *   - Los cinco filtros tenian el rotulo suelto, sin asociar a su control.
 *
 * Nada de esta pantalla debe poder escribir en la base: se comprueba tambien
 * que el API solo lee.
 */
import { type Page } from "@playwright/test";
import { test, expect, pantallaUtil, permitirFalloEn } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E, CIFRAS_AUTOMATIZACIONES, REGISTROS_POR_PAGINA } from "./seed-e2e";
import { diaCivilES, sumarDiasES } from "../src/lib/fecha-es";

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

async function irAAuditoria(page: Page) {
  await page.goto("/audit");
  await pantallaUtil(page);
  // La primera carga es del cliente: se espera a que la tabla exista.
  await expect(page.getByTestId("contador-auditoria")).toBeVisible();
}

async function orgAuto() {
  return prisma.organization.findUniqueOrThrow({
    where: { slug: E2E.automatizaciones.slug },
    select: { id: true },
  });
}

/**
 * El buscador GLOBAL de la cabecera tambien se llama «Buscar…»: sin
 * `exact: true` el localizador encuentra dos botones y Playwright se niega a
 * elegir. Los helpers de aqui apuntan siempre al filtro de la pantalla.
 */
function campoBuscar(page: Page) {
  return page.getByLabel("Buscar", { exact: true });
}
function botonBuscar(page: Page) {
  return page.getByRole("button", { name: "Buscar", exact: true });
}

async function buscar(page: Page, texto: string) {
  await campoBuscar(page).fill(texto);
  await botonBuscar(page).click();
}

/** `AAAA-MM-DD` del dia civil espanol de ese instante. */
function fechaES(d: Date): string {
  return diaCivilES(d);
}

// ─── Carga y contador ──────────────────────────────────────────────────────

test.describe("Auditoria: lo que se ve al entrar", () => {
  test("el contador coincide con lo que hay en la base", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    const org = await orgAuto();
    const enBase = await prisma.auditLog.count({ where: { orgId: org.id } });
    expect(enBase, "el sembrado deja registros suficientes").toBeGreaterThanOrEqual(
      CIFRAS_AUTOMATIZACIONES.auditoriaTotal,
    );
    await expect(page.getByTestId("contador-auditoria")).toHaveText(`${enBase} registros`);
    await expect(page.getByTestId("fila-auditoria")).toHaveCount(REGISTROS_POR_PAGINA);
  });

  test("un registro del sistema sale como «Sistema», no en blanco", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await buscar(page, E2E.automatizaciones.accionCsv);
    await expect(page.getByTestId("fila-auditoria")).toHaveCount(1);
    await expect(page.getByTestId("fila-auditoria").first()).toContainText("Sistema");
  });

  test("el detalle se lee entero, sin recortes sin recurso", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await buscar(page, E2E.automatizaciones.accionCsv);

    const fila = page.getByTestId("fila-auditoria").first();
    // El detalle completo, con sus comillas y sus acentos.
    await expect(fila).toContainText(E2E.automatizaciones.detalleCsv);
    const truncadas = await page.locator("tbody td .truncate, tbody td.truncate").count();
    expect(truncadas, "ninguna celda recorta el detalle").toBe(0);
  });
});

// ─── Filtros ───────────────────────────────────────────────────────────────

test.describe("Auditoria: filtros", () => {
  test("la categoria filtra por prefijo de accion", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await page.getByLabel("Categoria").selectOption("task.");

    const org = await orgAuto();
    const enBase = await prisma.auditLog.count({
      where: { orgId: org.id, action: { startsWith: "task." } },
    });
    expect(enBase).toBeGreaterThan(0);
    await expect(page.getByTestId("contador-auditoria")).toHaveText(
      `${enBase} registro${enBase === 1 ? "" : "s"} (filtrado)`,
    );

    const filas = page.getByTestId("fila-auditoria");
    const n = await filas.count();
    for (let i = 0; i < n; i++) {
      await expect(filas.nth(i)).toContainText("task.");
    }
  });

  test("el filtro de usuario separa a una persona del sistema", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    const org = await orgAuto();
    const delSistema = await prisma.auditLog.count({ where: { orgId: org.id, userId: null } });
    expect(delSistema).toBeGreaterThan(0);

    await page.getByLabel("Usuario").selectOption("system");
    await expect(page.getByTestId("contador-auditoria")).toHaveText(
      `${delSistema} registro${delSistema === 1 ? "" : "s"} (filtrado)`,
    );

    const filas = page.getByTestId("fila-auditoria");
    const n = await filas.count();
    for (let i = 0; i < n; i++) {
      await expect(filas.nth(i)).toContainText("Sistema");
    }
  });

  test("la busqueda mira accion y detalle", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await buscar(page, "numero 7");

    const org = await orgAuto();
    const enBase = await prisma.auditLog.count({
      where: {
        orgId: org.id,
        OR: [
          { action: { contains: "numero 7", mode: "insensitive" } },
          { details: { contains: "numero 7", mode: "insensitive" } },
        ],
      },
    });
    expect(enBase).toBeGreaterThan(0);
    await expect(page.getByTestId("contador-auditoria")).toHaveText(
      `${enBase} registro${enBase === 1 ? "" : "s"} (filtrado)`,
    );
  });

  test("«Limpiar» devuelve la lista completa", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);
    const org = await orgAuto();
    const total = await prisma.auditLog.count({ where: { orgId: org.id } });

    await page.getByLabel("Categoria").selectOption("task.");
    await expect(page.getByTestId("contador-auditoria")).toContainText("(filtrado)");

    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page.getByTestId("contador-auditoria")).toHaveText(`${total} registros`);
    await expect(page.getByLabel("Categoria")).toHaveValue("");
  });

  test("un filtro sin resultados lo dice como filtro, no como vacio", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await buscar(page, "cadena-que-no-existe-en-ningun-registro");

    const vacio = page.getByTestId("vacio-auditoria");
    await expect(vacio).toBeVisible();
    await expect(vacio).toContainText("con los filtros seleccionados");
  });
});

// ─── Fechas: dias civiles espanoles ───────────────────────────────────────

test.describe("Auditoria: el rango de fechas es de dias de Madrid", () => {
  /*
   * Los dos registros de borde estan a media hora de la medianoche CIVIL de
   * Madrid, uno a cada lado. En verano la medianoche de Madrid son las 22:00
   * UTC del dia anterior, asi que con un filtro que trabajase en dias UTC los
   * dos caerian en el MISMO dia UTC y ninguna de estas dos pruebas pasaria.
   */
  test("«Desde hoy» incluye lo de las 00:30 y excluye lo de ayer a las 23:30", async ({
    page,
  }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await buscar(page, E2E.automatizaciones.accionBorde);
    await expect(page.getByTestId("fila-auditoria")).toHaveCount(2);

    await page.getByLabel("Desde").fill(fechaES(new Date()));
    await expect(page.getByTestId("fila-auditoria")).toHaveCount(1);
    await expect(page.getByTestId("fila-auditoria").first()).toContainText(
      E2E.automatizaciones.detalleHoyTemprano,
    );
    await expect(page.locator("tbody")).not.toContainText(E2E.automatizaciones.detalleAyerTarde);
  });

  test("«Hasta ayer» incluye lo de ayer a las 23:30 y excluye lo de hoy", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await buscar(page, E2E.automatizaciones.accionBorde);
    await expect(page.getByTestId("fila-auditoria")).toHaveCount(2);

    await page.getByLabel("Hasta").fill(fechaES(sumarDiasES(new Date(), -1)));
    await expect(page.getByTestId("fila-auditoria")).toHaveCount(1);
    await expect(page.getByTestId("fila-auditoria").first()).toContainText(
      E2E.automatizaciones.detalleAyerTarde,
    );
    await expect(page.locator("tbody")).not.toContainText(
      E2E.automatizaciones.detalleHoyTemprano,
    );
  });

  test("«Hasta hoy» incluye lo de hoy: el limite superior es inclusivo", async ({ page }) => {
    // El otro medio defecto: `lte: to + "T23:59:59.999Z"` son las 01:59 del dia
    // siguiente en Madrid, y el limite acababa dejando fuera o colando el dia
    // segun la hora. Hoy tiene que estar dentro de «hasta hoy».
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await buscar(page, E2E.automatizaciones.accionBorde);
    await page.getByLabel("Hasta").fill(fechaES(new Date()));

    await expect(page.getByTestId("fila-auditoria")).toHaveCount(2);
  });

  test("una fecha imposible se rechaza con 400, no con 500", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const res = await page.request.get("/api/audit-logs?from=ayer");
    expect(res.status(), '`new Date("ayer")` es Invalid Date y Prisma lanzaba').toBe(400);
  });
});

// ─── Paginacion ────────────────────────────────────────────────────────────

test.describe("Auditoria: paginacion", () => {
  test("se pasa de pagina y se vuelve, y las filas cambian", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    const org = await orgAuto();
    const total = await prisma.auditLog.count({ where: { orgId: org.id } });
    expect(total).toBeGreaterThan(REGISTROS_POR_PAGINA);

    const primera = () => page.getByTestId("fila-auditoria").first().innerText();
    const enPagina1 = await primera();

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Pagina 2 de")).toBeVisible();
    expect(await primera()).not.toBe(enPagina1);

    await page.getByRole("button", { name: "Anterior" }).click();
    await expect(page.getByText("Pagina 1 de")).toBeVisible();
    await expect.poll(primera).toBe(enPagina1);
  });

  test("cambiar de filtro vuelve a la pagina 1", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Pagina 2 de")).toBeVisible();

    await page.getByLabel("Categoria").selectOption("task.");
    // Con el filtro puesto ya no hay dos paginas, asi que el indicador se va.
    await expect(page.getByText("Pagina 2 de")).toHaveCount(0);
    await expect(page.getByTestId("contador-auditoria")).toContainText("(filtrado)");
  });

  test("las filas de la pagina 2 son las que dice la base", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    const org = await orgAuto();
    const total = await prisma.auditLog.count({ where: { orgId: org.id } });
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByTestId("fila-auditoria")).toHaveCount(
      Math.min(REGISTROS_POR_PAGINA, total - REGISTROS_POR_PAGINA),
    );
  });
});

// ─── Exportacion CSV ───────────────────────────────────────────────────────

test.describe("Auditoria: exportacion CSV", () => {
  /** Lee el contenido del fichero que descarga el navegador. */
  async function descargarCsv(page: Page): Promise<{ nombre: string; texto: string }> {
    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByTestId("exportar-csv").click(),
    ]);
    const ruta = await descarga.path();
    if (!ruta) throw new Error("La descarga no ha dejado ningun fichero.");
    const { readFile } = await import("node:fs/promises");
    return { nombre: descarga.suggestedFilename(), texto: await readFile(ruta, "utf8") };
  }

  test("el CSV lleva TODOS los registros, no solo la pagina a la vista", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    const org = await orgAuto();
    const total = await prisma.auditLog.count({ where: { orgId: org.id } });
    expect(total, "hacen falta mas de una pagina para que el defecto se note").toBeGreaterThan(
      REGISTROS_POR_PAGINA,
    );

    // El boton declara su alcance antes de pulsarlo.
    await expect(page.getByTestId("exportar-csv")).toContainText(`CSV (${total})`);

    const { texto } = await descargarCsv(page);
    const lineas = texto.replace(/^﻿/, "").trim().split("\n");
    // Una cabecera + un registro por fila. Los detalles del sembrado no llevan
    // saltos de linea, asi que la cuenta de lineas es la cuenta de registros.
    expect(lineas.length - 1, "el CSV trae la traza entera").toBe(total);
    await expect(page.getByTestId("exito-exportar-csv")).toContainText(
      `Exportados ${total} registros`,
    );
  });

  test("el fichero se llama y se abre bien: nombre, BOM y cabecera", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    const { nombre, texto } = await descargarCsv(page);
    expect(nombre).toMatch(/^audit-trail-\d{4}-\d{2}-\d{2}\.csv$/);
    // Sin BOM, Excel abre el fichero en Latin-1 y los acentos salen rotos.
    expect(texto.startsWith("﻿"), "el CSV lleva marca de orden de bytes").toBe(true);
    expect(texto.replace(/^﻿/, "").split("\n")[0]).toBe(
      "Fecha,Usuario,Accion,Detalles,Expediente,IP",
    );
  });

  test("comillas, comas y acentos sobreviven al CSV", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await buscar(page, E2E.automatizaciones.accionCsv);
    await expect(page.getByTestId("fila-auditoria")).toHaveCount(1);

    const { texto } = await descargarCsv(page);
    const lineas = texto.replace(/^﻿/, "").trim().split("\n");
    expect(lineas).toHaveLength(2);

    const fila = lineas[1];
    // Las comillas del detalle van dobladas, que es como se escapan en CSV.
    expect(fila).toContain('""comillas""');
    // Los acentos llegan intactos.
    expect(fila).toContain("ñáéíóú");
    // Y la coma de dentro del detalle no ha partido la fila: sigue habiendo
    // seis campos entrecomillados.
    expect(fila.match(/(^|,)"/g) ?? []).toHaveLength(6);
    // El registro sin usuario sale como «Sistema».
    expect(fila).toContain('"Sistema"');
    // Y trae la referencia del expediente.
    expect(fila).toContain(E2E.automatizaciones.caseRef);
  });

  test("con filtros puestos, el CSV exporta lo filtrado y lo dice", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await page.getByLabel("Categoria").selectOption("task.");
    const org = await orgAuto();
    const filtrados = await prisma.auditLog.count({
      where: { orgId: org.id, action: { startsWith: "task." } },
    });

    await expect(page.getByTestId("exportar-csv")).toHaveAttribute(
      "aria-label",
      `Exportar a CSV los ${filtrados} registros filtrados`,
    );

    const { texto } = await descargarCsv(page);
    const lineas = texto.replace(/^﻿/, "").trim().split("\n");
    expect(lineas.length - 1).toBe(filtrados);
    for (const linea of lineas.slice(1)) {
      expect(linea).toContain("task.");
    }
  });

  test("si la exportacion falla, se dice y no se descarga nada a medias", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    permitirFalloEn(page, "/api/audit-logs");
    await page.route("**/api/audit-logs?**limit=100**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );

    let huboDescarga = false;
    page.on("download", () => {
      huboDescarga = true;
    });
    await page.getByTestId("exportar-csv").click();

    await expect(page.getByTestId("error-exportar-csv")).toContainText(
      "El servidor ha respondido 500",
    );
    await expect(page.getByTestId("exito-exportar-csv")).toHaveCount(0);
    expect(huboDescarga, "un CSV a medias es peor que ninguno").toBe(false);

    await page.unroute("**/api/audit-logs?**limit=100**");
  });

  test("el aviso de exportacion no sobrevive a un cambio de filtro", async ({ page }) => {
    // Decia «Exportados 37 registros» junto a una lista ya filtrada de 8.
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    await descargarCsv(page);
    await expect(page.getByTestId("exito-exportar-csv")).toBeVisible();

    await page.getByLabel("Categoria").selectOption("task.");
    await expect(page.getByTestId("exito-exportar-csv")).toHaveCount(0);
  });
});

// ─── La auditoria refleja lo que pasa de verdad ───────────────────────────

test.describe("Auditoria: una accion real aparece en la traza", () => {
  test("desactivar una regla queda registrado y se ve en /audit", async ({ page }) => {
    /*
     * De punta a punta y por la interfaz: se hace una accion real en otra
     * pantalla y se comprueba que llega a la auditoria, a la base y a la
     * pantalla de auditoria.
     */
    await login(page, E2E.automatizaciones.owner);
    const org = await orgAuto();
    const antes = await prisma.auditLog.count({
      where: { orgId: org.id, action: { startsWith: "workflow." } },
    });

    await page.goto("/workflow-rules");
    await pantallaUtil(page);
    await page
      .getByRole("button", { name: `Desactivar regla ${E2E.automatizaciones.reglaActiva}` })
      .click();
    await expect(page.getByTestId("exito-accion-regla")).toBeVisible();

    try {
      const despues = await prisma.auditLog.count({
        where: { orgId: org.id, action: { startsWith: "workflow." } },
      });
      expect(despues, "la accion deja rastro en la auditoria").toBeGreaterThan(antes);

      await irAAuditoria(page);
      await buscar(page, E2E.automatizaciones.reglaActiva);
      await expect(page.getByTestId("fila-auditoria").first()).toContainText(
        E2E.automatizaciones.reglaActiva,
      );
      // Con el nombre de quien lo hizo, no como «Sistema».
      await expect(page.getByTestId("fila-auditoria").first()).toContainText("Owner Auto E2E");
    } finally {
      await prisma.workflowRule.updateMany({
        where: { orgId: org.id, name: E2E.automatizaciones.reglaActiva },
        data: { isActive: true },
      });
      await prisma.auditLog.deleteMany({
        where: { orgId: org.id, action: { startsWith: "workflow." } },
      });
    }
  });
});

// ─── Solo lectura ──────────────────────────────────────────────────────────

test.describe("Auditoria: la traza no se puede tocar", () => {
  for (const metodo of ["post", "put", "patch", "delete"] as const) {
    test(`un ${metodo.toUpperCase()} a /api/audit-logs no borra nada`, async ({ page }) => {
      await login(page, E2E.automatizaciones.owner);
      const org = await orgAuto();
      const antes = await prisma.auditLog.count({ where: { orgId: org.id } });

      const res = await page.request[metodo]("/api/audit-logs", {
        data: {},
        failOnStatusCode: false,
      });
      // 405 (no existe el verbo) o 404: lo que no puede es funcionar.
      expect(res.status(), `un ${metodo} no puede tener exito`).toBeGreaterThanOrEqual(400);

      expect(await prisma.auditLog.count({ where: { orgId: org.id } })).toBe(antes);
    });
  }

  test("un GET no cambia el numero de registros", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const org = await orgAuto();
    const antes = await prisma.auditLog.count({ where: { orgId: org.id } });

    await irAAuditoria(page);
    await page.getByLabel("Categoria").selectOption("case.");
    await expect(page.getByTestId("contador-auditoria")).toContainText("(filtrado)");

    // Y navegando por las paginas, si el filtro deja mas de una.
    const siguiente = page.getByRole("button", { name: "Siguiente" });
    if ((await siguiente.count()) > 0) {
      await siguiente.click();
      await expect(page.getByText("Pagina 2 de")).toBeVisible();
    }

    expect(await prisma.auditLog.count({ where: { orgId: org.id } })).toBe(antes);
  });
});

// ─── Roles y aislamiento ───────────────────────────────────────────────────

test.describe("Auditoria: roles y aislamiento", () => {
  // `audit.read` la tienen los CUATRO roles, leido de `src/lib/rbac.ts`.
  for (const rol of ["owner", "manager", "operador", "viewer"] as const) {
    test(`un ${rol.toUpperCase()} entra y ve la traza`, async ({ page }) => {
      await login(page, E2E.automatizaciones[rol]);
      await irAAuditoria(page);
      await expect(page.getByTestId("fila-auditoria").first()).toBeVisible();
    });
  }

  test("no se ve ni un registro de la organizacion vecina", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    // Ni en la pantalla…
    await expect(page.locator("body")).not.toContainText(
      E2E.automatizacionesVecina.accionAuditoria,
    );
    // …ni buscandolo a proposito.
    await buscar(page, E2E.automatizacionesVecina.accionAuditoria);
    await expect(page.getByTestId("vacio-auditoria")).toBeVisible();
  });

  test("el API no devuelve la traza ajena ni pidiendola por caseId", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const casoAjeno = await prisma.case.findFirstOrThrow({
      where: { ref: E2E.automatizacionesVecina.caseRef },
      select: { id: true },
    });

    const res = await page.request.get(`/api/audit-logs?caseId=${casoAjeno.id}`);
    expect(res.status()).toBe(200);
    const cuerpo = (await res.json()) as { logs: unknown[]; total: number };
    expect(cuerpo.total, "un expediente ajeno no tiene traza para mi").toBe(0);
    expect(cuerpo.logs).toHaveLength(0);
  });

  test("sin sesion no se lee la auditoria", async ({ page }) => {
    const res = await page.request.get("/api/audit-logs");
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Robustez del API ──────────────────────────────────────────────────────

test.describe("Auditoria: el API no se cae con parametros raros", () => {
  test("una pagina que no es un numero no devuelve 500", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const res = await page.request.get("/api/audit-logs?page=abc");
    expect(res.status()).toBe(200);
    expect(((await res.json()) as { page: number }).page).toBe(1);
  });

  test("un limite negativo no invierte el orden", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const res = await page.request.get("/api/audit-logs?limit=-5");
    expect(res.status()).toBe(200);
    const cuerpo = (await res.json()) as { limit: number; logs: { createdAt: string }[] };
    expect(cuerpo.limit).toBeGreaterThan(0);
    const fechas = cuerpo.logs.map((l) => new Date(l.createdAt).getTime());
    expect([...fechas].sort((a, b) => b - a)).toEqual(fechas);
  });
});

// ─── Accesibilidad ─────────────────────────────────────────────────────────

test.describe("Auditoria: accesibilidad", () => {
  test("los cinco filtros tienen su rotulo asociado", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    for (const nombre of ["Buscar", "Categoria", "Usuario", "Desde", "Hasta"]) {
      await expect(page.getByLabel(nombre, { exact: true })).toBeVisible();
    }

    // Y ningun rotulo suelto: si alguien quita un `htmlFor`, esto falla.
    const sueltos = await page.locator("label:not([for])").filter({ hasNotText: /^$/ }).count();
    expect(sueltos, "todo <label> visible apunta a su campo").toBe(0);
  });

  test("el boton de CSV dice cuantos registros se lleva", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAAuditoria(page);

    const org = await orgAuto();
    const total = await prisma.auditLog.count({ where: { orgId: org.id } });
    await expect(page.getByTestId("exportar-csv")).toHaveAttribute(
      "aria-label",
      `Exportar a CSV los ${total} registros`,
    );
  });
});

// ─── Fallos de carga ───────────────────────────────────────────────────────

test.describe("Auditoria: un fallo de carga no se disfraza de traza vacia", () => {
  for (const [codigo, esperado] of [
    [401, "Tu sesion ha caducado"],
    [403, "No tienes permiso para consultar la auditoria"],
    [500, "El servidor ha respondido 500"],
  ] as const) {
    test(`un HTTP ${codigo} se explica`, async ({ page }) => {
      await login(page, E2E.automatizaciones.owner);
      permitirFalloEn(page, "/api/audit-logs");
      await page.route("**/api/audit-logs?**", (route) =>
        route.fulfill({ status: codigo, contentType: "application/json", body: "{}" }),
      );
      await page.goto("/audit");
      await pantallaUtil(page);

      const aviso = page.getByTestId("carga-error");
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(esperado);
      await expect(page.getByTestId("vacio-auditoria")).toHaveCount(0);

      await page.unroute("**/api/audit-logs?**");
    });
  }

  test("un fallo de red se explica y no dice «Failed to fetch»", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/audit-logs");
    await page.route("**/api/audit-logs?**", (route) => route.abort("failed"));
    await page.goto("/audit");
    await pantallaUtil(page);

    await expect(page.getByTestId("carga-error")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Failed to fetch");
    await expect(page.getByTestId("vacio-auditoria")).toHaveCount(0);

    await page.unroute("**/api/audit-logs?**");
  });

  test("el aviso de error se puede reintentar", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/audit-logs");
    let fallar = true;
    await page.route("**/api/audit-logs?**", (route) => {
      if (fallar) {
        fallar = false;
        return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      }
      return route.continue();
    });
    await page.goto("/audit");
    await pantallaUtil(page);
    await expect(page.getByTestId("carga-error")).toBeVisible();

    await page.getByRole("button", { name: /Reintentar/ }).click();
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
    await expect(page.getByTestId("fila-auditoria").first()).toBeVisible();

    await page.unroute("**/api/audit-logs?**");
  });
});
