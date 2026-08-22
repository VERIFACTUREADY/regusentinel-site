/**
 * /workflow-rules, /workflow-logs y /audit.
 *
 * QUE VIGILA ESTA SUITE
 * ---------------------
 * Las tres pantallas tenían el mismo patrón de fallo silencioso que el resto
 * de la aplicación, y en `/workflow-rules` era el peor de todos:
 *
 *   - `load()` era `try { if (res.ok) setRules(...) } catch {}`. Con la
 *     petición caída la pantalla decía **«Sin reglas de automatización»**: el
 *     gestor concluía que su despacho no tenía ninguna automatización montada
 *     cuando podía tenerlas todas.
 *   - Activar, desactivar y borrar disparaban la petición y recargaban sin
 *     mirar la respuesta: un 403 dejaba la regla como estaba y el usuario se
 *     iba creyendo que la había desactivado.
 *   - Ni un solo `<label>` del formulario estaba asociado a su campo, y los
 *     botones de editar y eliminar no tenían nombre accesible ninguno.
 *
 * En `/audit` había además un defecto de fechas de la misma familia que los ya
 * corregidos, y un CSV que exportaba 30 filas de las que hubiera.
 */
import { type Page } from "@playwright/test";
import { test, expect, pantallaUtil, permitirFalloEn } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E, CIFRAS_AUTOMATIZACIONES, REGISTROS_POR_PAGINA } from "./seed-e2e";

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

async function irAReglas(page: Page) {
  await page.goto("/workflow-rules");
  await pantallaUtil(page);
}

/** Deja las reglas de la organización como las dejó el sembrado. */
async function restaurarReglas() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: E2E.automatizaciones.slug },
    select: { id: true },
  });
  // Las creadas por las pruebas se borran…
  await prisma.workflowRule.deleteMany({
    where: {
      orgId: org.id,
      name: {
        notIn: [
          E2E.automatizaciones.reglaActiva,
          E2E.automatizaciones.reglaInactiva,
          E2E.automatizaciones.reglaBorrable,
        ],
      },
    },
  });
  // …y las tres del sembrado vuelven a su estado.
  await prisma.workflowRule.updateMany({
    where: { orgId: org.id, name: E2E.automatizaciones.reglaActiva },
    data: { isActive: true },
  });
  await prisma.workflowRule.updateMany({
    where: { orgId: org.id, name: E2E.automatizaciones.reglaInactiva },
    data: { isActive: false },
  });
  // La borrable puede haber desaparecido: se recrea si falta.
  const borrable = await prisma.workflowRule.findFirst({
    where: { orgId: org.id, name: E2E.automatizaciones.reglaBorrable },
  });
  if (!borrable) {
    await prisma.workflowRule.create({
      data: {
        orgId: org.id,
        name: E2E.automatizaciones.reglaBorrable,
        trigger: "DOCUMENT_UPLOADED",
        conditions: {},
        action: "ADD_CASE_COMMENT",
        actionConfig: { comment: "Documento recibido" },
        isActive: true,
      },
    });
  }
}

// ─── Reglas: carga ────────────────────────────────────────────────────────

test.describe("Automatizaciones: la lista caída NO se disfraza de vacía", () => {
  test.afterEach(restaurarReglas);

  for (const [codigo, esperado] of [
    [401, "Tu sesion ha caducado"],
    [403, "No tienes permiso para ver las automatizaciones"],
    [500, "El servidor ha respondido 500"],
  ] as const) {
    test(`un HTTP ${codigo} se explica y NO dice «Sin reglas de automatización»`, async ({
      page,
    }) => {
      await login(page, E2E.automatizaciones.owner);
      permitirFalloEn(page, "/api/workflow-rules");
      await page.route("**/api/workflow-rules", (route) =>
        route.fulfill({ status: codigo, contentType: "application/json", body: "{}" }),
      );
      await irAReglas(page);

      const aviso = page.getByTestId("carga-error");
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(esperado);
      // Lo que de verdad importa: el estado vacío NO está.
      await expect(page.getByTestId("vacio-reglas")).toHaveCount(0);
      await expect(page.getByText("Sin reglas de automatización")).toHaveCount(0);

      await page.unroute("**/api/workflow-rules");
    });
  }

  test("un fallo de red se explica igual que uno del servidor", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/workflow-rules");
    await page.route("**/api/workflow-rules", (route) => route.abort("failed"));
    await irAReglas(page);

    await expect(page.getByTestId("carga-error")).toBeVisible();
    await expect(page.getByTestId("vacio-reglas")).toHaveCount(0);
    await page.unroute("**/api/workflow-rules");
  });

  test("una respuesta 200 con forma inesperada se detecta", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await page.route("**/api/workflow-rules", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        // Un objeto donde se esperaba una lista: antes reventaba al recorrerlo.
        body: JSON.stringify({ reglas: [] }),
      }),
    );
    await irAReglas(page);

    await expect(page.getByTestId("carga-error")).toContainText("formato esperado");
    await expect(page.getByTestId("vacio-reglas")).toHaveCount(0);
    await page.unroute("**/api/workflow-rules");
  });

  test("«Reintentar» recupera la lista", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/workflow-rules");
    await page.route("**/api/workflow-rules", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await irAReglas(page);
    await expect(page.getByTestId("carga-error")).toBeVisible();

    await page.unroute("**/api/workflow-rules");
    await page.getByTestId("carga-error").getByRole("button", { name: "Reintentar" }).click();

    await expect(page.getByText(E2E.automatizaciones.reglaActiva)).toBeVisible();
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("un estado vacío REAL sigue diciendo que no hay reglas", async ({ page }) => {
    // Organización sin ninguna regla: aquí el vacío es cierto.
    await login(page, E2E.panelNueva.owner);
    await irAReglas(page);

    await expect(page.getByTestId("vacio-reglas")).toBeVisible();
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
  });

  test("la lista muestra las reglas con su disparador y su acción", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);

    await expect(page.getByText(E2E.automatizaciones.reglaActiva)).toBeVisible();
    await expect(page.getByText(E2E.automatizaciones.reglaInactiva)).toBeVisible();
    await expect(page.getByText("Estado de expediente cambia").first()).toBeVisible();
    await expect(page.getByText("Añadir comentario al expediente").first()).toBeVisible();
  });
});

