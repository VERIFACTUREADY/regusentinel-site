/**
 * CONCURRENCIA DE LAS TRANSICIONES DE ESTADO.
 *
 * EL HUECO QUE VIGILA ESTA SUITE
 * ------------------------------
 * Las dos rutas de cambio de estado —tarea y expediente— reclamaban la
 * transición de forma atómica, y eso estaba bien: sólo una de dos peticiones
 * simultáneas audita y emite el evento.
 *
 * Pero DESPUÉS seguían haciendo un `update` normal que incluía `status` otra
 * vez. La petición que PERDÍA la reclamación escribía igualmente el estado que
 * pedía. Con dos destinos distintos:
 *
 *     estado inicial: PENDIENTE
 *     A: PENDIENTE -> HECHA          gana la reclamación, audita y emite
 *     B: PENDIENTE -> EN CURSO       pierde, no audita, no emite… y ESCRIBE
 *
 * El resultado era una base de datos en EN CURSO con una auditoría que decía
 * HECHA y un flujo ejecutado para HECHA. El estado y su historia contaban
 * cosas distintas, y las dos peticiones devolvían 200.
 *
 * Eso es exactamente lo que una traza de auditoría no puede permitirse: un
 * cambio de estado sin su registro. Y no lo detectaba ninguna prueba, porque
 * la única que había mandaba dos peticiones al MISMO destino, donde la
 * escritura del perdedor coincide con la del ganador y no se nota.
 *
 * SEMÁNTICA ELEGIDA
 * -----------------
 * Comparar-y-cambiar, con dos desenlaces distintos:
 *
 *   - **mismo destino**: la intención de quien pide ya está cumplida. Se
 *     responde 200 idempotente. Una sola transición, una sola auditoría, una
 *     sola ejecución, un solo correo por destinatario.
 *   - **destino distinto**: el estado sobre el que quien pide tomó su decisión
 *     ya no existe. Se responde **409** con el estado real y **no se escribe
 *     nada**. Serializarlo en silencio desharía la decisión de otra persona sin
 *     que ninguna de las dos se entere.
 */
import { type Page, type APIRequestContext } from "@playwright/test";
import { test, expect, pantallaUtil } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./seed-e2e";

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

async function orgDisp() {
  return prisma.organization.findUniqueOrThrow({
    where: { slug: E2E.disparadores.slug },
    select: { id: true },
  });
}

async function casoDisp() {
  return prisma.case.findFirstOrThrow({
    where: { ref: E2E.disparadores.caseRef },
    select: { id: true, status: true },
  });
}

async function tareaDisp() {
  const caso = await casoDisp();
  return prisma.task.findFirstOrThrow({
    where: { caseId: caso.id, title: E2E.disparadores.tarea },
    select: { id: true, status: true },
  });
}

async function cuantosCorreos(api: APIRequestContext, destinatario: string): Promise<number> {
  const res = await api.get(`${BANDEJA}/mensajes?para=${encodeURIComponent(destinatario)}`);
  if (!res.ok()) throw new Error(`La bandeja de pruebas respondio ${res.status()}.`);
  return ((await res.json()) as unknown[]).length;
}

/** Deja la organizacion como la dejo el sembrado. */
async function limpiar() {
  const org = await orgDisp();
  const caso = await casoDisp();
  await prisma.workflowLog.deleteMany({ where: { rule: { orgId: org.id } } });
  await prisma.workflowRule.deleteMany({ where: { orgId: org.id } });
  await prisma.task.updateMany({ where: { caseId: caso.id }, data: { status: "PENDING" } });
  await prisma.case.update({ where: { id: caso.id }, data: { status: "IN_PROGRESS" } });
  await prisma.auditLog.deleteMany({
    where: { caseId: caso.id, action: { startsWith: "task." } },
  });
  await prisma.auditLog.deleteMany({
    where: { caseId: caso.id, action: "case.status_changed" },
  });
}

