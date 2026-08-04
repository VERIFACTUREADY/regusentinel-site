/**
 * Idempotencia y reintentos del webhook de Stripe.
 *
 * HANDLER/SERVICE TESTS con Prisma y Stripe mockeados. No son E2E.
 *
 * El fallo que cubren: antes `stripeEvent.create` se ejecutaba ANTES del
 * switch. Si el handler lanzaba, la fila ya existia; el reintento de Stripe
 * chocaba con P2002 y se respondia `duplicate: true` sin volver a aplicar
 * nada. Una activacion de suscripcion podia perderse para siempre — dinero
 * cobrado y plan sin activar.
 *
 * Ahora solo PROCESSED descarta un reintento.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    stripeEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    organization: { findUnique: vi.fn() },
    subscription: { upsert: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("stripe", () => ({
  default: class FakeStripe {
    webhooks = { constructEvent: (body: string) => JSON.parse(body) };
    subscriptions = { retrieve: vi.fn() };
  },
}));

vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";

import { prisma } from "../src/lib/prisma";
import { handleWebhookEvent } from "../src/lib/stripe";

const evCreate = prisma.stripeEvent.create as unknown as ReturnType<typeof vi.fn>;
const evFindUnique = prisma.stripeEvent.findUnique as unknown as ReturnType<typeof vi.fn>;
const evUpdate = prisma.stripeEvent.update as unknown as ReturnType<typeof vi.fn>;
const evUpdateMany = prisma.stripeEvent.updateMany as unknown as ReturnType<typeof vi.fn>;
const subFindFirst = prisma.subscription.findFirst as unknown as ReturnType<typeof vi.fn>;
const subUpdate = prisma.subscription.update as unknown as ReturnType<typeof vi.fn>;

/** Evento no manejado por el switch: ejercita la maquina de estados, no un handler. */
function fakeEvent(id: string, type = "ping.unhandled") {
  return JSON.stringify({ id, type, data: { object: {} } });
}

/** Evento que SI toca la base de datos, para comprobar que el reintento lo aplica. */
function invoiceFailedEvent(id: string) {
  return JSON.stringify({
    id,
    type: "invoice.payment_failed",
    data: { object: { customer: "cus_1", amount_due: 34900 } },
  });
}

/** Estado de la fila StripeEvent para esta ejecucion. */
function eventRow(over: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "ping.unhandled",
    status: "RECEIVED",
    attempts: 0,
    startedAt: null,
    receivedAt: new Date(),
    completedAt: null,
    lastError: null,
    ...over,
  };
}

const P2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

beforeEach(() => {
  vi.clearAllMocks();
  evCreate.mockResolvedValue({});
  evUpdate.mockResolvedValue({});
  evUpdateMany.mockResolvedValue({ count: 1 });
  subFindFirst.mockResolvedValue(null);
});

describe("Evento nuevo", () => {
  it("se marca PROCESSED solo despues de ejecutar la logica", async () => {
    evFindUnique.mockResolvedValue(eventRow());

    const result = await handleWebhookEvent(fakeEvent("evt_1"), "sig");

    expect(result.received).toBe(true);
    expect(result.duplicate).toBeUndefined();

    // La reclamacion lo pone en PROCESSING...
    expect(evUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSING" }) }),
    );
    // ...y solo al final pasa a PROCESSED.
    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_1" },
        data: expect.objectContaining({ status: "PROCESSED", completedAt: expect.any(Date) }),
      }),
    );
  });

  it("cuenta el intento al reclamarlo", async () => {
    evFindUnique.mockResolvedValue(eventRow());
    await handleWebhookEvent(fakeEvent("evt_1"), "sig");

    expect(evUpdateMany.mock.calls[0][0].data.attempts).toEqual({ increment: 1 });
  });
});

describe("Evento ya procesado", () => {
  it("no se vuelve a ejecutar", async () => {
    evFindUnique.mockResolvedValue(eventRow({ status: "PROCESSED", attempts: 1 }));

    const result = await handleWebhookEvent(invoiceFailedEvent("evt_1"), "sig");

    expect(result.duplicate).toBe(true);
    expect(evUpdateMany).not.toHaveBeenCalled();
    // El handler no corrio.
    expect(subFindFirst).not.toHaveBeenCalled();
  });

  it("da igual que el alta choque con P2002: manda el estado, no la existencia", async () => {
    evCreate.mockRejectedValue(P2002);
    evFindUnique.mockResolvedValue(eventRow({ status: "PROCESSED" }));

    const result = await handleWebhookEvent(fakeEvent("evt_1"), "sig");
    expect(result.duplicate).toBe(true);
  });
});