// ─── Reglas: accesibilidad del formulario ─────────────────────────────────

test.describe("Automatizaciones: accesibilidad del formulario", () => {
  test.afterEach(restaurarReglas);

  test("todos los campos se localizan por su etiqueta", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();

    // El modal se anuncia como diálogo, con título.
    const modal = page.getByRole("dialog", { name: "Nueva regla" });
    await expect(modal).toBeVisible();

    // Ni uno solo de estos estaba asociado a su campo.
    await expect(page.getByLabel("Nombre")).toBeVisible();
    await expect(page.getByLabel("Descripción")).toBeVisible();
    await expect(page.getByLabel("Disparador (cuando…)")).toBeVisible();
    await expect(page.getByLabel("Regla activa")).toBeVisible();
    await expect(page.getByLabel("Acción (entonces…)")).toBeVisible();
    // Del disparador de partida (CASE_STATUS_CHANGED).
    await expect(page.getByLabel("Desde estado (opcional)")).toBeVisible();
    await expect(page.getByLabel("Hacia estado (opcional)")).toBeVisible();
    // De la acción de partida (ADD_CASE_COMMENT).
    await expect(page.getByLabel("Texto del comentario")).toBeVisible();
  });

  test("las etiquetas están ASOCIADAS de verdad, no colocadas al lado", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const sueltas = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="modal-regla"]');
      if (!modal) return ["no hay modal"];
      return Array.from(modal.querySelectorAll("label"))
        .filter((l) => {
          // Una etiqueta que ENVUELVE su control ya está asociada.
          if (l.querySelector("input, select, textarea")) return false;
          const para = l.getAttribute("for");
          return !para || !document.getElementById(para);
        })
        .map((l) => l.textContent?.trim() ?? "(sin texto)");
    });
    expect(sueltas, `estas etiquetas no apuntan a ningún control: ${sueltas.join(" | ")}`).toEqual([]);
  });

  test("los grupos de campos se anuncian como grupos", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();

    // «Condiciones» y «Configuración de acción» rotulan un conjunto de
    // campos, no uno solo: son `fieldset`/`legend`, no `<label>`.
    await expect(page.getByRole("group", { name: "Condiciones" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Configuración de acción" })).toBeVisible();
  });

  test("cada botón de la tarjeta dice sobre QUÉ regla actúa", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);

    const nombre = E2E.automatizaciones.reglaActiva;
    // Editar y eliminar no tenían nombre accesible ninguno; los otros dos
    // dependían de `title`, que es una ayuda emergente y no un nombre.
    await expect(page.getByRole("button", { name: `Editar regla ${nombre}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Eliminar regla ${nombre}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Probar regla ${nombre}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Desactivar regla ${nombre}` })).toBeVisible();
    // La desactivada ofrece activarla.
    await expect(
      page.getByRole("button", { name: `Activar regla ${E2E.automatizaciones.reglaInactiva}` }),
    ).toBeVisible();
  });
});

// ─── Reglas: crear ────────────────────────────────────────────────────────

