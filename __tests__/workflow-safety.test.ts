/**
 * Seguridad del motor de workflows.
 *
 * Antes: `conditions` y `actionConfig` se casteaban sin validar (`newStatus`
 * podia ser cualquier string y reventaba en `prisma.case.update`), el
 * expediente se cargaba sin filtrar por organizacion, y SEND_EMAIL_TEAM se
 * registraba como SUCCESS aunque fallasen TODOS los envios.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    workflowRule: { findMany: vi.fn(), update: vi.fn() },
    workflowLog: {
      // `create` sigue usandose para los registros SKIPPED y FAILED; la
      // RECLAMACION de la ejecucion usa `createMany` con `skipDuplicates`.
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    workflowDelivery: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    case: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    membership: { findMany: vi.fn() },
  },
}));
vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "../src/lib/prisma";
import { sendEmail } from "../src/lib/email";
import {
  triggerWorkflow,
  ruleConditionsSchema,
  actionConfigSchema,
} from "../src/lib/workflow-engine";

const ruleFindMany = prisma.workflowRule.findMany as unknown as ReturnType<typeof vi.fn>;
const caseFindFirst = prisma.case.findFirst as unknown as ReturnType<typeof vi.fn>;
const caseFindUnique = prisma.case.findUnique as unknown as ReturnType<typeof vi.fn>;
const caseUpdateMany = prisma.case.updateMany as unknown as ReturnType<typeof vi.fn>;
const logCreate = prisma.workflowLog.create as unknown as ReturnType<typeof vi.fn>;
/*
 * La reclamacion de la ejecucion. Es `createMany` con `skipDuplicates`, no un
 * `create` dentro de un `try`: el choque de la clave unica es el camino NORMAL
 * —ocurre cada vez que un evento llega dos veces— y con `create` Prisma dejaba
 * un ERROR en el log del servidor en cada deduplicacion correcta.
 */
const logReclamar = prisma.workflowLog.createMany as unknown as ReturnType<typeof vi.fn>;
const logFindUnique = prisma.workflowLog.findUnique as unknown as ReturnType<typeof vi.fn>;
const logUpdate = prisma.workflowLog.update as unknown as ReturnType<typeof vi.fn>;
/*
 * La reclamacion por destinatario usa `createMany` con `skipDuplicates`, no
 * `create` dentro de un try/catch: es igual de atomica y no deja un
 * `prisma:error` en el log cada vez que la fila ya existia —que es el caso
 * normal al reintentar—.
 */
const deliveryCreate =
  prisma.workflowDelivery.createMany as unknown as ReturnType<typeof vi.fn>;
const deliveryFindMany = prisma.workflowDelivery.findMany as unknown as ReturnType<typeof vi.fn>;
const memberFindMany = prisma.membership.findMany as unknown as ReturnType<typeof vi.fn>;
const emailMock = sendEmail as unknown as ReturnType<typeof vi.fn>;

function rule(over: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    name: "Regla",
    orgId: "org-1",
    isActive: true,
    trigger: "CASE_STATUS_CHANGED",
    action: "CHANGE_CASE_STATUS",
    conditions: {},
    actionConfig: { newStatus: "IN_PROGRESS" },
    ...over,
  };
}

function caseRow(over: Record<string, unknown> = {}) {
  return {
    id: "case-1",
    orgId: "org-1",
    status: "INTAKE",
    ref: "EXP-2026-0001",
    deceased: { fullName: "Fallecido" },
    contact: { email: "familia@x.es", fullName: "Contacto" },
    org: { name: "Org" },
    ...over,
  };
}

const evento = { type: "CASE_STATUS_CHANGED" as const, orgId: "org-1", caseId: "case-1" };

beforeEach(() => {
  vi.clearAllMocks();
  // El log se crea reclamado (PROCESSING) y devuelve su id: es lo que el
  // motor necesita para reclamar cada entrega ANTES de enviar.
  logCreate.mockResolvedValue({ id: "log-1" });
  logReclamar.mockResolvedValue({ count: 1 });
  // `createMany` no devuelve la fila: el motor la relee por su clave.
  logFindUnique.mockResolvedValue({ id: "log-1" });
  logUpdate.mockResolvedValue({});
  deliveryCreate.mockResolvedValue({ count: 1 });
  deliveryFindMany.mockResolvedValue([]);
  (prisma.workflowDelivery.updateMany as any).mockResolvedValue({ count: 1 });
  (prisma.workflowRule.update as any).mockResolvedValue({});
  caseUpdateMany.mockResolvedValue({ count: 1 });
  emailMock.mockResolvedValue(undefined);
});

