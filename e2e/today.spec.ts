/**
 * /today — Resumen del día, conducido como lo conduce un usuario.
 *
 * EL DEFECTO CENTRAL QUE VIGILA
 * ------------------------------
 * `hasAnything` se calculaba sobre nueve listas que un ayudante `safe()`
 * devolvia VACIAS tanto si de verdad no habia nada como si la consulta habia
 * reventado. Con PostgreSQL caido, la pantalla ensenaba un tic verde y
 * «Todo al día»: el mensaje mas peligroso posible, porque invita a cerrar el
 * portatil con seis aprobaciones esperando y un ISD a punto de vencer.
 *
 * De ahi que casi todas las pruebas de fallo afirmen DOS cosas: que el aviso
 * aparece, y que «Todo al día» NO aparece.
 */
import { type Page, type BrowserContext } from "@playwright/test";
import { test, expect, pantallaUtil } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E, CIFRAS_PANEL, reanclarVenceHoy } from "./seed-e2e";

const prisma = new PrismaClient();

/*
 * El plazo de «vence hoy» se reancla ANTES DE CADA PRUEBA.
 *
 * Tiene que ser hoy y estar en el futuro cuando la prueba lo mira, y no hay
 * instante fijo elegido al sembrar que aguante las dos cosas: anclado al
 * mediodia caducaba a las 12:00, y anclado al final del dia caducaba si el
 * sembrado ocurria poco antes de medianoche y la suite cruzaba las 00:00
 * —que es lo que paso en una ejecucion de CI que empezo a las 23:56 de
 * Madrid—. Reanclarlo aqui reduce la ventana de riesgo de veinte minutos a
 * los segundos que dura la prueba.
 */
test.beforeEach(async () => {
  await reanclarVenceHoy(prisma);
});


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

async function irAlResumen(page: Page) {
  // Se navega pulsando el enlace del menu, no con `goto`: asi se comprueba de
  // paso que el enlace existe y lleva donde dice.
  await page.getByRole("link", { name: "Resumen del día" }).first().click();
  await page.waitForURL("**/today");
  await pantallaUtil(page);
}

async function forzarFallo(context: BrowserContext, ...consultas: string[]) {
  await context.addCookies([
    { name: "e2e-fallos", value: consultas.join(","), url: "http://127.0.0.1:3000" },
  ]);
}

async function quitarFallos(context: BrowserContext) {
  await context.clearCookies({ name: "e2e-fallos" });
}

/** La tarjeta de una seccion, localizada por su titulo. */
function seccion(page: Page, titulo: string) {
  return page
    .locator("div.bg-white.border.rounded-xl")
    .filter({ hasText: titulo })
    .first();
}

