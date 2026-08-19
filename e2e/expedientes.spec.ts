/**
 * Expedientes, conducidos como los conduce una persona.
 *
 * REGLA DE ESTA SUITE
 * -------------------
 * Ningun clic ni formulario se sustituye por `page.goto` ni por una llamada al
 * API. La unica excepcion, declarada en cada caso, es cuando lo que se
 * comprueba es EXPRESAMENTE la segunda mitad del control de acceso: que el
 * servidor rechaza aunque la interfaz no ofrezca el boton.
 *
 * Los expedientes de apoyo (los que una prueba edita o borra) SI se crean
 * contra la base: crear no es lo que esas pruebas comprueban, y hacerlas pasar
 * por el asistente de cinco pasos solo anadiria minutos y motivos de fallo
 * ajenos. El alta se prueba entera, por el asistente, en su propio bloque.
 *
 * Y toda accion que escribe se prueba en los dos sentidos: cuando sale bien y
 * cuando falla. Un boton que se calla al fallar es el defecto que esta fase
 * persigue.
 */
import { type Page, type Locator } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
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

const buscador = 'input[placeholder*="Buscar por nombre"]';

/** Filas de la tabla de expedientes (la de escritorio). */
function filas(page: Page) {
  return page.locator("table tbody tr");
}

/** Referencias visibles en la pagina actual del listado, en orden. */
async function refsVisibles(page: Page): Promise<string[]> {
  return (await page.getByTestId("ref-expediente").allTextContents()).map((t) => t.trim());
}

/** El total que anuncia la cabecera: "31 expedientes". */
async function totalAnunciado(page: Page): Promise<number> {
  const texto = await page.getByTestId("total-expedientes").innerText();
  return Number(texto.trim().split(" ")[0]);
}

/**
 * Busca en el listado y espera al resultado de verdad.
 *
 * Mientras carga, la tabla sustituye las filas por "Cargando...": leerla antes
 * de que llegue la respuesta devolveria las filas ANTERIORES y la prueba
 * afirmaria cosas sobre una busqueda que aun no ha ocurrido. Por eso se espera
 * primero a la respuesta con el termino buscado, y solo despues a que vuelva a
 * haber filas (o el estado vacio).
 */
async function buscar(page: Page, texto: string) {
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/cases?") &&
        r.url().includes(`search=${encodeURIComponent(texto)}`) &&
        r.status() === 200,
      { timeout: 25_000 },
    ),
    // El buscador va con retardo de 300 ms: se espera al resultado, no al reloj.
    page.fill(buscador, texto),
  ]);
  await expect(async () => {
    const refs = await refsVisibles(page);
    const vacio = await page.getByTestId("carga-vacio").count();
    expect(refs.length > 0 || vacio > 0).toBe(true);
  }).toPass({ timeout: 20_000 });
}

/** Abre un expediente desde el listado, buscandolo y pulsando su referencia. */
async function abrirExpediente(page: Page, ref: string) {
  await buscar(page, ref);
  const enlace = page.getByTestId("ref-expediente").filter({ hasText: ref }).first();
  await expect(enlace).toBeVisible({ timeout: 20_000 });
  await enlace.click();
  await page.waitForURL(/\/cases\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: ref })).toBeVisible({ timeout: 30_000 });
}

/** Identificador de la organizacion de pruebas. */
async function orgE2E(): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { slug: E2E.orgSlug },
    select: { id: true },
  });
  if (!org) throw new Error("La organizacion de pruebas no existe: revisa el sembrado");
  return org.id;
}

/**
 * Expediente de apoyo para las pruebas que editan o borran.
 *
 * Con referencia unica por ejecucion: si dos pruebas compartieran expediente,
 * la que borra dejaria a la que edita sin nada que editar, y el fallo se leeria
 * como un defecto del producto.
 */
async function expedienteDeApoyo(sufijo: string) {
  const orgId = await orgE2E();
  const ref = `EXP-APOYO-${sufijo}-${Date.now().toString().slice(-6)}`;
  return prisma.case.create({
    data: {
      orgId,
      ref,
      province: "Madrid",
      categories: ["BANCOS"],
      deceased: { create: { fullName: `Apoyo ${sufijo} ${ref}`, deathDate: new Date("2026-02-01") } },
      contact: { create: { fullName: `Contacto ${sufijo}`, email: "apoyo@ejemplo.test" } },
    },
    select: { id: true, ref: true },
  });
}

/** El bloque blanco de la ficha cuyo encabezado es `titulo`. */
function bloqueFicha(page: Page, titulo: string): Locator {
  return page
    .locator("div.bg-white.p-6")
    .filter({ has: page.getByRole("heading", { name: titulo, exact: true }) })
    .first();
}

test.describe("Expedientes: listado, busqueda y filtros", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");
    await pantallaUtil(page);
  });

  test("el listado muestra el expediente del seed", async ({ page }) => {
    await expect(page.locator(`text=${E2E.caseRef}`).first()).toBeVisible({ timeout: 20_000 });
  });

  test("buscar por referencia filtra la lista", async ({ page }) => {
    await page.fill(buscador, E2E.caseRef);
    await expect(page.locator(`text=${E2E.caseRef}`).first()).toBeVisible({ timeout: 20_000 });

    // Y una referencia que no existe deja la lista vacia, diciendolo.
    await page.fill(buscador, "EXP-NO-EXISTE-0000");
    await expect(page.getByTestId("carga-vacio").first()).toBeVisible({ timeout: 20_000 });
    // Vacio NO es error: son cosas distintas y la pantalla debe distinguirlas.
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("buscar por nombre del causante encuentra el expediente", async ({ page }) => {
    const caso = await prisma.case.findFirst({
      where: { ref: E2E.caseRef },
      select: { deceased: { select: { fullName: true } } },
    });
    const nombre = caso?.deceased?.fullName;
    test.skip(!nombre, "el seed no trae nombre de causante");

    await page.fill(buscador, nombre!.split(" ")[0]);
    await expect(page.locator(`text=${E2E.caseRef}`).first()).toBeVisible({ timeout: 20_000 });
  });

  test("el filtro de estado cambia la consulta Y los resultados", async ({ page }) => {
    const selectEstado = page.locator("select").first();

    const [peticion] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/cases?"), { timeout: 20_000 }),
      selectEstado.selectOption("IN_PROGRESS"),
    ]);
    expect(peticion.url()).toContain("status=IN_PROGRESS");

    // Y no basta con que salga la peticion: lo que se ve tiene que cambiar.
    // Cada fila lleva su propio selector de estado; todos deben marcar el
    // estado filtrado. Si el filtro fuera decorativo, aqui habria de todo.
    await expect(async () => {
      const estados = await filas(page).locator("select").evaluateAll((ss) =>
        ss.map((s) => (s as HTMLSelectElement).value),
      );
      expect(estados.length, "el filtro no puede dejar la lista vacia").toBeGreaterThan(0);
      expect(new Set(estados)).toEqual(new Set(["IN_PROGRESS"]));
    }).toPass({ timeout: 20_000 });

    await pantallaUtil(page);
  });

  test("el filtro de categoria llega al servidor y reduce la lista", async ({ page }) => {
    const total = await totalAnunciado(page);

    const selectCategoria = page.locator("select").nth(1);
    const [peticion] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/cases?"), { timeout: 20_000 }),
      selectCategoria.selectOption("BANCOS"),
    ]);
    expect(peticion.url()).toContain("category=BANCOS");

    await expect(async () => {
      const filtrado = await totalAnunciado(page);
      expect(filtrado, "debe quedar algun expediente de BANCOS").toBeGreaterThan(0);
      expect(filtrado, "y menos que sin filtrar").toBeLessThan(total);
    }).toPass({ timeout: 20_000 });
  });

  test("el filtro de provincia llega al servidor y reduce la lista", async ({ page }) => {
    const total = await totalAnunciado(page);

    const selectProvincia = page.locator("select").nth(2);
    const [peticion] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/cases?"), { timeout: 20_000 }),
      selectProvincia.selectOption("Madrid"),
    ]);
    expect(peticion.url()).toContain("province=Madrid");

    await expect(async () => {
      const filtrado = await totalAnunciado(page);
      expect(filtrado).toBeGreaterThan(0);
      expect(filtrado).toBeLessThan(total);
    }).toPass({ timeout: 20_000 });
  });

  test("abrir un expediente desde la lista lleva a su ficha", async ({ page }) => {
    const enlace = page.locator(`a:has-text("${E2E.caseRef}")`).first();
    await expect(enlace).toBeVisible({ timeout: 20_000 });
    await enlace.click();
    await page.waitForURL(/\/cases\/[^/]+$/, { timeout: 30_000 });
    await pantallaUtil(page);
  });
});