test.describe("Automatizaciones: crear regla", () => {
  test.afterEach(restaurarReglas);

  test("se crea una regla con comentario y persiste tras recargar", async ({ page }) => {
    const nombre = `Regla nueva E2E ${Date.now()}`;

    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();

    await page.getByLabel("Nombre").fill(nombre);
    await page.getByLabel("Descripción").fill("Creada desde el navegador");
    await page.getByLabel("Disparador (cuando…)").selectOption("CASE_STATUS_CHANGED");
    await page.getByLabel("Hacia estado (opcional)").selectOption("CLOSED");
    await page.getByLabel("Acción (entonces…)").selectOption("ADD_CASE_COMMENT");
    await page.getByLabel("Texto del comentario").fill("Expediente cerrado automáticamente");
    await page.getByTestId("guardar-regla").click();

    await expect(page.getByTestId("exito-accion-regla")).toContainText("Regla creada");
    await expect(page.getByText(nombre)).toBeVisible();

    // Persiste de verdad, con su configuración.
    await page.reload();
    await pantallaUtil(page);
    await expect(page.getByText(nombre)).toBeVisible();

    const guardada = await prisma.workflowRule.findFirstOrThrow({
      where: { name: nombre },
      select: { trigger: true, action: true, conditions: true, actionConfig: true, isActive: true },
    });
    expect(guardada.trigger).toBe("CASE_STATUS_CHANGED");
    expect(guardada.action).toBe("ADD_CASE_COMMENT");
    expect(guardada.conditions).toMatchObject({ toStatus: "CLOSED" });
    expect(guardada.actionConfig).toMatchObject({ comment: "Expediente cerrado automáticamente" });
    expect(guardada.isActive).toBe(true);
  });

  test("cada disparador despliega sus propias condiciones", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();

    // CASE_STATUS_CHANGED: dos estados.
    await page.getByLabel("Disparador (cuando…)").selectOption("CASE_STATUS_CHANGED");
    await expect(page.getByLabel("Desde estado (opcional)")).toBeVisible();
    await expect(page.getByLabel("Hacia estado (opcional)")).toBeVisible();

    // TASK_STATUS_CHANGED: estado de tarea.
    await page.getByLabel("Disparador (cuando…)").selectOption("TASK_STATUS_CHANGED");
    await expect(page.getByLabel("Hacia estado de tarea (opcional)")).toBeVisible();
    await expect(page.getByLabel("Desde estado (opcional)")).toHaveCount(0);

    // Los otros dos no tienen condiciones que configurar.
    for (const disparador of ["CASE_CREATED", "DOCUMENT_UPLOADED"]) {
      await page.getByLabel("Disparador (cuando…)").selectOption(disparador);
      await expect(
        page.getByText("Sin condiciones adicionales disponibles para este disparador."),
      ).toBeVisible();
    }
  });

  test("cada acción despliega su propia configuración", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();

    for (const accion of ["SEND_EMAIL_CONTACT", "SEND_EMAIL_TEAM"]) {
      await page.getByLabel("Acción (entonces…)").selectOption(accion);
      await expect(page.getByLabel("Asunto del email")).toBeVisible();
      await expect(page.getByLabel("Cuerpo del mensaje")).toBeVisible();
    }

    await page.getByLabel("Acción (entonces…)").selectOption("ADD_CASE_COMMENT");
    await expect(page.getByLabel("Texto del comentario")).toBeVisible();

    await page.getByLabel("Acción (entonces…)").selectOption("CHANGE_CASE_STATUS");
    await expect(page.getByLabel("Nuevo estado del expediente")).toBeVisible();
  });

  test("se crea una regla de email con asunto y cuerpo", async ({ page }) => {
    const nombre = `Regla email E2E ${Date.now()}`;

    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();

    await page.getByLabel("Nombre").fill(nombre);
    await page.getByLabel("Disparador (cuando…)").selectOption("CASE_CREATED");
    await page.getByLabel("Acción (entonces…)").selectOption("SEND_EMAIL_TEAM");
    await page.getByLabel("Asunto del email").fill("Nuevo expediente {{case.ref}}");
    await page.getByLabel("Cuerpo del mensaje").fill("Se ha creado el expediente {{case.ref}}.");
    await page.getByTestId("guardar-regla").click();

    await expect(page.getByTestId("exito-accion-regla")).toBeVisible();
    const guardada = await prisma.workflowRule.findFirstOrThrow({ where: { name: nombre } });
    expect(guardada.actionConfig).toMatchObject({
      subject: "Nuevo expediente {{case.ref}}",
      body: "Se ha creado el expediente {{case.ref}}.",
    });
  });

  test("sin nombre no se puede guardar", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();

    // El botón está inhabilitado con el nombre vacío…
    await expect(page.getByTestId("guardar-regla")).toBeDisabled();
    // …y con sólo espacios, también.
    await page.getByLabel("Nombre").fill("   ");
    await expect(page.getByTestId("guardar-regla")).toBeDisabled();
  });

  test("la casilla «Regla activa» se guarda como se deja", async ({ page }) => {
    const nombre = `Regla inactiva E2E ${Date.now()}`;

    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();

    await page.getByLabel("Nombre").fill(nombre);
    await page.getByLabel("Regla activa").uncheck();
    await page.getByLabel("Texto del comentario").fill("Nada");
    await page.getByTestId("guardar-regla").click();

    await expect(page.getByTestId("exito-accion-regla")).toBeVisible();
    const guardada = await prisma.workflowRule.findFirstOrThrow({ where: { name: nombre } });
    expect(guardada.isActive).toBe(false);
  });
});

// ─── Reglas: errores al guardar ───────────────────────────────────────────

