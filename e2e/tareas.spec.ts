/**
 * Tareas, conducidas como las conduce una persona.
 *
 * REGLA DE ESTA SUITE
 * -------------------
 * Ningun clic ni formulario se sustituye por `page.goto` ni por una llamada al
 * API. La unica excepcion, declarada en cada caso, es cuando lo que se
 * comprueba es EXPRESAMENTE la segunda mitad del control de acceso: que el
 * servidor rechaza aunque la interfaz no ofrezca el boton.
 *
 * DONDE ESTA CADA COSA (inventario real, no supuesto)
 * ---------------------------------------------------
 * `/tasks` es una BANDEJA: lista, filtra, completa, inicia, actua en lote y
 * anota. NO crea, NO edita campos y NO borra — esos controles no existen ahi.
 * Crear, renombrar, reasignar, cambiar plazo, cambiar estado (incluido
 * reabrir) y borrar se hacen desde la pestana Tareas de la ficha del
 * expediente. Por eso el alta y la edicion se prueban alli: es donde el
 * producto las ofrece, no donde seria comodo que estuvieran.
 *
 * Lo que no existe esta declarado en QA_MATRIX y no se inventa aqui.
 */
import { readFile } from "node:fs/promises";
import { type Page, type Locator } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect, permitirFalloEn, pantallaUtil } from "./vigilancia";
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

/** Titulo completo de una tarea del sembrado. */
function T(sufijo: string) {
  return `${E2E.tareas.prefijo} ${sufijo}`;
}

/** Titulos de las tareas visibles en /tasks, en orden. */
async function titulosVisibles(page: Page): Promise<string[]> {
  return (await page.getByTestId("titulo-tarea").allTextContents()).map((t) => t.trim());
}

/** La tarjeta de /tasks correspondiente a una tarea. */
function tarjeta(page: Page, titulo: string): Locator {
  return page.locator("div.bg-white.p-4").filter({ hasText: titulo }).first();
}

/** El total que anuncia la cabecera: "17 tareas". */
async function totalAnunciado(page: Page): Promise<number> {
  const texto = await page.locator("p", { hasText: /^\d+ tareas?$/ }).first().innerText();
  return Number(texto.trim().split(" ")[0]);
}

/**
 * Cambia un filtro y espera a que la lista sea YA la filtrada.
 *
 * Mientras carga, /tasks sustituye las tarjetas por "Cargando...", asi que leer
 * antes de la respuesta devolveria la lista anterior y la prueba afirmaria
 * cosas sobre un filtro que todavia no se ha aplicado.
 */
async function filtrar(page: Page, etiqueta: string, valor: string, esperado: string) {
  const [peticion] = await Promise.all([
    page.waitForRequest(
      (r) => r.url().includes("/api/tasks?") && r.url().includes(esperado),
      { timeout: 25_000 },
    ),
    page.getByLabel(etiqueta, { exact: true }).selectOption(valor),
  ]);
  await expect(page.locator("text=Cargando...")).toHaveCount(0, { timeout: 25_000 });
  return peticion;
}

/** Id de la organizacion de pruebas. */
async function orgE2E(): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { slug: E2E.orgSlug },
    select: { id: true },
  });
  if (!org) throw new Error("La organizacion de pruebas no existe: revisa el sembrado");
  return org.id;
}

/** El expediente que agrupa las tareas de prueba. */
async function casoDeTareas() {
  const c = await prisma.case.findFirst({
    where: { ref: E2E.tareas.caseRef, orgId: await orgE2E() },
    select: { id: true, ref: true },
  });
  if (!c) throw new Error("El expediente de tareas no existe: revisa el sembrado");
  return c;
}

/**
 * Tarea de apoyo para las pruebas que editan o borran.
 *
 * Con titulo unico por ejecucion: si dos pruebas compartieran tarea, la que
 * borra dejaria a la que edita sin nada que editar y el fallo se leeria como un
 * defecto del producto.
 *
 * Y con un plazo muy pasado a proposito: la bandeja ordena por plazo ascendente
 * y pagina de 50 en 50. Corriendo la suite entera sobre la misma base, las
 * tareas que siembran otras pruebas llenan la primera pagina y la de apoyo se
 * iria a la segunda, donde ningun `getByRole` la encuentra.
 */
async function tareaDeApoyo(sufijo: string) {
  const caso = await casoDeTareas();
  const titulo = `${E2E.tareas.prefijo} apoyo ${sufijo} ${Date.now().toString().slice(-6)}`;
  const tarea = await prisma.task.create({
    data: {
      caseId: caso.id,
      title: titulo,
      category: "OTROS",
      status: "PENDING",
      sortOrder: 900,
      deadline: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    },
    select: { id: true, title: true },
  });
  return { ...tarea, caseId: caso.id, caseRef: caso.ref };
}

