/**
 * Los tres huecos que quedaban de la fase de automatizaciones:
 *
 *   1. «Probar regla» con CORREO REAL, comprobado en el buzon de pruebas.
 *   2. Disparo AUTOMATICO de `TASK_STATUS_CHANGED`, `CASE_CREATED` y
 *      `DOCUMENT_UPLOADED`, conducidos desde el navegador.
 *   3. Idempotencia del motor: evento duplicado, concurrencia, repeticion
 *      legitima y reclamacion por destinatario.
 *
 * POR QUE HACIA FALTA TOCAR EL PRODUCTO PARA PROBAR ESTO
 * -----------------------------------------------------
 * Al ir a escribir las pruebas de idempotencia salio el defecto de fondo:
 * `WorkflowEvent.eventKey` existia y **ningun emisor real lo pasaba**. Los
 * siete caian en la ventana temporal de cinco minutos, que como identidad
 * falla en las dos direcciones:
 *
 *   - `DOCUMENT_UPLOADED` no llevaba NADA del documento, asi que tres
 *     documentos subidos al mismo expediente en cinco minutos ejecutaban la
 *     automatizacion UNA vez;
 *   - `TASK_STATUS_CHANGED` no distinguia dos transiciones iguales, asi que
 *     una repeticion legitima se tragaba.
 *
 * Estas pruebas fallan sin esa correccion. Ver `claveDeEvento` en
 * `src/lib/workflow-engine.ts`.
 *
 * NADA SE SIMULA
 * --------------
 * El correo va al SMTP de pruebas que arranca `scripts/e2e.sh` y se lee de su
 * buzon HTTP. Los documentos van a MinIO real. Ninguna prueba llama a
 * `triggerWorkflow` a mano: los eventos los provoca la interfaz.
 */
import { type Page, type APIRequestContext } from "@playwright/test";
import { test, expect, pantallaUtil, permitirFalloEn } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./seed-e2e";
import { exigirAlmacen, objetoExiste } from "./almacen";

const prisma = new PrismaClient();
const BANDEJA = process.env.BANDEJA_URL ?? "http://127.0.0.1:8025";

/** PDF minimo valido: el mismo que usa la suite de documentos. */
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/MediaBox[0 0 99 9]/Parent 2 0 R>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
  "latin1",
);

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

async function orgDisp() {
  return prisma.organization.findUniqueOrThrow({
    where: { slug: E2E.disparadores.slug },
    select: { id: true },
  });
}

async function casoDisp(ref = E2E.disparadores.caseRef) {
  return prisma.case.findFirstOrThrow({ where: { ref }, select: { id: true, status: true } });
}

// ─── Buzon de pruebas ──────────────────────────────────────────────────────

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

async function cuantosCorreos(api: APIRequestContext, destinatario: string): Promise<number> {
  return (await bandeja(api, destinatario)).length;
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
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(
    `No han llegado ${minimo} correo(s) a ${destinatario} en el tiempo previsto (hay ${ultimos.length}).`,
  );
}

/**
 * Comprueba que a un destinatario NO le ha llegado nada nuevo.
 *
 * Con margen: un correo que fuera a salir ya habria salido. Afirmarlo sin
 * esperar solo demostraria que la comprobacion se hizo antes de tiempo.
 */
async function seguirSinCorreo(
  api: APIRequestContext,
  destinatario: string,
  antes: number,
  motivo: string,
) {
  await new Promise((r) => setTimeout(r, 1500));
  expect(await cuantosCorreos(api, destinatario), motivo).toBe(antes);
}

// ─── Reglas creadas por la interfaz ────────────────────────────────────────

/**
 * Crea una regla recorriendo el formulario REAL, campo a campo.
 *
 * No se inserta en PostgreSQL: el encargo pide que la regla se cree por la
 * interfaz, y ademas asi se comprueba de paso que el formulario sabe guardar
 * cada combinacion de disparador y accion.
 */
async function crearRegla(
  page: Page,
  opciones: {
    nombre: string;
    disparador: string;
    accion: string;
    asunto?: string;
    cuerpo?: string;
    comentario?: string;
    estadoTarea?: string;
  },
) {
  await page.getByTestId("nueva-regla").click();
  await expect(page.getByTestId("modal-regla")).toBeVisible();

  await page.getByLabel("Nombre").fill(opciones.nombre);
  await page.getByLabel("Disparador (cuando…)").selectOption(opciones.disparador);
  await page.getByLabel("Acción (entonces…)").selectOption(opciones.accion);

  if (opciones.estadoTarea) {
    await page.getByLabel("Hacia estado de tarea (opcional)").selectOption(opciones.estadoTarea);
  }
  if (opciones.asunto !== undefined) {
    await page.getByLabel("Asunto del email").fill(opciones.asunto);
  }
  if (opciones.cuerpo !== undefined) {
    await page.getByLabel("Cuerpo del mensaje").fill(opciones.cuerpo);
  }
  if (opciones.comentario !== undefined) {
    await page.getByLabel("Texto del comentario").fill(opciones.comentario);
  }

  await page.getByTestId("guardar-regla").click();

  /*
   * Si el guardado falla, el modal se queda abierto y la espera de abajo
   * agotaria el tiempo sin decir por que. Se mira primero el aviso de error,
   * que es donde el servidor explica que ha rechazado.
   */
  const avisoError = page.getByTestId("error-guardar-regla");
  if ((await avisoError.count()) > 0) {
    expect(await avisoError.innerText(), "el formulario no ha podido guardar la regla").toBe("");
  }
  await expect(page.getByTestId("modal-regla")).toHaveCount(0);
  await expect(page.getByText(opciones.nombre)).toBeVisible();
}