describe("Validacion de la configuracion", () => {
  it("rechaza newStatus fuera del enum y lo registra como SKIPPED", async () => {
    ruleFindMany.mockResolvedValue([rule({ actionConfig: { newStatus: "ESTADO_INVENTADO" } })]);
    caseFindFirst.mockResolvedValue(caseRow());

    await triggerWorkflow(evento);

    expect(caseUpdateMany).not.toHaveBeenCalled();
    const log = logCreate.mock.calls[0][0].data;
    expect(log.status).toBe("SKIPPED");
    expect(log.details.reason).toBe("invalid_config");
  });

  it("rechaza condiciones con claves desconocidas", () => {
    expect(ruleConditionsSchema.safeParse({ campoRaro: "x" }).success).toBe(false);
  });

  it("rechaza estados invalidos en las condiciones", () => {
    expect(ruleConditionsSchema.safeParse({ toStatus: "NO_EXISTE" }).success).toBe(false);
    expect(ruleConditionsSchema.safeParse({ toStatus: "CLOSED" }).success).toBe(true);
  });

  it("acepta una configuracion valida", () => {
    expect(actionConfigSchema.safeParse({ newStatus: "CLOSED" }).success).toBe(true);
    expect(actionConfigSchema.safeParse({ subject: "Hola", body: "<p>x</p>" }).success).toBe(true);
  });
});

describe("Aislamiento por organizacion", () => {
  it("el expediente se carga filtrando por la organizacion del evento", async () => {
    ruleFindMany.mockResolvedValue([rule()]);
    caseFindFirst.mockResolvedValue(caseRow());

    await triggerWorkflow(evento);

    // Antes era findUnique({ id }) sin orgId.
    expect(caseFindUnique).not.toHaveBeenCalled();
    expect(caseFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "case-1", orgId: "org-1", deletedAt: null }),
      }),
    );
  });

  it("si el expediente no es de esa organizacion, no se ejecuta nada", async () => {
    ruleFindMany.mockResolvedValue([rule()]);
    caseFindFirst.mockResolvedValue(null);

    await triggerWorkflow(evento);
    expect(caseUpdateMany).not.toHaveBeenCalled();
  });
});

describe("Prevencion de bucles de estado", () => {
  it("no reescribe si el expediente ya esta en el estado destino", async () => {
    ruleFindMany.mockResolvedValue([rule({ actionConfig: { newStatus: "IN_PROGRESS" } })]);
    caseFindFirst.mockResolvedValue(caseRow({ status: "IN_PROGRESS" }));

    await triggerWorkflow(evento);

    expect(caseUpdateMany).not.toHaveBeenCalled();
    const log = logCreate.mock.calls[0][0].data;
    expect(log.status).toBe("SKIPPED");
    expect(log.details.reason).toMatch(/ya esta en IN_PROGRESS/);
  });

  it("la escritura es condicional al estado leido", async () => {
    ruleFindMany.mockResolvedValue([rule()]);
    caseFindFirst.mockResolvedValue(caseRow({ status: "INTAKE" }));

    await triggerWorkflow(evento);

    expect(caseUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "case-1", orgId: "org-1", status: "INTAKE" }),
      }),
    );
  });

  it("si el estado cambio mientras se ejecutaba, se omite", async () => {
    ruleFindMany.mockResolvedValue([rule()]);
    caseFindFirst.mockResolvedValue(caseRow());
    caseUpdateMany.mockResolvedValue({ count: 0 });

    await triggerWorkflow(evento);

    // El log se reclama en PROCESSING y, al ver que el efecto no llego a
    // aplicarse, pasa a SKIPPED con su motivo. Antes se marcaba SUCCESS: decia
    // que se habia hecho algo que no se hizo.
    expect(logReclamar.mock.calls[0][0].data[0].status).toBe("PROCESSING");
    const actualizado = logUpdate.mock.calls.at(-1)![0].data;
    expect(actualizado.status).toBe("SKIPPED");
    expect(actualizado.details.reason).toMatch(/cambio mientras/);
  });

  it("corta al alcanzar la profundidad maxima", async () => {
    ruleFindMany.mockResolvedValue([rule()]);
    await triggerWorkflow({ ...evento, depth: 3 });
    expect(ruleFindMany).not.toHaveBeenCalled();
  });
});