/** Abre la pestana Tareas de la ficha del expediente de tareas. */
async function abrirPestanaTareas(page: Page, caseId: string) {
  await page.goto(`/cases/${caseId}`);
  // La ficha carga en cliente: se espera a que este pintada antes de auditarla,
  // o se acaba juzgando el "Cargando..." en vez del expediente.
  const pestana = page.getByRole("button", { name: /^Tareas \(/ });
  await expect(pestana).toBeVisible({ timeout: 30_000 });
  await pantallaUtil(page);
  await pestana.click();

  await expect(page.getByRole("button", { name: "Añadir tarea" })).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Vuelve a la pestana Tareas despues de recargar.
 *
 * Misma espera que `abrirPestanaTareas`: tras `reload()` la ficha tarda en
 * traerse sus datos, y auditar la pantalla en ese hueco juzga el "Cargando...".
 */
async function reabrirPestanaTareas(page: Page) {
  const pestana = page.getByRole("button", { name: /^Tareas \(/ });
  await expect(pestana).toBeVisible({ timeout: 30_000 });
  await pantallaUtil(page);
  await pestana.click();
}

// ───────────────────────── Listado, filtros y estados ─────────────────────────

test.describe("Tareas: listado y filtros", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks");
    await pantallaUtil(page);
  });

  test("la bandeja muestra las tareas activas del usuario", async ({ page }) => {
    // El filtro por defecto es "Mis tareas" + "Activas".
    await expect(page.getByLabel("Responsable", { exact: true })).toHaveValue("me");
    await expect(page.getByLabel("Estado", { exact: true })).toHaveValue(
      "PENDING,IN_PROGRESS,BLOCKED,READY",
    );

    const titulos = await titulosVisibles(page);
    expect(titulos, "las tareas activas del owner deben estar").toContain(T("vencida del owner"));
    expect(titulos).toContain(T("bloqueada"));
    // Y lo que NO es activo no aparece.
    expect(titulos).not.toContain(T("ya completada"));
    expect(titulos).not.toContain(T("omitida"));
    // Ni lo que es de otra persona.
    expect(titulos).not.toContain(T("del operador vencida"));
  });

  test("el aviso de plazos vencidos cuenta las que de verdad lo estan", async ({ page }) => {
    const aviso = page.locator("text=/tareas? con plazo vencido/");
    await expect(aviso).toBeVisible({ timeout: 20_000 });

    const cuantas = Number((await aviso.innerText()).trim().split(" ")[0]);
    const titulos = await titulosVisibles(page);
    /*
     * Cada tarjeta vencida lleva su insignia "VENCIDO — fecha". Se cuentan los
     * `<span>` de la insignia y no `text=VENCIDO`: ese motor casa tambien con
     * cada contenedor que envuelva el texto y devolveria de mas.
     */
    const marcadas = await page.locator("span").filter({ hasText: /^VENCIDO —/ }).count();
    expect(cuantas, "el aviso debe contar las mismas que marca la lista").toBe(marcadas);
    expect(titulos).toContain(T("vencida del owner"));
  });

  test("el filtro de responsable cambia la peticion Y los resultados", async ({ page }) => {
    const peticion = await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");
    expect(peticion.url()).toContain("assignee=unassigned");

    await expect(async () => {
      const titulos = await titulosVisibles(page);
      expect(titulos.length).toBeGreaterThan(0);
      expect(titulos).toContain(T("sin asignar pendiente"));
      expect(titulos).not.toContain(T("vencida del owner"));
    }).toPass({ timeout: 20_000 });

    // Y filtrando por el operador salen las suyas y solo las suyas.
    const operador = await prisma.user.findUnique({
      where: { email: E2E.operador },
      select: { id: true },
    });
    await filtrar(page, "Responsable", operador!.id, `assignee=${operador!.id}`);
    await expect(async () => {
      const titulos = await titulosVisibles(page);
      expect(titulos).toContain(T("del operador vencida"));
      expect(titulos).not.toContain(T("sin asignar pendiente"));
    }).toPass({ timeout: 20_000 });
  });

  test("el filtro de estado cambia la peticion Y los resultados", async ({ page }) => {
    // "Todas" en responsable NO manda `assignee`: se espera a `limit`, que
    // siempre viaja, y despues ya se comprueba el parametro del estado.
    await filtrar(page, "Responsable", "", "limit=");
    const peticion = await filtrar(page, "Estado", "DONE", "status=DONE");
    expect(peticion.url()).toContain("status=DONE");

    await expect(async () => {
      const titulos = await titulosVisibles(page);
      expect(titulos.length).toBeGreaterThan(0);
      expect(titulos).toContain(T("ya completada"));
      expect(titulos).not.toContain(T("vencida del owner"));
    }).toPass({ timeout: 20_000 });

    /*
     * Y "Bloqueada" deja SOLO tareas bloqueadas.
     *
     * No se exige que la lista sea exactamente la tarea del sembrado: otras
     * suites de la misma base crean tareas bloqueadas al aplicar plantillas, y
     * atarse a una lista literal hacia fallar esta prueba por datos ajenos en
     * vez de por el filtro. Lo que se comprueba es mas fuerte: que la tarea
     * conocida esta, que una que no lo esta no aparece, y que TODAS las tarjetas
     * en pantalla se anuncian como bloqueadas. El estado se lee de la insignia
     * de cada tarjeta y no de la base por titulo: hay titulos repetidos entre
     * expedientes ("Solicitar certificado de saldos" sale en cada plantilla), y
     * buscar por titulo traia tareas distintas de las que se estan viendo.
     */
    await filtrar(page, "Estado", "BLOCKED", "status=BLOCKED");
    await expect(async () => {
      const titulos = await titulosVisibles(page);
      expect(titulos.length).toBeGreaterThan(0);
      expect(titulos).toContain(T("bloqueada"));
      expect(titulos).not.toContain(T("vencida del owner"));

      const estados = await page.getByTestId("estado-tarea").allTextContents();
      expect(estados.length).toBe(titulos.length);
      expect(new Set(estados.map((e) => e.trim()))).toEqual(new Set(["BLOCKED"]));
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText("A la espera del certificado de defuncion")).toBeVisible();
  });

  test("el filtro de categoria cambia la peticion Y los resultados", async ({ page }) => {
    await filtrar(page, "Responsable", "", "limit=");
    await filtrar(page, "Estado", "", "limit=");
    const peticion = await filtrar(page, "Categoria", "SEGUROS", "category=SEGUROS");
    expect(peticion.url()).toContain("category=SEGUROS");

    await expect(async () => {
      const titulos = await titulosVisibles(page);
      expect(titulos.length).toBeGreaterThan(0);
      expect(titulos).toContain(T("de este mes"));
      expect(titulos).toContain(T("lista para revisar"));
      expect(titulos).not.toContain(T("sin asignar pendiente"));
    }).toPass({ timeout: 20_000 });
  });

  test("sin resultados dice que es por los filtros, no que no haya nada", async ({ page }) => {
    // Categoria sin ninguna tarea del owner: la combinacion existe, el
    // resultado esta vacio, y eso es distinto de no tener tareas.
    await filtrar(page, "Categoria", "VIDA_DIGITAL", "category=VIDA_DIGITAL");

    const vacio = page.getByTestId("carga-vacio");
    await expect(vacio).toBeVisible({ timeout: 20_000 });
    await expect(vacio).toHaveText("No hay tareas con estos filtros");
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("sin ninguna tarea NO se culpa a los filtros", async ({ page }) => {
    /*
     * Este estado no se puede producir con datos reales —la organizacion tiene
     * tareas—, asi que se sirve una respuesta valida y vacia. Lo que se
     * comprueba es del producto: que con los filtros abiertos del todo el
     * mensaje deja de mandar al usuario a buscar un filtro que no existe.
     */
    await page.route("**/api/tasks?**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tasks: [], total: 0, page: 1, limit: 50 }),
      }),
    );
    await filtrar(page, "Responsable", "", "limit=");
    await filtrar(page, "Estado", "", "limit=");

    const vacio = page.getByTestId("carga-vacio");
    await expect(vacio).toBeVisible({ timeout: 20_000 });
    await expect(vacio).toHaveText("Aun no hay ninguna tarea");
  });

  test("una sesion caducada se explica, no se disfraza de bandeja vacia", async ({ page }) => {
    permitirFalloEn(page, "/api/tasks");
    await page.route("**/api/tasks?**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "No autenticado" }),
      }),
    );

    await page.reload();
    await expect(page.getByTestId("carga-error").first()).toContainText(/sesion ha caducado/i, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("carga-vacio")).toHaveCount(0);
  });

  test("si fallan los companeros, la bandeja sigue en pie y lo dice", async ({ page }) => {
    /*
     * Compartian estado de error: un 500 en `/api/org/members` borraba la lista
     * de tareas —que habia cargado bien— y la sustituia por "No se han podido
     * cargar las tareas". Mentia sobre que habia fallado y escondia el trabajo.
     */
    permitirFalloEn(page, "/api/org/members");
    await page.route("**/api/org/members", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "fallo simulado" }),
      }),
    );

    await page.reload();
    await expect(page.getByTestId("aviso-miembros")).toContainText(/companeros|compañeros/i, {
      timeout: 20_000,
    });
    // La bandeja NO se ha ido.
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
    expect(await titulosVisibles(page)).toContain(T("vencida del owner"));
  });

  test("la paginacion aparece solo cuando de verdad sobra una pagina", async ({ page }) => {
    await filtrar(page, "Responsable", "", "limit=");
    await filtrar(page, "Estado", "", "limit=");

    await expect(async () => {
      const total = await totalAnunciado(page);
      const hayPaginacion = (await page.getByRole("button", { name: "Siguiente" }).count()) > 0;
      expect(hayPaginacion, `con ${total} tareas y 50 por pagina`).toBe(total > 50);
      // Y nunca se pintan mas tarjetas que el tamano de pagina.
      expect((await titulosVisibles(page)).length).toBeLessThanOrEqual(50);
    }).toPass({ timeout: 20_000 });
  });
});

// ───────────────────────── Completar e iniciar ─────────────────────────

