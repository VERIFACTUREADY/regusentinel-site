/**
 * /approvals — la cola de aprobaciones, conducida desde el navegador.
 *
 * QUE VIGILA ESTA SUITE
 * ---------------------
 * `handleAction` era un `fetch` a pelo: sin `try`, sin mensaje de error y sin
 * `finally`.
 *
 *   - Con un 403, un 404 o un 500, el `if (res.ok)` no entraba y **no pasaba
 *     nada**: el usuario pulsaba «Aprobar», el boton volvia a su sitio y la
 *     aprobacion seguia pendiente, sin una palabra.
 *   - Con la red caida, `fetch` rechazaba, `setActing(null)` no llegaba a
 *     ejecutarse y el boton se quedaba **bloqueado en «...»** para siempre.
 *
 * Aprobar o rechazar dispara acciones con consecuencias —correos a las
 * familias—, asi que no puede fallar en silencio.
 */
import { type Page } from "@playwright/test";
import { test, expect, pantallaUtil, permitirFalloEn } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E, CIFRAS_AVISOS } from "./seed-e2e";

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

async function irAAprobaciones(page: Page) {
  await page.getByRole("link", { name: "Aprobaciones" }).first().click();
  await page.waitForURL("**/approvals");
  await pantallaUtil(page);
}

/** Devuelve las aprobaciones pendientes que hay EN LA BASE. */
async function pendientesEnBase(): Promise<number> {
  return prisma.approval.count({
    where: {
      case: { org: { slug: E2E.avisos.slug }, deletedAt: null },
      status: "PENDING",
    },
  });
}

/** Deja la cola como la dejo el sembrado. */
async function restaurarAprobaciones() {
  await prisma.approval.updateMany({
    where: {
      case: { org: { slug: E2E.avisos.slug } },
      action: { in: [E2E.avisos.accionAprobar, E2E.avisos.accionRechazar, "generate_checklist"] },
    },
    data: { status: "PENDING", reviewerId: null, reviewedAt: null },
  });
}

test.describe("Aprobaciones: cola y contadores", () => {
  test.afterEach(restaurarAprobaciones);

  test("el encabezado cuadra con las pendientes reales", async ({ page }) => {
    expect(await pendientesEnBase()).toBe(CIFRAS_AVISOS.aprobacionesPendientes);

    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    await expect(page.getByTestId("pendientes-de-revision")).toHaveText(
      `${CIFRAS_AVISOS.aprobacionesPendientes} acciones pendientes de revision`,
    );
    // La pestaña «Pendientes» es la de partida y su recuento coincide.
    await expect(page.getByTestId("pestana-PENDING")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("recuento-aprobaciones")).toHaveText(
      `${CIFRAS_AVISOS.aprobacionesPendientes} aprobaciones`,
    );
  });

  test("las cuatro pestañas filtran de verdad", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    await page.getByTestId("pestana-APPROVED").click();
    await expect(page.getByTestId("recuento-aprobaciones")).toHaveText(
      `${CIFRAS_AVISOS.aprobacionesAprobadas} aprobacion`,
    );
    await expect(page.getByText("Aprobada").first()).toBeVisible();

    await page.getByTestId("pestana-REJECTED").click();
    await expect(page.getByTestId("recuento-aprobaciones")).toHaveText(
      `${CIFRAS_AVISOS.aprobacionesRechazadas} aprobacion`,
    );

    await page.getByTestId("pestana-todas").click();
    const total =
      CIFRAS_AVISOS.aprobacionesPendientes +
      CIFRAS_AVISOS.aprobacionesAprobadas +
      CIFRAS_AVISOS.aprobacionesRechazadas;
    await expect(page.getByTestId("recuento-aprobaciones")).toHaveText(`${total} aprobaciones`);
  });

  test("cada fila muestra accion, expediente, causante y fecha", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    const cuerpo = page.locator("body");
    await expect(cuerpo).toContainText("Enviar borrador");
    await expect(cuerpo).toContainText(E2E.avisos.caseConDos);
    await expect(cuerpo).toContainText("Causante Dos Sin Leer");
    await expect(cuerpo).toContainText("Pendiente");
  });

  test("las revisadas muestran quien y cuando", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);
    await page.getByTestId("pestana-APPROVED").click();

    await expect(page.getByText(/revisada por Owner Avisos E2E/)).toBeVisible();
  });

  test("el enlace del expediente abre el expediente", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    await page.getByRole("link", { name: E2E.avisos.caseConDos }).first().click();
    await page.waitForURL("**/cases/**");
  });

  test("una pestaña sin resultados lo dice sin fingir un fallo", async ({ page }) => {
    // La organizacion nueva no tiene ninguna aprobacion.
    await login(page, E2E.panelNueva.owner);
    await page.goto("/approvals");
    await pantallaUtil(page);

    await expect(page.getByTestId("pendientes-de-revision")).toHaveText(
      "No hay acciones pendientes de revision",
    );
    await expect(page.getByText("No hay acciones pendientes de aprobacion")).toBeVisible();
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("el singular y el plural del contador son correctos", async ({ page }) => {
    /*
     * Se dejan las pendientes en 1 para ver el singular de verdad, y despues
     * se restauran. Afirmar el plural con datos fijos y el singular no seria
     * probarlo: seria suponerlo.
     */
    await prisma.approval.updateMany({
      where: {
        case: { org: { slug: E2E.avisos.slug } },
        action: { in: [E2E.avisos.accionRechazar, "generate_checklist"] },
        status: "PENDING",
      },
      data: { status: "APPROVED" },
    });
    expect(await pendientesEnBase()).toBe(1);

    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    await expect(page.getByTestId("pendientes-de-revision")).toHaveText(
      "1 accion pendiente de revision",
    );
    await expect(page.getByTestId("recuento-aprobaciones")).toHaveText("1 aprobacion");
  });

  test("las aprobaciones de expedientes borrados no cuentan", async ({ page }) => {
    /*
     * La politica real, la misma que ya aplican /dashboard y /today: un
     * expediente borrado no genera trabajo pendiente. Faltaba aqui, asi que la
     * misma organizacion ensenaba dos cifras distintas en tres pantallas.
     */
    const caso = await prisma.case.findFirstOrThrow({
      where: { ref: E2E.avisos.caseSinMensajes },
      select: { id: true },
    });
    await prisma.case.update({
      where: { id: caso.id },
      data: { deletedAt: new Date() },
    });

    try {
      await login(page, E2E.avisos.owner);
      await irAAprobaciones(page);

      // Una menos: la del expediente borrado.
      await expect(page.getByTestId("pendientes-de-revision")).toHaveText(
        `${CIFRAS_AVISOS.aprobacionesPendientes - 1} acciones pendientes de revision`,
      );
      await expect(page.getByTestId("recuento-aprobaciones")).toHaveText(
        `${CIFRAS_AVISOS.aprobacionesPendientes - 1} aprobaciones`,
      );
      await expect(page.getByText("Generar checklist")).toHaveCount(0);
    } finally {
      await prisma.case.update({ where: { id: caso.id }, data: { deletedAt: null } });
    }
  });
});