test.describe("Automatizaciones: el guardado no finge éxito", () => {
  test.afterEach(restaurarReglas);

  for (const [codigo, cuerpo, esperado] of [
    [400, { error: "El nombre es obligatorio" }, "El nombre es obligatorio"],
    [403, {}, "No tienes permiso para gestionar automatizaciones"],
    [500, {}, "El servidor ha respondido 500"],
  ] as const) {
    test(`un HTTP ${codigo} se explica y la regla NO aparece`, async ({ page }) => {
      const nombre = `No deberia guardarse ${codigo} ${Date.now()}`;

      await login(page, E2E.automatizaciones.owner);
      permitirFalloEn(page, "/api/workflow-rules");
      await irAReglas(page);
      await page.getByTestId("nueva-regla").click();
      await page.getByLabel("Nombre").fill(nombre);
      await page.getByLabel("Texto del comentario").fill("Nada");

      await page.route("**/api/workflow-rules", (route) =>
        route.request().method() === "POST"
          ? route.fulfill({
              status: codigo,
              contentType: "application/json",
              body: JSON.stringify(cuerpo),
            })
          : route.continue(),
      );
      await page.getByTestId("guardar-regla").click();

      await expect(page.getByTestId("error-guardar-regla")).toContainText(esperado);
      // El modal sigue abierto y con lo escrito: no se pierde el trabajo.
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByLabel("Nombre")).toHaveValue(nombre);
      // Y no se ha creado nada.
      expect(await prisma.workflowRule.count({ where: { name: nombre } })).toBe(0);

      await page.unroute("**/api/workflow-rules");
    });
  }

  test("una respuesta que no es JSON no enseña «Unexpected token»", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/workflow-rules");
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();
    await page.getByLabel("Nombre").fill("Da igual");
    await page.getByLabel("Texto del comentario").fill("Nada");

    await page.route("**/api/workflow-rules", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<!DOCTYPE html><h1>502</h1>" })
        : route.continue(),
    );
    await page.getByTestId("guardar-regla").click();

    const aviso = page.getByTestId("error-guardar-regla");
    await expect(aviso).toBeVisible();
    await expect(aviso).not.toContainText("Unexpected token");
    await expect(aviso).toContainText("502");
    await page.unroute("**/api/workflow-rules");
  });

  test("un fallo de red conserva el formulario", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/workflow-rules");
    await irAReglas(page);
    await page.getByTestId("nueva-regla").click();
    await page.getByLabel("Nombre").fill("Se cae la red");
    await page.getByLabel("Texto del comentario").fill("Nada");

    await page.route("**/api/workflow-rules", (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );
    await page.getByTestId("guardar-regla").click();

    await expect(page.getByTestId("error-guardar-regla")).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveValue("Se cae la red");
    await page.unroute("**/api/workflow-rules");
  });

  test("el servidor rechaza un nombre vacío aunque se salte la interfaz", async ({ page }) => {
    // La segunda mitad: la validación real está en el servidor.
    await login(page, E2E.automatizaciones.owner);
    const res = await page.request.post("/api/workflow-rules", {
      data: { name: "   ", trigger: "CASE_CREATED", action: "ADD_CASE_COMMENT" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("nombre");
  });

  test("el servidor rechaza un disparador y una acción inválidos", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);

    const disparador = await page.request.post("/api/workflow-rules", {
      data: { name: "Regla mala", trigger: "NO_EXISTE", action: "ADD_CASE_COMMENT" },
    });
    expect(disparador.status()).toBe(400);
    expect((await disparador.json()).error).toContain("Disparador");

    const accion = await page.request.post("/api/workflow-rules", {
      data: { name: "Regla mala", trigger: "CASE_CREATED", action: "NO_EXISTE" },
    });
    expect(accion.status()).toBe(400);
    expect((await accion.json()).error).toContain("Accion");
  });

  test("el servidor rechaza un estado de destino inválido", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const res = await page.request.post("/api/workflow-rules", {
      data: {
        name: "Cambiar a un estado que no existe",
        trigger: "CASE_CREATED",
        action: "CHANGE_CASE_STATUS",
        actionConfig: { newStatus: "ESTADO_INVENTADO" },
      },
    });
    expect(res.status()).toBe(400);
    expect(await prisma.workflowRule.count({ where: { name: "Cambiar a un estado que no existe" } })).toBe(0);
  });
});

// ─── Reglas: editar, activar y borrar ─────────────────────────────────────