test.describe("Tareas: completar e iniciar desde la bandeja", () => {
  test("completar una tarea lo confirma y persiste tras recargar", async ({ page }) => {
    const tarea = await tareaDeApoyo("COMPLETAR");

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");
    await expect(page.getByTestId("titulo-tarea").filter({ hasText: tarea.title })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: `Marcar completada: ${tarea.title}` }).click();

    await expect(page.getByTestId("aviso-accion")).toContainText(/Tarea completada/i, {
      timeout: 20_000,
    });

    // En la base, no solo en pantalla.
    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
      expect(enBase?.status).toBe("DONE");
    }).toPass({ timeout: 20_000 });

    // Y al recargar sigue completada: el filtro "Completada" la encuentra.
    await page.reload();
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");
    await filtrar(page, "Estado", "DONE", "status=DONE");
    await expect(page.getByTestId("titulo-tarea").filter({ hasText: tarea.title })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("iniciar una tarea la pasa a en curso y lo confirma", async ({ page }) => {
    const tarea = await tareaDeApoyo("INICIAR");

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    await page.getByRole("button", { name: `Iniciar: ${tarea.title}` }).click();
    await expect(page.getByTestId("aviso-accion")).toContainText(/Tarea iniciada/i, {
      timeout: 20_000,
    });

    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
      expect(enBase?.status).toBe("IN_PROGRESS");
    }).toPass({ timeout: 20_000 });
  });

  test("si el servidor rechaza, se dice y la tarea NO cambia", async ({ page }) => {
    const tarea = await tareaDeApoyo("COMPLETAR500");

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    permitirFalloEn(page, "/tasks");
    await page.route("**/api/cases/*/tasks", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "fallo simulado del servidor" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: `Marcar completada: ${tarea.title}` }).click();

    const aviso = page.getByTestId("aviso-accion");
    await expect(aviso).toContainText(/fallo simulado del servidor/i, { timeout: 20_000 });
    await expect(aviso).toContainText(/No se ha podido actualizar/i);

    const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
    expect(enBase?.status, "no puede completarse lo que el servidor rechazo").toBe("PENDING");
    // Y el boton vuelve a estar disponible: nada de quedarse apagado.
    await expect(
      page.getByRole("button", { name: `Marcar completada: ${tarea.title}` }),
    ).toBeEnabled({ timeout: 10_000 });
  });

  test("si la red se cae, se dice y el boton no se queda apagado", async ({ page }) => {
    const tarea = await tareaDeApoyo("COMPLETARRED");

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    permitirFalloEn(page, "/tasks");
    await page.route("**/api/cases/*/tasks", async (route) => {
      if (route.request().method() === "PATCH") await route.abort("failed");
      else await route.continue();
    });

    await page.getByRole("button", { name: `Marcar completada: ${tarea.title}` }).click();
    await expect(page.getByTestId("aviso-accion")).toContainText(/No se ha podido actualizar/i, {
      timeout: 20_000,
    });

    const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
    expect(enBase?.status).toBe("PENDING");
    await expect(
      page.getByRole("button", { name: `Marcar completada: ${tarea.title}` }),
    ).toBeEnabled({ timeout: 10_000 });
  });
});

// ───────────────────────── Acciones en lote ─────────────────────────

test.describe("Tareas: acciones en lote", () => {
  test("completar en lote actualiza las seleccionadas y lo confirma", async ({ page }) => {
    const a = await tareaDeApoyo("LOTE1");
    const b = await tareaDeApoyo("LOTE2");

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    await page.getByRole("checkbox", { name: `Seleccionar ${a.title}` }).check();
    await page.getByRole("checkbox", { name: `Seleccionar ${b.title}` }).check();
    await expect(page.locator("text=/2 seleccionadas/")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Completar", exact: true }).click();
    await expect(page.getByTestId("aviso-accion")).toContainText(/2 tarea\(s\) completadas/i, {
      timeout: 20_000,
    });

    await expect(async () => {
      const enBase = await prisma.task.findMany({
        where: { id: { in: [a.id, b.id] } },
        select: { status: true },
      });
      expect(enBase.map((t) => t.status)).toEqual(["DONE", "DONE"]);
    }).toPass({ timeout: 20_000 });
  });

  test("reasignar en lote deja las tareas con su nuevo responsable", async ({ page }) => {
    const a = await tareaDeApoyo("LOTEASIG");
    const operador = await prisma.user.findUnique({
      where: { email: E2E.operador },
      select: { id: true },
    });

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    await page.getByRole("checkbox", { name: `Seleccionar ${a.title}` }).check();
    await page
      .getByRole("combobox", { name: "Reasignar las tareas seleccionadas" })
      .selectOption(operador!.id);

    await expect(page.getByTestId("aviso-accion")).toContainText(/reasignadas/i, {
      timeout: 20_000,
    });
    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: a.id } });
      expect(enBase?.assigneeId).toBe(operador!.id);
    }).toPass({ timeout: 20_000 });
  });

  test("un lote que falla NO se anuncia como hecho y deja la barra utilizable", async ({
    page,
  }) => {
    const a = await tareaDeApoyo("LOTE500");

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");
    await page.getByRole("checkbox", { name: `Seleccionar ${a.title}` }).check();

    permitirFalloEn(page, "/api/tasks/batch");
    await page.route("**/api/tasks/batch", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "fallo simulado" }),
      }),
    );

    await page.getByRole("button", { name: "Completar", exact: true }).click();
    await expect(page.getByTestId("aviso-accion")).toContainText(
      /No se han podido actualizar las tareas/i,
      { timeout: 20_000 },
    );

    const enBase = await prisma.task.findUnique({ where: { id: a.id } });
    expect(enBase?.status).toBe("PENDING");
    // La barra sigue viva: el defecto que esto impide es que se quede apagada.
    await expect(page.getByRole("button", { name: "Completar", exact: true })).toBeEnabled({
      timeout: 10_000,
    });
  });
});

// ───────────────────────── Notas de gestion ─────────────────────────

test.describe("Tareas: notas de gestion", () => {
  test("se escribe una nota y queda guardada", async ({ page }) => {
    const tarea = await tareaDeApoyo("NOTA");
    const texto = `Llamada al banco ${Date.now().toString().slice(-6)}`;

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    await page.getByRole("button", { name: `Notas de gestion de ${tarea.title}` }).click();
    await page.getByLabel(`Nueva nota para ${tarea.title}`).fill(texto);
    await tarjeta(page, tarea.title).getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText(texto)).toBeVisible({ timeout: 20_000 });
    await expect(async () => {
      const enBase = await prisma.taskNote.findFirst({ where: { taskId: tarea.id } });
      expect(enBase?.content).toBe(texto);
    }).toPass({ timeout: 20_000 });
  });

  test("si las notas no se pueden cargar, NO se dice que no hay ninguna", async ({ page }) => {
    const tarea = await tareaDeApoyo("NOTAERR");

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    permitirFalloEn(page, "/notes");
    await page.route("**/api/tasks/*/notes", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "fallo simulado" }),
      }),
    );

    await page.getByRole("button", { name: `Notas de gestion de ${tarea.title}` }).click();

    await expect(page.getByTestId("error-notas")).toContainText(
      /No se han podido cargar las notas/i,
      { timeout: 20_000 },
    );
    // Lo que no puede pasar: presentar el fallo como "aqui no hay nada".
    await expect(page.getByText("Sin notas aún.")).toHaveCount(0);
  });

  test("si la nota no se guarda, se dice y el texto no se pierde", async ({ page }) => {
    const tarea = await tareaDeApoyo("NOTAGUARDA");
    const texto = "Nota que no debe perderse";

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    await page.getByRole("button", { name: `Notas de gestion de ${tarea.title}` }).click();
    await page.getByLabel(`Nueva nota para ${tarea.title}`).fill(texto);

    permitirFalloEn(page, "/notes");
    await page.route("**/api/tasks/*/notes", async (route) => {
      if (route.request().method() === "POST") await route.abort("failed");
      else await route.continue();
    });

    await tarjeta(page, tarea.title).getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByTestId("error-notas")).toContainText(
      /No se ha podido guardar la nota/i,
      { timeout: 20_000 },
    );
    // El texto sigue en el cuadro: es lo unico que no se puede recuperar.
    await expect(page.getByLabel(`Nueva nota para ${tarea.title}`)).toHaveValue(texto);
    expect(await prisma.taskNote.count({ where: { taskId: tarea.id } })).toBe(0);
  });

  test("tambien se anota desde la ficha del expediente", async ({ page }) => {
    /*
     * Las notas existen en dos sitios: la bandeja y la ficha. Comparten el
     * codigo de error, pero el panel de la ficha es otro y tiene su propio
     * cuadro de texto: se conduce aqui para no dar por probada por herencia una
     * pantalla que nadie ha abierto.
     */
    const tarea = await tareaDeApoyo("NOTAFICHA");
    const texto = `Llamada al banco ${Date.now().toString().slice(-6)}`;

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    await page.getByRole("button", { name: `Notas de gestion de ${tarea.title}` }).click();
    const campo = page.getByLabel(`Nueva nota para ${tarea.title}`);
    await expect(campo).toBeVisible({ timeout: 20_000 });
    await campo.fill(texto);
    await page.getByRole("button", { name: `Guardar nota de ${tarea.title}` }).click();

    // Queda en la base…
    await expect(async () => {
      const notas = await prisma.taskNote.findMany({ where: { taskId: tarea.id } });
      expect(notas.map((n) => n.content)).toContain(texto);
    }).toPass({ timeout: 20_000 });

    // …y se lee en el panel, que ya no dice que no hay ninguna.
    await expect(page.getByText(texto)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Sin notas aún", { exact: false })).toHaveCount(0);
  });
});