describe("Reintento tras un fallo — el bug de los cobros perdidos", () => {
  it("un evento fallido se marca FAILED y propaga el error para que Stripe reintente", async () => {
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_failed" }));
    subFindFirst.mockRejectedValue(new Error("DB caida"));

    await expect(handleWebhookEvent(invoiceFailedEvent("evt_1"), "sig")).rejects.toThrow("DB caida");

    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          lastError: expect.stringContaining("DB caida"),
        }),
      }),
    );
    // NO se marca como procesado.
    const processed = evUpdate.mock.calls.some((c: any) => c[0]?.data?.status === "PROCESSED");
    expect(processed).toBe(false);
  });

  it("el reintento de un evento FAILED SI vuelve a ejecutar la logica", async () => {
    // Este test falla con la implementacion antigua: alli la fila ya existia,
    // P2002 devolvia duplicate=true y la mutacion se perdia para siempre.
    evCreate.mockRejectedValue(P2002);
    evFindUnique.mockResolvedValue(
      eventRow({
        status: "FAILED",
        attempts: 1,
        lastError: "DB caida",
        type: "invoice.payment_failed",
      }),
    );
    subFindFirst.mockResolvedValue({ id: "sub_1", orgId: "org_1", status: "active" });

    const result = await handleWebhookEvent(invoiceFailedEvent("evt_1"), "sig");

    expect(result.duplicate).toBeUndefined();
    // La logica corrio de verdad.
    expect(subFindFirst).toHaveBeenCalled();
    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) }),
    );
  });

  it("una ejecucion PROCESSING reciente no se duplica", async () => {
    evCreate.mockRejectedValue(P2002);
    evFindUnique.mockResolvedValue(
      eventRow({ status: "PROCESSING", startedAt: new Date(), attempts: 1 }),
    );

    const result = await handleWebhookEvent(invoiceFailedEvent("evt_1"), "sig");

    expect(result.duplicate).toBe(true);
    expect(subFindFirst).not.toHaveBeenCalled();
  });

  it("una ejecucion PROCESSING colgada se puede reclamar de nuevo", async () => {
    // El proceso murio a mitad: sin esto el evento quedaria bloqueado para siempre.
    evCreate.mockRejectedValue(P2002);
    evFindUnique.mockResolvedValue(
      eventRow({
        status: "PROCESSING",
        startedAt: new Date(Date.now() - 30 * 60 * 1000),
        attempts: 1,
      }),
    );

    const result = await handleWebhookEvent(fakeEvent("evt_1"), "sig");
    expect(result.duplicate).toBeUndefined();
  });
});

describe("Entregas simultaneas del mismo evento", () => {
  it("solo una gana la reclamacion; la otra se retira sin duplicar", async () => {
    evCreate.mockRejectedValue(P2002);
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_failed" }));
    // La actualizacion condicional no afecta a ninguna fila: otra la reclamo antes.
    evUpdateMany.mockResolvedValue({ count: 0 });

    const result = await handleWebhookEvent(invoiceFailedEvent("evt_1"), "sig");

    expect(result.duplicate).toBe(true);
    expect(subFindFirst).not.toHaveBeenCalled();
  });

  it("la reclamacion es condicional al estado leido (no un update ciego)", async () => {
    evFindUnique.mockResolvedValue(eventRow({ status: "RECEIVED" }));
    await handleWebhookEvent(fakeEvent("evt_1"), "sig");

    expect(evUpdateMany.mock.calls[0][0].where).toEqual({ id: "evt_1", status: "RECEIVED" });
  });
});

describe("Errores de infraestructura", () => {
  it("un error de base de datos distinto de P2002 se propaga", async () => {
    evCreate.mockRejectedValue(
      Object.assign(new Error("DB connection lost"), { code: "P1001" }),
    );

    await expect(handleWebhookEvent(fakeEvent("evt_x"), "sig")).rejects.toThrow(
      "DB connection lost",
    );
  });
});

describe("Recuperacion de suscripcion al cobrar", () => {
  it("invoice.payment_succeeded reactiva una suscripcion en past_due", async () => {
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_succeeded" }));
    subFindFirst.mockResolvedValue({ id: "sub_1", orgId: "org_1", status: "past_due" });
    subUpdate.mockResolvedValue({});

    await handleWebhookEvent(
      JSON.stringify({
        id: "evt_ok",
        type: "invoice.payment_succeeded",
        data: { object: { customer: "cus_1" } },
      }),
      "sig",
    );

    expect(subUpdate).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: { status: "active" },
    });
  });

  it("no toca una suscripcion que ya esta activa", async () => {
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_succeeded" }));
    subFindFirst.mockResolvedValue({ id: "sub_1", orgId: "org_1", status: "active" });

    await handleWebhookEvent(
      JSON.stringify({
        id: "evt_ok2",
        type: "invoice.payment_succeeded",
        data: { object: { customer: "cus_1" } },
      }),
      "sig",
    );

    expect(subUpdate).not.toHaveBeenCalled();
  });
});
