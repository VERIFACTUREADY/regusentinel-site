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
    workflowLog: { create: vi.fn() },
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
  logCreate.mockResolvedValue({});
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

    const log = logCreate.mock.calls[0][0].data;
    expect(log.status).toBe("SKIPPED");
    expect(log.details.reason).toMatch(/cambio mientras/);
  });

  it("corta al alcanzar la profundidad maxima", async () => {
    ruleFindMany.mockResolvedValue([rule()]);
    await triggerWorkflow({ ...evento, depth: 3 });
    expect(ruleFindMany).not.toHaveBeenCalled();
  });
});

describe("SEND_EMAIL_TEAM no miente sobre el resultado", () => {
  const emailRule = rule({ action: "SEND_EMAIL_TEAM", actionConfig: { subject: "Aviso" } });

  it("si fallan TODOS los envios, el workflow se registra como FAILED", async () => {
    ruleFindMany.mockResolvedValue([emailRule]);
    caseFindFirst.mockResolvedValue(caseRow());
    memberFindMany.mockResolvedValue([
      { user: { email: "a@x.es" } },
      { user: { email: "b@x.es" } },
    ]);
    emailMock.mockRejectedValue(new Error("SMTP caido"));

    await triggerWorkflow(evento);

    const log = logCreate.mock.calls[0][0].data;
    expect(log.status).toBe("FAILED");
    expect(log.error).toMatch(/2 de 2 destinatario/i);
    // Cada destinatario deja su propia fila, para poder reintentarlo solo a el.
    expect(log.deliveries.create).toHaveLength(2);
    expect(log.deliveries.create.every((d: any) => d.status === "FAILED")).toBe(true);
  });

  it("si falla la MITAD, es PARTIAL — no SUCCESS", async () => {
    ruleFindMany.mockResolvedValue([emailRule]);
    caseFindFirst.mockResolvedValue(caseRow());
    memberFindMany.mockResolvedValue([
      { user: { email: "a@x.es" } },
      { user: { email: "b@x.es" } },
    ]);
    emailMock
      .mockRejectedValueOnce(new Error("rebote"))
      .mockResolvedValueOnce(undefined);

    await triggerWorkflow(evento);

    // ANTES: bastaba con que UNO de los destinatarios funcionara para que la
    // ejecucion se registrase como SUCCESS. Con diez destinatarios y nueve
    // fallos, el registro decia "exitoso" y nadie se enteraba de que nueve
    // personas no habian recibido el aviso.
    const log = logCreate.mock.calls[0][0].data;
    expect(log.status).toBe("PARTIAL");
    expect(log.error).toMatch(/1 de 2 destinatario/i);
    expect(log.details.entregadas).toBe(1);
    expect(log.details.fallidas).toBe(1);

    // La entrega fallida queda identificada por destinatario: sin esto no se
    // sabe A QUIEN reintentar, y reintentar la regla entera duplicaria el
    // envio al que si lo recibio.
    const entregas = log.deliveries.create;
    expect(entregas).toHaveLength(2);
    expect(entregas.find((d: any) => d.recipient === "a@x.es").status).toBe("FAILED");
    expect(entregas.find((d: any) => d.recipient === "b@x.es").status).toBe("SENT");
  });

  it("si TODOS llegan, es SUCCESS y no se registra ningun fallo", async () => {
    ruleFindMany.mockResolvedValue([emailRule]);
    caseFindFirst.mockResolvedValue(caseRow());
    memberFindMany.mockResolvedValue([
      { user: { email: "a@x.es" } },
      { user: { email: "b@x.es" } },
    ]);
    emailMock.mockResolvedValue(undefined);

    await triggerWorkflow(evento);

    const log = logCreate.mock.calls[0][0].data;
    expect(log.status).toBe("SUCCESS");
    expect(log.error).toBeNull();
    expect(log.deliveries.create.every((d: any) => d.status === "SENT")).toBe(true);
  });

  it("sin destinatarios internos se omite con motivo", async () => {
    ruleFindMany.mockResolvedValue([emailRule]);
    caseFindFirst.mockResolvedValue(caseRow());
    memberFindMany.mockResolvedValue([]);

    await triggerWorkflow(evento);

    const log = logCreate.mock.calls[0][0].data;
    expect(log.status).toBe("SKIPPED");
    expect(log.details.reason).toMatch(/destinatarios internos/);
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