// ───────────────────────── Alta desde el expediente ─────────────────────────

test.describe("Tareas: alta desde el expediente", () => {
  /** Rellena el formulario de nueva tarea localizando por etiqueta. */
  async function rellenarNuevaTarea(page: Page, titulo: string) {
    await page.getByRole("button", { name: "Añadir tarea" }).click();
    await page.getByLabel("Titulo de la tarea *").fill(titulo);
    await page.getByLabel("Categoria de la tarea").selectOption("SEGUROS");
    await page.getByLabel("Fecha limite (opcional)").fill("2026-12-01");
    await page.getByLabel("Responsable de la tarea").selectOption({ label: "Owner E2E" });
    await page.getByLabel("Descripcion de la tarea (opcional)").fill("Creada por la prueba E2E");
  }

  test("se crea una tarea completa y aparece en el expediente y en la bandeja", async ({
    page,
  }) => {
    const caso = await casoDeTareas();
    const titulo = `${E2E.tareas.prefijo} creada ${Date.now().toString().slice(-6)}`;

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, caso.id);

    await rellenarNuevaTarea(page, titulo);
    await page.getByRole("button", { name: "Crear tarea" }).click();

    // Mensaje de exito.
    await expect(page.getByTestId("toast-exito")).toContainText(/Tarea creada/i, {
      timeout: 20_000,
    });

    // Esta en la ficha…
    await expect(
      page.getByRole("button", { name: `Editar titulo: ${titulo}` }),
    ).toBeVisible({ timeout: 20_000 });

    // …y en la base, colgando del expediente correcto y con lo que se escribio.
    const enBase = await prisma.task.findFirst({ where: { title: titulo } });
    expect(enBase, "la tarea debe existir en la base").not.toBeNull();
    expect(enBase!.caseId).toBe(caso.id);
    expect(enBase!.category).toBe("SEGUROS");
    expect(enBase!.description).toBe("Creada por la prueba E2E");
    expect(enBase!.dueDate?.toISOString().slice(0, 10)).toBe("2026-12-01");

    // Recargar: sigue ahi.
    await page.reload();
    await reabrirPestanaTareas(page);
    await expect(
      page.getByRole("button", { name: `Editar titulo: ${titulo}` }),
    ).toBeVisible({ timeout: 20_000 });

    // Y la bandeja general la ve, con la referencia de su expediente.
    await page.getByRole("link", { name: "Mis tareas", exact: true }).first().click();
    await page.waitForURL(/\/tasks$/, { timeout: 30_000 });
    await expect(page.getByTestId("titulo-tarea").filter({ hasText: titulo })).toBeVisible({
      timeout: 20_000,
    });
    await expect(tarjeta(page, titulo).getByRole("link", { name: caso.ref })).toBeVisible();
  });

  test("sin titulo no se puede crear", async ({ page }) => {
    const caso = await casoDeTareas();
    await login(page, E2E.owner);
    await abrirPestanaTareas(page, caso.id);

    await page.getByRole("button", { name: "Añadir tarea" }).click();
    // El titulo es el unico campo obligatorio: sin el, el boton no deja pulsar.
    await expect(page.getByRole("button", { name: "Crear tarea" })).toBeDisabled();

    // Solo espacios tampoco vale.
    await page.getByLabel("Titulo de la tarea *").fill("   ");
    await expect(page.getByRole("button", { name: "Crear tarea" })).toBeDisabled();

    await page.getByLabel("Titulo de la tarea *").fill("Con titulo ya vale");
    await expect(page.getByRole("button", { name: "Crear tarea" })).toBeEnabled();
  });

  for (const escenario of [
    {
      nombre: "un 400 con el motivo del campo",
      estado: 400,
      cuerpo: { error: "Categoria no valida" },
      texto: /Categoria no valida/i,
    },
    {
      nombre: "un 422 de validacion",
      estado: 422,
      cuerpo: { error: "Datos no validos" },
      texto: /Datos no validos/i,
    },
    {
      nombre: "un 500 del servidor",
      estado: 500,
      cuerpo: { error: "Error interno" },
      texto: /Error interno/i,
    },
  ]) {
    test(`si al crear llega ${escenario.nombre}, se dice y no se falsea`, async ({ page }) => {
      const caso = await casoDeTareas();
      const titulo = `${E2E.tareas.prefijo} que no debe crearse ${escenario.estado}`;

      await login(page, E2E.owner);
      await abrirPestanaTareas(page, caso.id);

      permitirFalloEn(page, "/tasks");
      await page.route(`**/api/cases/${caso.id}/tasks`, async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: escenario.estado,
            contentType: "application/json",
            body: JSON.stringify(escenario.cuerpo),
          });
        } else {
          await route.continue();
        }
      });

      await rellenarNuevaTarea(page, titulo);
      await page.getByRole("button", { name: "Crear tarea" }).click();

      // 1. Se dice.
      await expect(page.getByTestId("toast-error")).toContainText(escenario.texto, {
        timeout: 20_000,
      });
      // 2. No se anuncia exito.
      await expect(page.getByTestId("toast-exito")).toHaveCount(0);
      // 3. No hay nada en la base.
      expect(await prisma.task.count({ where: { title: titulo } })).toBe(0);
      // 4. El formulario sigue abierto, con lo escrito, y se puede reintentar.
      await expect(page.getByLabel("Titulo de la tarea *")).toHaveValue(titulo);
      await expect(page.getByRole("button", { name: "Crear tarea" })).toBeEnabled();
    });
  }

  test("si la red se cae al crear, se dice y el boton no se queda girando", async ({ page }) => {
    const caso = await casoDeTareas();
    const titulo = `${E2E.tareas.prefijo} que no debe crearse por red`;

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, caso.id);

    permitirFalloEn(page, "/tasks");
    await page.route(`**/api/cases/${caso.id}/tasks`, async (route) => {
      if (route.request().method() === "POST") await route.abort("failed");
      else await route.continue();
    });

    await rellenarNuevaTarea(page, titulo);
    await page.getByRole("button", { name: "Crear tarea" }).click();

    await expect(page.getByTestId("toast-error")).toContainText(/No se ha podido crear la tarea/i, {
      timeout: 20_000,
    });
    expect(await prisma.task.count({ where: { title: titulo } })).toBe(0);
    await expect(page.getByRole("button", { name: "Crear tarea" })).toBeEnabled({
      timeout: 10_000,
    });
  });
});

// ───────────────────────── Edicion desde el expediente ─────────────────────────