describe("SEND_EMAIL_TEAM reserva ANTES de enviar", () => {
  const emailRule = rule({ action: "SEND_EMAIL_TEAM", actionConfig: { subject: "Aviso" } });

  /**
   * EL INVARIANTE QUE ANTES NO SE CUMPLIA.
   *
   * El diseño anterior enviaba los correos y DESPUES creaba `WorkflowLog` y
   * `WorkflowDelivery`. Aqui se comprueba el orden real de las llamadas: la
   * reserva de la ejecucion y la de CADA destinatario ocurren antes de la
   * primera llamada al proveedor.
   *
   * La exclusion mutua de verdad —que dos ejecuciones simultaneas produzcan una
   * sola llamada— no se puede demostrar con Prisma mockeado, porque no hay dos
   * transacciones: eso se verifica en
   * `__tests__/integration/workflow-claim-db.test.ts` contando las llamadas al
   * proveedor contra PostgreSQL real.
   */
  it("crea el log y reclama la entrega antes de la primera llamada al proveedor", async () => {
    const orden: string[] = [];
    ruleFindMany.mockResolvedValue([emailRule]);
    caseFindFirst.mockResolvedValue(caseRow());
    memberFindMany.mockResolvedValue([{ user: { email: "a@x.es" } }]);

    logReclamar.mockImplementation(async () => {
      orden.push("reservar-ejecucion");
      return { count: 1 };
    });
    deliveryCreate.mockImplementation(async () => {
      orden.push("reservar-entrega");
      return { count: 1 };
    });
    emailMock.mockImplementation(async () => {
      orden.push("enviar");
    });

    await triggerWorkflow(evento);

    expect(orden).toEqual(["reservar-ejecucion", "reservar-entrega", "enviar"]);
  });

  it("el log se crea en PROCESSING y con clave idempotente, no con el resultado final", async () => {
    ruleFindMany.mockResolvedValue([emailRule]);
    caseFindFirst.mockResolvedValue(caseRow());
    memberFindMany.mockResolvedValue([{ user: { email: "a@x.es" } }]);
    emailMock.mockResolvedValue(undefined);

    await triggerWorkflow(evento);

    const datos = logReclamar.mock.calls[0][0].data[0];
    expect(datos.status).toBe("PROCESSING");
    // SHA-256 en hexadecimal: la clave no lleva emails ni nombres.
    expect(datos.idempotencyKey).toMatch(/^[0-9a-f]{64}$/);
    expect(datos.startedAt).toBeInstanceOf(Date);
  });

  it("cada destinatario se reclama por separado", async () => {
    ruleFindMany.mockResolvedValue([emailRule]);
    caseFindFirst.mockResolvedValue(caseRow());
    memberFindMany.mockResolvedValue([
      { user: { email: "a@x.es" } },
      { user: { email: "b@x.es" } },
    ]);
    emailMock.mockResolvedValue(undefined);

    await triggerWorkflow(evento);

    type FilaEntrega = { recipient: string; status: string };
    const filas: FilaEntrega[] = deliveryCreate.mock.calls.flatMap(
      (c) => (c[0] as { data: FilaEntrega[] }).data,
    );
    expect(filas.map((f) => f.recipient).sort()).toEqual(["a@x.es", "b@x.es"]);
    expect(filas.every((f) => f.status === "PROCESSING")).toBe(true);
  });

  it("un fallo de envio no impide reclamar ni enviar al resto", async () => {
    ruleFindMany.mockResolvedValue([emailRule]);
    caseFindFirst.mockResolvedValue(caseRow());
    memberFindMany.mockResolvedValue([
      { user: { email: "a@x.es" } },
      { user: { email: "b@x.es" } },
    ]);
    emailMock.mockImplementation(async ({ to }: { to: string }) => {
      if (to === "a@x.es") throw new Error("rebote");
    });

    await triggerWorkflow(evento);

    expect(emailMock).toHaveBeenCalledTimes(2);
  });

  it("sin destinatarios internos se omite con motivo y no se reserva nada", async () => {
    ruleFindMany.mockResolvedValue([emailRule]);
    caseFindFirst.mockResolvedValue(caseRow());
    memberFindMany.mockResolvedValue([]);

    await triggerWorkflow(evento);

    const log = logCreate.mock.calls[0][0].data;
    expect(log.status).toBe("SKIPPED");
    expect(log.details.reason).toMatch(/destinatarios internos/);
    expect(deliveryCreate).not.toHaveBeenCalled();
  });
});

describe("SEND_EMAIL_CONTACT", () => {
  it("se omite con motivo si el expediente no tiene email de contacto", async () => {
    ruleFindMany.mockResolvedValue([
      rule({ action: "SEND_EMAIL_CONTACT", actionConfig: { subject: "Hola" } }),
    ]);
    caseFindFirst.mockResolvedValue(caseRow({ contact: null }));

    await triggerWorkflow(evento);

    const log = logCreate.mock.calls[0][0].data;
    expect(log.status).toBe("SKIPPED");
    expect(emailMock).not.toHaveBeenCalled();
  });
});