test.describe("Aprobaciones: aprobar y rechazar", () => {
  test.afterEach(restaurarAprobaciones);

  test("aprobar funciona y persiste tras recargar", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    await page
      .getByRole("button", { name: `Aprobar: Enviar borrador (${E2E.avisos.caseConDos})` })
      .click();

    await expect(page.getByTestId("exito-accion-aprobacion")).toContainText(
      "Aprobacion registrada",
    );
    await expect(page.getByTestId("error-accion-aprobacion")).toHaveCount(0);

    // El servidor lo ha guardado.
    await expect(async () => {
      expect(await pendientesEnBase()).toBe(CIFRAS_AVISOS.aprobacionesPendientes - 1);
    }).toPass({ timeout: 10_000 });

    // Y al recargar, el contador, la pestaña y la lista van a una.
    await page.reload();
    await pantallaUtil(page);
    await expect(page.getByTestId("pendientes-de-revision")).toHaveText(
      `${CIFRAS_AVISOS.aprobacionesPendientes - 1} acciones pendientes de revision`,
    );
    await expect(page.getByText("Enviar borrador")).toHaveCount(0);

    await page.getByTestId("pestana-APPROVED").click();
    await expect(page.getByText("Enviar borrador")).toBeVisible();
  });

  test("rechazar funciona y persiste", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    await page
      .getByRole("button", { name: `Rechazar: Enviar email (${E2E.avisos.caseConDos})` })
      .click();

    await expect(page.getByTestId("exito-accion-aprobacion")).toContainText("Rechazo registrado");
    await expect(async () => {
      expect(await pendientesEnBase()).toBe(CIFRAS_AVISOS.aprobacionesPendientes - 1);
    }).toPass({ timeout: 10_000 });

    await page.reload();
    await pantallaUtil(page);
    await page.getByTestId("pestana-REJECTED").click();
    await expect(page.getByText("Enviar email").first()).toBeVisible();
  });

  test("el dashboard refleja el cambio", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);
    await page
      .getByRole("button", { name: `Aprobar: Enviar borrador (${E2E.avisos.caseConDos})` })
      .click();
    await expect(page.getByTestId("exito-accion-aprobacion")).toBeVisible();

    await page.goto("/dashboard");
    await pantallaUtil(page);
    // El KPI de aprobaciones pendientes baja con el resto.
    const kpi = page.locator("div").filter({ hasText: /^Aprobaciones pend\./ }).first();
    await expect(kpi).toContainText(String(CIFRAS_AVISOS.aprobacionesPendientes - 1));
  });

  for (const [codigo, cuerpo, esperado] of [
    [403, {}, "No tienes permiso para revisar aprobaciones"],
    [404, {}, "La aprobacion ya no existe"],
    [409, {}, "ya ha sido revisada por otra persona"],
    [400, { error: "Estado invalido" }, "Estado invalido"],
    [500, {}, "El servidor ha respondido 500"],
  ] as const) {
    test(`un HTTP ${codigo} se explica y NO cambia el estado`, async ({ page }) => {
      await login(page, E2E.avisos.owner);
      permitirFalloEn(page, "/api/approvals/");
      await irAAprobaciones(page);

      await page.route("**/api/approvals/*", (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({
              status: codigo,
              contentType: "application/json",
              body: JSON.stringify(cuerpo),
            })
          : route.continue(),
      );

      await page
        .getByRole("button", { name: `Aprobar: Enviar borrador (${E2E.avisos.caseConDos})` })
        .click();

      await expect(page.getByTestId("error-accion-aprobacion")).toContainText(esperado);
      await expect(page.getByTestId("exito-accion-aprobacion")).toHaveCount(0);
      // Sigue pendiente en pantalla…
      await expect(page.getByText("Pendiente").first()).toBeVisible();
      // …y en la base.
      expect(await pendientesEnBase()).toBe(CIFRAS_AVISOS.aprobacionesPendientes);
      // El boton vuelve a estar disponible: se puede reintentar.
      await expect(
        page.getByRole("button", { name: `Aprobar: Enviar borrador (${E2E.avisos.caseConDos})` }),
      ).toBeEnabled();

      await page.unroute("**/api/approvals/*");
    });
  }

  test("un fallo de red avisa y NO deja el boton bloqueado", async ({ page }) => {
    /*
     * El defecto mas visible: sin `finally`, `setActing(null)` no se ejecutaba
     * y el boton se quedaba en «...» hasta recargar la pagina.
     */
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/api/approvals/");
    await irAAprobaciones(page);

    await page.route("**/api/approvals/*", (route) =>
      route.request().method() === "PATCH" ? route.abort("failed") : route.continue(),
    );

    const boton = page.getByRole("button", {
      name: `Aprobar: Enviar borrador (${E2E.avisos.caseConDos})`,
    });
    await boton.click();

    await expect(page.getByTestId("error-accion-aprobacion")).toContainText("error de red");
    await expect(page.getByTestId("error-accion-aprobacion")).toContainText("Nada ha cambiado");
    // El boton vuelve, con su texto y utilizable.
    await expect(boton).toBeEnabled();
    await expect(boton).toHaveText("Aprobar");
    expect(await pendientesEnBase()).toBe(CIFRAS_AVISOS.aprobacionesPendientes);

    await page.unroute("**/api/approvals/*");
  });

  test("una respuesta que no es JSON no ensena «Unexpected token»", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    permitirFalloEn(page, "/api/approvals/");
    await irAAprobaciones(page);

    await page.route("**/api/approvals/*", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<!DOCTYPE html><h1>502</h1>" })
        : route.continue(),
    );

    await page
      .getByRole("button", { name: `Aprobar: Enviar borrador (${E2E.avisos.caseConDos})` })
      .click();

    const aviso = page.getByTestId("error-accion-aprobacion");
    await expect(aviso).toBeVisible();
    await expect(aviso).not.toContainText("Unexpected token");
    await expect(aviso).toContainText("502");
    await page.unroute("**/api/approvals/*");
  });

  test("el doble clic no aprueba dos veces", async ({ page }) => {
    let llamadas = 0;
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    await page.route("**/api/approvals/*", async (route) => {
      if (route.request().method() === "PATCH") {
        llamadas++;
        await new Promise((r) => setTimeout(r, 1200));
      }
      await route.continue();
    });

    const boton = page.getByRole("button", {
      name: `Aprobar: Enviar borrador (${E2E.avisos.caseConDos})`,
    });
    await boton.click();
    await boton.click({ force: true, timeout: 2000 }).catch(() => {
      // Que ya este inhabilitado tambien es un resultado valido.
    });

    await expect(page.getByTestId("exito-accion-aprobacion")).toBeVisible({ timeout: 15_000 });
    expect(llamadas).toBe(1);
    await page.unroute("**/api/approvals/*");
  });
});