test.describe("Tareas: edicion desde el expediente", () => {
  test("se cambia titulo, responsable y estado, y persiste", async ({ page }) => {
    const tarea = await tareaDeApoyo("EDITAR");
    const nuevoTitulo = `${tarea.title} (renombrada)`;
    const operador = await prisma.user.findUnique({
      where: { email: E2E.operador },
      select: { id: true },
    });

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    // 1. Titulo: se pulsa, se escribe y se confirma con Enter.
    await page.getByRole("button", { name: `Editar titulo: ${tarea.title}` }).click();
    const campoTitulo = page.getByLabel("Titulo de la tarea", { exact: true });
    await campoTitulo.fill(nuevoTitulo);
    await campoTitulo.press("Enter");
    await expect(page.getByTestId("toast-exito")).toContainText(/titulo de la tarea/i, {
      timeout: 20_000,
    });

    // 2. Responsable.
    await page.getByLabel(`Responsable de ${nuevoTitulo}`).selectOption(operador!.id);
    await expect(page.getByTestId("toast-exito")).toContainText(/responsable/i, {
      timeout: 20_000,
    });

    // 3. Estado.
    await page.getByLabel(`Estado de ${nuevoTitulo}`).selectOption("IN_PROGRESS");
    await expect(page.getByTestId("toast-exito")).toContainText(/estado de la tarea/i, {
      timeout: 20_000,
    });

    // Todo junto, en la base.
    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
      expect(enBase?.title).toBe(nuevoTitulo);
      expect(enBase?.assigneeId).toBe(operador!.id);
      expect(enBase?.status).toBe("IN_PROGRESS");
    }).toPass({ timeout: 20_000 });

    // Y tras recargar sigue igual.
    await page.reload();
    await reabrirPestanaTareas(page);
    await expect(
      page.getByRole("button", { name: `Editar titulo: ${nuevoTitulo}` }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(`Estado de ${nuevoTitulo}`)).toHaveValue("IN_PROGRESS");
  });

  test("reabrir una tarea completada la devuelve a pendiente", async ({ page }) => {
    /*
     * Reabrir SI existe, pero solo aqui: el selector de estado de la ficha
     * admite volver de DONE a PENDING. En la bandeja /tasks no existe —al
     * completarse desaparecen sus botones—, y eso queda declarado en
     * QA_MATRIX en vez de inventar un boton que no hay.
     */
    const tarea = await tareaDeApoyo("REABRIR");
    await prisma.task.update({ where: { id: tarea.id }, data: { status: "DONE" } });

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    await expect(page.getByLabel(`Estado de ${tarea.title}`)).toHaveValue("DONE");
    await page.getByLabel(`Estado de ${tarea.title}`).selectOption("PENDING");
    await expect(page.getByTestId("toast-exito")).toContainText(/estado de la tarea/i, {
      timeout: 20_000,
    });

    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
      expect(enBase?.status).toBe("PENDING");
    }).toPass({ timeout: 20_000 });

    await page.reload();
    await reabrirPestanaTareas(page);
    await expect(page.getByLabel(`Estado de ${tarea.title}`)).toHaveValue("PENDING");
  });

  test("el plazo se cambia desde la ficha y persiste", async ({ page }) => {
    /*
     * El plazo tiene DOS caminos en el producto: las tareas con `deadline` de
     * sistema guardan ahi, y las que no lo tienen guardan en `dueDate`. Se
     * conducen los dos, porque la rama de `dueDate` era la que hacia
     * `fetch(...).then()` sin mirar `res.ok`.
     */
    for (const caso of [
      { sufijo: "PLAZOSISTEMA", conDeadline: true },
      { sufijo: "PLAZOVENCE", conDeadline: false },
    ]) {
      const tarea = await tareaDeApoyo(caso.sufijo);
      if (!caso.conDeadline) {
        // `tareaDeApoyo` siempre pone `deadline`; para la otra rama se quita.
        await prisma.task.update({
          where: { id: tarea.id },
          data: { deadline: null, dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
        });
      }

      await login(page, E2E.owner);
      await abrirPestanaTareas(page, tarea.caseId);

      // Se pulsa la insignia del plazo, que abre el campo de fecha.
      await page.getByRole("button", { name: `Editar plazo de ${tarea.title}` }).click();
      const campo = page.getByLabel(`Plazo de ${tarea.title}`);
      await expect(campo).toBeVisible({ timeout: 10_000 });
      await campo.fill("2027-03-15");
      await campo.press("Enter"); // Enter hace blur, y el blur es lo que guarda.

      await expect(page.getByTestId("toast-exito")).toContainText(/plazo de la tarea/i, {
        timeout: 20_000,
      });

      await expect(async () => {
        const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
        const guardado = enBase?.deadline ?? enBase?.dueDate;
        expect(guardado, `${caso.sufijo}: el plazo debe quedar en base`).toBeTruthy();
        expect(new Date(guardado!).toISOString().slice(0, 10)).toBe("2027-03-15");
      }).toPass({ timeout: 20_000 });

      // Y tras recargar la ficha sigue ahi.
      await page.reload();
      await reabrirPestanaTareas(page);
      await expect(
        page.getByRole("button", { name: `Editar plazo de ${tarea.title}` }),
      ).toContainText("15/3/2027", { timeout: 20_000 });
    }
  });

  test("si el plazo no se guarda, se dice y no se anuncia exito", async ({ page }) => {
    // La rama de `dueDate`: la que antes se tragaba el fallo en silencio.
    const tarea = await tareaDeApoyo("PLAZOERROR");
    await prisma.task.update({
      where: { id: tarea.id },
      data: { deadline: null, dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
    });

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    permitirFalloEn(page, "/tasks");
    await page.route(`**/api/cases/${tarea.caseId}/tasks`, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "No se ha podido guardar el plazo" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: `Editar plazo de ${tarea.title}` }).click();
    const campo = page.getByLabel(`Plazo de ${tarea.title}`);
    await campo.fill("2027-03-15");
    await campo.press("Enter");

    await expect(page.getByTestId("toast-error")).toContainText(
      /No se ha podido guardar el plazo/i,
      { timeout: 20_000 },
    );
    await expect(page.getByTestId("toast-exito")).toHaveCount(0);

    const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
    expect(
      new Date((enBase?.dueDate ?? enBase?.deadline)!).toISOString().slice(0, 10),
      "un plazo rechazado no puede quedar guardado",
    ).not.toBe("2027-03-15");
  });

  test("una dependencia se elige desde la ficha y se ve que la tarea espera", async ({ page }) => {
    const bloqueante = await tareaDeApoyo("DEPPADRE");
    const dependiente = await tareaDeApoyo("DEPHIJA");

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, dependiente.caseId);

    await page.getByLabel(`Dependencia de ${dependiente.title}`).selectOption(bloqueante.id);
    await expect(page.getByTestId("toast-exito")).toContainText(/dependencia de la tarea/i, {
      timeout: 20_000,
    });

    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: dependiente.id } });
      expect(enBase?.dependsOnId).toBe(bloqueante.id);
    }).toPass({ timeout: 20_000 });

    // La ficha lo cuenta: la tarea queda esperando a la otra.
    await expect(
      page.locator("span").filter({ hasText: /^Espera: / }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Y se puede quitar.
    await page.getByLabel(`Dependencia de ${dependiente.title}`).selectOption("");
    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: dependiente.id } });
      expect(enBase?.dependsOnId).toBeNull();
    }).toPass({ timeout: 20_000 });
  });

  test("una dependencia que crearia un ciclo se rechaza y se explica", async ({ page }) => {
    /*
     * A depende de B. Si desde la interfaz se intenta que B dependa de A, el
     * servidor lo rechaza con un 400 y la ficha tiene que DECIRLO: es la
     * validacion de ciclos conducida desde el navegador, no desde el API.
     */
    const a = await tareaDeApoyo("CICLOA");
    const b = await tareaDeApoyo("CICLOB");
    await prisma.task.update({ where: { id: a.id }, data: { dependsOnId: b.id } });

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, b.caseId);

    permitirFalloEn(page, "/tasks");
    await page.getByLabel(`Dependencia de ${b.title}`).selectOption(a.id);

    await expect(page.getByTestId("toast-error")).toContainText(/ciclo/i, { timeout: 20_000 });
    await expect(page.getByTestId("toast-exito")).toHaveCount(0);

    const enBase = await prisma.task.findUnique({ where: { id: b.id } });
    expect(enBase?.dependsOnId, "el ciclo no puede quedar guardado").toBeNull();
  });

  for (const escenario of [
    { nombre: "un 400", estado: 400, cuerpo: { error: "Estado no valido" }, texto: /Estado no valido/i },
    { nombre: "un 500", estado: 500, cuerpo: { error: "Error interno" }, texto: /Error interno/i },
  ]) {
    test(`si al editar llega ${escenario.nombre}, se dice y no se falsea`, async ({ page }) => {
      const tarea = await tareaDeApoyo(`EDIT${escenario.estado}`);

      await login(page, E2E.owner);
      await abrirPestanaTareas(page, tarea.caseId);

      permitirFalloEn(page, "/tasks");
      await page.route(`**/api/cases/${tarea.caseId}/tasks`, async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: escenario.estado,
            contentType: "application/json",
            body: JSON.stringify(escenario.cuerpo),
          });
        } else {
          await route.continue();
        }
      });

      await page.getByLabel(`Estado de ${tarea.title}`).selectOption("IN_PROGRESS");

      await expect(page.getByTestId("toast-error")).toContainText(escenario.texto, {
        timeout: 20_000,
      });
      await expect(page.getByTestId("toast-exito")).toHaveCount(0);

      const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
      expect(enBase?.status).toBe("PENDING");
      // La pantalla vuelve a lo que hay en la base, no se queda con lo elegido.
      await expect(page.getByLabel(`Estado de ${tarea.title}`)).toHaveValue("PENDING", {
        timeout: 20_000,
      });
    });
  }

  test("si la red se cae al editar, se dice y el formulario sigue vivo", async ({ page }) => {
    const tarea = await tareaDeApoyo("EDITRED");

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    permitirFalloEn(page, "/tasks");
    await page.route(`**/api/cases/${tarea.caseId}/tasks`, async (route) => {
      if (route.request().method() === "PATCH") await route.abort("failed");
      else await route.continue();
    });

    await page.getByLabel(`Estado de ${tarea.title}`).selectOption("IN_PROGRESS");
    await expect(page.getByTestId("toast-error")).toContainText(/No se ha podido guardar/i, {
      timeout: 20_000,
    });

    const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
    expect(enBase?.status).toBe("PENDING");
    await expect(page.getByLabel(`Estado de ${tarea.title}`)).toBeEnabled({ timeout: 10_000 });
  });
});