test.describe("Automatizaciones: editar, activar y borrar", () => {
  test.afterEach(restaurarReglas);

  test("se edita una regla y los cambios persisten", async ({ page }) => {
    const nuevoNombre = `Regla renombrada E2E ${Date.now()}`;

    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page
      .getByRole("button", { name: `Editar regla ${E2E.automatizaciones.reglaBorrable}` })
      .click();

    await expect(page.getByRole("dialog", { name: "Editar regla" })).toBeVisible();
    await page.getByLabel("Nombre").fill(nuevoNombre);
    await page.getByLabel("Descripción").fill("Descripción cambiada");
    await page.getByLabel("Disparador (cuando…)").selectOption("CASE_STATUS_CHANGED");
    await page.getByLabel("Hacia estado (opcional)").selectOption("SENT");
    await page.getByLabel("Acción (entonces…)").selectOption("CHANGE_CASE_STATUS");
    await page.getByLabel("Nuevo estado del expediente").selectOption("ARCHIVED");
    await page.getByTestId("guardar-regla").click();

    await expect(page.getByTestId("exito-accion-regla")).toContainText("Regla actualizada");

    await page.reload();
    await pantallaUtil(page);
    await expect(page.getByText(nuevoNombre)).toBeVisible();

    const guardada = await prisma.workflowRule.findFirstOrThrow({ where: { name: nuevoNombre } });
    expect(guardada.description).toBe("Descripción cambiada");
    expect(guardada.trigger).toBe("CASE_STATUS_CHANGED");
    expect(guardada.action).toBe("CHANGE_CASE_STATUS");
    expect(guardada.conditions).toMatchObject({ toStatus: "SENT" });
    expect(guardada.actionConfig).toMatchObject({ newStatus: "ARCHIVED" });
  });

  test("una edición rechazada NO aparece guardada", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/workflow-rules/");
    await irAReglas(page);
    await page
      .getByRole("button", { name: `Editar regla ${E2E.automatizaciones.reglaBorrable}` })
      .click();
    await page.getByLabel("Nombre").fill("Nombre que no debe guardarse");

    await page.route("**/api/workflow-rules/*", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
        : route.continue(),
    );
    await page.getByTestId("guardar-regla").click();

    await expect(page.getByTestId("error-guardar-regla")).toBeVisible();
    await page.unroute("**/api/workflow-rules/*");

    // En la base sigue llamándose como antes.
    expect(
      await prisma.workflowRule.count({ where: { name: "Nombre que no debe guardarse" } }),
    ).toBe(0);
    expect(
      await prisma.workflowRule.count({ where: { name: E2E.automatizaciones.reglaBorrable } }),
    ).toBe(1);
  });

  test("se desactiva y se reactiva, y persiste en los dos sentidos", async ({ page }) => {
    const nombre = E2E.automatizaciones.reglaActiva;

    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);

    // Desactivar.
    await page.getByRole("button", { name: `Desactivar regla ${nombre}` }).click();
    await expect(page.getByTestId("exito-accion-regla")).toContainText("desactivada");
    await expect(async () => {
      const r = await prisma.workflowRule.findFirstOrThrow({ where: { name: nombre } });
      expect(r.isActive).toBe(false);
    }).toPass({ timeout: 10_000 });

    await page.reload();
    await pantallaUtil(page);
    await expect(page.getByRole("button", { name: `Activar regla ${nombre}` })).toBeVisible();

    // Reactivar.
    await page.getByRole("button", { name: `Activar regla ${nombre}` }).click();
    await expect(page.getByTestId("exito-accion-regla")).toContainText("activada");
    await page.reload();
    await pantallaUtil(page);
    await expect(page.getByRole("button", { name: `Desactivar regla ${nombre}` })).toBeVisible();

    const r = await prisma.workflowRule.findFirstOrThrow({ where: { name: nombre } });
    expect(r.isActive).toBe(true);
  });

  for (const [codigo, esperado] of [
    [403, "No tienes permiso"],
    [500, "No se ha podido cambiar el estado"],
  ] as const) {
    test(`activar con un HTTP ${codigo} avisa y NO cambia el estado`, async ({ page }) => {
      const nombre = E2E.automatizaciones.reglaActiva;

      await login(page, E2E.automatizaciones.owner);
      permitirFalloEn(page, "/api/workflow-rules/");
      await irAReglas(page);

      await page.route("**/api/workflow-rules/*", (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({ status: codigo, contentType: "application/json", body: "{}" })
          : route.continue(),
      );
      await page.getByRole("button", { name: `Desactivar regla ${nombre}` }).click();

      await expect(page.getByTestId("error-accion-regla")).toContainText(esperado);
      // Sigue activa en la base: la pantalla no puede decir lo contrario.
      const r = await prisma.workflowRule.findFirstOrThrow({ where: { name: nombre } });
      expect(r.isActive).toBe(true);
      // Y en pantalla se sigue ofreciendo desactivarla.
      await expect(page.getByRole("button", { name: `Desactivar regla ${nombre}` })).toBeVisible();

      await page.unroute("**/api/workflow-rules/*");
    });
  }

  test("un fallo de red al activar tampoco falsea el estado", async ({ page }) => {
    const nombre = E2E.automatizaciones.reglaActiva;

    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/workflow-rules/");
    await irAReglas(page);
    await page.route("**/api/workflow-rules/*", (route) =>
      route.request().method() === "PATCH" ? route.abort("failed") : route.continue(),
    );

    await page.getByRole("button", { name: `Desactivar regla ${nombre}` }).click();
    await expect(page.getByTestId("error-accion-regla")).toContainText("Error de red");
    const r = await prisma.workflowRule.findFirstOrThrow({ where: { name: nombre } });
    expect(r.isActive).toBe(true);
    await page.unroute("**/api/workflow-rules/*");
  });

  test("borrar: se cancela y la regla sigue; se confirma y desaparece", async ({ page }) => {
    const nombre = E2E.automatizaciones.reglaBorrable;

    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);

    // Cancelar deja la regla donde estaba.
    await page.getByRole("button", { name: `Eliminar regla ${nombre}` }).click();
    await expect(page.getByRole("dialog", { name: "¿Eliminar esta regla?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText(nombre)).toBeVisible();
    expect(await prisma.workflowRule.count({ where: { name: nombre } })).toBe(1);

    // Confirmar la borra de verdad.
    await page.getByRole("button", { name: `Eliminar regla ${nombre}` }).click();
    await page.getByTestId("confirmar-eliminar-regla").click();
    await expect(page.getByTestId("exito-accion-regla")).toContainText("eliminada");

    /*
     * La ausencia se comprueba sobre la TARJETA, no sobre el texto suelto: el
     * aviso de exito dice «Regla "X" eliminada», asi que buscar el nombre a
     * secas encuentra el propio aviso y la prueba fallaba afirmando que la
     * regla seguia ahi cuando ya no estaba.
     */
    await expect(page.getByRole("button", { name: `Eliminar regla ${nombre}` })).toHaveCount(0);

    await page.reload();
    await pantallaUtil(page);
    await expect(page.getByRole("button", { name: `Eliminar regla ${nombre}` })).toHaveCount(0);
    expect(await prisma.workflowRule.count({ where: { name: nombre } })).toBe(0);
  });

  for (const [codigo, esperado] of [
    [403, "No tienes permiso para eliminar"],
    [404, "La regla ya no existe"],
    [500, "No se ha podido eliminar"],
  ] as const) {
    test(`borrar con un HTTP ${codigo} NO finge que se ha borrado`, async ({ page }) => {
      const nombre = E2E.automatizaciones.reglaBorrable;

      await login(page, E2E.automatizaciones.owner);
      permitirFalloEn(page, "/api/workflow-rules/");
      await irAReglas(page);

      await page.route("**/api/workflow-rules/*", (route) =>
        route.request().method() === "DELETE"
          ? route.fulfill({ status: codigo, contentType: "application/json", body: "{}" })
          : route.continue(),
      );
      await page.getByRole("button", { name: `Eliminar regla ${nombre}` }).click();
      await page.getByTestId("confirmar-eliminar-regla").click();

      await expect(page.getByTestId("error-accion-regla")).toContainText(esperado);
      // La confirmación sigue abierta: el borrado NO ha ocurrido.
      await expect(page.getByTestId("confirmar-borrado-regla")).toBeVisible();
      // Y la regla sigue en la base.
      expect(await prisma.workflowRule.count({ where: { name: nombre } })).toBe(1);

      await page.unroute("**/api/workflow-rules/*");
    });
  }

  test("el doble clic no borra dos veces", async ({ page }) => {
    let llamadas = 0;
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);

    await page.route("**/api/workflow-rules/*", async (route) => {
      if (route.request().method() === "DELETE") {
        llamadas++;
        await new Promise((r) => setTimeout(r, 1200));
      }
      await route.continue();
    });

    await page
      .getByRole("button", { name: `Eliminar regla ${E2E.automatizaciones.reglaBorrable}` })
      .click();
    const confirmar = page.getByTestId("confirmar-eliminar-regla");
    await confirmar.click();
    await confirmar.click({ force: true, timeout: 2000 }).catch(() => {
      // Que ya esté inhabilitado también es un resultado válido.
    });

    await expect(page.getByTestId("exito-accion-regla")).toBeVisible({ timeout: 15_000 });
    expect(llamadas).toBe(1);
    await page.unroute("**/api/workflow-rules/*");
  });
});

