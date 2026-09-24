/**
 * ATOMICIDAD DE «CAMBIO DE ESTADO + AUDITORÍA», CONTRA POSTGRESQL REAL.
 *
 * QUÉ PRUEBA Y POR QUÉ NO BASTABA CON LO QUE HABÍA
 * -----------------------------------------------
 * `concurrencia-estados.spec.ts` demuestra que dos peticiones simultáneas
 * producen UNA transición con SU auditoría. Eso cubre el camino en el que todo
 * va bien. Queda el otro: **¿y si la auditoría no se puede escribir?**
 *
 * Hasta ahora las rutas hacían tres escrituras confirmadas por separado:
 *
 *     1. updateMany condicionado  -> el estado nuevo queda COMMITEADO
 *     2. update del resto de campos
 *     3. insert en AuditLog
 *
 * Un fallo en la 2 o en la 3 dejaba el estado cambiado y **ninguna fila que
 * dijera quién lo cambió, cuándo ni desde qué estado**. Y como la identidad
 * del evento ES esa fila, tampoco había evento, ni ejecución, ni aviso: la
 * automatización que el gestor había configurado simplemente no ocurría, en
 * silencio. En un expediente de herencia el histórico ES la prueba de lo que
 * se hizo, así que un estado sin su registro no es un registro incompleto: es
 * un estado que no se puede justificar ante nadie.
 *
 * CÓMO SE PROVOCA EL FALLO
 * ------------------------
 * No se mockea Prisma ni se falsea una respuesta. Se instala un **disparador
 * de PostgreSQL** que rechaza el INSERT en `"AuditLog"` para una acción
 * concreta. Quien aborta la transacción es la base de datos, y quien deshace
 * la transición es su propio ROLLBACK. Es lo más parecido a lo que ocurriría
 * de verdad si la escritura de auditoría fallara —una restricción, un disco
 * lleno, una desconexión a mitad—.
 *
 * Cada escenario va acompañado de su CONTROL: la misma petición sin el
 * disparador, que sí transiciona, sí audita, sí ejecuta la regla y sí manda el
 * correo. Sin el control, «no hay WorkflowLog» no probaría nada: podría no
 * haberlo porque la regla nunca llegó a encajar.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";

interface Identidad {
  userId: string;
  orgId: string | null;
}

const { identidad, correos } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AsyncLocalStorage } = require("node:async_hooks") as typeof import("node:async_hooks");
  return {
    identidad: new AsyncLocalStorage() as InstanceType<
      typeof import("node:async_hooks").AsyncLocalStorage<Identidad>
    >,
    correos: [] as string[],
  };
});

vi.mock("next-auth", () => ({
  getServerSession: async () => {
    const actual = identidad.getStore();
    if (!actual) return null;
    return { user: { id: actual.userId, email: "sesion@ejemplo.test", orgId: actual.orgId } };
  },
}));
vi.mock("../../src/lib/auth", () => ({ authOptions: {} }));

vi.mock("../../src/lib/email", () => ({
  sendEmail: vi.fn(async ({ to }: { to: string }) => {
    correos.push(to);
  }),
}));

import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import { PATCH as patchTareas } from "../../src/app/api/cases/[id]/tasks/route";
import { PATCH as patchExpediente } from "../../src/app/api/cases/[id]/route";

function como<T>(userId: string, orgId: string, fn: () => Promise<T>): Promise<T> {
  return identidad.run({ userId, orgId }, fn);
}

/** Petición PATCH con cuerpo JSON, como la que manda el navegador. */
function peticion(url: string, cuerpo: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

/**
 * Hace que PostgreSQL rechace el INSERT de auditoría de una acción concreta.
 *
 * El disparador vive sólo mientras dura la prueba. No toca el esquema de la
 * aplicación ni se aplica a ninguna migración.
 */
async function rechazarAuditoriaDe(accion: string) {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION prueba_falla_auditoria() RETURNS trigger
    LANGUAGE plpgsql AS $cuerpo$
    BEGIN
      RAISE EXCEPTION 'fallo inyectado en la escritura de auditoria (%)', NEW.action;
    END;
    $cuerpo$
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER prueba_falla_auditoria
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW
      WHEN (NEW.action = '${accion}')
      EXECUTE FUNCTION prueba_falla_auditoria()
  `);
}

async function quitarElRechazo() {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS prueba_falla_auditoria ON "AuditLog"`);
}

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await quitarElRechazo();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  correos.length = 0;
  vi.clearAllMocks();
});

afterEach(quitarElRechazo);

let seq = 0;

/**
 * Organización con dos destinatarios internos, un expediente, una tarea
 * PENDIENTE y una regla activa que manda correo al equipo.
 *
 * La regla es la que convierte «no hay WorkflowLog» en una afirmación con
 * contenido: si la transición ocurriera, la regla se ejecutaría.
 */