// ───────────────────────── Eliminacion ─────────────────────────

test.describe("Tareas: eliminacion", () => {
  test("cancelar no borra; confirmar borra y desaparece", async ({ page }) => {
    const tarea = await tareaDeApoyo("BORRAR");

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    const boton = page.getByRole("button", { name: `Eliminar tarea: ${tarea.title}` });
    await expect(boton).toBeVisible({ timeout: 20_000 });

    // 1. Se pide confirmacion, y cancelar no borra nada.
    let mensaje = "";
    page.once("dialog", (d) => { mensaje = d.message(); d.dismiss(); });
    await boton.click();
    await expect(async () => {
      expect(mensaje, "el borrado debe pedir confirmacion").toContain(tarea.title);
    }).toPass({ timeout: 10_000 });
    expect(await prisma.task.count({ where: { id: tarea.id } })).toBe(1);
    await expect(boton).toBeVisible();

    // 2. Ahora si.
    page.once("dialog", (d) => d.accept());
    await boton.click();

    await expect(
      page.getByRole("button", { name: `Eliminar tarea: ${tarea.title}` }),
    ).toHaveCount(0, { timeout: 20_000 });
    expect(await prisma.task.count({ where: { id: tarea.id } })).toBe(0);
  });

  test("si el servidor rechaza el borrado, NO se anuncia como hecho", async ({ page }) => {
    const tarea = await tareaDeApoyo("BORRAR500");

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    permitirFalloEn(page, "/tasks");
    await page.route(`**/api/cases/${tarea.caseId}/tasks**`, async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "fallo simulado" }),
        });
      } else {
        await route.continue();
      }
    });

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: `Eliminar tarea: ${tarea.title}` }).click();

    await expect(page.getByTestId("toast-error")).toContainText(/fallo simulado/i, {
      timeout: 20_000,
    });
    expect(await prisma.task.count({ where: { id: tarea.id } })).toBe(1);
    await expect(
      page.getByRole("button", { name: `Eliminar tarea: ${tarea.title}` }),
    ).toBeVisible();
  });

  test("si la red se cae al borrar, tampoco se anuncia como hecho", async ({ page }) => {
    const tarea = await tareaDeApoyo("BORRARRED");

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    permitirFalloEn(page, "/tasks");
    await page.route(`**/api/cases/${tarea.caseId}/tasks**`, async (route) => {
      if (route.request().method() === "DELETE") await route.abort("failed");
      else await route.continue();
    });

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: `Eliminar tarea: ${tarea.title}` }).click();

    await expect(page.getByTestId("toast-error")).toContainText(/No se ha podido eliminar/i, {
      timeout: 20_000,
    });
    expect(await prisma.task.count({ where: { id: tarea.id } })).toBe(1);
  });
});

// ───────────────────────── Cronograma ─────────────────────────

test.describe("Tareas: cronograma", () => {
  test("agrupa las tareas con plazo y sus recuentos cuadran", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks");
    await page.getByRole("link", { name: "Cronograma" }).click();
    await page.waitForURL("**/tasks/timeline", { timeout: 30_000 });
    await pantallaUtil(page);

    // El grupo de vencidas existe y lleva dentro la tarea vencida del sembrado.
    // La cabecera del grupo es un <h3>: se pide por rol, no por un `div` que
    // case por texto, porque ese motor casa tambien con los contenedores.
    await expect(
      page.getByRole("heading", { name: "Vencidas", exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(T("vencida del owner"))).toBeVisible();

    // El recuento de la cabecera coincide con lo que dice el servidor.
    const respuesta = await page.request.get("/api/tasks/timeline");
    expect(respuesta.ok()).toBe(true);
    const datos = await respuesta.json();
    const tarjetaVencidas = page
      .locator("div.rounded-lg.border")
      .filter({ hasText: "Vencidas" })
      .first();
    await expect(tarjetaVencidas).toContainText(String(datos.overdue));

    // Las omitidas no entran en el cronograma.
    await expect(page.getByText(T("omitida"))).toHaveCount(0);
    // Ni las que no tienen plazo.
    await expect(page.getByText(T("sin plazo"))).toHaveCount(0);
  });

  test("el filtro de responsable cambia la peticion Y los resultados", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks/timeline");
    await pantallaUtil(page);

    const operador = await prisma.user.findUnique({
      where: { email: E2E.operador },
      select: { id: true },
    });

    const [peticion] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("/api/tasks/timeline") && r.url().includes(`assignee=${operador!.id}`),
        { timeout: 25_000 },
      ),
      page.getByLabel("Responsable", { exact: true }).selectOption(operador!.id),
    ]);
    expect(peticion.url()).toContain(`assignee=${operador!.id}`);

    await expect(async () => {
      await expect(page.getByText(T("del operador vencida"))).toBeVisible();
      await expect(page.getByText(T("vencida del owner"))).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
  });

  test("una tarjeta lleva al expediente de la tarea", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks/timeline");
    await pantallaUtil(page);

    await page.getByRole("link", { name: E2E.tareas.caseRef }).first().click();
    await page.waitForURL(/\/cases\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: E2E.tareas.caseRef })).toBeVisible({
      timeout: 30_000,
    });
    await pantallaUtil(page);
  });

  test("sin tareas para el responsable elegido, lo dice sin llamarlo error", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks/timeline");
    await pantallaUtil(page);

    // El viewer no tiene ninguna tarea asignada: filtro legitimo, resultado vacio.
    const viewer = await prisma.user.findUnique({
      where: { email: E2E.viewer },
      select: { id: true },
    });
    await page.getByLabel("Responsable", { exact: true }).selectOption(viewer!.id);

    const vacio = page.getByTestId("carga-vacio");
    await expect(vacio).toBeVisible({ timeout: 20_000 });
    await expect(vacio).toContainText(/No hay tareas con plazos/i);
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("si el servidor falla, se ve el error y Reintentar lo recupera", async ({ page }) => {
    await login(page, E2E.owner);

    permitirFalloEn(page, "/api/tasks/timeline");
    let roto = true;
    await page.route("**/api/tasks/timeline**", async (route) => {
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

    await page.goto("/tasks/timeline");
    const aviso = page.getByTestId("carga-error").first();
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText("No se han podido cargar");
    // Y no se pinta el estado vacio: fallar no es "no hay nada".
    await expect(page.getByTestId("carga-vacio")).toHaveCount(0);

    roto = false;
    await aviso.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByTestId("carga-error")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(T("vencida del owner"))).toBeVisible({ timeout: 20_000 });
  });

  test("si la red se cae, tampoco se disfraza de cronograma vacio", async ({ page }) => {
    await login(page, E2E.owner);

    permitirFalloEn(page, "/api/tasks/timeline");
    await page.route("**/api/tasks/timeline**", (route) => route.abort("failed"));

    await page.goto("/tasks/timeline");
    await expect(page.getByTestId("carga-error").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("carga-vacio")).toHaveCount(0);
  });
});