/**
 * NINGUN control de esta pantalla puede ser decorativo.
 *
 * Cada preset se comprueba en las dos mitades: que sale la peticion con su
 * parametro (si no saliera, el boton no haria nada) y que el resultado que
 * vuelve es realmente distinto (si volviera lo mismo, el parametro no se
 * estaria usando).
 */
test.describe("Expedientes: los presets no son decorativos", () => {
  interface Preset {
    etiqueta: string;
    parametro: string;
    /** Comprobacion sobre las filas que quedan. */
    comprueba: (page: Page, totalSinFiltro: number) => Promise<void>;
  }

  /** Todas las filas marcan el estado indicado. */
  function soloEstado(estado: string) {
    return async (page: Page) => {
      await expect(async () => {
        const estados = await filas(page).locator("select").evaluateAll((ss) =>
          ss.map((s) => (s as HTMLSelectElement).value),
        );
        expect(estados.length, `el preset no debe dejar la lista vacia`).toBeGreaterThan(0);
        expect(new Set(estados)).toEqual(new Set([estado]));
      }).toPass({ timeout: 20_000 });
    };
  }

  /** Quedan expedientes, pero menos de los que habia. */
  function reduceLaLista() {
    return async (page: Page, totalSinFiltro: number) => {
      await expect(async () => {
        const total = await totalAnunciado(page);
        expect(total, "el preset debe dejar algo").toBeGreaterThan(0);
        expect(total, "y quitar algo").toBeLessThan(totalSinFiltro);
      }).toPass({ timeout: 20_000 });
    };
  }

  const PRESETS: Preset[] = [
    { etiqueta: "Mis expedientes", parametro: "myTasks=true", comprueba: reduceLaLista() },
    {
      etiqueta: "Urgentes",
      parametro: "urgent=true",
      comprueba: async (page) => {
        await expect(async () => {
          const cuantas = await filas(page).count();
          expect(cuantas).toBeGreaterThan(0);
          const urgentes = await filas(page).filter({ hasText: "Urgente" }).count();
          expect(urgentes, "todas las filas deben ser urgentes").toBe(cuantas);
        }).toPass({ timeout: 20_000 });
      },
    },
    { etiqueta: "ISD < 30d", parametro: "isdExpiring=30", comprueba: reduceLaLista() },
    { etiqueta: "ISD < 60d", parametro: "isdExpiring=60", comprueba: reduceLaLista() },
    { etiqueta: "Docs pendientes", parametro: "status=PENDING_DOCS", comprueba: soloEstado("PENDING_DOCS") },
    { etiqueta: "En curso", parametro: "status=IN_PROGRESS", comprueba: soloEstado("IN_PROGRESS") },
    { etiqueta: "Nuevos", parametro: "status=INTAKE", comprueba: soloEstado("INTAKE") },
    { etiqueta: "Listos para enviar", parametro: "status=READY_TO_SEND", comprueba: soloEstado("READY_TO_SEND") },
    { etiqueta: "Cerrados", parametro: "status=CLOSED", comprueba: soloEstado("CLOSED") },
  ];

  for (const preset of PRESETS) {
    test(`el preset "${preset.etiqueta}" filtra de verdad`, async ({ page }) => {
      await login(page, E2E.owner);
      await page.goto("/cases");
      await pantallaUtil(page);

      const totalSinFiltro = await totalAnunciado(page);
      expect(totalSinFiltro, "hacen falta expedientes sembrados").toBeGreaterThan(1);

      const boton = page.getByRole("button", { name: preset.etiqueta, exact: true });
      await expect(boton).toBeVisible({ timeout: 20_000 });

      const [peticion] = await Promise.all([
        page.waitForRequest((r) => r.url().includes("/api/cases?"), { timeout: 20_000 }),
        boton.click(),
      ]);
      expect(
        peticion.url(),
        `"${preset.etiqueta}" debe enviar ${preset.parametro}`,
      ).toContain(preset.parametro);

      // El preset queda marcado: sin eso el usuario no sabe que hay un filtro.
      await expect(boton).toHaveClass(/bg-primary/, { timeout: 10_000 });

      await preset.comprueba(page, totalSinFiltro);

      // Y se puede quitar: volver a pulsarlo devuelve la lista entera.
      await boton.click();
      await expect(async () => {
        expect(await totalAnunciado(page)).toBe(totalSinFiltro);
      }).toPass({ timeout: 20_000 });
      await expect(boton).not.toHaveClass(/bg-primary/);
    });
  }
});