// ─── Reglas: probar y disparo automático ──────────────────────────────────

test.describe("Automatizaciones: probar la regla y disparo automático", () => {
  test.afterEach(restaurarReglas);

  test("el buscador caído NO dice «sin coincidencias»", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/search");
    await irAReglas(page);
    await page
      .getByRole("button", { name: `Probar regla ${E2E.automatizaciones.reglaActiva}` })
      .click();

    await page.route("**/api/search*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.getByLabel("Buscar expediente").fill("EXP-2026");

    await expect(page.getByTestId("error-buscar-expediente")).toContainText("500");
    await expect(page.getByTestId("sin-coincidencias")).toHaveCount(0);
    await page.unroute("**/api/search*");
  });

  test("una búsqueda sin resultados REALES sí lo dice", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page
      .getByRole("button", { name: `Probar regla ${E2E.automatizaciones.reglaActiva}` })
      .click();

    await page.getByLabel("Buscar expediente").fill("ZZZNOEXISTEZZZ");
    await expect(page.getByTestId("sin-coincidencias")).toBeVisible();
    await expect(page.getByTestId("error-buscar-expediente")).toHaveCount(0);
  });

  test("se busca un expediente, se ejecuta la regla y el comentario aparece", async ({ page }) => {
    const caso = await prisma.case.findFirstOrThrow({
      where: { ref: E2E.automatizaciones.caseRef },
      select: { id: true },
    });
    const antes = await prisma.auditLog.count({ where: { caseId: caso.id, action: "case.comment" } });

    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await page
      .getByRole("button", { name: `Probar regla ${E2E.automatizaciones.reglaActiva}` })
      .click();

    await page.getByLabel("Buscar expediente").fill(E2E.automatizaciones.caseRef);
    // Se pulsa el resultado real, no se inyecta el id.
    await page.getByRole("button", { name: new RegExp(E2E.automatizaciones.caseRef) }).click();
    await page.getByRole("button", { name: "Ejecutar regla" }).click();

    await expect(page.getByTestId("exito-ejecutar-regla")).toBeVisible();

    // El efecto real: el comentario está en el expediente.
    await expect(async () => {
      const despues = await prisma.auditLog.count({ where: { caseId: caso.id, action: "case.comment" } });
      expect(despues).toBeGreaterThan(antes);
    }).toPass({ timeout: 15_000 });

    const comentario = await prisma.auditLog.findFirst({
      where: { caseId: caso.id, action: "case.comment" },
      orderBy: { createdAt: "desc" },
    });
    expect(comentario?.details).toContain(E2E.automatizaciones.textoComentario);

    // Y ha quedado registrada la ejecución.
    const ejecuciones = await prisma.workflowLog.count({
      where: { rule: { name: E2E.automatizaciones.reglaActiva }, caseId: caso.id },
    });
    expect(ejecuciones).toBeGreaterThan(CIFRAS_AUTOMATIZACIONES.ejecuciones);
  });

  test("ejecutar con el servidor caído avisa y no finge éxito", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    permitirFalloEn(page, "/api/workflow-rules/");
    await irAReglas(page);
    await page
      .getByRole("button", { name: `Probar regla ${E2E.automatizaciones.reglaActiva}` })
      .click();
    await page.getByLabel("Buscar expediente").fill(E2E.automatizaciones.caseRef);
    await page.getByRole("button", { name: new RegExp(E2E.automatizaciones.caseRef) }).click();

    await page.route("**/api/workflow-rules/*/test", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.getByRole("button", { name: "Ejecutar regla" }).click();

    await expect(page.getByTestId("error-ejecutar-regla")).toContainText("500");
    await expect(page.getByTestId("exito-ejecutar-regla")).toHaveCount(0);
    await page.unroute("**/api/workflow-rules/*/test");
  });

  test("DISPARO AUTOMÁTICO: cambiar el estado desde la ficha ejecuta la regla", async ({
    page,
  }) => {
    /*
     * La prueba que de verdad demuestra la cadena entera:
     *
     *   acción en la interfaz → evento de dominio → motor → acción → registro
     *
     * No se llama al endpoint de «probar regla»: se cambia el estado del
     * expediente desde su ficha, como lo haría un gestor, y se comprueba que
     * el motor arranca solo.
     */
    const caso = await prisma.case.findFirstOrThrow({
      where: { ref: E2E.automatizaciones.caseRef },
      select: { id: true, status: true },
    });
    const comentariosAntes = await prisma.auditLog.count({ where: { caseId: caso.id, action: "case.comment" } });
    const ejecucionesAntes = await prisma.workflowLog.count({
      where: { rule: { name: E2E.automatizaciones.reglaActiva } },
    });
    const reglaAntes = await prisma.workflowRule.findFirstOrThrow({
      where: { name: E2E.automatizaciones.reglaActiva },
      select: { execCount: true },
    });

    await login(page, E2E.automatizaciones.owner);
    await page.goto(`/cases/${caso.id}`);
    await pantallaUtil(page);

    /*
     * El estado se cambia con el control REAL de la ficha.
     *
     * Se localiza por estructura y no por etiqueta a proposito: ese `<select>`
     * de `/cases/[id]` no tiene nombre accesible ninguno —ni `<label>`, ni
     * `aria-label`— y sus opciones son los nombres del enum con los guiones
     * bajos cambiados por espacios. Es un defecto real, pero cae en el modulo
     * de ficha de expediente, que esta FUERA del alcance de esta fase; queda
     * anotado en el informe en vez de arreglado por la puerta de atras.
     */
    const selector = page.locator('select').filter({
      has: page.locator('option[value="CLOSED"]'),
    }).first();
    await expect(selector).toBeVisible();
    const destino = caso.status === "SENT" ? "CLOSED" : "SENT";
    await selector.selectOption(destino);

    // El motor deja su rastro: comentario, registro y contador.
    await expect(async () => {
      const despues = await prisma.auditLog.count({ where: { caseId: caso.id, action: "case.comment" } });
      expect(despues, "el motor debe haber dejado el comentario").toBeGreaterThan(comentariosAntes);
    }).toPass({ timeout: 20_000 });

    const ejecucionesDespues = await prisma.workflowLog.count({
      where: { rule: { name: E2E.automatizaciones.reglaActiva } },
    });
    expect(ejecucionesDespues, "debe quedar registrada la ejecución").toBeGreaterThan(
      ejecucionesAntes,
    );

    const reglaDespues = await prisma.workflowRule.findFirstOrThrow({
      where: { name: E2E.automatizaciones.reglaActiva },
      select: { execCount: true, lastRunAt: true },
    });
    expect(reglaDespues.execCount).toBeGreaterThan(reglaAntes.execCount);
    expect(reglaDespues.lastRunAt).not.toBeNull();
  });
});