// ───────────────────── Resumen de tareas del escritorio ─────────────────────

test.describe("Tareas: resumen del escritorio", () => {
  /**
   * Tarea mia y muy vencida, para que entre segura en el widget.
   *
   * El escritorio muestra solo las 8 primeras por plazo: con un plazo de hace
   * dos meses queda la primera y la prueba no depende de cuantas tareas haya
   * dejado el resto de la suite.
   */
  async function tareaMia(sufijo: string) {
    const caso = await casoDeTareas();
    const owner = await prisma.user.findUnique({
      where: { email: E2E.owner },
      select: { id: true },
    });
    const titulo = `${E2E.tareas.prefijo} escritorio ${sufijo} ${Date.now().toString().slice(-6)}`;
    const tarea = await prisma.task.create({
      data: {
        caseId: caso.id,
        title: titulo,
        category: "OTROS",
        status: "PENDING",
        sortOrder: 800,
        assigneeId: owner!.id,
        deadline: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
      select: { id: true, title: true },
    });
    return { ...tarea, caseId: caso.id };
  }

  test("se completa una tarea desde el escritorio y desaparece del resumen", async ({ page }) => {
    const tarea = await tareaMia("OK");

    await login(page, E2E.owner);
    await pantallaUtil(page);

    const boton = page.getByRole("button", { name: `Marcar completada: ${tarea.title}` });
    await expect(boton).toBeVisible({ timeout: 20_000 });
    await boton.click();

    // Se va del resumen porque de verdad se ha completado…
    await expect(boton).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("aviso-widget-tareas")).toHaveCount(0);
    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
      expect(enBase?.status).toBe("DONE");
    }).toPass({ timeout: 20_000 });
  });

  test("si el servidor rechaza, se dice y la tarea NO desaparece", async ({ page }) => {
    /*
     * El defecto que cubre: era `if (res.ok) { quitarla de la lista }` sin
     * rama de error. Con un 500 el usuario pulsaba y no pasaba absolutamente
     * nada, sin saber si se habia guardado.
     */
    const tarea = await tareaMia("ERROR");

    await login(page, E2E.owner);
    await pantallaUtil(page);

    permitirFalloEn(page, "/tasks");
    await page.route("**/api/cases/*/tasks", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Fallo simulado del servidor" }),
        });
      } else {
        await route.continue();
      }
    });

    const boton = page.getByRole("button", { name: `Marcar completada: ${tarea.title}` });
    await expect(boton).toBeVisible({ timeout: 20_000 });
    await boton.click();

    await expect(page.getByTestId("aviso-widget-tareas")).toContainText(
      /Fallo simulado del servidor/i,
      { timeout: 20_000 },
    );
    // Sigue ahi, y el boton se puede volver a pulsar.
    await expect(boton).toBeVisible();
    await expect(boton).toBeEnabled({ timeout: 10_000 });

    const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
    expect(enBase?.status, "lo que el servidor rechazo no puede quedar completado").toBe("PENDING");
  });
});

// ───────────────────────── Exportacion CSV ─────────────────────────

test.describe("Tareas: exportacion CSV", () => {
  /** Pulsa "Exportar CSV" y devuelve el contenido del fichero descargado. */
  async function descargarCsv(page: Page): Promise<string> {
    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: /Exportar CSV/i }).click(),
    ]);
    const ruta = await descarga.path();
    expect(ruta, "la descarga debe producir un fichero").toBeTruthy();
    expect(descarga.suggestedFilename()).toMatch(/^tareas_\d{4}-\d{2}-\d{2}\.csv$/);
    return await readFile(ruta!, "utf8");
  }

  /** Filas de datos del CSV (sin cabecera ni linea final vacia). */
  function filas(contenido: string): string[] {
    return contenido.replace(/^﻿/, "").split("\n").slice(1).filter((l) => l.trim());
  }

  test("el CSV trae cabeceras y las tareas que se ven en pantalla", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks");
    await pantallaUtil(page);

    // Sin filtro de responsable ni de estado: la exportacion es de todo.
    await filtrar(page, "Responsable", "", "limit=");
    await filtrar(page, "Estado", "", "limit=");

    const contenido = await descargarCsv(page);

    expect(contenido.startsWith("﻿"), "el CSV debe llevar BOM para Excel").toBe(true);
    expect(contenido).toContain("Expediente,Urgente,Categoria,Titulo,Estado,Asignado a,Plazo");
    // Una tarea concreta del sembrado, con su expediente y su estado en español.
    expect(contenido).toContain(T("vencida del owner"));
    expect(contenido).toContain(E2E.tareas.caseRef);
    expect(contenido, "los estados se exportan traducidos").toMatch(/,Pendiente,/);

    // Y trae exactamente las tareas que hay, no una muestra.
    const enBase = await prisma.task.count({
      where: { case: { orgId: await orgE2E(), deletedAt: null } },
    });
    expect(filas(contenido).length).toBe(enBase);
  });

  test("el CSV respeta los filtros aplicados en la pantalla", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks");
    await pantallaUtil(page);

    // Se filtra por una categoria concreta…
    await filtrar(page, "Responsable", "", "limit=");
    await filtrar(page, "Estado", "", "limit=");
    await filtrar(page, "Categoria", "BANCOS", "category=BANCOS");

    const enPantalla = await titulosVisibles(page);
    expect(enPantalla.length, "el filtro debe dejar algo que exportar").toBeGreaterThan(0);

    const contenido = await descargarCsv(page);

    // …y el CSV trae esas, no la lista entera.
    const esperadas = await prisma.task.count({
      where: { category: "BANCOS", case: { orgId: await orgE2E(), deletedAt: null } },
    });
    expect(filas(contenido).length).toBe(esperadas);
    for (const titulo of enPantalla) {
      expect(contenido, `"${titulo}" se ve en pantalla y debe estar en el CSV`).toContain(titulo);
    }
    // Y una de otra categoria (SUMINISTROS) queda fuera.
    expect(contenido).not.toContain(T("sin plazo"));
  });
});

// ───────────────────────── Roles ─────────────────────────