test.describe("Expedientes: alta por el asistente", () => {
  /**
   * Recorre el asistente entero como una persona.
   *
   * Se localiza con `getByLabel`, no por CSS: si algun campo pierde su etiqueta
   * asociada, estas pruebas dejan de encontrarlo y fallan. Esa es justo la
   * garantia que se quiere, y por eso ademas hay una prueba dedicada a los
   * nombres accesibles mas abajo.
   */
  async function recorrerAsistente(page: Page, nombre: string) {
    // 1. Fallecido
    await page.getByLabel("Nombre del fallecido").fill(nombre);
    await page.getByLabel("Fecha aproximada de fallecimiento").fill("2026-05-10");
    await page.getByLabel("DNI del fallecido").fill("12345678Z");
    await page.getByRole("button", { name: "Siguiente" }).click();

    // 2. Solicitante
    await expect(page.getByRole("heading", { name: /Datos del solicitante/i })).toBeVisible();
    await page.getByLabel("Nombre del solicitante").fill("Solicitante E2E");
    await page.getByLabel("Telefono de contacto").fill("600000000");
    await page.getByLabel("Email de contacto").fill("solicitante.e2e@ejemplo.test");
    await page.getByLabel("Relacion con el fallecido").selectOption("Hijo/a");
    await page.getByRole("button", { name: "Siguiente" }).click();

    // 3. Detalles. La categoria es obligatoria: sin marcarla el asistente se
    //    queda aqui, que es exactamente donde se quedaba antes esta prueba.
    await expect(page.getByRole("heading", { name: /Detalles del expediente/i })).toBeVisible();
    await page.getByLabel("Provincia").fill("Madrid");
    await page.getByRole("checkbox", { name: "Bancos" }).check();
    await page.getByRole("button", { name: "Siguiente" }).click();

    // 4. Plantilla (opcional)
    await expect(page.getByRole("heading", { name: /Plantilla de tareas/i })).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    // 5. Consentimiento: las dos casillas son obligatorias.
    await expect(page.getByRole("heading", { name: /Consentimiento/i })).toBeVisible();
    await page.getByRole("checkbox", { name: /Confirmo que actuo/ }).check();
    await page.getByRole("checkbox", { name: /Acepto los terminos/ }).check();
  }

  test("el asistente crea el expediente y aparece en el listado", async ({ page }) => {
    const nombre = `Fallecido Asistente ${Date.now().toString().slice(-6)}`;

    await login(page, E2E.owner);
    await page.goto("/cases");
    await pantallaUtil(page);

    // Se entra por donde entra el usuario: el boton del listado.
    await page.getByRole("link", { name: "Nuevo expediente" }).click();
    await page.waitForURL("**/cases/new", { timeout: 30_000 });

    await recorrerAsistente(page, nombre);

    // El resumen del ultimo paso debe reflejar lo introducido antes de crear.
    await expect(page.getByText(nombre).first()).toBeVisible();

    await page.getByRole("button", { name: "Crear expediente" }).click();

    // Navegacion a la ficha del expediente recien creado.
    await page.waitForURL(/\/cases\/(?!new|import|kanban)[^/]+$/, { timeout: 45_000 });
    await pantallaUtil(page);
    const id = page.url().split("/").pop()!;

    // Existe en la base, con los datos que se escribieron.
    const creado = await prisma.case.findUnique({
      where: { id },
      include: { deceased: true, contact: true },
    });
    expect(creado, "el expediente debe existir en la base").not.toBeNull();
    expect(creado!.deceased?.fullName).toBe(nombre);
    expect(creado!.contact?.fullName).toBe("Solicitante E2E");
    expect(creado!.contact?.email).toBe("solicitante.e2e@ejemplo.test");
    expect(creado!.province).toBe("Madrid");
    expect(creado!.categories).toContain("BANCOS");
    expect(creado!.consentAccepted).toBe(true);
    // La ficha muestra su referencia.
    await expect(page.getByRole("heading", { name: creado!.ref })).toBeVisible({ timeout: 30_000 });

    // Y se vuelve al listado por la navegacion, donde tiene que aparecer.
    await page.getByRole("link", { name: "Expedientes", exact: true }).first().click();
    await page.waitForURL(/\/cases(\?.*)?$/, { timeout: 30_000 });
    await buscar(page, creado!.ref);
    await expect(
      page.getByTestId("ref-expediente").filter({ hasText: creado!.ref }),
      "el expediente creado debe aparecer en el listado",
    ).toBeVisible({ timeout: 20_000 });
  });

  test("el asistente no deja pasar sin el nombre del fallecido", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases/new");

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByTestId("error-asistente")).toHaveText(/Nombre obligatorio/i);
    // Y sigue en el primer paso: no ha avanzado a espaldas del aviso.
    await expect(page.getByRole("heading", { name: /Datos del fallecido/i })).toBeVisible();
  });

  test("el asistente exige al menos una categoria para pasar de Detalles", async ({ page }) => {
    /*
     * Este era el bloqueo. La prueba anterior recorria el asistente sin marcar
     * ninguna categoria, el paso 3 la rechazaba —con razon, es obligatoria— y
     * el recorrido nunca llegaba al boton "Crear expediente". El producto hacia
     * lo correcto; lo que faltaba era decirlo de forma audible y probarlo.
     */
    await login(page, E2E.owner);
    await page.goto("/cases/new");

    await page.getByLabel("Nombre del fallecido").fill("Fallecido sin categoria");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByLabel("Nombre del solicitante").fill("Solicitante sin categoria");
    await page.getByLabel("Telefono de contacto").fill("600111222");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("heading", { name: /Detalles del expediente/i })).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByTestId("error-asistente")).toHaveText(/al menos una categoria/i);
    await expect(page.getByRole("heading", { name: /Detalles del expediente/i })).toBeVisible();

    // Y marcando una, avanza.
    await page.getByRole("checkbox", { name: "Seguros" }).check();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByRole("heading", { name: /Plantilla de tareas/i })).toBeVisible();
  });

  test("el paso 2 exige un telefono o un email de contacto", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases/new");

    await page.getByLabel("Nombre del fallecido").fill("Fallecido sin contacto");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByLabel("Nombre del solicitante").fill("Solicitante sin contacto");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByTestId("error-asistente")).toHaveText(/tel[eé]fono o email/i);
    await expect(page.getByRole("heading", { name: /Datos del solicitante/i })).toBeVisible();
  });

  test("si el servidor rechaza el alta, se dice y no se navega a ninguna parte", async ({
    page,
  }) => {
    await login(page, E2E.owner);
    await page.goto("/cases/new");

    permitirFalloEn(page, "/api/cases");
    await page.route("**/api/cases", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "fallo simulado del servidor" }),
        });
      } else {
        await route.continue();
      }
    });

    await recorrerAsistente(page, "Fallecido que no debe crearse");
    await page.getByRole("button", { name: "Crear expediente" }).click();

    await expect(page.getByTestId("error-asistente")).toHaveText(/fallo simulado del servidor/i);
    // Sigue en el asistente, con el boton utilizable: nada de "Creando…" eterno.
    await expect(page).toHaveURL(/\/cases\/new$/);
    await expect(page.getByRole("button", { name: "Crear expediente" })).toBeEnabled();

    // Y no ha quedado nada a medias en la base.
    const fantasma = await prisma.case.findFirst({
      where: { deceased: { fullName: "Fallecido que no debe crearse" } },
    });
    expect(fantasma, "no puede crearse un expediente que el servidor rechazo").toBeNull();
  });

  /**
   * Red de seguridad de accesibilidad.
   *
   * Falla si un campo principal del asistente pierde su nombre accesible: sin
   * `htmlFor`/`id` (ni el input dentro del label) `getByLabel` no encuentra
   * nada, que es lo mismo que le pasa a un lector de pantalla.
   */
  test("los campos del asistente tienen nombre accesible", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases/new");

    const paso1 = ["Nombre del fallecido", "Fecha aproximada de fallecimiento", "DNI del fallecido"];
    for (const etiqueta of paso1) {
      const campo = page.getByLabel(etiqueta);
      await expect(campo, `el campo "${etiqueta}" debe tener etiqueta asociada`).toHaveCount(1);
      await expect(campo).toBeEditable();
    }

    await page.getByLabel("Nombre del fallecido").fill("Comprobacion de etiquetas");
    await page.getByRole("button", { name: "Siguiente" }).click();

    const paso2 = [
      "Nombre del solicitante",
      "Telefono de contacto",
      "Email de contacto",
      "Relacion con el fallecido",
    ];
    for (const etiqueta of paso2) {
      const campo = page.getByLabel(etiqueta);
      await expect(campo, `el campo "${etiqueta}" debe tener etiqueta asociada`).toHaveCount(1);
      await expect(campo).toBeEnabled();
    }

    await page.getByLabel("Telefono de contacto").fill("600333444");
    await page.getByLabel("Nombre del solicitante").fill("Comprobacion");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByLabel("Provincia")).toHaveCount(1);
    // Las casillas de categoria toman su nombre del texto que llevan dentro.
    await expect(page.getByRole("checkbox", { name: "Bancos" })).toHaveCount(1);
    await expect(page.getByRole("checkbox", { name: "Suministros" })).toHaveCount(1);
    // El grupo se anuncia como grupo, no como una etiqueta suelta sin campo.
    await expect(page.getByRole("group", { name: /Categorias de gestion/i })).toHaveCount(1);
  });
});