test.describe("Resumen del día: secciones con datos", () => {
  test("el encabezado lleva la fecha del calendario español", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    await expect(page.getByRole("heading", { name: "Resumen del día" })).toBeVisible();

    /*
     * La fecha se compara con la que ve un usuario en Madrid, no con la del
     * reloj del servidor. Entre las 00:00 y las 02:00 de Madrid el proceso —que
     * va en UTC— seguia en el dia de ayer y el titulo mostraba la fecha
     * equivocada justo a la hora en que alguien entra a repasar el dia.
     */
    const enMadrid = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
    // "jueves, 20 de agosto de 2026"
    const dia = enMadrid.match(/\d+/)?.[0];
    const nombreDia = enMadrid.split(",")[0];
    await expect(page.locator("p.capitalize").first()).toContainText(String(dia));
    await expect(page.locator("p.capitalize").first()).toContainText(nombreDia, {
      ignoreCase: true,
    });
  });

  test("mis tareas vencidas se listan con su antigüedad y enlazan al expediente", async ({
    page,
  }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const bloque = seccion(page, "Mis tareas vencidas");
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText("vencida hace 3 dias");
    await expect(bloque).toContainText("vencida hace 10 dias");
    // La cuenta de dias, en dias de calendario.
    await expect(bloque).toContainText("hace 3d");
    await expect(bloque).toContainText("hace 10d");
    // El contador de la cabecera cuadra con el sembrado.
    await expect(bloque).toContainText(String(CIFRAS_PANEL.vencidasDelOwner));

    // Orden cronologico: la mas antigua primero.
    const titulos = await bloque.locator("li a").allInnerTexts();
    expect(titulos.findIndex((t) => t.includes("hace 10"))).toBeLessThan(
      titulos.findIndex((t) => t.includes("hace 3")),
    );

    await bloque.getByRole("link", { name: /vencida hace 10 dias/ }).click();
    await page.waitForURL("**/cases/**");
  });

  test("«Para hoy» lista la tarea que vence hoy", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const bloque = seccion(page, "Para hoy");
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText("vence hoy");
    // Y no se cuela ninguna de otro dia.
    await expect(bloque).not.toContainText("vence en 7 dias");
    await expect(bloque).not.toContainText("vencida hace 3 dias");
  });

  test("«Esta semana» lista lo de los proximos 7 dias, no lo de hoy ni lo de 30", async ({
    page,
  }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const bloque = seccion(page, "Esta semana");
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText("vence en 3 dias");
    await expect(bloque).toContainText("vence en 7 dias");
    // Bordes: hoy va en su propia seccion y los 30 dias quedan fuera.
    await expect(bloque).not.toContainText("vence hoy");
    await expect(bloque).not.toContainText("vence en 30 dias");
  });

  test("las tareas vencidas del EQUIPO van aparte de las mias", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const equipo = seccion(page, "Tareas del equipo vencidas");
    await expect(equipo).toBeVisible();
    await expect(equipo).toContainText("vencida del manager");
    await expect(equipo).toContainText("Manager Panel E2E");
    // Las mias no se repiten aqui.
    await expect(equipo).not.toContainText("vencida hace 10 dias");

    await equipo.getByRole("link", { name: /Ver todas las tareas/ }).click();
    await page.waitForURL("**/tasks");
  });

  test("los plazos ISD proximos salen con su fecha y su cuenta atras", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const bloque = seccion(page, "Plazos ISD próximos");
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText(E2E.panel.causanteIsd);
    await expect(bloque).toContainText(E2E.panel.caseRefIsd);
    await expect(bloque).toContainText("ISD vence");

    await bloque.getByRole("link", { name: E2E.panel.causanteIsd }).click();
    await page.waitForURL("**/cases/**");
  });

  test("las aprobaciones pendientes se listan y enlazan a su modulo", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const bloque = seccion(page, "Aprobaciones pendientes");
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText(String(CIFRAS_PANEL.aprobacionesPendientes));
    await expect(bloque).toContainText("send email");
    // La ya aprobada no aparece.
    await expect(bloque).not.toContainText("mark sent");

    await bloque.getByRole("link", { name: /Ir a aprobaciones/ }).click();
    await page.waitForURL("**/approvals");
  });

  test("los mensajes sin responder muestran autor y texto", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const bloque = seccion(page, "Mensajes sin responder");
    await expect(bloque).toBeVisible();
    // Aqui se cuentan EXPEDIENTES con mensajes, no mensajes.
    await expect(bloque).toContainText(String(CIFRAS_PANEL.expedientesConMensajes));
    await expect(bloque).toContainText(E2E.panel.autorMensaje);
    await expect(bloque).toContainText(E2E.panel.mensajeFamilia);
    // Ni el ya leido ni el nuestro cuentan.
    await expect(bloque).not.toContainText("ya leido");
    await expect(bloque).not.toContainText("respuesta del despacho");
  });

  test("los expedientes bloqueados listan sus tareas y el motivo", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const bloque = seccion(page, "Expedientes bloqueados");
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText(E2E.panel.caseRef);
    await expect(bloque).toContainText("bloqueada 8 dias si entra");
    await expect(bloque).toContainText("Falta certificado de defuncion");
  });

  test("«Listas para continuar» muestra la que desbloqueó su prerrequisito", async ({
    page,
  }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const bloque = seccion(page, "Listas para continuar");
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText("desbloqueada por su prerrequisito");
    await expect(bloque).toContainText("prerrequisito completado");
  });
});