test.describe("Tareas: roles", () => {
  for (const rol of [
    { correo: E2E.manager, nombre: "MANAGER" },
    { correo: E2E.operador, nombre: "OPERATOR" },
  ]) {
    test(`${rol.nombre} puede trabajar con las tareas`, async ({ page }) => {
      const tarea = await tareaDeApoyo(`ROL${rol.nombre}`);

      await login(page, rol.correo);
      await page.goto("/tasks");
      await pantallaUtil(page);
      await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

      // Ve las acciones y puede completarla.
      await page.getByRole("button", { name: `Marcar completada: ${tarea.title}` }).click();
      await expect(page.getByTestId("aviso-accion")).toContainText(/Tarea completada/i, {
        timeout: 20_000,
      });
      await expect(async () => {
        const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
        expect(enBase?.status).toBe("DONE");
      }).toPass({ timeout: 20_000 });
    });
  }

  test("VIEWER consulta pero no se le ofrece escribir", async ({ page }) => {
    const tarea = await tareaDeApoyo("ROLVIEWER");

    await login(page, E2E.viewer);
    await page.goto("/tasks");
    await pantallaUtil(page);
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    // Puede leer: la tarea esta ahi y la pantalla no da error.
    await expect(page.getByTestId("titulo-tarea").filter({ hasText: tarea.title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("carga-error")).toHaveCount(0);

    // Pero no se le ofrece ninguna accion de escritura.
    await expect(page.getByRole("button", { name: /^Marcar completada/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Iniciar:/ })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /^Seleccionar/ })).toHaveCount(0);

    // Puede leer las notas, pero no se le ofrece escribirlas.
    await page.getByRole("button", { name: `Notas de gestion de ${tarea.title}` }).click();
    await expect(page.getByLabel(`Nueva nota para ${tarea.title}`)).toHaveCount(0);
  });

  test("VIEWER: el servidor rechaza aunque vaya por la URL directa", async ({ page }) => {
    /*
     * La mitad que de verdad importa. Esconder un boton no es autorizar.
     * Se llama al endpoint directamente porque es EXACTAMENTE lo que se
     * comprueba: la unica excepcion admitida a la regla de esta suite.
     */
    const tarea = await tareaDeApoyo("VIEWERAPI");

    await login(page, E2E.viewer);

    const cambiar = await page.request.patch(`/api/cases/${tarea.caseId}/tasks`, {
      data: { taskId: tarea.id, status: "DONE" },
    });
    expect([401, 403], `cambiar estado devolvio ${cambiar.status()}`).toContain(cambiar.status());

    const crear = await page.request.post(`/api/cases/${tarea.caseId}/tasks`, {
      data: { title: "Intento de VIEWER", category: "OTROS" },
    });
    expect([401, 403], `crear devolvio ${crear.status()}`).toContain(crear.status());

    const borrar = await page.request.delete(
      `/api/cases/${tarea.caseId}/tasks?taskId=${tarea.id}`,
    );
    expect([401, 403], `borrar devolvio ${borrar.status()}`).toContain(borrar.status());

    const lote = await page.request.patch("/api/tasks/batch", {
      data: { taskIds: [tarea.id], status: "DONE" },
    });
    expect([401, 403], `lote devolvio ${lote.status()}`).toContain(lote.status());

    /*
     * Y la nota. Este endpoint pedia `tasks.read`, asi que un VIEWER —que solo
     * tiene permisos `.read`— podia dejar escritura permanente y firmada en
     * cualquier tarea de la organizacion. Ahora pide `tasks.update`.
     */
    const nota = await page.request.post(`/api/tasks/${tarea.id}/notes`, {
      data: { content: "Nota de un usuario de solo lectura" },
    });
    expect([401, 403], `escribir nota devolvio ${nota.status()}`).toContain(nota.status());

    // Nada de lo intentado ha ocurrido.
    const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
    expect(enBase?.status).toBe("PENDING");
    expect(await prisma.taskNote.count({ where: { taskId: tarea.id } })).toBe(0);
    expect(await prisma.task.count({ where: { title: "Intento de VIEWER" } })).toBe(0);
  });
});

// ───────────────────────── Accesibilidad ─────────────────────────

test.describe("Tareas: accesibilidad", () => {
  test("los filtros de la bandeja tienen nombre accesible", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks");
    await pantallaUtil(page);

    for (const etiqueta of ["Responsable", "Estado", "Categoria"]) {
      const campo = page.getByLabel(etiqueta, { exact: true });
      await expect(campo, `el filtro "${etiqueta}" debe tener etiqueta asociada`).toHaveCount(1);
      await expect(campo).toBeEnabled();
    }
    // Y son listas desplegables de verdad, no divs disfrazados.
    await expect(page.getByRole("combobox", { name: "Responsable" })).toHaveCount(1);
  });

  test("el formulario de nueva tarea tiene nombre accesible en cada campo", async ({ page }) => {
    const caso = await casoDeTareas();
    await login(page, E2E.owner);
    await abrirPestanaTareas(page, caso.id);
    await page.getByRole("button", { name: "Añadir tarea" }).click();

    const campos = [
      "Titulo de la tarea *",
      "Categoria de la tarea",
      "Fecha limite (opcional)",
      "Responsable de la tarea",
      "Descripcion de la tarea (opcional)",
    ];
    for (const etiqueta of campos) {
      const campo = page.getByLabel(etiqueta, { exact: true });
      await expect(campo, `el campo "${etiqueta}" debe tener etiqueta asociada`).toHaveCount(1);
      await expect(campo).toBeEditable();
    }
  });

  test("el titulo de una tarea se puede editar con el teclado", async ({ page }) => {
    /*
     * Era un `<p onClick>`: no recibia foco, no respondia a Enter y un lector
     * de pantalla lo leia como texto corrido. Quien no usa raton no podia
     * renombrar una tarea. Ahora es un `<button>`.
     */
    const tarea = await tareaDeApoyo("TECLADO");
    const nuevoTitulo = `${tarea.title} por teclado`;

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    const boton = page.getByRole("button", { name: `Editar titulo: ${tarea.title}` });
    await boton.focus();
    await expect(boton).toBeFocused();
    await page.keyboard.press("Enter");

    const campo = page.getByLabel("Titulo de la tarea", { exact: true });
    await expect(campo).toBeFocused();
    await campo.fill(nuevoTitulo);
    await campo.press("Enter");

    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
      expect(enBase?.title).toBe(nuevoTitulo);
    }).toPass({ timeout: 20_000 });
  });

  test("los botones de accion se anuncian con la tarea a la que pertenecen", async ({ page }) => {
    const tarea = await tareaDeApoyo("NOMBRES");

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await filtrar(page, "Responsable", "unassigned", "assignee=unassigned");

    // Con muchas tareas en pantalla, "Completar" a secas no dice cual.
    await expect(
      page.getByRole("button", { name: `Marcar completada: ${tarea.title}` }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: `Notas de gestion de ${tarea.title}` }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("checkbox", { name: `Seleccionar ${tarea.title}` }),
    ).toHaveCount(1);
  });

  test("los controles de la ficha se anuncian con la tarea a la que pertenecen", async ({ page }) => {
    /*
     * Tres defectos que estaban aqui: la insignia del plazo se anunciaba con su
     * propio texto ("Plazo: 30d - …"), el campo de fecha no tenia ningun
     * nombre, y el cuadro de nota solo tenia `placeholder`, que no es una
     * etiqueta. Con varias tareas en la ficha, ninguno decia de cual era.
     */
    const tarea = await tareaDeApoyo("NOMBRESFICHA");

    await login(page, E2E.owner);
    await abrirPestanaTareas(page, tarea.caseId);

    for (const nombre of [
      `Editar plazo de ${tarea.title}`,
      `Eliminar tarea: ${tarea.title}`,
      `Notas de gestion de ${tarea.title}`,
    ]) {
      await expect(page.getByRole("button", { name: nombre }), nombre).toHaveCount(1);
    }
    for (const nombre of [
      `Responsable de ${tarea.title}`,
      `Dependencia de ${tarea.title}`,
      `Estado de ${tarea.title}`,
    ]) {
      await expect(page.getByRole("combobox", { name: nombre }), nombre).toHaveCount(1);
    }

    // El campo de fecha, que solo aparece al abrir la edicion del plazo.
    await page.getByRole("button", { name: `Editar plazo de ${tarea.title}` }).click();
    await expect(page.getByLabel(`Plazo de ${tarea.title}`)).toBeEditable();

    // Y el cuadro de nota del panel de la ficha.
    await page.getByRole("button", { name: `Notas de gestion de ${tarea.title}` }).click();
    await expect(page.getByLabel(`Nueva nota para ${tarea.title}`)).toBeEditable();
  });
});