test.describe("Expedientes: edicion", () => {
  test("editar el fallecido guarda, avisa y persiste tras recargar", async ({ page }) => {
    const caso = await expedienteDeApoyo("EDIT");
    const nuevoNombre = `Editado ${Date.now().toString().slice(-6)}`;

    await login(page, E2E.owner);
    await page.goto("/cases");
    await abrirExpediente(page, caso.ref);

    const bloque = bloqueFicha(page, "Fallecido");
    await bloque.getByRole("button", { name: "Editar datos del fallecido" }).click();

    await page.getByLabel("Nombre del fallecido").fill(nuevoNombre);
    await page.getByLabel("DNI/NIE del fallecido").fill("00000000T");
    await bloque.getByRole("button", { name: "Guardar" }).click();

    // Mensaje de exito visible.
    await expect(page.getByTestId("toast-exito")).toContainText(/cambios guardados/i, {
      timeout: 20_000,
    });

    // Y el cambio esta en la base, no solo en pantalla.
    await expect(async () => {
      const enBase = await prisma.deceased.findUnique({ where: { caseId: caso.id } });
      expect(enBase?.fullName).toBe(nuevoNombre);
      expect(enBase?.dni).toBe("00000000T");
    }).toPass({ timeout: 20_000 });

    // Recargar: lo que se ve sigue siendo lo guardado.
    await page.reload();
    await pantallaUtil(page);
    await expect(bloqueFicha(page, "Fallecido")).toContainText(nuevoNombre, { timeout: 30_000 });
    await expect(bloqueFicha(page, "Fallecido")).toContainText("00000000T");
  });

  test("editar el solicitante guarda y persiste tras recargar", async ({ page }) => {
    const caso = await expedienteDeApoyo("EDITC");
    const nuevoTelefono = "600999888";

    await login(page, E2E.owner);
    await page.goto("/cases");
    await abrirExpediente(page, caso.ref);

    const bloque = bloqueFicha(page, "Solicitante");
    await bloque.getByRole("button", { name: "Editar datos del solicitante" }).click();
    await page.getByLabel("Telefono del solicitante").fill(nuevoTelefono);
    await page.getByLabel("Relacion con el fallecido").fill("Hijo/a");
    await bloque.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByTestId("toast-exito")).toContainText(/cambios guardados/i, {
      timeout: 20_000,
    });

    await page.reload();
    await pantallaUtil(page);
    await expect(bloqueFicha(page, "Solicitante")).toContainText(nuevoTelefono, { timeout: 30_000 });
  });

  /**
   * Los tres caminos malos.
   *
   * En los tres se exige lo mismo: que se diga, que NO se muestre como guardado
   * lo que no se ha guardado, y que el formulario siga sirviendo. Antes de este
   * parche los tres cerraban el panel en silencio y el usuario veia su cambio
   * desaparecer sin explicacion; con la red caida, ademas, el boton se quedaba
   * en "Guardando…" para siempre.
   */
  for (const escenario of [
    {
      nombre: "un 400 con el detalle del campo",
      estado: 400,
      cuerpo: { error: "Datos invalidos", details: [{ message: "El nombre no puede estar vacio" }] },
      // Con un error de validacion, el detalle del campo es mucho mas util que
      // el generico: es lo unico que le dice al usuario que corregir.
      texto: /El nombre no puede estar vacio/i,
    },
    { nombre: "un 422 de validacion", estado: 422, cuerpo: { error: "Datos invalidos" }, texto: /Datos invalidos/i },
    { nombre: "un 500 del servidor", estado: 500, cuerpo: { error: "Error interno" }, texto: /Error interno/i },
  ]) {
    test(`si al guardar llega ${escenario.nombre}, se avisa y no se falsea`, async ({ page }) => {
      const caso = await expedienteDeApoyo("EDITERR");
      const original = `Apoyo EDITERR ${caso.ref}`;

      await login(page, E2E.owner);
      await page.goto("/cases");
      await abrirExpediente(page, caso.ref);

      permitirFalloEn(page, "/api/cases/");
      await page.route(`**/api/cases/${caso.id}`, async (route) => {
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

      const bloque = bloqueFicha(page, "Fallecido");
      await bloque.getByRole("button", { name: "Editar datos del fallecido" }).click();
      await page.getByLabel("Nombre del fallecido").fill("Cambio que no debe guardarse");
      await bloque.getByRole("button", { name: "Guardar" }).click();

      // 1. Se dice.
      await expect(page.getByTestId("toast-error")).toContainText(escenario.texto, {
        timeout: 20_000,
      });
      // 2. No se anuncia exito.
      await expect(page.getByTestId("toast-exito")).toHaveCount(0);
      // 3. La base no ha cambiado.
      const enBase = await prisma.deceased.findUnique({ where: { caseId: caso.id } });
      expect(enBase?.fullName).toBe(original);
      // 4. El formulario sigue abierto y utilizable, con lo escrito dentro.
      await expect(page.getByLabel("Nombre del fallecido")).toHaveValue(
        "Cambio que no debe guardarse",
      );
      await expect(bloque.getByRole("button", { name: "Guardar" })).toBeEnabled();
    });
  }

  test("si la red se cae al guardar, se avisa y el boton no se queda girando", async ({
    page,
  }) => {
    const caso = await expedienteDeApoyo("EDITRED");
    const original = `Apoyo EDITRED ${caso.ref}`;

    await login(page, E2E.owner);
    await page.goto("/cases");
    await abrirExpediente(page, caso.ref);

    permitirFalloEn(page, "/api/cases/");
    await page.route(`**/api/cases/${caso.id}`, async (route) => {
      if (route.request().method() === "PATCH") await route.abort("failed");
      else await route.continue();
    });

    const bloque = bloqueFicha(page, "Fallecido");
    await bloque.getByRole("button", { name: "Editar datos del fallecido" }).click();
    await page.getByLabel("Nombre del fallecido").fill("Cambio con la red caida");
    await bloque.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByTestId("toast-error")).toContainText(/No se han podido guardar/i, {
      timeout: 20_000,
    });
    // El defecto concreto que esto impide: "Guardando…" eterno.
    await expect(bloque.getByRole("button", { name: "Guardar" })).toBeEnabled({ timeout: 10_000 });

    const enBase = await prisma.deceased.findUnique({ where: { caseId: caso.id } });
    expect(enBase?.fullName).toBe(original);
  });
});

