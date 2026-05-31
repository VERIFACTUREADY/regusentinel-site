import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ANTES de los imports. El handler de register usa $transaction
// con un callback; simulamos pasando un cliente con los mismos metodos
// mockeados (no estamos testeando atomicidad de Postgres, solo wiring).

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    organization: { findUnique: vi.fn(), create: vi.fn() },
    membership: { create: vi.fn() },
    subscription: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/lib/email", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/default-case-templates", () => ({
  seedDefaultCaseTemplates: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/sample-case-seeder", () => ({
  seedSampleCase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$mockedhash"),
  },
}));

import { prisma } from "../src/lib/prisma";
import { sendWelcomeEmail, sendEmail } from "../src/lib/email";
import { logAudit } from "../src/lib/audit";
import { seedDefaultCaseTemplates } from "../src/lib/default-case-templates";
import { seedSampleCase } from "../src/lib/sample-case-seeder";
import bcrypt from "bcryptjs";

import { POST as registerPOST } from "../src/app/api/register/route";

const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const orgFindUnique = prisma.organization.findUnique as unknown as ReturnType<typeof vi.fn>;
const transaction = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;
const orgCreate = (prisma as any).organization.create as ReturnType<typeof vi.fn>;
const userCreate = (prisma as any).user.create as ReturnType<typeof vi.fn>;
const memCreate = (prisma as any).membership.create as ReturnType<typeof vi.fn>;
const subCreate = (prisma as any).subscription.create as ReturnType<typeof vi.fn>;
const welcomeMock = sendWelcomeEmail as unknown as ReturnType<typeof vi.fn>;
const emailMock = sendEmail as unknown as ReturnType<typeof vi.fn>;
const auditMock = logAudit as unknown as ReturnType<typeof vi.fn>;
const templatesMock = seedDefaultCaseTemplates as unknown as ReturnType<typeof vi.fn>;
const sampleCaseMock = seedSampleCase as unknown as ReturnType<typeof vi.fn>;
const bcryptHash = bcrypt.hash as unknown as ReturnType<typeof vi.fn>;

function fakeReq(body: any): any {
  return {
    json: async () => body,
  };
}

const validBody = () => ({
  orgName: "Gestoria Demo",
  name: "Andrea Martin",
  email: "andrea@gestoriademo.es",
  password: "secret123",
  plan: "INICIA",
  acceptTerms: true,
});

function resetAll() {
  for (const m of [
    userFindUnique, orgFindUnique, transaction, orgCreate, userCreate,
    memCreate, subCreate, welcomeMock, emailMock, auditMock, templatesMock,
    sampleCaseMock, bcryptHash,
  ]) {
    m.mockReset();
  }
  // Defaults: nadie existe, transaction ejecuta el callback con el cliente mockeado
  userFindUnique.mockResolvedValue(null);
  orgFindUnique.mockResolvedValue(null);
  transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(prisma));
  orgCreate.mockResolvedValue({ id: "org_new", slug: "gestoria-demo", name: "Gestoria Demo" });
  userCreate.mockResolvedValue({ id: "user_new", email: "andrea@gestoriademo.es" });
  memCreate.mockResolvedValue({});
  subCreate.mockResolvedValue({});
  templatesMock.mockResolvedValue(undefined);
  sampleCaseMock.mockResolvedValue(undefined);
  bcryptHash.mockResolvedValue("$2b$12$mockedhash");
  welcomeMock.mockResolvedValue(undefined);
  emailMock.mockResolvedValue(undefined);
  auditMock.mockResolvedValue(undefined);
}