test.describe("Resumen del día: «Todo al día»", () => {
  test("sin nada pendiente Y sin fallos, dice «Todo al día»", async ({ page }) => {
    // La organizacion nueva no tiene ni un expediente: aqui el mensaje es
    // cierto, y debe salir.
    await login(page, E2E.panelNueva.owner);
    await irAlResumen(page);

    await expect(page.getByTestId("todo-al-dia")).toBeVisible();
    await expect(page.getByTestId("todo-al-dia")).toContainText("Todo al día");
    await expect(page.getByTestId("aviso-datos-incompletos")).toHaveCount(0);
    await expect(page.getByTestId("franja-accion-inmediata")).toHaveCount(0);
  });

  test("si UNA consulta falla, NO dice «Todo al día»", async ({ page, context }) => {
    /*
     * Este es el escenario exacto de la auditoria: una organizacion que de
     * verdad no tiene nada pendiente, pero cuya consulta de aprobaciones ha
     * reventado. Antes salia el tic verde igualmente, porque la lista llegaba
     * vacia por el respaldo de `safe()` y nadie podia distinguirlo.
     */
    await login(page, E2E.panelNueva.owner);
    await forzarFallo(context, "aprobacionesPendientes");
    await page.goto("/today");
    await pantallaUtil(page);

    await expect(page.getByTestId("todo-al-dia")).toHaveCount(0);
    await expect(page.getByText("Todo al día")).toHaveCount(0);
    await expect(page.getByTestId("aviso-datos-incompletos")).toBeVisible();
    await expect(page.getByTestId("aviso-datos-incompletos")).toContainText(
      "las aprobaciones pendientes",
    );

    await quitarFallos(context);
  });

  test("con TODAS las consultas caidas tampoco dice «Todo al día»", async ({
    page,
    context,
  }) => {
    await login(page, E2E.panelNueva.owner);
    await forzarFallo(
      context,
      "misTareasVencidas",
      "misTareasDeHoy",
      "misTareasDeLaSemana",
      "tareasVencidasDelEquipo",
      "isdEnRiesgo",
      "aprobacionesPendientes",
      "mensajesSinLeer",
      "expedientesBloqueados",
      "listasParaContinuar",
    );
    await page.goto("/today");
    await pantallaUtil(page);

    await expect(page.getByText("Todo al día")).toHaveCount(0);
    const aviso = page.getByTestId("aviso-datos-incompletos");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("mis tareas vencidas");
    await expect(aviso).toContainText("los plazos ISD");
    // La pantalla no se queda en blanco: sigue habiendo encabezado y avisos.
    await expect(page.getByRole("heading", { name: "Resumen del día" })).toBeVisible();
    await expect(page.getByTestId("bloques-fallidos")).toBeVisible();

    await quitarFallos(context);
  });

  test("una sola tarea vencida basta para que NO diga «Todo al día»", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    await expect(page.getByTestId("todo-al-dia")).toHaveCount(0);
    await expect(seccion(page, "Mis tareas vencidas")).toBeVisible();
  });

  test("degradacion PARCIAL: lo que sí cargó se sigue viendo", async ({ page, context }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "aprobacionesPendientes", "mensajesSinLeer");
    await page.goto("/today");
    await pantallaUtil(page);

    // Los dos bloques caidos lo dicen...
    await expect(page.getByTestId("aviso-datos-incompletos")).toContainText(
      "las aprobaciones pendientes",
    );
    await expect(page.getByTestId("aviso-datos-incompletos")).toContainText(
      "los mensajes de las familias",
    );
    // ...y el resto de la pantalla sigue trabajando con sus datos reales.
    await expect(seccion(page, "Mis tareas vencidas")).toContainText("vencida hace 3 dias");
    await expect(seccion(page, "Plazos ISD próximos")).toContainText(E2E.panel.causanteIsd);

    await quitarFallos(context);
  });
});