test.describe("Expedientes: eliminacion individual", () => {
  test("cancelar no borra; confirmar borra y desaparece del listado", async ({ page }) => {
    const caso = await expedienteDeApoyo("BORRAR");

    await login(page, E2E.owner);
    await page.goto("/cases");
    await abrirExpediente(page, caso.ref);

    // 1. Se pide confirmacion.
    await page.getByRole("button", { name: "Eliminar expediente" }).click();
    const dialogo = page.getByTestId("confirmar-borrado");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(caso.ref);

    // 2. Cancelar no borra nada.
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogo).toHaveCount(0);
    let enBase = await prisma.case.findUnique({ where: { id: caso.id } });
    expect(enBase?.deletedAt, "cancelar no puede borrar").toBeNull();

    // Y sigue en el listado.
    await page.getByRole("link", { name: "Expedientes", exact: true }).first().click();
    await page.waitForURL(/\/cases(\?.*)?$/, { timeout: 30_000 });
    await buscar(page, caso.ref);
    await expect(page.getByTestId("ref-expediente").filter({ hasText: caso.ref })).toBeVisible();

    // 3. Ahora si: abrir, eliminar y confirmar.
    await page.getByTestId("ref-expediente").filter({ hasText: caso.ref }).first().click();
    await page.waitForURL(/\/cases\/[^/]+$/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Eliminar expediente" }).click();
    await page.getByTestId("confirmar-borrado").getByRole("button", { name: /Si, eliminar/ }).click();

    // Vuelve al listado diciendo lo que ha pasado.
    await page.waitForURL(/\/cases(\?.*)?$/, { timeout: 30_000 });
    await expect(page.getByTestId("aviso-accion")).toContainText(/Expediente eliminado/i, {
      timeout: 20_000,
    });

    // 4. Ya no esta: ni en la base ni en el listado.
    enBase = await prisma.case.findUnique({ where: { id: caso.id } });
    expect(enBase?.deletedAt, "confirmar debe borrar").not.toBeNull();

    await buscar(page, caso.ref);
    await expect(page.getByTestId("ref-expediente").filter({ hasText: caso.ref })).toHaveCount(0);
    await expect(page.getByTestId("carga-vacio").first()).toBeVisible({ timeout: 20_000 });
  });

  test("si el servidor rechaza el borrado, NO se anuncia como hecho", async ({ page }) => {
    const caso = await expedienteDeApoyo("BORRAR500");

    await login(page, E2E.owner);
    await page.goto("/cases");
    await abrirExpediente(page, caso.ref);

    permitirFalloEn(page, "/api/cases/");
    await page.route(`**/api/cases/${caso.id}`, async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "no se ha podido borrar" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: "Eliminar expediente" }).click();
    await page.getByTestId("confirmar-borrado").getByRole("button", { name: /Si, eliminar/ }).click();

    await expect(page.getByTestId("toast-error")).toContainText(/no se ha podido borrar/i, {
      timeout: 20_000,
    });
    // No se navega: seguimos en la ficha del expediente, que sigue existiendo.
    await expect(page).toHaveURL(new RegExp(`/cases/${caso.id}$`));
    const enBase = await prisma.case.findUnique({ where: { id: caso.id } });
    expect(enBase?.deletedAt).toBeNull();
    // Y el dialogo sigue utilizable para reintentar o cancelar.
    await expect(
      page.getByTestId("confirmar-borrado").getByRole("button", { name: /Si, eliminar/ }),
    ).toBeEnabled({ timeout: 10_000 });
  });

  test("si la red se cae al borrar, tampoco se anuncia como hecho", async ({ page }) => {
    const caso = await expedienteDeApoyo("BORRARRED");

    await login(page, E2E.owner);
    await page.goto("/cases");
    await abrirExpediente(page, caso.ref);

    permitirFalloEn(page, "/api/cases/");
    await page.route(`**/api/cases/${caso.id}`, async (route) => {
      if (route.request().method() === "DELETE") await route.abort("failed");
      else await route.continue();
    });

    await page.getByRole("button", { name: "Eliminar expediente" }).click();
    await page.getByTestId("confirmar-borrado").getByRole("button", { name: /Si, eliminar/ }).click();

    await expect(page.getByTestId("toast-error")).toContainText(/No se ha podido eliminar/i, {
      timeout: 20_000,
    });
    const enBase = await prisma.case.findUnique({ where: { id: caso.id } });
    expect(enBase?.deletedAt).toBeNull();
    await expect(
      page.getByTestId("confirmar-borrado").getByRole("button", { name: /Si, eliminar/ }),
    ).toBeEnabled({ timeout: 10_000 });
  });

  test("un VIEWER no ve el boton de eliminar, y el servidor tampoco le deja", async ({ page }) => {
    const caso = await expedienteDeApoyo("BORRARVIEWER");

    await login(page, E2E.viewer);
    await page.goto("/cases");
    await abrirExpediente(page, caso.ref);

    await expect(page.getByRole("button", { name: "Eliminar expediente" })).toHaveCount(0);

    /*
     * Segunda mitad del control de acceso, y la unica excepcion admitida a la
     * regla de esta suite: esconder el boton no es autorizar. Se llama al
     * endpoint directamente porque es EXACTAMENTE lo que se comprueba.
     */
    const respuesta = await page.request.delete(`/api/cases/${caso.id}`);
    expect([401, 403], `borrar devolvio ${respuesta.status()}`).toContain(respuesta.status());
    const enBase = await prisma.case.findUnique({ where: { id: caso.id } });
    expect(enBase?.deletedAt).toBeNull();
  });
});

test.describe("Expedientes: paginacion", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");
    await pantallaUtil(page);
  });

  test("se puede ir y volver entre paginas sin perder ni repetir expedientes", async ({
    page,
  }) => {
    const total = await totalAnunciado(page);
    expect(
      total,
      "el sembrado debe dejar mas de una pagina",
    ).toBeGreaterThan(E2E.porPagina);

    const indicador = page.getByTestId("indicador-pagina");
    await expect(indicador).toBeVisible({ timeout: 20_000 });
    const paginas = Number((await indicador.innerText()).split("/")[1].trim());
    expect(paginas).toBeGreaterThan(1);

    const anterior = page.getByRole("button", { name: "Anterior" });
    const siguiente = page.getByRole("button", { name: "Siguiente" });

    /**
     * Cambia de pagina y espera a que la tabla traiga de verdad la nueva.
     *
     * Mientras carga no hay ninguna fila —la tabla pinta "Cargando..."—, asi
     * que esperar primero a la respuesta y despues a que vuelva a haber
     * referencias garantiza que lo que se lee es la pagina pedida y no la
     * anterior.
     */
    async function irA(destino: number, boton: Locator): Promise<string[]> {
      await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/api/cases?") &&
            r.url().includes(`page=${destino}&`) &&
            r.status() === 200,
          { timeout: 25_000 },
        ),
        boton.click(),
      ]);
      await expect(indicador).toHaveText(`${destino} / ${paginas}`, { timeout: 20_000 });
      await expect(async () => {
        expect((await refsVisibles(page)).length).toBeGreaterThan(0);
      }).toPass({ timeout: 20_000 });
      return refsVisibles(page);
    }

    // Primera pagina: llena y sin "Anterior" utilizable.
    const pagina1 = await refsVisibles(page);
    expect(pagina1.length).toBe(E2E.porPagina);
    await expect(anterior).toBeDisabled();

    // Siguiente.
    const pagina2 = await irA(2, siguiente);
    await expect(anterior).toBeEnabled();

    // Ni un solo expediente repetido entre paginas.
    const repetidos = pagina2.filter((r) => pagina1.includes(r));
    expect(repetidos, `expedientes repetidos entre paginas: ${repetidos.join(", ")}`).toEqual([]);

    // Anterior devuelve exactamente a la primera pagina.
    expect(await irA(1, anterior)).toEqual(pagina1);

    // Ultima pagina: se llega y "Siguiente" se apaga.
    const vistos = new Set<string>(pagina1);
    for (let p = 2; p <= paginas; p++) {
      for (const ref of await irA(p, siguiente)) {
        expect(vistos.has(ref), `${ref} aparece en dos paginas`).toBe(false);
        vistos.add(ref);
      }
    }
    await expect(siguiente).toBeDisabled();

    // Recorriendo todas las paginas se han visto todos los expedientes: ni uno
    // se ha quedado por el camino.
    expect(vistos.size, "faltan expedientes al recorrer las paginas").toBe(total);
  });

  test("al filtrar, la paginacion se recalcula y vuelve a la primera pagina", async ({
    page,
  }) => {
    const indicador = page.getByTestId("indicador-pagina");
    await expect(indicador).toBeVisible({ timeout: 20_000 });

    // Nos vamos a la segunda pagina…
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/cases?") && r.url().includes("page=2&") && r.status() === 200,
        { timeout: 25_000 },
      ),
      page.getByRole("button", { name: "Siguiente" }).click(),
    ]);
    await expect(indicador).toHaveText(/^2 \//, { timeout: 20_000 });

    // …y filtramos. La pagina debe volver a 1: quedarse en la 2 de un
    // resultado que ya no tiene 2 paginas deja la lista vacia sin motivo.
    const [peticion] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("/api/cases?") && r.url().includes("status=INTAKE"),
        { timeout: 20_000 },
      ),
      page.locator("select").first().selectOption("INTAKE"),
    ]);
    expect(peticion.url()).toContain("page=1");

    // Igual que arriba: primero la tabla filtrada, luego sus numeros. El total
    // de la cabecera sigue siendo el anterior mientras la lista carga.
    await expect(async () => {
      const estados = await filas(page).locator("select").evaluateAll((ss) =>
        ss.map((s) => (s as HTMLSelectElement).value),
      );
      expect(estados.length).toBeGreaterThan(0);
      expect(new Set(estados)).toEqual(new Set(["INTAKE"]));
    }).toPass({ timeout: 20_000 });

    await expect(async () => {
      const filtrado = await totalAnunciado(page);
      expect(filtrado).toBeGreaterThan(0);
      const visibles = await refsVisibles(page);
      expect(visibles.length).toBe(Math.min(filtrado, E2E.porPagina));
      // El bloque de paginacion solo debe existir si de verdad sobra una pagina.
      const hayPaginacion = (await page.getByRole("button", { name: "Siguiente" }).count()) > 0;
      expect(hayPaginacion).toBe(filtrado > E2E.porPagina);
    }).toPass({ timeout: 20_000 });

    await pantallaUtil(page);
  });
});

