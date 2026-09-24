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

const stripeSubRetrieve = vi.fn();
const stripeEventRetrieve = vi.fn();
vi.mock("stripe", () => ({
  default: class FakeStripe {
    webhooks = { constructEvent: (body: string) => JSON.parse(body) };
    subscriptions = { retrieve: (...a: unknown[]) => stripeSubRetrieve(...a) };
    events = { retrieve: (...a: unknown[]) => stripeEventRetrieve(...a) };
  },
}));

vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";

import { prisma } from "../src/lib/prisma";
import { handleWebhookEvent, MAX_INTENTOS_EVENTO } from "../src/lib/stripe";

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
    data: { object: { customer: "cus_1", subscription: "sub_stripe_1", amount_due: 34900 } },
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

/** El evento se ha aplicado ahora (ni duplicado ni pendiente de reintento). */
function esAplicado(r: Awaited<ReturnType<typeof handleWebhookEvent>>): boolean {
  return r.received === true && r.duplicate !== true;
}

beforeEach(() => {
  vi.clearAllMocks();
  evCreate.mockResolvedValue({});
  evUpdate.mockResolvedValue({});
  evUpdateMany.mockResolvedValue({ count: 1 });
  subFindFirst.mockResolvedValue(null);
  stripeSubRetrieve.mockReset();
  stripeEventRetrieve.mockReset();
});

/** Factura de suscripcion; `subscription` es lo que correlaciona, no el customer. */
function facturaPagada(
  id: string,
  over: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    id,
    type: "invoice.payment_succeeded",
    data: {
      object: { id: "in_1", customer: "cus_1", subscription: "sub_stripe_1", ...over },
    },
  });
}

describe("Evento nuevo", () => {
  it("se marca PROCESSED solo despues de ejecutar la logica", async () => {
    evFindUnique.mockResolvedValue(eventRow());

    const result = await handleWebhookEvent(fakeEvent("evt_1"), "sig");

    expect(result.received).toBe(true);
    expect(esAplicado(result)).toBe(true);

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

    expect(result).toMatchObject({ received: true, duplicate: true });
    expect(evUpdateMany).not.toHaveBeenCalled();
    // El handler no corrio.
    expect(subFindFirst).not.toHaveBeenCalled();
  });

  it("da igual que el alta choque con P2002: manda el estado, no la existencia", async () => {
    evCreate.mockRejectedValue(P2002);
    evFindUnique.mockResolvedValue(eventRow({ status: "PROCESSED" }));

    const result = await handleWebhookEvent(fakeEvent("evt_1"), "sig");
    expect(result).toMatchObject({ received: true, duplicate: true });
  });
});

describe("Reintento tras un fallo — el bug de los cobros perdidos", () => {
  it("un evento fallido se marca FAILED y propaga el error para que Stripe reintente", async () => {
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_failed" }));
    subFindFirst.mockRejectedValue(new Error("DB caida"));

    await expect(handleWebhookEvent(invoiceFailedEvent("evt_1"), "sig")).rejects.toThrow("DB caida");

    // El fallo se registra con `updateMany` condicionado a `attempts`: mientras
    // queden reintentos queda FAILED; agotados, pasa a NEEDS_INTERVENTION.
    expect(evUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "evt_1", attempts: { lt: MAX_INTENTOS_EVENTO } }),
        data: expect.objectContaining({
          status: "FAILED",
          lastError: expect.stringContaining("DB caida"),
        }),
      }),
    );
    expect(evUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ attempts: { gte: MAX_INTENTOS_EVENTO } }),
        data: expect.objectContaining({ status: "NEEDS_INTERVENTION" }),
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

    expect(esAplicado(result)).toBe(true);
    // La logica corrio de verdad.
    expect(subFindFirst).toHaveBeenCalled();
    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) }),
    );
  });

  it("una ejecucion PROCESSING reciente no se duplica y PIDE REINTENTO", async () => {
    // Antes esto devolvia `{received:true, duplicate:true}` -> HTTP 200, y
    // Stripe daba el evento por entregado. Si el proceso que lo tenia
    // reclamado moria a mitad, su efecto no se aplicaba nunca.
    evCreate.mockRejectedValue(P2002);
    evFindUnique.mockResolvedValue(
      eventRow({ status: "PROCESSING", startedAt: new Date(), attempts: 1 }),
    );

    const result = await handleWebhookEvent(invoiceFailedEvent("evt_1"), "sig");

    expect(result).toEqual({
      received: false,
      type: "invoice.payment_failed",
      retry: true,
      reason: "in_progress",
    });
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
    expect(esAplicado(result)).toBe(true);
  });
});