test.describe("Resumen del día: contador de acción inmediata", () => {
  test("suma tareas vencidas, ISD critico y aprobaciones", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const franja = page.getByTestId("franja-accion-inmediata");
    await expect(franja).toBeVisible();

    // El desglose nombra las tres categorias con sus cifras.
    const desglose = page.getByTestId("desglose-accion-inmediata");
    await expect(desglose).toContainText(
      `${CIFRAS_PANEL.vencidasDelOwner} tareas vencidas`,
    );
    await expect(desglose).toContainText(
      `${CIFRAS_PANEL.aprobacionesPendientes} aprobaciones pendientes`,
    );

    // Y el total es la suma de lo que enumera.
    const texto = await page.getByTestId("contador-accion-inmediata").innerText();
    const total = Number(texto.match(/^(\d+)/)?.[1]);
    expect(total).toBeGreaterThanOrEqual(
      CIFRAS_PANEL.vencidasDelOwner + CIFRAS_PANEL.aprobacionesPendientes,
    );
    // Plural correcto con varios elementos.
    expect(texto).toContain("elementos requieren acción inmediata");
  });

  test("con cero elementos la franja no aparece", async ({ page }) => {
    await login(page, E2E.panelNueva.owner);
    await irAlResumen(page);
    await expect(page.getByTestId("franja-accion-inmediata")).toHaveCount(0);
  });

  test("con UN solo elemento el texto va en singular", async ({ page }) => {
    /*
     * El singular sólo se puede comprobar con exactamente un elemento, así que
     * se construye ese estado: una organizacion propia con una sola aprobacion
     * pendiente y nada mas.
     */
    const org = await prisma.organization.create({
      data: {
        name: `Singular ${Date.now()}`,
        slug: `org-e2e-singular-${Date.now()}`,
        subscription: { create: { plan: "FIRMA", status: "active" } },
        onboardingDismissedAt: new Date(),
      },
    });
    const bcrypt = await import("bcryptjs");
    const email = `singular.${Date.now()}@ejemplo.test`;
    const usuario = await prisma.user.create({
      data: {
        email,
        name: "Singular E2E",
        passwordHash: await bcrypt.default.hash(E2E.password, 10),
      },
    });
    await prisma.membership.create({
      data: { userId: usuario.id, orgId: org.id, role: "OWNER" },
    });
    const caso = await prisma.case.create({
      data: { orgId: org.id, ref: `EXP-SING-${Date.now()}`, status: "IN_PROGRESS" },
    });
    await prisma.approval.create({
      data: { caseId: caso.id, action: "send_email", status: "PENDING" },
    });

    await login(page, email);
    await irAlResumen(page);

    const contador = page.getByTestId("contador-accion-inmediata");
    await expect(contador).toContainText("1 elemento requiere acción inmediata");
    await expect(contador).not.toContainText("elementos");
    await expect(page.getByTestId("desglose-accion-inmediata")).toContainText(
      "1 aprobación pendiente",
    );
    await expect(page.getByTestId("todo-al-dia")).toHaveCount(0);
  });
});

test.describe("Resumen del día: aislamiento entre organizaciones", () => {
  test("no aparece nada de la organizacion vecina", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    const cuerpo = page.locator("body");
    for (const marca of [
      E2E.panelVecina.caseRef,
      E2E.panelVecina.causante,
      E2E.panelVecina.tarea,
      E2E.panelVecina.mensaje,
      "NO_DEBE_VERSE_aprobacion",
    ]) {
      await expect(cuerpo).not.toContainText(marca);
    }
  });

  test("los contadores de las secciones no suman los del vecino", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await irAlResumen(page);

    // La vecina tiene 1 aprobacion pendiente y 1 mensaje sin leer: si se
    // colaran, estas cifras subirian.
    await expect(seccion(page, "Aprobaciones pendientes")).toContainText(
      String(CIFRAS_PANEL.aprobacionesPendientes),
    );
    await expect(seccion(page, "Mensajes sin responder")).toContainText(
      String(CIFRAS_PANEL.expedientesConMensajes),
    );
  });
});