test.describe("Expedientes: acciones en lote", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");
    await pantallaUtil(page);
  });

  test("seleccion multiple muestra la barra de acciones", async ({ page }) => {
    /*
     * Se espera a la casilla; no se pregunta y se salta. Preguntar antes de que
     * llegue la lista devolvia 0 y la prueba se saltaba sola, aparentando
     * cobertura que no existia.
     */
    const casillas = page.locator("table input[type='checkbox']");
    await expect(casillas.nth(1)).toBeVisible({ timeout: 20_000 });

    await casillas.nth(1).check();
    await expect(page.locator("text=/\\d+ seleccionado/").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("seleccionar todo marca todas las filas", async ({ page }) => {
    const cabecera = page.locator("table thead input[type='checkbox']").first();
    await expect(cabecera).toBeVisible({ timeout: 20_000 });
    await expect(filas(page).first()).toBeVisible({ timeout: 20_000 });

    const cuantas = await filas(page).count();
    await cabecera.check();
    await expect(page.locator(`text=${cuantas} seleccionado`).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("cambio de estado en lote: exito confirmado", async ({ page }) => {
    const casillas = page.locator("table input[type='checkbox']");
    await expect(casillas.nth(1)).toBeVisible({ timeout: 20_000 });
    await casillas.nth(1).check();

    const selectorLote = page.locator("div.bg-blue-50 select").first();
    await expect(selectorLote).toBeVisible({ timeout: 10_000 });
    const valores = await selectorLote
      .locator("option")
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    await selectorLote.selectOption(valores[0]);

    await expect(page.getByTestId("aviso-accion")).toContainText(/actualizados/i, {
      timeout: 20_000,
    });
  });
});

test.describe("Expedientes: exportacion CSV", () => {
  /** Descarga el CSV pulsando el boton y devuelve su contenido. */
  async function descargarCsv(page: Page): Promise<string> {
    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: /Exportar CSV/i }).click(),
    ]);
    const ruta = await descarga.path();
    expect(ruta, "la descarga debe producir un fichero").toBeTruthy();
    expect(descarga.suggestedFilename()).toMatch(/^expedientes_\d{4}-\d{2}-\d{2}\.csv$/);
    return readFileSync(ruta!, "utf8");
  }

  /** Lineas de datos, sin cabecera ni linea final vacia. */
  function lineasDeDatos(csv: string): string[] {
    return csv.split("\n").slice(1).filter((l) => l.trim().length > 0);
  }

  test("el CSV trae cabeceras, varias filas y los valores del expediente", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");
    await pantallaUtil(page);

    const contenido = await descargarCsv(page);

    // No esta vacio.
    expect(contenido.length, "el CSV no puede venir vacio").toBeGreaterThan(100);

    // Codificacion: BOM UTF-8 al principio (es lo que hace que Excel abra bien
    // el fichero en espanol) y las tildes intactas.
    expect(contenido.charCodeAt(0), "falta el BOM UTF-8").toBe(0xfeff);
    expect(contenido, "las tildes deben sobrevivir a la descarga").toContain("Málaga");

    // Cabeceras completas y en su sitio.
    const cabecera = contenido.replace(/^\uFEFF/, "").split("\n")[0].trim();
    expect(cabecera.split(",")).toEqual([
      "Referencia", "Estado", "Urgente", "Categorias", "Provincia",
      "Fallecido", "DNI Fallecido", "Fecha fallecimiento", "Contacto",
      "Telefono contacto", "Email contacto", "Relacion", "Tareas",
      "Documentos", "ISD deadline", "Salud (%)", "Creado", "Cerrado",
    ]);

    // Varias filas: tantas como expedientes vivos tenga la organizacion.
    const filasCsv = lineasDeDatos(contenido);
    const enBase = await prisma.case.count({
      where: { orgId: await orgE2E(), deletedAt: null },
    });
    expect(filasCsv.length, "el CSV debe traer todos los expedientes").toBe(enBase);
    expect(filasCsv.length).toBeGreaterThan(1);

    // Y valores reconocibles, no filas en blanco.
    expect(contenido).toContain(E2E.caseRef);
    expect(contenido).toContain(E2E.relleno.apellido);
    expect(contenido).toContain("Recepcion");
  });

  test("el CSV respeta los filtros aplicados en la pantalla", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");
    await pantallaUtil(page);

    // Filtramos por un estado concreto…
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("status=CLOSED") && r.status() === 200,
        { timeout: 25_000 },
      ),
      page.locator("select").first().selectOption("CLOSED"),
    ]);
    /*
     * Y se espera a que la TABLA sea ya la filtrada, no solo a que la peticion
     * haya salido. La cabecera conserva el total anterior mientras carga: leerlo
     * antes de tiempo daba el total sin filtrar y la prueba comparaba el CSV
     * filtrado contra el recuento equivocado.
     */
    await expect(async () => {
      const estados = await filas(page).locator("select").evaluateAll((ss) =>
        ss.map((s) => (s as HTMLSelectElement).value),
      );
      expect(estados.length).toBeGreaterThan(0);
      expect(new Set(estados)).toEqual(new Set(["CLOSED"]));
    }).toPass({ timeout: 20_000 });
    const cerradosEnPantalla = await totalAnunciado(page);

    const contenido = await descargarCsv(page);
    const filasCsv = lineasDeDatos(contenido);

    // …y el CSV trae exactamente esos, no la lista entera.
    expect(filasCsv.length).toBe(cerradosEnPantalla);
    for (const linea of filasCsv) {
      // La segunda columna es el estado; ni la referencia ni la etiqueta de
      // estado llevan comas, asi que partir por coma es fiable para leerla.
      expect(linea.split(",")[1]).toBe("Cerrado");
    }
    expect(contenido).not.toContain("Recepcion");
  });

  test("el CSV respeta tambien la busqueda", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases");
    await pantallaUtil(page);

    await buscar(page, E2E.caseRef);
    const contenido = await descargarCsv(page);
    const filasCsv = lineasDeDatos(contenido);

    expect(filasCsv.length).toBe(1);
    expect(filasCsv[0]).toContain(E2E.caseRef);
  });
});