test.describe("Aprobaciones: detalle", () => {
  test.afterEach(restaurarAprobaciones);

  test("«Ver detalle» abre y «Ocultar» cierra", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    const boton = page.getByRole("button", {
      name: `Ver detalle de Enviar borrador (${E2E.avisos.caseConDos})`,
    });
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await boton.click();

    await expect(page.getByText("Estimada familia")).toBeVisible();
    const cerrar = page.getByRole("button", {
      name: `Ocultar detalle de Enviar borrador (${E2E.avisos.caseConDos})`,
    });
    await expect(cerrar).toHaveAttribute("aria-expanded", "true");
    await cerrar.click();
    await expect(page.getByText("Estimada familia")).toHaveCount(0);
  });

  test("sin detalle no aparece el boton", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    // La aprobacion «Generar checklist» se sembro con `details: null`.
    await expect(
      page.getByRole("button", { name: /Ver detalle de Generar checklist/ }),
    ).toHaveCount(0);
    await expect(page.getByText("Generar checklist")).toBeVisible();
  });

  test("el contenido se muestra COMO TEXTO, no se ejecuta", async ({ page }) => {
    /*
     * `details` puede traer cualquier cosa. Se comprueba con marcado real que
     * el navegador no lo interpreta: ni imagen, ni negrita, ni script.
     */
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);

    await page
      .getByRole("button", { name: `Ver detalle de Enviar email (${E2E.avisos.caseConDos})` })
      .click();

    const detalle = page.locator("pre").filter({ hasText: "onerror" });
    await expect(detalle).toBeVisible();
    // El texto se lee tal cual, con sus etiquetas visibles.
    await expect(detalle).toContainText("<img src=x onerror=alert(1)>");
    await expect(detalle).toContainText("<b>negrita</b>");
    // Y no ha creado ningun elemento: no se interpreto.
    expect(await detalle.locator("img").count()).toBe(0);
    expect(await detalle.locator("b").count()).toBe(0);
    expect(await detalle.locator("script").count()).toBe(0);
  });
});