test.describe("Resumen del día: roles y acceso", () => {
  // Politica REAL: `/today` solo exige sesion con organizacion y rol; no pide
  // ningun permiso concreto. Los cuatro roles entran.
  for (const rol of ["owner", "manager", "operador", "viewer"] as const) {
    test(`un ${rol.toUpperCase()} entra y ve el resumen`, async ({ page }) => {
      await login(page, E2E.panel[rol]);
      await irAlResumen(page);
      await expect(page.getByRole("heading", { name: "Resumen del día" })).toBeVisible();
    });
  }

  test("cada uno ve SUS tareas, no las de otro", async ({ page }) => {
    // El VIEWER no tiene ninguna tarea asignada: no debe ver las del OWNER.
    await login(page, E2E.panel.viewer);
    await irAlResumen(page);

    await expect(page.getByText("P-E2E vencida hace 10 dias")).toHaveCount(0);
    // Pero las del equipo sí las ve, porque esa seccion es de toda la
    // organizacion (es la politica real, no una restriccion inventada).
    await expect(seccion(page, "Tareas del equipo vencidas")).toContainText(
      "vencida hace 10 dias",
    );
  });

  test("un usuario sin organizacion va al panel, no al login", async ({ page }) => {
    // Usuario recien creado: el sembrado tiene uno, pero la prueba del panel
    // le crea una organizacion, asi que dejaria de servir aqui.
    const bcrypt = await import("bcryptjs");
    const email = `sin-org.today.${Date.now()}@ejemplo.test`;
    await prisma.user.create({
      data: {
        email,
        name: "Sin Organizacion E2E",
        passwordHash: await bcrypt.default.hash(E2E.password, 10),
      },
    });

    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', E2E.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    await page.goto("/today");
    await page.waitForURL("**/dashboard");
    // Sigue con sesion iniciada.
    expect(page.url()).not.toContain("/login");
  });

  test("sin sesion, /today lleva al login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/today");
    await page.waitForURL(/\/login/);
  });
});

test.describe("Resumen del día: fallos por seccion", () => {
  for (const [consulta, etiqueta, titulo] of [
    ["misTareasVencidas", "mis tareas vencidas", "Mis tareas vencidas"],
    ["isdEnRiesgo", "los plazos ISD", "Plazos ISD próximos"],
    ["aprobacionesPendientes", "las aprobaciones pendientes", "Aprobaciones pendientes"],
    ["mensajesSinLeer", "los mensajes de las familias", "Mensajes sin responder"],
    ["expedientesBloqueados", "los expedientes bloqueados", "Expedientes bloqueados"],
  ] as const) {
    test(`si falla «${etiqueta}», se dice y su seccion no finge estar vacia`, async ({
      page,
      context,
    }) => {
      await login(page, E2E.panel.owner);
      await forzarFallo(context, consulta);
      await page.goto("/today");
      await pantallaUtil(page);

      const aviso = page.getByTestId("aviso-datos-incompletos");
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(etiqueta);
      // La seccion desaparece —no hay datos que pintar— pero su ausencia queda
      // explicada arriba y en su propio bloque de aviso.
      await expect(page.getByRole("heading", { name: titulo })).toHaveCount(0);
      await expect(page.getByTestId("bloques-fallidos")).toContainText(etiqueta);
      await expect(page.getByText("Todo al día")).toHaveCount(0);

      await quitarFallos(context);
    });
  }
});