test.describe("Expedientes: importacion CSV", () => {
  const CABECERA =
    "fallecido,contacto,email_contacto,telefono_contacto,provincia,categorias,fecha_fallecimiento,dni_fallecido,parentesco,urgente,notas";

  /** Abre la pantalla de importacion desde el listado, como el usuario. */
  async function abrirImportacion(page: Page) {
    await login(page, E2E.owner);
    await page.goto("/cases");
    await pantallaUtil(page);
    await page.getByRole("link", { name: /Importar CSV/i }).click();
    await page.waitForURL("**/cases/import", { timeout: 30_000 });
    await pantallaUtil(page);
  }

  /** Elige un fichero en el selector de la pantalla. */
  async function elegirFichero(page: Page, nombre: string, contenido: string, tipo = "text/csv") {
    await page.locator('input[type="file"]').setInputFiles({
      name: nombre,
      mimeType: tipo,
      buffer: Buffer.from(contenido, "utf8"),
    });
  }

  test("la pantalla explica el formato que espera", async ({ page }) => {
    await abrirImportacion(page);
    await expect(page.getByRole("heading", { name: /Formato del archivo/i })).toBeVisible();
    // Las columnas obligatorias tienen que estar documentadas: si no, el
    // usuario adivina.
    await expect(page.getByText("fallecido", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("contacto", { exact: true }).first()).toBeVisible();
  });

  test("un CSV valido se valida, se importa y los expedientes aparecen", async ({ page }) => {
    const marca = Date.now().toString().slice(-6);
    const nombreA = `Peláez Muñoz, María ${marca}`;
    const nombreB = `Fernández Ruiz, José ${marca}`;
    const csv = [
      CABECERA,
      `"${nombreA}","Solicitante Uno ${marca}",uno${marca}@ejemplo.test,600100100,Madrid,"BANCOS,SEGUROS",2026-04-01,11111111H,Hija,false,"Importado por E2E"`,
      `"${nombreB}","Solicitante Dos ${marca}",,600200200,Barcelona,SUMINISTROS,2026-03-15,22222222J,Hijo,true,"Importado por E2E"`,
    ].join("\n");

    await abrirImportacion(page);
    await elegirFichero(page, "expedientes.csv", csv);

    await page.getByRole("button", { name: "Validar archivo" }).click();
    await expect(page.getByRole("heading", { name: /Resultado de validacion|Resultado de validación/i })).toBeVisible({
      timeout: 20_000,
    });

    // Dos validos, ningun error.
    const importar = page.getByRole("button", { name: /^Importar 2 expedientes$/ });
    await expect(importar).toBeVisible({ timeout: 20_000 });
    await importar.click();

    // Resultado con las referencias generadas.
    await expect(page.getByRole("heading", { name: /2 expedientes importados/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Referencias generadas: EXP-/).first()).toBeVisible();

    // Y estan de verdad en la base…
    const creados = await prisma.case.findMany({
      where: { orgId: await orgE2E(), deceased: { fullName: { contains: marca } } },
      include: { deceased: true },
    });
    expect(creados).toHaveLength(2);
    expect(creados.map((c) => c.deceased?.fullName).sort()).toEqual([nombreB, nombreA].sort());

    // …y se ven en el listado, que es donde el usuario los busca.
    await page.getByRole("link", { name: "Ver expedientes" }).click();
    await page.waitForURL(/\/cases(\?.*)?$/, { timeout: 30_000 });
    await buscar(page, marca);
    await expect(page.getByTestId("ref-expediente")).toHaveCount(2, { timeout: 20_000 });
  });

  test("un CSV con cabeceras incorrectas se rechaza diciendo cuales faltan", async ({ page }) => {
    await abrirImportacion(page);
    await elegirFichero(
      page,
      "cabeceras-malas.csv",
      "nombre,telefono,ciudad\nJuan Perez,600000000,Madrid",
    );
    await page.getByRole("button", { name: "Validar archivo" }).click();

    const aviso = page.getByTestId("error-importacion");
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText(/'fallecido' y 'contacto'/);
    // Y no se ha importado nada.
    await expect(page.getByRole("button", { name: /^Importar/ })).toHaveCount(0);
  });

  test("un CSV que no es una tabla se rechaza con un mensaje claro", async ({ page }) => {
    await abrirImportacion(page);
    await elegirFichero(
      page,
      "malformado.csv",
      'esto no es un csv; "comillas sin cerrar\nni cabeceras ni nada\n',
    );
    await page.getByRole("button", { name: "Validar archivo" }).click();

    const aviso = page.getByTestId("error-importacion");
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText(/cabecera|Cabeceras/i);
  });

  test("las filas con datos invalidos se listan una a una y no se importa nada", async ({
    page,
  }) => {
    await abrirImportacion(page);
    await elegirFichero(
      page,
      "datos-invalidos.csv",
      [
        CABECERA,
        `,"Sin fallecido",sin@ejemplo.test,,Madrid,BANCOS,,,,,`,
        `"Con fallecido, sin contacto",,,,Madrid,BANCOS,,,,,`,
        `"Sin forma de contacto","Contacto",,,Madrid,BANCOS,,,,,`,
        `"Fecha imposible","Contacto",ok@ejemplo.test,,Madrid,BANCOS,no-es-fecha,,,,`,
        `"Categoria inventada","Contacto",ok@ejemplo.test,,Madrid,CRIPTOMONEDAS,,,,,`,
      ].join("\n"),
    );
    await page.getByRole("button", { name: "Validar archivo" }).click();

    await expect(page.getByRole("heading", { name: /Resultado de validaci/i })).toBeVisible({
      timeout: 20_000,
    });
    // Cada fila mala se explica: numero de fila, campo y motivo.
    await expect(page.getByText("Nombre del fallecido obligatorio").first()).toBeVisible();
    await expect(page.getByText("Nombre del contacto obligatorio").first()).toBeVisible();
    await expect(page.getByText("Se requiere al menos email o teléfono").first()).toBeVisible();
    await expect(page.getByText("Formato de fecha inválido").first()).toBeVisible();
    await expect(page.getByText(/Categoría inválida: "CRIPTOMONEDAS"/).first()).toBeVisible();

    // Con errores no se ofrece importar: importar a medias es peor.
    await expect(page.getByRole("button", { name: /^Importar/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
  });

  test("un fichero vacio se rechaza diciendo que esta vacio", async ({ page }) => {
    await abrirImportacion(page);
    await elegirFichero(page, "vacio.csv", "");

    const aviso = page.getByTestId("error-importacion");
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText(/vacio/i);
    // El boton de validar sigue desactivado: no hay nada que validar.
    await expect(page.getByRole("button", { name: "Validar archivo" })).toBeDisabled();
  });

  test("una extension no admitida se rechaza antes de enviar nada", async ({ page }) => {
    await abrirImportacion(page);

    // Si el fichero llegara al servidor habria una peticion; se comprueba que
    // no la hay.
    let hubopeticion = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/cases/import")) hubopeticion = true;
    });

    await elegirFichero(page, "expedientes.pdf", "%PDF-1.4 contenido binario", "application/pdf");

    const aviso = page.getByTestId("error-importacion");
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText(/no tiene una extension admitida/i);
    await expect(aviso).toContainText(".csv");
    expect(hubopeticion, "un PDF no debe llegar al servidor").toBe(false);
  });

  test("si el servidor falla al importar, se dice y no se anuncia ningun expediente", async ({
    page,
  }) => {
    const marca = `nofalla${Date.now().toString().slice(-6)}`;
    const csv = [
      CABECERA,
      `"Fallecido ${marca}","Contacto ${marca}",${marca}@ejemplo.test,,Madrid,BANCOS,,,,,`,
    ].join("\n");

    await abrirImportacion(page);
    await elegirFichero(page, "correcto.csv", csv);

    // La validacion pasa; el fallo se provoca solo en la importacion real.
    await page.getByRole("button", { name: "Validar archivo" }).click();
    const importar = page.getByRole("button", { name: /^Importar 1 expediente$/ });
    await expect(importar).toBeVisible({ timeout: 20_000 });

    permitirFalloEn(page, "/api/cases/import");
    await page.route("**/api/cases/import", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "fallo simulado al importar" }),
      }),
    );

    await importar.click();

    const aviso = page.getByTestId("error-importacion");
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText(/fallo simulado al importar/i);
    // Nada de pantalla de exito.
    await expect(page.getByRole("heading", { name: /expedientes? importados?/i })).toHaveCount(0);
    // Y nada creado.
    const creados = await prisma.case.count({
      where: { deceased: { fullName: { contains: marca } } },
    });
    expect(creados).toBe(0);
    // El formulario sigue utilizable.
    await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
  });

  test("si la red se cae al importar, se dice sin culpar al servidor de nada", async ({
    page,
  }) => {
    const marca = `red${Date.now().toString().slice(-6)}`;
    const csv = [
      CABECERA,
      `"Fallecido ${marca}","Contacto ${marca}",${marca}@ejemplo.test,,Madrid,BANCOS,,,,,`,
    ].join("\n");

    await abrirImportacion(page);
    await elegirFichero(page, "correcto.csv", csv);
    await page.getByRole("button", { name: "Validar archivo" }).click();
    const importar = page.getByRole("button", { name: /^Importar 1 expediente$/ });
    await expect(importar).toBeVisible({ timeout: 20_000 });

    permitirFalloEn(page, "/api/cases/import");
    await page.route("**/api/cases/import", (route) => route.abort("failed"));
    await importar.click();

    await expect(page.getByTestId("error-importacion")).toContainText(
      /No se ha podido contactar con el servidor/i,
      { timeout: 20_000 },
    );
    const creados = await prisma.case.count({
      where: { deceased: { fullName: { contains: marca } } },
    });
    expect(creados).toBe(0);
  });
});