describe("POST /api/register — flujo de registro E2E", () => {
  beforeEach(() => {
    resetAll();
    delete process.env.LEADS_NOTIFY_EMAIL;
  });

  // ─── Happy path ─────────────────────────────────────────

  it("happy path: crea User+Org+Membership+Subscription y dispara seeders", async () => {
    const res = await registerPOST(fakeReq(validBody()));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.orgId).toBe("org_new");
    expect(body.userId).toBe("user_new");

    expect(orgCreate).toHaveBeenCalledWith({
      data: { name: "Gestoria Demo", slug: "gestoria-demo" },
    });
    expect(userCreate).toHaveBeenCalledWith({
      data: {
        email: "andrea@gestoriademo.es",
        name: "Andrea Martin",
        passwordHash: "$2b$12$mockedhash",
      },
    });
    expect(memCreate).toHaveBeenCalledWith({
      data: { userId: "user_new", orgId: "org_new", role: "OWNER" },
    });
    expect(subCreate).toHaveBeenCalled();
    expect(templatesMock).toHaveBeenCalledWith(prisma, "org_new");
    expect(sampleCaseMock).toHaveBeenCalledWith(prisma, "org_new");
  });

  it("bcrypt hash usa 12 rounds (no menos por error)", async () => {
    await registerPOST(fakeReq(validBody()));
    expect(bcryptHash).toHaveBeenCalledWith("secret123", 12);
  });

  it("subscription tiene plan + status trialing + currentPeriodEnd = +14 dias", async () => {
    const before = Date.now();
    await registerPOST(fakeReq(validBody()));

    const subCall = subCreate.mock.calls[0][0].data;
    expect(subCall.orgId).toBe("org_new");
    expect(subCall.plan).toBe("INICIA");
    expect(subCall.status).toBe("trialing");

    const expectedTrialEnd = before + 14 * 24 * 60 * 60 * 1000;
    const actual = subCall.currentPeriodEnd.getTime();
    expect(Math.abs(actual - expectedTrialEnd)).toBeLessThan(60_000); // 1min slack
  });

  it("dispara sendWelcomeEmail + logAudit despues de la transaccion", async () => {
    await registerPOST(fakeReq(validBody()));
    expect(welcomeMock).toHaveBeenCalledWith({
      email: "andrea@gestoriademo.es",
      name: "Andrea Martin",
      orgName: "Gestoria Demo",
      plan: "INICIA",
      trialDays: 14,
    });
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({
      orgId: "org_new",
      userId: "user_new",
      action: "org.created",
    }));
  });

  it("plan default es INICIA si no se pasa en el body", async () => {
    const body = validBody();
    delete (body as any).plan;
    await registerPOST(fakeReq(body));
    expect(subCreate.mock.calls[0][0].data.plan).toBe("INICIA");
  });

  it("acepta plan DESPACHO y FIRMA explicitos", async () => {
    for (const plan of ["DESPACHO", "FIRMA"] as const) {
      resetAll();
      await registerPOST(fakeReq({ ...validBody(), plan }));
      expect(subCreate.mock.calls[0][0].data.plan).toBe(plan);
    }
  });

  // ─── Validacion ─────────────────────────────────────────

  it("rechaza 400 si Zod falla (email invalido)", async () => {
    const res = await registerPOST(fakeReq({ ...validBody(), email: "no-es-email" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalido/i);
    expect(body.details).toBeDefined();
    expect(orgCreate).not.toHaveBeenCalled();
  });

  it("rechaza 400 si acceptTerms es false o ausente (RGPD)", async () => {
    const res1 = await registerPOST(fakeReq({ ...validBody(), acceptTerms: false }));
    expect(res1.status).toBe(400);

    resetAll();
    const body = validBody();
    delete (body as any).acceptTerms;
    const res2 = await registerPOST(fakeReq(body));
    expect(res2.status).toBe(400);

    expect(orgCreate).not.toHaveBeenCalled();
  });

  it("rechaza 400 si password tiene menos de 6 caracteres", async () => {
    const res = await registerPOST(fakeReq({ ...validBody(), password: "123" }));
    expect(res.status).toBe(400);
    expect(orgCreate).not.toHaveBeenCalled();
  });

  it("rechaza 400 si orgName es demasiado corto", async () => {
    const res = await registerPOST(fakeReq({ ...validBody(), orgName: "A" }));
    expect(res.status).toBe(400);
  });

  // ─── Conflictos ─────────────────────────────────────────

  it("rechaza 400 si el email ya esta registrado (sin tocar org)", async () => {
    userFindUnique.mockResolvedValueOnce({ id: "user_existing", email: "andrea@gestoriademo.es" });

    const res = await registerPOST(fakeReq(validBody()));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/ya registrado/i);
    expect(orgFindUnique).not.toHaveBeenCalled();
    expect(orgCreate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rechaza 400 si el slug de la organizacion ya esta en uso", async () => {
    orgFindUnique.mockResolvedValueOnce({ id: "org_existing", slug: "gestoria-demo" });

    const res = await registerPOST(fakeReq(validBody()));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/ya en uso/i);
    expect(transaction).not.toHaveBeenCalled();
  });

  // ─── Slug generation ────────────────────────────────────

  it("genera slug normalizado para nombres con caracteres especiales", async () => {
    await registerPOST(fakeReq({ ...validBody(), orgName: "Asesoria Perez & Cia" }));
    expect(orgCreate).toHaveBeenCalledWith({
      data: { name: "Asesoria Perez & Cia", slug: "asesoria-perez-cia" },
    });
  });

  // ─── Notificacion al equipo ─────────────────────────────

  it("envia notificacion a LEADS_NOTIFY_EMAIL si esta configurado", async () => {
    process.env.LEADS_NOTIFY_EMAIL = "ops@heredia.app";

    await registerPOST(fakeReq(validBody()));

    expect(emailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "ops@heredia.app",
      subject: expect.stringContaining("Nuevo registro"),
    }));
  });

  it("no envia digest interno si LEADS_NOTIFY_EMAIL no esta configurado", async () => {
    await registerPOST(fakeReq(validBody()));
    expect(emailMock).not.toHaveBeenCalled();
  });

  // ─── Robustez ───────────────────────────────────────────

  it("error en sendWelcomeEmail NO rompe el registro (.catch sin throw)", async () => {
    welcomeMock.mockRejectedValueOnce(new Error("SMTP down"));

    const res = await registerPOST(fakeReq(validBody()));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.orgId).toBe("org_new");
  });

  it("error en logAudit NO rompe el registro", async () => {
    auditMock.mockRejectedValueOnce(new Error("DB hot"));

    const res = await registerPOST(fakeReq(validBody()));
    expect(res.status).toBe(201);
  });

  it("error en la transaccion devuelve 500 sin filtrar stacktrace", async () => {
    transaction.mockRejectedValueOnce(new Error("DB unique constraint"));

    const res = await registerPOST(fakeReq(validBody()));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Error interno");
    expect(body.error).not.toContain("DB unique constraint");
  });

  // ─── Regresion: seedSampleCase wired correctamente ──────

  it("seedSampleCase se llama dentro de la transaccion (regresion: estuvo desconectado en algun momento)", async () => {
    await registerPOST(fakeReq(validBody()));
    expect(sampleCaseMock).toHaveBeenCalledOnce();
    expect(sampleCaseMock).toHaveBeenCalledWith(prisma, "org_new");

    // Y se llamo DESPUES de seedDefaultCaseTemplates (orden importante:
    // los templates definen la estructura, el sample case los usa).
    const templatesOrder = templatesMock.mock.invocationCallOrder[0];
    const sampleOrder = sampleCaseMock.mock.invocationCallOrder[0];
    expect(sampleOrder).toBeGreaterThan(templatesOrder);
  });
});
