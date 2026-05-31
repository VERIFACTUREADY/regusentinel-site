import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ANTES de los imports.
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: vi.fn(), upsert: vi.fn() },
    organization: { findUniqueOrThrow: vi.fn() },
    usageRecord: { findUnique: vi.fn(), findMany: vi.fn() },
    membership: { count: vi.fn() },
  },
}));

vi.mock("stripe", () => ({
  default: class FakeStripe {
    customers = { create: vi.fn() };
    checkout = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    subscriptions = { retrieve: vi.fn() };
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("../src/lib/auth", () => ({
  authOptions: {},
}));

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_PRICE_INICIA_MONTHLY = "price_inicia_m";
process.env.STRIPE_PRICE_INICIA_ANNUAL = "price_inicia_a";
process.env.STRIPE_PRICE_DESPACHO_MONTHLY = "price_despacho_m";
process.env.STRIPE_PRICE_DESPACHO_ANNUAL = "price_despacho_a";
process.env.STRIPE_PRICE_FIRMA_MONTHLY = "price_firma_m";
process.env.STRIPE_PRICE_FIRMA_ANNUAL = "price_firma_a";
process.env.STRIPE_PRICE_SETUP_DESPACHO = "price_setup_d";
process.env.STRIPE_PRICE_SETUP_FIRMA = "price_setup_f";
process.env.APP_URL = "http://localhost:3000";

import { getServerSession } from "next-auth";
import { prisma } from "../src/lib/prisma";
import { stripe, createCheckoutSession } from "../src/lib/stripe";

import { POST as billingPOST, GET as billingGET } from "../src/app/api/billing/route";

const session = getServerSession as unknown as ReturnType<typeof vi.fn>;
const subFindUnique = prisma.subscription.findUnique as unknown as ReturnType<typeof vi.fn>;
const subUpsert = prisma.subscription.upsert as unknown as ReturnType<typeof vi.fn>;
const orgFindUnique = prisma.organization.findUniqueOrThrow as unknown as ReturnType<typeof vi.fn>;
const usageOne = prisma.usageRecord.findUnique as unknown as ReturnType<typeof vi.fn>;
const usageMany = prisma.usageRecord.findMany as unknown as ReturnType<typeof vi.fn>;
const memCount = prisma.membership.count as unknown as ReturnType<typeof vi.fn>;
const customerCreate = (stripe as any).customers.create as ReturnType<typeof vi.fn>;
const checkoutCreate = (stripe as any).checkout.sessions.create as ReturnType<typeof vi.fn>;

function fakeReq(body: any = {}): any {
  return { json: async () => body };
}

function resetAll() {
  session.mockReset();
  subFindUnique.mockReset();
  subUpsert.mockReset();
  orgFindUnique.mockReset();
  usageOne.mockReset();
  usageMany.mockReset();
  memCount.mockReset();
  customerCreate.mockReset();
  checkoutCreate.mockReset();
}

function asUser(role: "OWNER" | "MANAGER" | "OPERATOR" | "VIEWER") {
  return {
    user: { id: "user1", email: "u@u.com", orgId: "org1", role },
  };
}

// ─── POST /api/billing (crear checkout) ────────────────────

describe("POST /api/billing — Stripe checkout", () => {
  beforeEach(resetAll);

  it("rechaza 401 si no hay sesion", async () => {
    session.mockResolvedValueOnce(null);
    const res = await billingPOST(fakeReq({ plan: "DESPACHO" }));
    expect(res.status).toBe(401);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("rechaza 403 si role VIEWER (no billing.manage)", async () => {
    session.mockResolvedValueOnce(asUser("VIEWER"));
    const res = await billingPOST(fakeReq({ plan: "DESPACHO" }));
    expect(res.status).toBe(403);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("rechaza 403 si role OPERATOR (no billing.manage)", async () => {
    session.mockResolvedValueOnce(asUser("OPERATOR"));
    const res = await billingPOST(fakeReq({ plan: "DESPACHO" }));
    expect(res.status).toBe(403);
  });

  it("rechaza 403 si role MANAGER (manager no toca billing)", async () => {
    session.mockResolvedValueOnce(asUser("MANAGER"));
    const res = await billingPOST(fakeReq({ plan: "DESPACHO" }));
    expect(res.status).toBe(403);
  });

  it("OWNER puede crear checkout (tiene billing.manage)", async () => {
    session.mockResolvedValueOnce(asUser("OWNER"));
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus_existing", setupFeePaid: true });
    checkoutCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/session_xyz" });

    const res = await billingPOST(fakeReq({ plan: "INICIA", interval: "MONTHLY" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.com/session_xyz");
    expect(checkoutCreate).toHaveBeenCalled();
  });

  it("400 si plan no esta en PLAN_PRICING", async () => {
    session.mockResolvedValueOnce(asUser("OWNER"));
    const res = await billingPOST(fakeReq({ plan: "ENTERPRISE" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalido/i);
  });

  it("400 si interval no es MONTHLY ni ANNUAL", async () => {
    session.mockResolvedValueOnce(asUser("OWNER"));
    const res = await billingPOST(fakeReq({ plan: "INICIA", interval: "BIYEARLY" }));
    expect(res.status).toBe(400);
  });

  it("default interval MONTHLY si no se pasa", async () => {
    session.mockResolvedValueOnce(asUser("OWNER"));
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus1", setupFeePaid: true });
    checkoutCreate.mockResolvedValueOnce({ url: "https://x.com" });

    await billingPOST(fakeReq({ plan: "INICIA" }));

    const params = checkoutCreate.mock.calls[0][0];
    expect(params.line_items[0].price).toBe("price_inicia_m"); // monthly id
    expect(params.metadata.interval).toBe("MONTHLY");
  });

  it("error de Stripe devuelve 500 con mensaje generico (no filtra detalles)", async () => {
    session.mockResolvedValueOnce(asUser("OWNER"));
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus1", setupFeePaid: true });
    checkoutCreate.mockRejectedValueOnce(new Error("Stripe API quota exceeded"));

    const res = await billingPOST(fakeReq({ plan: "INICIA" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Error al crear sesion de pago");
    expect(body.error).not.toContain("quota");
  });
});

// ─── lib createCheckoutSession ─────────────────────────────

describe("createCheckoutSession", () => {
  beforeEach(resetAll);

  it("reusa customer existente sin llamar a stripe.customers.create", async () => {
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus_existing", setupFeePaid: true });
    checkoutCreate.mockResolvedValueOnce({ url: "x" });

    await createCheckoutSession("org1", "INICIA", "MONTHLY", "http://localhost/billing");

    expect(customerCreate).not.toHaveBeenCalled();
    expect(subUpsert).not.toHaveBeenCalled();
    const params = checkoutCreate.mock.calls[0][0];
    expect(params.customer).toBe("cus_existing");
  });

  it("crea customer + upsert subscription si no hay stripeCustomerId", async () => {
    subFindUnique.mockResolvedValueOnce(null);
    orgFindUnique.mockResolvedValueOnce({ id: "org1", name: "Despacho Demo" });
    customerCreate.mockResolvedValueOnce({ id: "cus_new" });
    subUpsert.mockResolvedValueOnce({});
    checkoutCreate.mockResolvedValueOnce({ url: "x" });

    await createCheckoutSession("org1", "INICIA", "MONTHLY", "http://localhost/billing");

    expect(customerCreate).toHaveBeenCalledWith({
      name: "Despacho Demo",
      metadata: { orgId: "org1" },
    });
    expect(subUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId: "org1" },
      create: expect.objectContaining({ orgId: "org1", stripeCustomerId: "cus_new" }),
    }));
  });

  it("INICIA no anyade setup fee aunque sea primera vez (precio 0)", async () => {
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus1", setupFeePaid: false });
    checkoutCreate.mockResolvedValueOnce({ url: "x" });

    await createCheckoutSession("org1", "INICIA", "MONTHLY", "http://localhost/billing");

    const params = checkoutCreate.mock.calls[0][0];
    expect(params.line_items).toHaveLength(1);
    expect(params.metadata.chargedSetupFee).toBe("false");
  });

  it("DESPACHO con setupFeePaid=false anyade line item de setup", async () => {
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus1", setupFeePaid: false });
    checkoutCreate.mockResolvedValueOnce({ url: "x" });

    await createCheckoutSession("org1", "DESPACHO", "MONTHLY", "http://localhost/billing");

    const params = checkoutCreate.mock.calls[0][0];
    expect(params.line_items).toHaveLength(2);
    expect(params.line_items[0].price).toBe("price_despacho_m");
    expect(params.line_items[1].price).toBe("price_setup_d");
    expect(params.metadata.chargedSetupFee).toBe("true");
  });

  it("DESPACHO con setupFeePaid=true NO duplica el cobro de setup", async () => {
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus1", setupFeePaid: true });
    checkoutCreate.mockResolvedValueOnce({ url: "x" });

    await createCheckoutSession("org1", "DESPACHO", "MONTHLY", "http://localhost/billing");

    const params = checkoutCreate.mock.calls[0][0];
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items[0].price).toBe("price_despacho_m");
    expect(params.metadata.chargedSetupFee).toBe("false");
  });

  it("interval ANNUAL usa el price_id anual", async () => {
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus1", setupFeePaid: true });
    checkoutCreate.mockResolvedValueOnce({ url: "x" });

    await createCheckoutSession("org1", "FIRMA", "ANNUAL", "http://localhost/billing");

    const params = checkoutCreate.mock.calls[0][0];
    expect(params.line_items[0].price).toBe("price_firma_a");
  });

  it("metadata incluye orgId + plan + interval para que el webhook active la sub correcta", async () => {
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus1", setupFeePaid: true });
    checkoutCreate.mockResolvedValueOnce({ url: "x" });

    await createCheckoutSession("org_xyz", "DESPACHO", "ANNUAL", "http://localhost/billing");

    const params = checkoutCreate.mock.calls[0][0];
    expect(params.metadata).toMatchObject({
      orgId: "org_xyz",
      plan: "DESPACHO",
      interval: "ANNUAL",
    });
  });

  it("success_url incluye {CHECKOUT_SESSION_ID} (placeholder de Stripe)", async () => {
    subFindUnique.mockResolvedValueOnce({ stripeCustomerId: "cus1", setupFeePaid: true });
    checkoutCreate.mockResolvedValueOnce({ url: "x" });

    await createCheckoutSession("org1", "INICIA", "MONTHLY", "http://app/billing");

    const params = checkoutCreate.mock.calls[0][0];
    expect(params.success_url).toContain("{CHECKOUT_SESSION_ID}");
    expect(params.success_url).toContain("success=true");
    expect(params.cancel_url).toContain("canceled=true");
  });
});

// ─── GET /api/billing (panel del cliente) ──────────────────

describe("GET /api/billing — panel de billing", () => {
  beforeEach(resetAll);

  it("401 sin sesion", async () => {
    session.mockResolvedValueOnce(null);
    const res = await billingGET(fakeReq());
    expect(res.status).toBe(401);
  });

  it("403 si role no tiene billing.read (OPERATOR)", async () => {
    session.mockResolvedValueOnce(asUser("OPERATOR"));
    const res = await billingGET(fakeReq());
    expect(res.status).toBe(403);
  });

  it("OWNER ve subscription + usage + pricing", async () => {
    session.mockResolvedValueOnce(asUser("OWNER"));
    subFindUnique.mockResolvedValueOnce({ plan: "DESPACHO", status: "active" });
    usageOne.mockResolvedValueOnce({ casesCreated: 12, month: "2026-05" });
    usageMany.mockResolvedValueOnce([{ month: "2026-04", casesCreated: 8 }]);
    memCount.mockResolvedValueOnce(3);

    const res = await billingGET(fakeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscription.plan).toBe("DESPACHO");
    expect(body.usage.casesCreated).toBe(12);
    expect(body.memberCount).toBe(3);
    expect(body.pricing).toBeDefined();
    expect(body.pricing.DESPACHO.monthlyPrice).toBe(349);
  });
});