test.describe("Expedientes: Kanban", () => {
  /** La tarjeta de un expediente concreto en el tablero. */
  function tarjeta(page: Page, ref: string) {
    return page.locator("div.bg-white.rounded-lg.border").filter({ hasText: ref }).first();
  }

  /** La columna cuyo encabezado es `titulo`. */
  function columna(page: Page, titulo: string) {
    return page.locator("div.w-64").filter({ hasText: titulo }).first();
  }

  /**
   * Donde se suelta: la cabecera de la columna.
   *
   * Soltar en el centro de la columna parece lo natural, pero con el tablero
   * lleno cada columna mide varias pantallas de alto y su centro queda muy por
   * debajo de la tarjeta que se coge. El navegador tiene que desplazar la
   * pagina en mitad del gesto y el soltar acaba cayendo en otro sitio: se movia
   * un expediente distinto del que la prueba creia.
   *
   * La cabecera esta a la misma altura que las primeras tarjetas, es siempre
   * visible, y el `drop` sube hasta la columna igual —es hija suya—, que es lo
   * que hace un usuario cuando suelta arriba de la columna.
   *
   * Por lo mismo, las pruebas sueltan en columnas que caben en pantalla sin
   * desplazar el tablero a lo ancho: siete columnas de 256 px no entran en una
   * ventana de 1280.
   */
  function zonaSoltar(page: Page, titulo: string) {
    return columna(page, titulo).locator("div.bg-white").first();
  }

  /**
   * Arrastra una tarjeta hasta una columna.
   *
   * Es arrastre de verdad: `dragTo` emite `dragstart`, `dragover` y `drop`
   * sobre los elementos reales —comprobado— y el tablero reacciona a esos
   * eventos, no a nada que la prueba invente. Se envuelve en una funcion para
   * que el "cuando" quede en un solo sitio.
   */
  async function arrastrar(origen: Locator, destino: Locator) {
    await origen.dragTo(destino);
  }

  test("el tablero carga con sus columnas", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases/kanban");
    await pantallaUtil(page);

    await expect(page.getByRole("heading", { name: /Kanban/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("una tarjeta del tablero lleva a su expediente", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/cases/kanban");
    await pantallaUtil(page);

    const enlace = page.locator(`a[href^="/cases/"]`).first();
    await expect(enlace).toBeVisible({ timeout: 20_000 });

    await enlace.click();
    await page.waitForURL(/\/cases\/[^/]+$/, { timeout: 30_000 });
    await pantallaUtil(page);
  });

  test("arrastrar una tarjeta a otra columna cambia el estado y persiste", async ({ page }) => {
    const caso = await expedienteDeApoyo("KANBAN");

    await login(page, E2E.owner);
    await page.goto("/cases/kanban");
    await pantallaUtil(page);

    const origen = tarjeta(page, caso.ref);
    await expect(origen, "la tarjeta del expediente debe estar en el tablero").toBeVisible({
      timeout: 20_000,
    });
    // Empieza en Recepcion, que es el estado inicial.
    await expect(columna(page, "Recepcion")).toContainText(caso.ref);

    const destino = zonaSoltar(page, "En curso");

    // Se espera a la peticion real, no a una animacion.
    const [peticion] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes(`/api/cases/${caso.id}`) && r.method() === "PATCH",
        { timeout: 30_000 },
      ),
      arrastrar(origen, destino),
    ]);
    expect(peticion.postDataJSON()).toMatchObject({ status: "IN_PROGRESS" });

    // Cambio visual: la tarjeta esta ahora en la columna de destino y ya no en
    // la de origen.
    await expect(columna(page, "En curso")).toContainText(caso.ref, { timeout: 20_000 });
    await expect(columna(page, "Recepcion")).not.toContainText(caso.ref);
    await expect(page.getByTestId("aviso-kanban")).toContainText(/movido a En curso/i);

    // Persistencia: en la base y al recargar.
    await expect(async () => {
      const enBase = await prisma.case.findUnique({ where: { id: caso.id } });
      expect(enBase?.status).toBe("IN_PROGRESS");
    }).toPass({ timeout: 20_000 });

    await page.reload();
    await pantallaUtil(page);
    await expect(columna(page, "En curso")).toContainText(caso.ref, { timeout: 30_000 });
  });

  test("si el servidor rechaza el movimiento, la tarjeta se queda y se ve el error", async ({
    page,
  }) => {
    const caso = await expedienteDeApoyo("KANBANERR");

    await login(page, E2E.owner);
    await page.goto("/cases/kanban");
    await pantallaUtil(page);

    const origen = tarjeta(page, caso.ref);
    await expect(origen).toBeVisible({ timeout: 20_000 });
    await expect(columna(page, "Recepcion")).toContainText(caso.ref);

    permitirFalloEn(page, "/api/cases/");
    await page.route(`**/api/cases/${caso.id}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "el servidor rechaza el movimiento" }),
        });
      } else {
        await route.continue();
      }
    });

    await arrastrar(origen, zonaSoltar(page, "Docs pendientes"));

    // Error visible…
    await expect(page.getByTestId("aviso-kanban")).toContainText(
      /el servidor rechaza el movimiento/i,
      { timeout: 20_000 },
    );
    // …y la tarjeta sigue donde estaba, en pantalla y en la base.
    await expect(columna(page, "Recepcion")).toContainText(caso.ref);
    await expect(columna(page, "Docs pendientes")).not.toContainText(caso.ref);
    const enBase = await prisma.case.findUnique({ where: { id: caso.id } });
    expect(enBase?.status).toBe("INTAKE");
  });

  test("si la red se cae al mover, tampoco se miente sobre el estado", async ({ page }) => {
    const caso = await expedienteDeApoyo("KANBANRED");

    await login(page, E2E.owner);
    await page.goto("/cases/kanban");
    await pantallaUtil(page);

    const origen = tarjeta(page, caso.ref);
    await expect(origen).toBeVisible({ timeout: 20_000 });

    permitirFalloEn(page, "/api/cases/");
    await page.route(`**/api/cases/${caso.id}`, async (route) => {
      if (route.request().method() === "PATCH") await route.abort("failed");
      else await route.continue();
    });

    await arrastrar(origen, zonaSoltar(page, "Validacion"));

    await expect(page.getByTestId("aviso-kanban")).toContainText(/No se ha podido mover/i, {
      timeout: 20_000,
    });
    await expect(columna(page, "Recepcion")).toContainText(caso.ref);
    const enBase = await prisma.case.findUnique({ where: { id: caso.id } });
    expect(enBase?.status).toBe("INTAKE");
  });
});