// ─── Reglas: roles y aislamiento ──────────────────────────────────────────

test.describe("Automatizaciones: roles y aislamiento", () => {
  test.afterEach(restaurarReglas);

  /*
   * Política REAL, leída de `src/lib/rbac.ts`:
   *   - `workflow.read`   → los CUATRO roles.
   *   - `workflow.manage` → sólo OWNER y MANAGER.
   * Es decir: OPERATOR y VIEWER entran y leen, pero no tocan nada.
   */
  for (const rol of ["owner", "manager", "operador", "viewer"] as const) {
    test(`un ${rol.toUpperCase()} entra y ve las reglas`, async ({ page }) => {
      await login(page, E2E.automatizaciones[rol]);
      await irAReglas(page);
      await expect(page.getByText(E2E.automatizaciones.reglaActiva)).toBeVisible();
    });
  }

  for (const rol of ["operador", "viewer"] as const) {
    test(`un ${rol.toUpperCase()} no ve ningún control de gestión`, async ({ page }) => {
      await login(page, E2E.automatizaciones[rol]);
      await irAReglas(page);

      await expect(page.getByTestId("nueva-regla")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Editar regla / })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Eliminar regla / })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Desactivar regla / })).toHaveCount(0);
    });

    test(`el servidor rechaza a un ${rol.toUpperCase()} que llame al API`, async ({ page }) => {
      // Esconder el botón no es un control de seguridad.
      await login(page, E2E.automatizaciones[rol]);
      const regla = await prisma.workflowRule.findFirstOrThrow({
        where: { name: E2E.automatizaciones.reglaActiva },
        select: { id: true },
      });

      const crear = await page.request.post("/api/workflow-rules", {
        data: { name: "Regla colada", trigger: "CASE_CREATED", action: "ADD_CASE_COMMENT" },
      });
      expect(crear.status(), "crear sin workflow.manage").toBe(403);

      const editar = await page.request.patch(`/api/workflow-rules/${regla.id}`, {
        data: { isActive: false },
      });
      expect(editar.status(), "editar sin workflow.manage").toBe(403);

      const borrar = await page.request.delete(`/api/workflow-rules/${regla.id}`);
      expect(borrar.status(), "borrar sin workflow.manage").toBe(403);

      const probar = await page.request.post(`/api/workflow-rules/${regla.id}/test`, {
        data: { caseId: "lo-que-sea" },
      });
      expect(probar.status(), "probar sin workflow.manage").toBe(403);

      // Nada ha cambiado.
      expect(await prisma.workflowRule.count({ where: { name: "Regla colada" } })).toBe(0);
      const r = await prisma.workflowRule.findFirstOrThrow({ where: { id: regla.id } });
      expect(r.isActive).toBe(true);
    });
  }

  test("no se ve ni una regla de la organización vecina", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    await irAReglas(page);
    await expect(page.locator("body")).not.toContainText(E2E.automatizacionesVecina.regla);
  });

  test("el servidor rechaza tocar una regla ajena", async ({ page }) => {
    await login(page, E2E.automatizaciones.owner);
    const ajena = await prisma.workflowRule.findFirstOrThrow({
      where: { name: E2E.automatizacionesVecina.regla },
      select: { id: true, isActive: true },
    });

    const leer = await page.request.get(`/api/workflow-rules/${ajena.id}`);
    expect(leer.status(), "leer la regla ajena").toBe(404);

    const editar = await page.request.patch(`/api/workflow-rules/${ajena.id}`, {
      data: { isActive: false },
    });
    expect(editar.status(), "editar la regla ajena").toBe(404);

    const borrar = await page.request.delete(`/api/workflow-rules/${ajena.id}`);
    expect(borrar.status(), "borrar la regla ajena").toBe(404);

    const probar = await page.request.post(`/api/workflow-rules/${ajena.id}/test`, {
      data: { caseId: "x" },
    });
    expect(probar.status(), "probar la regla ajena").toBe(404);

    // Sigue intacta.
    const despues = await prisma.workflowRule.findUniqueOrThrow({ where: { id: ajena.id } });
    expect(despues.isActive).toBe(ajena.isActive);
  });
});