test.describe("Aprobaciones: roles y aislamiento", () => {
  test.afterEach(restaurarAprobaciones);

  /*
   * Politica REAL, leida de `src/lib/rbac.ts`: `autopilot.approve` lo tienen
   * OWNER, MANAGER y OPERATOR. El VIEWER **no**. No se inventa nada.
   */
  for (const rol of ["owner", "manager", "operador"] as const) {
    test(`un ${rol.toUpperCase()} entra y puede aprobar`, async ({ page }) => {
      await login(page, E2E.avisos[rol]);
      await irAAprobaciones(page);

      await expect(page.getByTestId("recuento-aprobaciones")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Aprobar: / }).first(),
      ).toBeEnabled();
    });
  }

  test("un VIEWER no ve la pantalla ni por URL directa", async ({ page }) => {
    await login(page, E2E.avisos.viewer);

    // El enlace del menu no esta.
    await expect(page.getByRole("link", { name: "Aprobaciones" })).toHaveCount(0);

    // Y la URL directa le devuelve al panel: esconder el enlace no basta.
    await page.goto("/approvals");
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("el servidor rechaza a un VIEWER que llame al API directamente", async ({ page }) => {
    await login(page, E2E.avisos.viewer);
    const aprobacion = await prisma.approval.findFirstOrThrow({
      where: { case: { org: { slug: E2E.avisos.slug } }, status: "PENDING" },
      select: { id: true },
    });

    const listar = await page.request.get("/api/approvals?status=PENDING");
    expect(listar.status(), "listar sin autopilot.approve").toBe(403);

    const aprobar = await page.request.patch(`/api/approvals/${aprobacion.id}`, {
      data: { status: "APPROVED" },
    });
    expect(aprobar.status(), "aprobar sin autopilot.approve").toBe(403);

    // Y no se ha tocado nada.
    expect(await pendientesEnBase()).toBe(CIFRAS_AVISOS.aprobacionesPendientes);
  });

  test("no se ve ni una aprobacion de la organizacion vecina", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    await irAAprobaciones(page);
    await page.getByTestId("pestana-todas").click();

    await expect(page.locator("body")).not.toContainText("NO_DEBE_VERSE_aprobacion_vecina");
    await expect(page.locator("body")).not.toContainText(E2E.avisosVecina.caseRef);
  });

  test("el servidor rechaza aprobar una aprobacion ajena", async ({ page }) => {
    await login(page, E2E.avisos.owner);
    const ajena = await prisma.approval.findFirstOrThrow({
      where: { case: { org: { slug: E2E.avisosVecina.slug } } },
      select: { id: true, status: true },
    });

    const res = await page.request.patch(`/api/approvals/${ajena.id}`, {
      data: { status: "APPROVED" },
    });
    expect(res.status(), "aprobar la de otra organizacion").toBe(404);

    // Sigue intacta.
    const despues = await prisma.approval.findUniqueOrThrow({
      where: { id: ajena.id },
      select: { status: true },
    });
    expect(despues.status).toBe(ajena.status);
  });
});