async function escenario(trigger: "TASK_STATUS_CHANGED" | "CASE_STATUS_CHANGED") {
  seq++;
  const { org, owner } = await createOrg();
  const segundo = await prisma.user.create({
    data: { email: `mgr-${seq}-${Date.now()}@ejemplo.test`, name: "Manager" },
  });
  await prisma.membership.create({
    data: { userId: segundo.id, orgId: org.id, role: "MANAGER" },
  });

  const expediente = await createCase(org.id, `EXP-2026-90${seq}0`);
  await prisma.case.update({
    where: { id: expediente.id },
    data: { status: "IN_PROGRESS" },
  });

  const tarea = await prisma.task.create({
    data: {
      caseId: expediente.id,
      title: "Tarea que cambia de estado",
      status: "PENDING",
      category: "OTROS",
    },
  });

  const regla = await prisma.workflowRule.create({
    data: {
      orgId: org.id,
      name: `Aviso (${trigger})`,
      trigger,
      conditions: {},
      action: "SEND_EMAIL_TEAM",
      actionConfig: { subject: "Cambio de estado", body: "Expediente {{case.ref}}." },
      isActive: true,
    },
  });

  return { org, owner, expediente, tarea, regla, destinatarios: [owner.email, segundo.email] };
}

/** El motor se dispara sin esperar respuesta; se le da margen y se confirma. */
async function esperarAlMotor(ruleId: string, esperadas: number) {
  const limite = Date.now() + 10_000;
  while (Date.now() < limite) {
    if ((await prisma.workflowLog.count({ where: { ruleId } })) >= esperadas) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  // Margen para que una ejecución de MÁS, de existir, hubiera aparecido.
  await new Promise((r) => setTimeout(r, 750));
  expect(await prisma.workflowLog.count({ where: { ruleId } })).toBe(esperadas);
}

// ═══════════════════════════════════════════════════════════════════════════
// TAREA
// ═══════════════════════════════════════════════════════════════════════════

describe("TAREA: si la auditoría de la transición no se escribe, el estado no cambia", () => {
  it("CONTROL: sin fallo, la transición ocurre y deja auditoría, ejecución y correo", async () => {
    const { org, owner, expediente, tarea, regla, destinatarios } =
      await escenario("TASK_STATUS_CHANGED");

    const res = await como(owner.id, org.id, () =>
      patchTareas(peticion(`/api/cases/${expediente.id}/tasks`, { taskId: tarea.id, status: "DONE" }), {
        params: Promise.resolve({ id: expediente.id }),
      }),
    );
    expect(res.status).toBe(200);

    const despues = await prisma.task.findUniqueOrThrow({
      where: { id: tarea.id },
      select: { status: true },
    });
    expect(despues.status).toBe("DONE");
    expect(
      await prisma.auditLog.count({ where: { caseId: expediente.id, action: "task.done" } }),
    ).toBe(1);

    await esperarAlMotor(regla.id, 1);
    expect(correos.slice().sort()).toEqual(destinatarios.slice().sort());
  });

  it("con la auditoría rechazada por la base: 500, estado intacto, cero rastro", async () => {
    const { org, owner, expediente, tarea, regla } = await escenario("TASK_STATUS_CHANGED");
    await rechazarAuditoriaDe("task.done");

    /*
     * La transacción aborta dentro de la ruta. Se comprueba que la petición NO
     * termina bien: ni 200 ni 409. Cualquiera de los dos sería mentir sobre lo
     * que ha quedado en la base.
     */
    const fallo = como(owner.id, org.id, () =>
      patchTareas(peticion(`/api/cases/${expediente.id}/tasks`, { taskId: tarea.id, status: "DONE" }), {
        params: Promise.resolve({ id: expediente.id }),
      }),
    );
    await expect(fallo).rejects.toThrow(/fallo inyectado/);

    // 1. EL ESTADO SE HA DESHECHO. Esto es lo que fallaba antes.
    const despues = await prisma.task.findUniqueOrThrow({
      where: { id: tarea.id },
      select: { status: true },
    });
    expect(despues.status, "la transición se deshace con su auditoría").toBe("PENDING");

    // 2. No hay ninguna auditoría de transición.
    expect(
      await prisma.auditLog.count({ where: { caseId: expediente.id, action: { startsWith: "task." } } }),
    ).toBe(0);

    // 3. Ni ejecución ni correo: sin commit no hay entrega al motor.
    await new Promise((r) => setTimeout(r, 750));
    expect(await prisma.workflowLog.count({ where: { ruleId: regla.id } })).toBe(0);
    expect(correos).toHaveLength(0);
    expect(
      (await prisma.workflowRule.findUniqueOrThrow({ where: { id: regla.id } })).execCount,
    ).toBe(0);
  });

  it("los OTROS campos del mismo PATCH también se deshacen", async () => {
    const { org, owner, expediente, tarea } = await escenario("TASK_STATUS_CHANGED");
    await rechazarAuditoriaDe("task.done");

    const fallo = como(owner.id, org.id, () =>
      patchTareas(
        peticion(`/api/cases/${expediente.id}/tasks`, {
          taskId: tarea.id,
          status: "DONE",
          title: "Titulo que no debe quedar escrito",
        }),
        { params: Promise.resolve({ id: expediente.id }) },
      ),
    );
    await expect(fallo).rejects.toThrow(/fallo inyectado/);

    const despues = await prisma.task.findUniqueOrThrow({
      where: { id: tarea.id },
      select: { status: true, title: true },
    });
    expect(despues.status).toBe("PENDING");
    expect(despues.title, "la escritura de campos va en la misma transacción").toBe(
      "Tarea que cambia de estado",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPEDIENTE
// ═══════════════════════════════════════════════════════════════════════════

describe("EXPEDIENTE: si la auditoría de la transición no se escribe, el estado no cambia", () => {
  it("CONTROL: sin fallo, la transición ocurre y deja auditoría, ejecución y correo", async () => {
    const { org, owner, expediente, regla, destinatarios } =
      await escenario("CASE_STATUS_CHANGED");

    const res = await como(owner.id, org.id, () =>
      patchExpediente(peticion(`/api/cases/${expediente.id}`, { status: "FOLLOW_UP" }), {
        params: Promise.resolve({ id: expediente.id }),
      }),
    );
    expect(res.status).toBe(200);

    const despues = await prisma.case.findUniqueOrThrow({
      where: { id: expediente.id },
      select: { status: true },
    });
    expect(despues.status).toBe("FOLLOW_UP");

    const auditorias = await prisma.auditLog.findMany({
      where: { caseId: expediente.id, action: "case.status_changed" },
      select: { details: true },
    });
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0].details).toBe("IN_PROGRESS -> FOLLOW_UP");

    await esperarAlMotor(regla.id, 1);
    expect(correos.slice().sort()).toEqual(destinatarios.slice().sort());
  });

  it("con la auditoría rechazada por la base: 500, estado intacto, cero rastro", async () => {
    const { org, owner, expediente, regla } = await escenario("CASE_STATUS_CHANGED");
    await rechazarAuditoriaDe("case.status_changed");

    const fallo = como(owner.id, org.id, () =>
      patchExpediente(peticion(`/api/cases/${expediente.id}`, { status: "FOLLOW_UP" }), {
        params: Promise.resolve({ id: expediente.id }),
      }),
    );
    await expect(fallo).rejects.toThrow(/fallo inyectado/);

    const despues = await prisma.case.findUniqueOrThrow({
      where: { id: expediente.id },
      select: { status: true },
    });
    expect(despues.status, "la transición se deshace con su auditoría").toBe("IN_PROGRESS");

    expect(
      await prisma.auditLog.count({
        where: { caseId: expediente.id, action: "case.status_changed" },
      }),
    ).toBe(0);

    await new Promise((r) => setTimeout(r, 750));
    expect(await prisma.workflowLog.count({ where: { ruleId: regla.id } })).toBe(0);
    expect(correos).toHaveLength(0);
    expect(
      (await prisma.workflowRule.findUniqueOrThrow({ where: { id: regla.id } })).execCount,
    ).toBe(0);
  });

  it("los OTROS campos del mismo PATCH también se deshacen", async () => {
    const { org, owner, expediente } = await escenario("CASE_STATUS_CHANGED");
    await rechazarAuditoriaDe("case.status_changed");

    const fallo = como(owner.id, org.id, () =>
      patchExpediente(
        peticion(`/api/cases/${expediente.id}`, {
          status: "FOLLOW_UP",
          notes: "Nota que no debe quedar escrita",
        }),
        { params: Promise.resolve({ id: expediente.id }) },
      ),
    );
    await expect(fallo).rejects.toThrow(/fallo inyectado/);

    const despues = await prisma.case.findUniqueOrThrow({
      where: { id: expediente.id },
      select: { status: true, notes: true },
    });
    expect(despues.status).toBe("IN_PROGRESS");
    expect(despues.notes).toBeNull();
  });

  it("el CLOSED que escribe closedAt tampoco sobrevive al fallo", async () => {
    /*
     * `closedAt` lo escribe el mismo compara-y-intercambia que el estado. Si
     * quedara puesto con el expediente todavía abierto, los informes de
     * cierre contarían un expediente que nadie cerró.
     */
    const { org, owner, expediente } = await escenario("CASE_STATUS_CHANGED");
    await rechazarAuditoriaDe("case.status_changed");

    const fallo = como(owner.id, org.id, () =>
      patchExpediente(peticion(`/api/cases/${expediente.id}`, { status: "CLOSED" }), {
        params: Promise.resolve({ id: expediente.id }),
      }),
    );
    await expect(fallo).rejects.toThrow(/fallo inyectado/);

    const despues = await prisma.case.findUniqueOrThrow({
      where: { id: expediente.id },
      select: { status: true, closedAt: true },
    });
    expect(despues.status).toBe("IN_PROGRESS");
    expect(despues.closedAt).toBeNull();
  });
});
