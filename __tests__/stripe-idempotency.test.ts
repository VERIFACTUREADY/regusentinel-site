import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma + stripe ANTES de importar el SUT.
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    stripeEvent: {
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    subscription: {
      upsert: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

// Stub minimo de Stripe que solo necesita exponer `webhooks.constructEvent`.
vi.mock("stripe", () => {
  return {
    default: class FakeStripe {
      webhooks = {
        constructEvent: (body: string) => JSON.parse(body),
      };
      subscriptions = { retrieve: vi.fn() };
    },
  };
});

vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn() }));

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";

import { prisma } from "../src/lib/prisma";
import { handleWebhookEvent } from "../src/lib/stripe";

const stripeEventCreate = prisma.stripeEvent.create as unknown as ReturnType<typeof vi.fn>;

// Tipo no manejado por el switch (cae en default sin tocar DB), asi el test
// solo ejercita la idempotencia, no el handler concreto de cada evento.
function fakeEvent(id: string, type: string = "ping.unhandled") {
  return JSON.stringify({
    id,
    type,
    data: { object: {} },
  });
}

describe("Stripe webhook idempotency", () => {
  beforeEach(() => {
    stripeEventCreate.mockReset();
    (prisma.subscription.findFirst as any).mockReset();
    (prisma.subscription.update as any).mockReset();
  });

  it("procesa un evento nuevo registrandolo en StripeEvent", async () => {
    stripeEventCreate.mockResolvedValueOnce({ id: "evt_first" });

    const result = await handleWebhookEvent(fakeEvent("evt_first"), "sig_dummy");

    expect(stripeEventCreate).toHaveBeenCalledWith({
      data: { id: "evt_first", type: "ping.unhandled" },
    });
    expect(result.duplicate).toBeUndefined();
    expect(result.received).toBe(true);
  });

  it("detecta un reintento de Stripe (P2002) y devuelve duplicate=true sin ejecutar handlers", async () => {
    const uniqueViolation: any = new Error("Unique constraint failed");
    uniqueViolation.code = "P2002";
    stripeEventCreate.mockRejectedValueOnce(uniqueViolation);

    const result = await handleWebhookEvent(fakeEvent("evt_retry"), "sig_dummy");

    expect(result).toEqual({
      received: true,
      type: "ping.unhandled",
      duplicate: true,
    });
    // Si el handler hubiera corrido, habria llamado findFirst para buscar la sub.
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it("re-lanza errores de DB que NO sean P2002", async () => {
    const dbError: any = new Error("DB connection lost");
    dbError.code = "P1001";
    stripeEventCreate.mockRejectedValueOnce(dbError);

    await expect(handleWebhookEvent(fakeEvent("evt_dberror"), "sig_dummy")).rejects.toThrow(
      "DB connection lost"
    );
  });
});