describe("Entregas simultaneas del mismo evento", () => {
  it("solo una gana la reclamacion; la otra se retira sin duplicar", async () => {
    evCreate.mockRejectedValue(P2002);
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_failed" }));
    // La actualizacion condicional no afecta a ninguna fila: otra la reclamo antes.
    evUpdateMany.mockResolvedValue({ count: 0 });

    const result = await handleWebhookEvent(invoiceFailedEvent("evt_1"), "sig");

    // Perder la carrera tampoco se responde como exito: se pide reintento.
    expect(result).toMatchObject({ received: false, retry: true, reason: "in_progress" });
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

describe("invoice.payment_succeeded — correlacion por suscripcion", () => {
  /**
   * ANTES: bastaba con que el `customer` de la factura coincidiera con
   * `Subscription.stripeCustomerId` para poner la suscripcion en `active`. Una
   * organizacion impagada volvia a operar por cualquier cobro del mismo
   * cliente: una factura suelta, un setup fee, o el pago de OTRA suscripcion.
   *
   * AHORA: la factura debe pertenecer a la suscripcion guardada, se recupera
   * esa suscripcion de Stripe, y se aplica SU estado real.
   */
  const subLocal = {
    id: "sub_1",
    orgId: "org_1",
    status: "past_due",
    stripeSubId: "sub_stripe_1",
    currentPeriodEnd: new Date(),
  };

  it("reactiva cuando la factura es de la suscripcion guardada y Stripe la da por activa", async () => {
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_succeeded" }));
    subFindFirst.mockResolvedValue(subLocal);
    stripeSubRetrieve.mockResolvedValue({
      id: "sub_stripe_1",
      status: "active",
      current_period_end: 1800000000,
    });
    subUpdate.mockResolvedValue({});

    await handleWebhookEvent(facturaPagada("evt_ok"), "sig");

    // La busqueda es por stripeSubId, NO por stripeCustomerId.
    expect(subFindFirst).toHaveBeenCalledWith({ where: { stripeSubId: "sub_stripe_1" } });
    expect(subUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub_1" },
        data: expect.objectContaining({ status: "active" }),
      }),
    );
  });

  it("NO reactiva por una factura suelta (one-off, sin suscripcion)", async () => {
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_succeeded" }));
    subFindFirst.mockResolvedValue(subLocal);

    await handleWebhookEvent(facturaPagada("evt_oneoff", { subscription: null }), "sig");

    expect(subFindFirst).not.toHaveBeenCalled();
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it("NO reactiva por el cobro de un setup fee facturado aparte", async () => {
    // Un setup fee cobrado como factura independiente no lleva `subscription`.
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_succeeded" }));
    subFindFirst.mockResolvedValue(subLocal);

    await handleWebhookEvent(
      facturaPagada("evt_setup", { subscription: undefined, billing_reason: "manual" }),
      "sig",
    );

    expect(subUpdate).not.toHaveBeenCalled();
  });

  it("NO reactiva por el pago de una suscripcion ANTIGUA ya sustituida", async () => {
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_succeeded" }));
    // La factura es de sub_stripe_VIEJA; en la base tenemos sub_stripe_1, asi
    // que la busqueda por stripeSubId no encuentra nada.
    subFindFirst.mockResolvedValue(null);

    await handleWebhookEvent(
      facturaPagada("evt_vieja", { subscription: "sub_stripe_VIEJA" }),
      "sig",
    );

    expect(subFindFirst).toHaveBeenCalledWith({ where: { stripeSubId: "sub_stripe_VIEJA" } });
    expect(stripeSubRetrieve).not.toHaveBeenCalled();
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it("NO reactiva por OTRA suscripcion del mismo customer", async () => {
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_succeeded" }));
    subFindFirst.mockResolvedValue(null); // no hay fila con ese stripeSubId

    await handleWebhookEvent(
      facturaPagada("evt_otra", { customer: "cus_1", subscription: "sub_stripe_OTRA" }),
      "sig",
    );

    expect(subUpdate).not.toHaveBeenCalled();
  });

  it("si Stripe dice que la suscripcion sigue impagada, NO se reactiva", async () => {
    // El cobro de una factura no implica que la suscripcion este al corriente:
    // puede quedar otra factura vencida. Manda el estado real de Stripe.
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_succeeded" }));
    subFindFirst.mockResolvedValue(subLocal);
    stripeSubRetrieve.mockResolvedValue({
      id: "sub_stripe_1",
      status: "past_due",
      current_period_end: 1800000000,
    });

    await handleWebhookEvent(facturaPagada("evt_sigue_impagada"), "sig");

    expect(subUpdate).not.toHaveBeenCalled();
  });

  it("no toca una suscripcion que ya esta activa y con periodo conocido", async () => {
    evFindUnique.mockResolvedValue(eventRow({ type: "invoice.payment_succeeded" }));
    subFindFirst.mockResolvedValue({ ...subLocal, status: "active" });
    stripeSubRetrieve.mockResolvedValue({
      id: "sub_stripe_1",
      status: "active",
      current_period_end: 1800000000,
    });

    await handleWebhookEvent(facturaPagada("evt_ok2"), "sig");

    expect(subUpdate).not.toHaveBeenCalled();
  });
});