/** Crea una regla de aviso al equipo por el disparador indicado. */
async function reglaDeAviso(trigger: "TASK_STATUS_CHANGED" | "CASE_STATUS_CHANGED") {
  const org = await orgDisp();
  return prisma.workflowRule.create({
    data: {
      orgId: org.id,
      name: `Aviso de concurrencia (${trigger})`,
      trigger,
      conditions: {},
      action: "SEND_EMAIL_TEAM",
      actionConfig: { subject: "Cambio de estado", body: "Expediente {{case.ref}}." },
      isActive: true,
    },
  });
}

async function ejecucionesDe(ruleId: string) {
  return prisma.workflowLog.findMany({
    where: { ruleId },
    select: { id: true, status: true, idempotencyKey: true },
  });
}

async function execCountDe(ruleId: string) {
  const r = await prisma.workflowRule.findUniqueOrThrow({
    where: { id: ruleId },
    select: { execCount: true },
  });
  return r.execCount;
}

/**
 * Espera a que el motor termine.
 *
 * `triggerWorkflow` se dispara sin esperar respuesta, asi que contar
 * inmediatamente despues del PATCH mediria el trabajo a medio hacer. Se espera
 * a que el numero de ejecuciones se estabilice.
 */
async function esperarAlMotor(ruleId: string, esperadas: number) {
  await expect(async () => {
    expect(await ejecucionesDe(ruleId)).toHaveLength(esperadas);
  }).toPass({ timeout: 20_000 });
  // Margen para que una segunda ejecucion, de existir, hubiera aparecido.
  await new Promise((r) => setTimeout(r, 1500));
  expect(await ejecucionesDe(ruleId), "no aparece una ejecucion de mas").toHaveLength(
    esperadas,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAREAS
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Concurrencia: estado de TAREA", () => {
  test.afterEach(limpiar);

  test("dos peticiones IDENTICAS: una sola transicion de negocio", async ({ page }) => {
    const regla = await reglaDeAviso("TASK_STATUS_CHANGED");
    const caso = await casoDisp();
    const tarea = await tareaDisp();
    expect(tarea.status, "punto de partida").toBe("PENDING");

    const antes = {
      owner: await cuantosCorreos(page.request, E2E.disparadores.owner),
      manager: await cuantosCorreos(page.request, E2E.disparadores.manager),
    };

    await login(page, E2E.disparadores.owner);

    const cuerpo = { taskId: tarea.id, status: "DONE" };
    const [a, b] = await Promise.all([
      page.request.patch(`/api/cases/${caso.id}/tasks`, { data: cuerpo, failOnStatusCode: false }),
      page.request.patch(`/api/cases/${caso.id}/tasks`, { data: cuerpo, failOnStatusCode: false }),
    ]);

    // Las dos peticiones piden lo mismo, y lo que piden se cumple: 200 las dos.
    expect([a.status(), b.status()].sort()).toEqual([200, 200]);

    // UNA transicion de negocio.
    const despues = await prisma.task.findUniqueOrThrow({
      where: { id: tarea.id },
      select: { status: true },
    });
    expect(despues.status).toBe("DONE");

    expect(
      await prisma.auditLog.count({ where: { caseId: caso.id, action: "task.done" } }),
      "una transicion, una entrada de auditoria",
    ).toBe(1);

    await esperarAlMotor(regla.id, 1);
    expect(await execCountDe(regla.id), "un solo incremento").toBe(1);

    expect(
      await cuantosCorreos(page.request, E2E.disparadores.owner),
      "un solo correo al OWNER",
    ).toBe(antes.owner + 1);
    expect(
      await cuantosCorreos(page.request, E2E.disparadores.manager),
      "un solo correo al MANAGER",
    ).toBe(antes.manager + 1);
  });

  test("dos peticiones EN CONFLICTO: la perdedora no escribe, y se le dice", async ({
    page,
  }) => {
    /*
     * ESTA ES LA PRUEBA QUE FALLA EN EL CODIGO ANTERIOR.
     *
     * Antes: la perdedora escribia su estado igualmente. La base quedaba en
     * EN CURSO, la auditoria decia HECHA, el flujo se habia ejecutado para
     * HECHA, y las dos peticiones respondian 200.
     */
    const regla = await reglaDeAviso("TASK_STATUS_CHANGED");
    const caso = await casoDisp();
    const tarea = await tareaDisp();
    expect(tarea.status).toBe("PENDING");

    const antes = {
      owner: await cuantosCorreos(page.request, E2E.disparadores.owner),
      manager: await cuantosCorreos(page.request, E2E.disparadores.manager),
    };

    await login(page, E2E.disparadores.owner);

    const [a, b] = await Promise.all([
      page.request.patch(`/api/cases/${caso.id}/tasks`, {
        data: { taskId: tarea.id, status: "DONE" },
        failOnStatusCode: false,
      }),
      page.request.patch(`/api/cases/${caso.id}/tasks`, {
        data: { taskId: tarea.id, status: "IN_PROGRESS" },
        failOnStatusCode: false,
      }),
    ]);

    // Una gana con 200; la otra se rechaza con 409 y dice el estado real.
    const codigos = [a.status(), b.status()].sort();
    expect(codigos, "una aplicada, una rechazada por conflicto").toEqual([200, 409]);

    const conflicto = a.status() === 409 ? a : b;
    const cuerpoConflicto = (await conflicto.json()) as {
      error?: string;
      currentStatus?: string;
    };
    expect(cuerpoConflicto.error, "el 409 explica que ha pasado").toBeTruthy();
    expect(
      ["DONE", "IN_PROGRESS"],
      "el 409 devuelve el estado real para que el cliente se refresque",
    ).toContain(cuerpoConflicto.currentStatus);

    // LO QUE DE VERDAD IMPORTA: el estado final es el de quien GANO, y su
    // auditoria existe. No hay escritura sin registro.
    const despues = await prisma.task.findUniqueOrThrow({
      where: { id: tarea.id },
      select: { status: true },
    });
    const ganador = a.status() === 200 ? "DONE" : "IN_PROGRESS";
    expect(despues.status, "manda quien gano la reclamacion").toBe(ganador);
    expect(cuerpoConflicto.currentStatus).toBe(ganador);

    // Exactamente UNA entrada de auditoria, y es la del estado que hay.
    const auditorias = await prisma.auditLog.findMany({
      where: { caseId: caso.id, action: { startsWith: "task." } },
      select: { action: true },
    });
    expect(auditorias, "una transicion, una auditoria").toHaveLength(1);
    expect(auditorias[0].action).toBe(`task.${ganador.toLowerCase()}`);

    // Un solo flujo, un solo incremento, un correo por destinatario.
    await esperarAlMotor(regla.id, 1);
    expect(await execCountDe(regla.id)).toBe(1);
    expect(await cuantosCorreos(page.request, E2E.disparadores.owner)).toBe(antes.owner + 1);
    expect(await cuantosCorreos(page.request, E2E.disparadores.manager)).toBe(
      antes.manager + 1,
    );
  });

  test("la perdedora tampoco escribe los OTROS campos", async ({ page }) => {
    /*
     * El 409 rechaza la peticion ENTERA, no sólo el estado. Quien pidió el
     * cambio lo pidió sobre una pantalla que ya no refleja la realidad: sus
     * demás campos se apoyan en la misma lectura obsoleta.
     */
    const caso = await casoDisp();
    const tarea = await tareaDisp();
    const tituloOriginal = E2E.disparadores.tarea;

    await login(page, E2E.disparadores.owner);

    const [a, b] = await Promise.all([
      page.request.patch(`/api/cases/${caso.id}/tasks`, {
        data: { taskId: tarea.id, status: "DONE" },
        failOnStatusCode: false,
      }),
      page.request.patch(`/api/cases/${caso.id}/tasks`, {
        data: { taskId: tarea.id, status: "IN_PROGRESS", title: "TITULO-OBSOLETO-E2E" },
        failOnStatusCode: false,
      }),
    ]);
    expect([a.status(), b.status()].sort()).toEqual([200, 409]);

    const despues = await prisma.task.findUniqueOrThrow({
      where: { id: tarea.id },
      select: { title: true },
    });
    // Si la perdedora fue la que traía el titulo, no se ha escrito.
    if (b.status() === 409) {
      expect(despues.title, "una peticion rechazada no escribe nada").toBe(tituloOriginal);
    }
  });

  test("sin cambio de estado no hay conflicto posible", async ({ page }) => {
    // Un PATCH que sólo toca otros campos no compite por la transicion.
    const caso = await casoDisp();
    const tarea = await tareaDisp();

    await login(page, E2E.disparadores.owner);
    const res = await page.request.patch(`/api/cases/${caso.id}/tasks`, {
      data: { taskId: tarea.id, description: "Nota puesta sin tocar el estado" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(200);

    const despues = await prisma.task.findUniqueOrThrow({
      where: { id: tarea.id },
      select: { status: true, description: true },
    });
    expect(despues.status, "el estado no se mueve").toBe("PENDING");
    expect(despues.description).toBe("Nota puesta sin tocar el estado");
    expect(
      await prisma.auditLog.count({ where: { caseId: caso.id, action: { startsWith: "task." } } }),
      "sin transicion no hay auditoria de transicion",
    ).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPEDIENTES
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Concurrencia: estado de EXPEDIENTE", () => {
  test.afterEach(limpiar);

  test("dos peticiones IDENTICAS: una sola transicion de negocio", async ({ page }) => {
    const regla = await reglaDeAviso("CASE_STATUS_CHANGED");
    const caso = await casoDisp();
    expect(caso.status, "punto de partida").toBe("IN_PROGRESS");

    const antes = {
      owner: await cuantosCorreos(page.request, E2E.disparadores.owner),
      manager: await cuantosCorreos(page.request, E2E.disparadores.manager),
    };

    await login(page, E2E.disparadores.owner);

    const cuerpo = { status: "FOLLOW_UP" };
    const [a, b] = await Promise.all([
      page.request.patch(`/api/cases/${caso.id}`, { data: cuerpo, failOnStatusCode: false }),
      page.request.patch(`/api/cases/${caso.id}`, { data: cuerpo, failOnStatusCode: false }),
    ]);
    expect([a.status(), b.status()].sort()).toEqual([200, 200]);

    const despues = await prisma.case.findUniqueOrThrow({
      where: { id: caso.id },
      select: { status: true },
    });
    expect(despues.status).toBe("FOLLOW_UP");

    const auditorias = await prisma.auditLog.findMany({
      where: { caseId: caso.id, action: "case.status_changed" },
      select: { details: true },
    });
    expect(auditorias, "una transicion, una auditoria").toHaveLength(1);
    expect(auditorias[0].details).toBe("IN_PROGRESS -> FOLLOW_UP");

    await esperarAlMotor(regla.id, 1);
    expect(await execCountDe(regla.id)).toBe(1);
    expect(await cuantosCorreos(page.request, E2E.disparadores.owner)).toBe(antes.owner + 1);
    expect(await cuantosCorreos(page.request, E2E.disparadores.manager)).toBe(
      antes.manager + 1,
    );
  });

  test("dos peticiones EN CONFLICTO: no hay sobreescritura silenciosa", async ({ page }) => {
    /*
     * El mismo hueco que en tareas: la ruta leia el expediente, escribia sin
     * condicion y decidia DESPUES si habia habido transicion usando el estado
     * leido antes. Las dos peticiones podian afirmar que venian de
     * IN_PROGRESS cuando sólo una lo hizo.
     */
    const regla = await reglaDeAviso("CASE_STATUS_CHANGED");
    const caso = await casoDisp();
    expect(caso.status).toBe("IN_PROGRESS");

    const antes = {
      owner: await cuantosCorreos(page.request, E2E.disparadores.owner),
      manager: await cuantosCorreos(page.request, E2E.disparadores.manager),
    };

    await login(page, E2E.disparadores.owner);

    const [a, b] = await Promise.all([
      page.request.patch(`/api/cases/${caso.id}`, {
        data: { status: "FOLLOW_UP" },
        failOnStatusCode: false,
      }),
      page.request.patch(`/api/cases/${caso.id}`, {
        data: { status: "CLOSED" },
        failOnStatusCode: false,
      }),
    ]);

    const codigos = [a.status(), b.status()].sort();
    expect(codigos, "una aplicada, una rechazada por conflicto").toEqual([200, 409]);

    const conflicto = a.status() === 409 ? a : b;
    const cuerpoConflicto = (await conflicto.json()) as {
      error?: string;
      currentStatus?: string;
    };
    expect(cuerpoConflicto.error).toBeTruthy();

    const despues = await prisma.case.findUniqueOrThrow({
      where: { id: caso.id },
      select: { status: true },
    });
    const ganador = a.status() === 200 ? "FOLLOW_UP" : "CLOSED";
    expect(despues.status, "manda quien gano la reclamacion").toBe(ganador);
    expect(cuerpoConflicto.currentStatus).toBe(ganador);

    // Una sola auditoria, y su detalle dice la transicion VERDADERA.
    const auditorias = await prisma.auditLog.findMany({
      where: { caseId: caso.id, action: "case.status_changed" },
      select: { details: true },
    });
    expect(auditorias, "una transicion, una auditoria").toHaveLength(1);
    expect(
      auditorias[0].details,
      "nadie puede afirmar que venia de IN_PROGRESS si no fue asi",
    ).toBe(`IN_PROGRESS -> ${ganador}`);

    await esperarAlMotor(regla.id, 1);
    expect(await execCountDe(regla.id)).toBe(1);
    expect(await cuantosCorreos(page.request, E2E.disparadores.owner)).toBe(antes.owner + 1);
    expect(await cuantosCorreos(page.request, E2E.disparadores.manager)).toBe(
      antes.manager + 1,
    );
  });

  test("un PATCH que no toca el estado no compite", async ({ page }) => {
    const caso = await casoDisp();
    await login(page, E2E.disparadores.owner);

    const res = await page.request.patch(`/api/cases/${caso.id}`, {
      data: { notes: "Nota de concurrencia E2E" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(200);

    const despues = await prisma.case.findUniqueOrThrow({
      where: { id: caso.id },
      select: { status: true, notes: true },
    });
    expect(despues.status).toBe("IN_PROGRESS");
    expect(despues.notes).toBe("Nota de concurrencia E2E");
    expect(
      await prisma.auditLog.count({
        where: { caseId: caso.id, action: "case.status_changed" },
      }),
    ).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LA INTERFAZ ANTE UN 409
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Concurrencia: la pantalla no finge que se guardo", () => {
  test.afterEach(limpiar);

  test("un 409 al mover una tarea se avisa y la pantalla vuelve al estado real", async ({
    page,
  }) => {
    const caso = await casoDisp();
    const tarea = await tareaDisp();

    await login(page, E2E.disparadores.owner);
    await page.goto(`/cases/${caso.id}`);
    await pantallaUtil(page);
    const pestana = page.getByRole("button", { name: /^Tareas \(/ });
    await expect(pestana).toBeVisible({ timeout: 30_000 });
    await pestana.click();

    const selector = page.getByLabel(`Estado de ${E2E.disparadores.tarea}`);
    await expect(selector).toBeVisible({ timeout: 30_000 });
    await expect(selector).toHaveValue("PENDING");

    /*
     * Se simula el conflicto respondiendo 409 como haria el servidor si otra
     * persona hubiera movido la tarea entre que se pinto la pantalla y el
     * clic. Lo que se comprueba es la reaccion de la interfaz.
     */
    await page.route("**/api/cases/*/tasks", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              error: "La tarea ha cambiado de estado mientras tanto. Actualiza la pagina.",
              currentStatus: "DONE",
            }),
          })
        : route.continue(),
    );

    await selector.selectOption("IN_PROGRESS");

    // NO se puede dar por guardado.
    const aviso = page.getByTestId("conflicto-tarea");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("ha cambiado");

    // Y la pantalla no se queda mostrando un estado que el servidor rechazo.
    await expect(selector).not.toHaveValue("IN_PROGRESS");

    // La base no se ha tocado: era un 409.
    const despues = await prisma.task.findUniqueOrThrow({
      where: { id: tarea.id },
      select: { status: true },
    });
    expect(despues.status).toBe("PENDING");

    await page.unroute("**/api/cases/*/tasks");
  });
});