/** Borra las reglas y ejecuciones que crean las pruebas de este fichero. */
async function limpiar() {
  const org = await orgDisp();
  await prisma.workflowLog.deleteMany({ where: { rule: { orgId: org.id } } });
  await prisma.workflowRule.deleteMany({ where: { orgId: org.id } });
}

/** Devuelve las tareas del expediente principal a PENDIENTE. */
async function restaurarTareas() {
  const caso = await casoDisp();
  await prisma.task.updateMany({
    where: { caseId: caso.id },
    data: { status: "PENDING" },
  });
}

/**
 * Abre la ficha del expediente y su pestana TAREAS.
 *
 * Los controles de tarea viven dentro de esa pestana: sin abrirla, el
 * `<select>` de estado no esta en el DOM.
 */
async function abrirTareas(page: Page) {
  const caso = await casoDisp();
  await page.goto(`/cases/${caso.id}`);
  await pantallaUtil(page);
  const pestana = page.getByRole("button", { name: /^Tareas \(/ });
  await expect(pestana).toBeVisible({ timeout: 30_000 });
  await pestana.click();
  return caso;
}

/** Cambia el estado de una tarea por el control REAL de la ficha. */
async function cambiarEstadoTarea(page: Page, tarea: string, estado: string) {
  const selector = page.getByLabel(`Estado de ${tarea}`);
  await expect(selector).toBeVisible({ timeout: 30_000 });
  await selector.scrollIntoViewIfNeeded();
  await Promise.all([
    page.waitForResponse(
      (r) => /\/api\/cases\/[^/]+\/tasks/.test(r.url()) && r.request().method() === "PATCH",
    ),
    selector.selectOption(estado),
  ]);
}

async function reglaEnBase(nombre: string) {
  return prisma.workflowRule.findFirstOrThrow({
    where: { name: nombre },
    select: { id: true, execCount: true, lastRunAt: true },
  });
}

async function ejecucionesDe(nombre: string) {
  return prisma.workflowLog.findMany({
    where: { rule: { name: nombre } },
    select: { id: true, status: true, caseId: true, idempotencyKey: true },
    orderBy: { createdAt: "asc" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. «PROBAR REGLA» CON CORREO REAL
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Probar regla: correo real por el buzon de pruebas", () => {
  test.afterEach(limpiar);

  test("SEND_EMAIL_CONTACT llega al contacto del expediente, con asunto y cuerpo interpolados", async ({
    page,
  }) => {
    const nombre = "Aviso al contacto (probar)";
    const antes = await cuantosCorreos(page.request, E2E.disparadores.contacto);

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "CASE_STATUS_CHANGED",
      accion: "SEND_EMAIL_CONTACT",
      asunto: "Su expediente {{case.ref}}",
      cuerpo: "Hola {{contact.fullName}}, el expediente de {{deceased.fullName}} sigue su curso.",
    });

    // El modal, conducido como una persona: buscar, pulsar el resultado real
    // y ejecutar. Se espera a la RESPUESTA del servidor, no a un tiempo fijo.
    await page.getByRole("button", { name: `Probar regla ${nombre}` }).click();
    await page.getByLabel("Buscar expediente").fill(E2E.disparadores.caseRef);
    await page.getByRole("button", { name: new RegExp(E2E.disparadores.caseRef) }).click();

    const [respuesta] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/test") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Ejecutar regla" }).click(),
    ]);
    expect(respuesta.status()).toBe(200);
    const cuerpoRespuesta = (await respuesta.json()) as { success: boolean; status: string };
    expect(cuerpoRespuesta.success, "el servidor confirma la ejecucion").toBe(true);
    expect(cuerpoRespuesta.status).toBe("SUCCESS");

    // El exito se anuncia DESPUES del exito del servidor, no antes.
    await expect(page.getByTestId("exito-ejecutar-regla")).toBeVisible();

    // ── LA EVIDENCIA: el buzon ──
    const correos = await esperarCorreos(page.request, E2E.disparadores.contacto, antes + 1);
    expect(correos.length, "exactamente un correo, ni dos").toBe(antes + 1);
    const ultimo = correos[correos.length - 1];
    expect(ultimo.para).toContain(E2E.disparadores.contacto);
    expect(ultimo.asunto).toContain(`Su expediente ${E2E.disparadores.caseRef}`);
    // Interpolacion real de los dos marcadores del cuerpo.
    expect(ultimo.cuerpo).toContain(E2E.disparadores.contactoNombre);
    expect(ultimo.cuerpo).toContain(E2E.disparadores.causante);
    expect(ultimo.cuerpo).not.toContain("{{");

    // ── El registro ──
    const ejecuciones = await ejecucionesDe(nombre);
    expect(ejecuciones).toHaveLength(1);
    expect(ejecuciones[0].status).toBe("SUCCESS");

    const entregas = await prisma.workflowDelivery.findMany({
      where: { workflowLogId: ejecuciones[0].id },
      select: { recipient: true, status: true, attempts: true },
    });
    expect(entregas).toHaveLength(1);
    expect(entregas[0].recipient).toBe(E2E.disparadores.contacto);
    expect(entregas[0].status).toBe("SENT");

    const regla = await reglaEnBase(nombre);
    expect(regla.execCount).toBe(1);
    expect(regla.lastRunAt).not.toBeNull();
  });

  test("SEND_EMAIL_TEAM llega a OWNER y MANAGER, y a nadie mas", async ({ page }) => {
    const nombre = "Aviso al equipo (probar)";
    const antes = {
      owner: await cuantosCorreos(page.request, E2E.disparadores.owner),
      manager: await cuantosCorreos(page.request, E2E.disparadores.manager),
      operador: await cuantosCorreos(page.request, E2E.disparadores.operador),
      viewer: await cuantosCorreos(page.request, E2E.disparadores.viewer),
    };

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "CASE_STATUS_CHANGED",
      accion: "SEND_EMAIL_TEAM",
      asunto: "Equipo: {{case.ref}}",
      cuerpo: "Revisad {{case.ref}} en {{org.name}}.",
    });

    await page.getByRole("button", { name: `Probar regla ${nombre}` }).click();
    await page.getByLabel("Buscar expediente").fill(E2E.disparadores.caseRef);
    await page.getByRole("button", { name: new RegExp(E2E.disparadores.caseRef) }).click();
    const [respuesta] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/test") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Ejecutar regla" }).click(),
    ]);
    expect(((await respuesta.json()) as { success: boolean }).success).toBe(true);
    await expect(page.getByTestId("exito-ejecutar-regla")).toBeVisible();

    // Los DOS destinatarios reales del equipo, uno cada uno.
    const aOwner = await esperarCorreos(page.request, E2E.disparadores.owner, antes.owner + 1);
    const aManager = await esperarCorreos(
      page.request,
      E2E.disparadores.manager,
      antes.manager + 1,
    );
    expect(aOwner.length, "un solo correo al OWNER").toBe(antes.owner + 1);
    expect(aManager.length, "un solo correo al MANAGER").toBe(antes.manager + 1);
    expect(aOwner[aOwner.length - 1].asunto).toContain(`Equipo: ${E2E.disparadores.caseRef}`);
    expect(aManager[aManager.length - 1].cuerpo).toContain(E2E.disparadores.orgNombre);

    // Y a quien NO le corresponde, no le llega.
    await seguirSinCorreo(
      page.request,
      E2E.disparadores.operador,
      antes.operador,
      "un OPERATOR no es destinatario del aviso al equipo",
    );
    await seguirSinCorreo(
      page.request,
      E2E.disparadores.viewer,
      antes.viewer,
      "un VIEWER no es destinatario del aviso al equipo",
    );

    // Una fila de entrega por destinatario, sin duplicados.
    const ejecuciones = await ejecucionesDe(nombre);
    expect(ejecuciones).toHaveLength(1);
    const entregas = await prisma.workflowDelivery.findMany({
      where: { workflowLogId: ejecuciones[0].id },
      select: { recipient: true, status: true },
    });
    expect(entregas.map((e) => e.recipient).sort()).toEqual(
      [E2E.disparadores.manager, E2E.disparadores.owner].sort(),
    );
    expect(entregas.every((e) => e.status === "SENT")).toBe(true);

    const regla = await reglaEnBase(nombre);
    expect(regla.execCount).toBe(1);
  });

  test("si el envio falla, el modal NO anuncia exito y el registro lo dice", async ({ page }) => {
    /*
     * El fallo se provoca donde de verdad ocurre: en el proveedor. La regla
     * apunta a un expediente cuyo contacto NO tiene correo, asi que el motor
     * no tiene a quien enviar y omite la accion.
     *
     * Antes este camino tambien salia como «Ejecutado correctamente»: el
     * endpoint respondia `success: true` sin mirar nada.
     */
    const nombre = "Aviso al contacto sin correo";
    const org = await orgDisp();
    const sinContacto = await prisma.case.create({
      data: {
        orgId: org.id,
        ref: "EXP-2026-7699",
        status: "IN_PROGRESS",
        deceased: { create: { fullName: "Causante Sin Contacto E2E" } },
      },
    });

    try {
      await login(page, E2E.disparadores.owner);
      await irAReglas(page);
      await crearRegla(page, {
        nombre,
        disparador: "CASE_STATUS_CHANGED",
        accion: "SEND_EMAIL_CONTACT",
        asunto: "No deberia salir",
        cuerpo: "No deberia salir",
      });

      await page.getByRole("button", { name: `Probar regla ${nombre}` }).click();
      await page.getByLabel("Buscar expediente").fill("EXP-2026-7699");
      await page.getByRole("button", { name: /EXP-2026-7699/ }).click();
      await page.getByRole("button", { name: "Ejecutar regla" }).click();

      // NO se anuncia exito.
      await expect(page.getByTestId("error-ejecutar-regla")).toBeVisible();
      await expect(page.getByTestId("exito-ejecutar-regla")).toHaveCount(0);

      // Y el registro dice la verdad: omitida, con su motivo.
      const ejecuciones = await prisma.workflowLog.findMany({
        where: { rule: { name: nombre } },
        select: { status: true, details: true },
      });
      expect(ejecuciones).toHaveLength(1);
      expect(ejecuciones[0].status).toBe("SKIPPED");
      expect(JSON.stringify(ejecuciones[0].details)).toContain("email de contacto");
    } finally {
      await prisma.case.delete({ where: { id: sinContacto.id } });
    }
  });

  test("si el servidor cae, el modal no finge que se ha enviado", async ({ page }) => {
    const nombre = "Aviso que no llega a salir";
    const antes = await cuantosCorreos(page.request, E2E.disparadores.contacto);

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "CASE_STATUS_CHANGED",
      accion: "SEND_EMAIL_CONTACT",
      asunto: "No sale",
      cuerpo: "No sale",
    });

    await page.getByRole("button", { name: `Probar regla ${nombre}` }).click();
    await page.getByLabel("Buscar expediente").fill(E2E.disparadores.caseRef);
    await page.getByRole("button", { name: new RegExp(E2E.disparadores.caseRef) }).click();

    permitirFalloEn(page, "/api/workflow-rules/");
    await page.route("**/api/workflow-rules/*/test", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.getByRole("button", { name: "Ejecutar regla" }).click();

    await expect(page.getByTestId("error-ejecutar-regla")).toContainText("500");
    await expect(page.getByTestId("exito-ejecutar-regla")).toHaveCount(0);
    await seguirSinCorreo(
      page.request,
      E2E.disparadores.contacto,
      antes,
      "la peticion no llego al servidor: no puede haber salido ningun correo",
    );

    await page.unroute("**/api/workflow-rules/*/test");
  });

  test("pulsar «Probar» dos veces ejecuta dos veces, no una", async ({ page }) => {
    /*
     * EL DEFECTO: sin `eventKey`, la clave de la ejecucion caia en la ventana
     * de cinco minutos. La segunda pulsacion sobre el mismo expediente daba la
     * MISMA identidad, se descartaba por duplicada… y la pantalla decia
     * «Ejecutado correctamente» igual. Una prueba manual que no probaba nada.
     */
    const nombre = "Comentario de prueba manual";
    const caso = await casoDisp();

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "CASE_STATUS_CHANGED",
      accion: "ADD_CASE_COMMENT",
      comentario: "Comentario de la prueba manual E2E",
    });

    async function probarUnaVez() {
      await page.getByRole("button", { name: `Probar regla ${nombre}` }).click();
      await page.getByLabel("Buscar expediente").fill(E2E.disparadores.caseRef);
      await page.getByRole("button", { name: new RegExp(E2E.disparadores.caseRef) }).click();
      await page.getByRole("button", { name: "Ejecutar regla" }).click();
      await expect(page.getByTestId("exito-ejecutar-regla")).toBeVisible();
      await page.getByRole("button", { name: "Cerrar" }).click();
    }

    const comentariosAntes = await prisma.auditLog.count({
      where: { caseId: caso.id, action: "case.comment" },
    });

    await probarUnaVez();
    await probarUnaVez();

    // Dos pulsaciones, dos ejecuciones, dos comentarios.
    expect(await ejecucionesDe(nombre)).toHaveLength(2);
    expect(
      await prisma.auditLog.count({ where: { caseId: caso.id, action: "case.comment" } }),
    ).toBe(comentariosAntes + 2);
    expect((await reglaEnBase(nombre)).execCount).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. DISPARO AUTOMATICO: TASK_STATUS_CHANGED
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Disparo automatico: TASK_STATUS_CHANGED", () => {
  test.afterEach(async () => {
    await limpiar();
    await restaurarTareas();
  });

  test("mover la tarea a EN CURSO desde la ficha ejecuta la regla UNA vez", async ({ page }) => {
    const nombre = "Comentar al mover la tarea";
    const texto = "La tarea ha empezado (E2E)";

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "TASK_STATUS_CHANGED",
      accion: "ADD_CASE_COMMENT",
      comentario: texto,
    });

    const caso = await abrirTareas(page);
    const comentariosAntes = await prisma.auditLog.count({
      where: { caseId: caso.id, action: "case.comment" },
    });

    await cambiarEstadoTarea(page, E2E.disparadores.tarea, "IN_PROGRESS");

    // El efecto de negocio, comprobado APARTE del registro.
    await expect(async () => {
      const comentario = await prisma.auditLog.findFirst({
        where: { caseId: caso.id, action: "case.comment" },
        orderBy: { createdAt: "desc" },
      });
      expect(comentario?.details).toContain(texto);
    }).toPass({ timeout: 20_000 });

    expect(
      await prisma.auditLog.count({ where: { caseId: caso.id, action: "case.comment" } }),
      "un solo comentario",
    ).toBe(comentariosAntes + 1);

    const ejecuciones = await ejecucionesDe(nombre);
    expect(ejecuciones, "una sola ejecucion registrada").toHaveLength(1);
    expect(ejecuciones[0].status).toBe("SUCCESS");

    const regla = await reglaEnBase(nombre);
    expect(regla.execCount).toBe(1);
    expect(regla.lastRunAt).not.toBeNull();

    // Y sigue ahi tras recargar: no era estado de pantalla.
    await page.reload();
    await pantallaUtil(page);
    expect(await ejecucionesDe(nombre)).toHaveLength(1);
  });

  test("la condicion de ESTADO acota: entra la transicion pedida y no otra", async ({ page }) => {
    const nombre = "Solo cuando la tarea se completa";
    const texto = "Tarea completada (E2E)";

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "TASK_STATUS_CHANGED",
      accion: "ADD_CASE_COMMENT",
      comentario: texto,
      estadoTarea: "DONE",
    });

    await abrirTareas(page);

    // NEGATIVO: pasar a EN CURSO no cumple la condicion.
    await cambiarEstadoTarea(page, E2E.disparadores.tarea, "IN_PROGRESS");
    await new Promise((r) => setTimeout(r, 1500));
    expect(await ejecucionesDe(nombre), "IN_PROGRESS no dispara una regla de DONE").toHaveLength(
      0,
    );

    // POSITIVO: completarla si.
    await cambiarEstadoTarea(page, E2E.disparadores.tarea, "DONE");
    /*
     * El estado se comprueba DENTRO de la espera: la fila se crea en
     * PROCESSING y pasa a SUCCESS un instante despues. Afirmarlo fuera era
     * una carrera contra ese paso.
     */
    await expect(async () => {
      const logs = await ejecucionesDe(nombre);
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe("SUCCESS");
    }).toPass({ timeout: 20_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. DISPARO AUTOMATICO: CASE_CREATED
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Disparo automatico: CASE_CREATED", () => {
  test.afterEach(limpiar);

  test("dar de alta un expediente por el asistente ejecuta la regla UNA vez", async ({ page }) => {
    const nombre = "Comentar al crear el expediente";
    const texto = "Expediente recien creado (E2E)";
    const causante = `Fallecido Disparador ${Date.now().toString().slice(-6)}`;

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    // La regla PRIMERO: si se crea despues, el evento ya habria pasado.
    await crearRegla(page, {
      nombre,
      disparador: "CASE_CREATED",
      accion: "ADD_CASE_COMMENT",
      comentario: texto,
    });

    // ── El alta, por el asistente real de cinco pasos ──
    await page.goto("/cases");
    await pantallaUtil(page);
    await page.getByRole("link", { name: "Nuevo expediente" }).click();
    await page.waitForURL("**/cases/new", { timeout: 30_000 });

    await page.getByLabel("Nombre del fallecido").fill(causante);
    await page.getByLabel("Fecha aproximada de fallecimiento").fill("2026-05-10");
    await page.getByLabel("DNI del fallecido").fill("12345678Z");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("heading", { name: /Datos del solicitante/i })).toBeVisible();
    await page.getByLabel("Nombre del solicitante").fill("Solicitante Disparador E2E");
    await page.getByLabel("Telefono de contacto").fill("600000000");
    await page.getByLabel("Email de contacto").fill("solicitante.disp.e2e@ejemplo.test");
    await page.getByLabel("Relacion con el fallecido").selectOption("Hijo/a");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("heading", { name: /Detalles del expediente/i })).toBeVisible();
    await page.getByLabel("Provincia").fill("Madrid");
    await page.getByRole("checkbox", { name: "Bancos" }).check();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("heading", { name: /Plantilla de tareas/i })).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("heading", { name: /Consentimiento/i })).toBeVisible();
    await page.getByRole("checkbox", { name: /Confirmo que actuo/ }).check();
    await page.getByRole("checkbox", { name: /Acepto los terminos/ }).check();
    await page.getByRole("button", { name: "Crear expediente" }).click();

    await page.waitForURL(/\/cases\/(?!new|import|kanban)[^/]+$/, { timeout: 45_000 });
    const nuevoId = page.url().split("/").pop()!;

    try {
      // ── El EFECTO, comprobado aparte del registro ──
      await expect(async () => {
        const comentario = await prisma.auditLog.findFirst({
          where: { caseId: nuevoId, action: "case.comment" },
          orderBy: { createdAt: "desc" },
        });
        expect(comentario?.details).toContain(texto);
      }).toPass({ timeout: 20_000 });

      expect(
        await prisma.auditLog.count({ where: { caseId: nuevoId, action: "case.comment" } }),
        "un solo comentario por un solo alta",
      ).toBe(1);

      // ── Y el registro ──
      const ejecuciones = await ejecucionesDe(nombre);
      expect(ejecuciones).toHaveLength(1);
      expect(ejecuciones[0].caseId).toBe(nuevoId);
      expect(ejecuciones[0].status).toBe("SUCCESS");

      const regla = await reglaEnBase(nombre);
      expect(regla.execCount).toBe(1);
      expect(regla.lastRunAt).not.toBeNull();
    } finally {
      await prisma.workflowLog.deleteMany({ where: { caseId: nuevoId } });
      await prisma.auditLog.deleteMany({ where: { caseId: nuevoId } });
      await prisma.case.delete({ where: { id: nuevoId } }).catch(() => {
        // Si el alta creo tareas o documentos, el borrado en cascada del
        // esquema se encarga; si no se puede, no es lo que prueba este test.
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. DISPARO AUTOMATICO: DOCUMENT_UPLOADED (MinIO real)
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Disparo automatico: DOCUMENT_UPLOADED", () => {
  test.beforeAll(async () => {
    // Sin almacen real esta prueba NO se sustituye por un doble: se exige.
    await exigirAlmacen();
  });

  test.afterEach(async () => {
    await limpiar();
    const caso = await casoDisp();
    const docs = await prisma.document.findMany({
      where: { caseId: caso.id },
      select: { id: true },
    });
    if (docs.length > 0) {
      await prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
    }
  });

  async function subirDesdeFicha(page: Page, nombre: string) {
    await page.getByLabel("Subir documento").setInputFiles({
      name: nombre,
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });
  }

  async function abrirDocumentos(page: Page) {
    const caso = await casoDisp();
    await page.goto(`/cases/${caso.id}`);
    await pantallaUtil(page);
    const pestana = page.getByRole("button", { name: /^Documentos \(/ });
    await expect(pestana).toBeVisible({ timeout: 30_000 });
    await pestana.click();
    return caso;
  }

  test("subir un documento desde la ficha ejecuta la regla y el objeto esta en el bucket", async ({
    page,
  }) => {
    const nombre = "Comentar al recibir documento";
    const texto = "Documento recibido (E2E)";
    const archivo = `DISP-E2E-${Date.now().toString().slice(-7)}.pdf`;

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "DOCUMENT_UPLOADED",
      accion: "ADD_CASE_COMMENT",
      comentario: texto,
    });

    const caso = await abrirDocumentos(page);
    const comentariosAntes = await prisma.auditLog.count({
      where: { caseId: caso.id, action: "case.comment" },
    });

    await subirDesdeFicha(page, archivo);
    await expect(page.getByText(archivo)).toBeVisible({ timeout: 45_000 });

    // ── El objeto EXISTE de verdad en MinIO ──
    const fila = await prisma.document.findFirstOrThrow({
      where: { fileName: archivo },
      select: { id: true, fileKey: true },
    });
    expect(await objetoExiste(fila.fileKey), "el objeto debe estar en el bucket").toBe(true);

    // ── El efecto de negocio ──
    await expect(async () => {
      const comentario = await prisma.auditLog.findFirst({
        where: { caseId: caso.id, action: "case.comment" },
        orderBy: { createdAt: "desc" },
      });
      expect(comentario?.details).toContain(texto);
    }).toPass({ timeout: 20_000 });
    expect(
      await prisma.auditLog.count({ where: { caseId: caso.id, action: "case.comment" } }),
    ).toBe(comentariosAntes + 1);

    // ── Y el registro ──
    const ejecuciones = await ejecucionesDe(nombre);
    expect(ejecuciones).toHaveLength(1);
    expect(ejecuciones[0].status).toBe("SUCCESS");
    const regla = await reglaEnBase(nombre);
    expect(regla.execCount).toBe(1);
    expect(regla.lastRunAt).not.toBeNull();
  });

  test("DOS documentos seguidos ejecutan la regla DOS veces", async ({ page }) => {
    /*
     * EL DEFECTO QUE ESTA PRUEBA VIGILA
     * ---------------------------------
     * El evento `DOCUMENT_UPLOADED` no llevaba NINGUN dato del documento, asi
     * que su identidad era `(org, regla, expediente, tipo, ventana de 5 min)`.
     * Subir dos documentos seguidos al mismo expediente —lo normal cuando la
     * familia manda la documentacion de golpe— ejecutaba la automatizacion UNA
     * sola vez, y el segundo documento no disparaba nada ni dejaba rastro de
     * por que. Con `eventKey: document:<id>` cada documento es un hecho.
     */
    const nombre = "Comentar por cada documento";
    const texto = "Documento recibido, uno por uno (E2E)";
    const sufijo = Date.now().toString().slice(-7);

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "DOCUMENT_UPLOADED",
      accion: "ADD_CASE_COMMENT",
      comentario: texto,
    });

    const caso = await abrirDocumentos(page);
    const comentariosAntes = await prisma.auditLog.count({
      where: { caseId: caso.id, action: "case.comment" },
    });

    const primero = `DISP-E2E-A-${sufijo}.pdf`;
    const segundo = `DISP-E2E-B-${sufijo}.pdf`;
    await subirDesdeFicha(page, primero);
    await expect(page.getByText(primero)).toBeVisible({ timeout: 45_000 });
    await subirDesdeFicha(page, segundo);
    await expect(page.getByText(segundo)).toBeVisible({ timeout: 45_000 });

    // Los dos objetos estan en el bucket.
    for (const archivo of [primero, segundo]) {
      const fila = await prisma.document.findFirstOrThrow({
        where: { fileName: archivo },
        select: { fileKey: true },
      });
      expect(await objetoExiste(fila.fileKey)).toBe(true);
    }

    // DOS ejecuciones y DOS comentarios: una por documento.
    await expect(async () => {
      expect(await ejecucionesDe(nombre)).toHaveLength(2);
    }).toPass({ timeout: 25_000 });

    expect(
      await prisma.auditLog.count({ where: { caseId: caso.id, action: "case.comment" } }),
      "un comentario por cada documento",
    ).toBe(comentariosAntes + 2);
    expect((await reglaEnBase(nombre)).execCount).toBe(2);

    // Y las dos ejecuciones tienen identidades distintas.
    const claves = (await ejecucionesDe(nombre)).map((e) => e.idempotencyKey);
    expect(new Set(claves).size, "dos hechos distintos, dos identidades").toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. IDEMPOTENCIA VISTA DESDE EL NAVEGADOR, CON CORREOS DE VERDAD
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Idempotencia conducida desde la interfaz", () => {
  test.afterEach(async () => {
    await limpiar();
    await restaurarTareas();
  });

  test("REPETICION LEGITIMA: la misma transicion dos veces en segundos avisa DOS veces", async ({
    page,
  }) => {
    /*
     * LA PRUEBA QUE FALLA CON EL DISEÑO ANTERIOR, Y LA QUE MAS IMPORTA.
     *
     * PENDIENTE -> EN CURSO, de vuelta a PENDIENTE, y otra vez EN CURSO. La
     * primera y la tercera son transiciones identicas salvo por CUANDO
     * ocurren, y ocurren con segundos de diferencia.
     *
     * Con la clave antigua —`(tarea, estado, ventana de 5 min)`— la tercera
     * era indistinguible de la primera: se descartaba por duplicada y el aviso
     * no salia. El gestor movia la tarea, veia el cambio en pantalla, y el
     * equipo no recibia nada. Sin error, sin registro, sin forma de saberlo.
     *
     * La evidencia es el BUZON: dos correos a cada destinatario, no uno.
     */
    const nombre = "Avisar al equipo cuando la tarea arranca";
    const antes = {
      owner: await cuantosCorreos(page.request, E2E.disparadores.owner),
      manager: await cuantosCorreos(page.request, E2E.disparadores.manager),
    };

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "TASK_STATUS_CHANGED",
      accion: "SEND_EMAIL_TEAM",
      asunto: "La tarea ha arrancado",
      cuerpo: "Expediente {{case.ref}}.",
      estadoTarea: "IN_PROGRESS",
    });

    await abrirTareas(page);

    // Ida…
    await cambiarEstadoTarea(page, E2E.disparadores.tarea, "IN_PROGRESS");
    await esperarCorreos(page.request, E2E.disparadores.owner, antes.owner + 1);
    // …vuelta (no cumple la condicion, no avisa)…
    await cambiarEstadoTarea(page, E2E.disparadores.tarea, "PENDING");
    // …y vuelta a ir. ESTA es la que se tragaba.
    await cambiarEstadoTarea(page, E2E.disparadores.tarea, "IN_PROGRESS");

    const aOwner = await esperarCorreos(page.request, E2E.disparadores.owner, antes.owner + 2);
    const aManager = await esperarCorreos(
      page.request,
      E2E.disparadores.manager,
      antes.manager + 2,
    );
    expect(aOwner.length, "dos transiciones legitimas, dos avisos al OWNER").toBe(antes.owner + 2);
    expect(aManager.length, "dos transiciones legitimas, dos avisos al MANAGER").toBe(
      antes.manager + 2,
    );

    // Dos ejecuciones, con identidades distintas.
    const ejecuciones = await ejecucionesDe(nombre);
    expect(ejecuciones).toHaveLength(2);
    expect(new Set(ejecuciones.map((e) => e.idempotencyKey)).size).toBe(2);
    expect((await reglaEnBase(nombre)).execCount).toBe(2);
  });

  test("EVENTO DUPLICADO: dos PATCH concurrentes iguales no duplican el aviso", async ({
    page,
  }) => {
    /*
     * Dos peticiones identicas y simultaneas a la ruta real de tareas. Es lo
     * que ocurre con un doble envio del cliente o un reintento de la capa de
     * transporte.
     *
     * La ruta solo emite el evento cuando el estado CAMBIA de verdad
     * (`status !== task.status`), asi que de las dos peticiones solo una
     * transiciona. La evidencia sigue siendo el buzon: un correo por
     * destinatario, no dos.
     */
    const nombre = "Avisar una sola vez";
    const antes = {
      owner: await cuantosCorreos(page.request, E2E.disparadores.owner),
      manager: await cuantosCorreos(page.request, E2E.disparadores.manager),
    };

    await login(page, E2E.disparadores.owner);
    await irAReglas(page);
    await crearRegla(page, {
      nombre,
      disparador: "TASK_STATUS_CHANGED",
      accion: "SEND_EMAIL_TEAM",
      asunto: "Solo una vez",
      cuerpo: "Expediente {{case.ref}}.",
      estadoTarea: "DONE",
    });

    const caso = await casoDisp();
    const tarea = await prisma.task.findFirstOrThrow({
      where: { caseId: caso.id, title: E2E.disparadores.tarea },
      select: { id: true },
    });
    // Punto de partida propio: otras pruebas del fichero mueven esta tarea.
    const auditoriaAntes = await prisma.auditLog.count({
      where: { caseId: caso.id, action: "task.done" },
    });

    // Las dos, a la vez, por la ruta real y con la sesion real del navegador.
    const cuerpo = { taskId: tarea.id, status: "DONE" };
    const respuestas = await Promise.all([
      page.request.patch(`/api/cases/${caso.id}/tasks`, { data: cuerpo }),
      page.request.patch(`/api/cases/${caso.id}/tasks`, { data: cuerpo }),
    ]);
    for (const r of respuestas) expect(r.status()).toBeLessThan(400);

    // Llega el aviso…
    await esperarCorreos(page.request, E2E.disparadores.owner, antes.owner + 1);

    // …y solo uno. Con margen para que un segundo, de haberlo, hubiera salido.
    await new Promise((r) => setTimeout(r, 2000));
    expect(
      await cuantosCorreos(page.request, E2E.disparadores.owner),
      "un solo aviso al OWNER pese a las dos peticiones",
    ).toBe(antes.owner + 1);
    expect(
      await cuantosCorreos(page.request, E2E.disparadores.manager),
      "un solo aviso al MANAGER pese a las dos peticiones",
    ).toBe(antes.manager + 1);

    // Y una sola entrada en la auditoria: la tarea transiciono UNA vez.
    expect(
      await prisma.auditLog.count({ where: { caseId: caso.id, action: "task.done" } }),
      "una transicion, una entrada de auditoria",
    ).toBe(auditoriaAntes + 1);

    // Una sola ejecucion, y una sola fila de entrega por destinatario.
    const ejecuciones = await ejecucionesDe(nombre);
    expect(ejecuciones, "una sola ejecucion").toHaveLength(1);
    const entregas = await prisma.workflowDelivery.findMany({
      where: { workflowLogId: ejecuciones[0].id },
      select: { recipient: true, status: true },
    });
    expect(entregas).toHaveLength(2);
    expect(entregas.every((e) => e.status === "SENT")).toBe(true);
    expect((await reglaEnBase(nombre)).execCount).toBe(1);
  });

  test("EJECUCION PARCIAL: quien ya lo recibio no lo recibe otra vez al reintentar", async ({
    page,
  }) => {
    /*
     * El limite para el que esta diseñada la arquitectura: la reserva ocurre
     * ANTES del envio externo.
     *
     * Se monta una ejecucion en la que un destinatario quedo SENT y el otro
     * FAILED —que es como queda tras una caida a medias— y se reintenta desde
     * la pantalla real de registro. El que ya lo tenia no debe recibir nada.
     */
    const nombre = "Aviso a medias";
    const caso = await casoDisp();
    const org = await orgDisp();

    const regla = await prisma.workflowRule.create({
      data: {
        orgId: org.id,
        name: nombre,
        trigger: "CASE_STATUS_CHANGED",
        conditions: {},
        action: "SEND_EMAIL_TEAM",
        actionConfig: { subject: "Aviso a medias", body: "Expediente {{case.ref}}." },
        isActive: true,
      },
    });
    const ahora = new Date();
    const log = await prisma.workflowLog.create({
      data: {
        ruleId: regla.id,
        caseId: caso.id,
        status: "PARTIAL",
        error: "SMTP 421: servicio no disponible",
        idempotencyKey: `e2e-parcial-${Date.now()}`,
      },
    });
    await prisma.workflowDelivery.createMany({
      data: [
        {
          workflowLogId: log.id,
          recipient: E2E.disparadores.owner,
          status: "SENT",
          attempts: 1,
          lastTriedAt: ahora,
          sentAt: ahora,
        },
        {
          workflowLogId: log.id,
          recipient: E2E.disparadores.manager,
          status: "FAILED",
          error: "SMTP 421: servicio no disponible",
          attempts: 1,
          lastTriedAt: ahora,
        },
      ],
    });

    const antes = {
      owner: await cuantosCorreos(page.request, E2E.disparadores.owner),
      manager: await cuantosCorreos(page.request, E2E.disparadores.manager),
    };

    await login(page, E2E.disparadores.owner);
    await page.goto("/workflow-logs");
    await pantallaUtil(page);
    await page.getByTestId(`reintentar-${log.id}`).click();
    await expect(page.getByTestId("reintento-exito")).toBeVisible();

    // El que fallo lo recibe…
    const aManager = await esperarCorreos(
      page.request,
      E2E.disparadores.manager,
      antes.manager + 1,
    );
    expect(aManager.length, "el destinatario fallido se recupera").toBe(antes.manager + 1);

    // …y el que ya lo tenia, NO.
    await seguirSinCorreo(
      page.request,
      E2E.disparadores.owner,
      antes.owner,
      "un destinatario en SENT no vuelve a recibir el mismo aviso",
    );

    // El estado agregado pasa a ser verdad, y los contadores son coherentes.
    const despues = await prisma.workflowLog.findUniqueOrThrow({
      where: { id: log.id },
      select: { status: true },
    });
    expect(despues.status).toBe("SUCCESS");

    const entregas = await prisma.workflowDelivery.findMany({
      where: { workflowLogId: log.id },
      select: { recipient: true, status: true, attempts: true },
      orderBy: { recipient: "asc" },
    });
    expect(entregas.every((e) => e.status === "SENT")).toBe(true);
    const delOwner = entregas.find((e) => e.recipient === E2E.disparadores.owner)!;
    const delManager = entregas.find((e) => e.recipient === E2E.disparadores.manager)!;
    expect(delOwner.attempts, "al que ya lo tenia no se le vuelve a intentar").toBe(1);
    expect(delManager.attempts, "al fallido si se le reintenta").toBeGreaterThan(1);
  });
});
