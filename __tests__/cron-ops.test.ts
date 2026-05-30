import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    organization: { findMany: vi.fn(), findUnique: vi.fn() },
    case: { updateMany: vi.fn(), findMany: vi.fn() },
    promptLog: { findMany: vi.fn() },
    membership: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/case-analyzer", () => ({
  analyzeCase: vi.fn(),
}));

vi.mock("../src/lib/demo-data", () => ({
  DEMO_ORG_SLUG: "gestoria-demo",
  DEMO_OWNER_EMAIL: "admin@heredia.app",
  DEMO_OPERATOR_EMAIL: "operador@heredia.app",
  resetDemoCases: vi.fn(),
}));

vi.mock("../src/lib/cron-auth", () => ({
  validateCronSecret: vi.fn().mockReturnValue(true),
}));

import { prisma } from "../src/lib/prisma";
import { sendEmail } from "../src/lib/email";
import { logAudit } from "../src/lib/audit";
import { analyzeCase } from "../src/lib/case-analyzer";
import { resetDemoCases } from "../src/lib/demo-data";
import { validateCronSecret } from "../src/lib/cron-auth";

import { GET as retentionGET } from "../src/app/api/cron/retention-cleanup/route";
import { GET as analyzeGET } from "../src/app/api/cron/analyze-all/route";
import { GET as demoGET } from "../src/app/api/cron/demo-reset/route";

const orgFindMany = prisma.organization.findMany as unknown as ReturnType<typeof vi.fn>;
const orgFindUnique = prisma.organization.findUnique as unknown as ReturnType<typeof vi.fn>;
const caseUpdateMany = prisma.case.updateMany as unknown as ReturnType<typeof vi.fn>;
const caseFindMany = prisma.case.findMany as unknown as ReturnType<typeof vi.fn>;
const promptFindMany = prisma.promptLog.findMany as unknown as ReturnType<typeof vi.fn>;
const memFindMany = prisma.membership.findMany as unknown as ReturnType<typeof vi.fn>;
const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const emailMock = sendEmail as unknown as ReturnType<typeof vi.fn>;
const auditMock = logAudit as unknown as ReturnType<typeof vi.fn>;
const analyzeMock = analyzeCase as unknown as ReturnType<typeof vi.fn>;
const resetMock = resetDemoCases as unknown as ReturnType<typeof vi.fn>;
const authMock = validateCronSecret as unknown as ReturnType<typeof vi.fn>;

function reqWith(query: Record<string, string> = {}): any {
  const url = new URL("http://localhost/api/cron/foo");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return {
    headers: { get: () => "Bearer test" },
    nextUrl: url,
  };
}

function resetAll() {
  for (const m of [orgFindMany, orgFindUnique, caseUpdateMany, caseFindMany, promptFindMany, memFindMany, userFindUnique, emailMock, auditMock, analyzeMock, resetMock, authMock]) {
    m.mockReset();
  }
  authMock.mockReturnValue(true);
  emailMock.mockResolvedValue(undefined);
  auditMock.mockResolvedValue(undefined);
}

// ─── /api/cron/retention-cleanup ───────────────────────────

describe("cron /retention-cleanup", () => {
  beforeEach(() => {
    resetAll();
    delete process.env.LEADS_NOTIFY_EMAIL;
  });

  it("rechaza 401 si el secret no es valido", async () => {
    authMock.mockReturnValueOnce(false);
    const res = await retentionGET(reqWith());
    expect(res.status).toBe(401);
    expect(orgFindMany).not.toHaveBeenCalled();
  });

  it("no archiva nada si ninguna org tiene cases pasados de retencion", async () => {
    orgFindMany.mockResolvedValueOnce([
      { id: "org1", name: "Despacho A", retentionDays: 90 },
    ]);
    caseUpdateMany.mockResolvedValue({ count: 0 });

    const res = await retentionGET(reqWith());
    const body = await res.json();

    expect(body.totalCleaned).toBe(0);
    expect(body.processed).toBe(1);
    expect(auditMock).not.toHaveBeenCalled();
    expect(emailMock).not.toHaveBeenCalled();
  });

  it("archiva cases viejos y loguea audit por cada org afectada", async () => {
    orgFindMany.mockResolvedValueOnce([
      { id: "org1", name: "Despacho A", retentionDays: 90 },
      { id: "org2", name: "Despacho B", retentionDays: 365 },
    ]);
    caseUpdateMany
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 0 });

    const res = await retentionGET(reqWith());
    const body = await res.json();

    expect(body.totalCleaned).toBe(3);
    expect(body.details).toHaveLength(1); // solo org1 en details
    expect(body.details[0]).toMatchObject({ name: "Despacho A", cleaned: 3 });
    expect(auditMock).toHaveBeenCalledOnce();
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({
      orgId: "org1",
      action: "retention.cleanup",
    }));
  });

  it("respeta el retentionDays distinto por org (cutoff = now - retentionDays)", async () => {
    orgFindMany.mockResolvedValueOnce([
      { id: "org1", name: "Despacho A", retentionDays: 30 },
    ]);
    caseUpdateMany.mockResolvedValueOnce({ count: 1 });

    await retentionGET(reqWith());

    const call = caseUpdateMany.mock.calls[0][0];
    expect(call.where.orgId).toBe("org1");
    expect(call.where.status).toBe("CLOSED");
    expect(call.where.deletedAt).toBe(null);
    // cutoff debe ser aproximadamente ahora - 30 dias
    const cutoff = call.where.closedAt.lt as Date;
    const expectedDelta = 30 * 24 * 60 * 60 * 1000;
    const actualDelta = Date.now() - cutoff.getTime();
    expect(Math.abs(actualDelta - expectedDelta)).toBeLessThan(60 * 1000); // 1 min slack
  });

  it("envia digest a LEADS_NOTIFY_EMAIL si se archivo algo", async () => {
    process.env.LEADS_NOTIFY_EMAIL = "ops@heredia.app";
    orgFindMany.mockResolvedValueOnce([
      { id: "org1", name: "Despacho A", retentionDays: 90 },
    ]);
    caseUpdateMany.mockResolvedValueOnce({ count: 5 });

    await retentionGET(reqWith());

    expect(emailMock).toHaveBeenCalledOnce();
    expect(emailMock.mock.calls[0][0]).toMatchObject({
      to: "ops@heredia.app",
      subject: expect.stringContaining("5 expediente"),
    });
  });
});

// ─── /api/cron/analyze-all ─────────────────────────────────

describe("cron /analyze-all", () => {
  beforeEach(resetAll);

  it("rechaza 401 si el secret no es valido", async () => {
    authMock.mockReturnValueOnce(false);
    const res = await analyzeGET(reqWith());
    expect(res.status).toBe(401);
    expect(caseFindMany).not.toHaveBeenCalled();
  });

  it("dryRun=1 reporta wouldAnalyze sin llamar a analyzeCase", async () => {
    promptFindMany.mockResolvedValueOnce([{ caseId: "case_recent" }]);
    caseFindMany.mockResolvedValueOnce([
      { id: "case_recent", ref: "EXP-1", orgId: "org1" }, // ya analizado
      { id: "case_new", ref: "EXP-2", orgId: "org1" },
    ]);

    const res = await analyzeGET(reqWith({ dry: "1" }));
    const body = await res.json();

    expect(body.dryRun).toBe(true);
    expect(body.wouldAnalyze).toBe(1); // solo case_new
    expect(body.totalOpen).toBe(2);
    expect(body.recentlyAnalyzed).toBe(1);
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it("salta cases ya analizados en las ultimas 23h", async () => {
    promptFindMany.mockResolvedValueOnce([{ caseId: "case_recent" }]);
    caseFindMany.mockResolvedValueOnce([
      { id: "case_recent", ref: "EXP-1", orgId: "org1" },
      { id: "case_new", ref: "EXP-2", orgId: "org1" },
    ]);
    memFindMany.mockResolvedValueOnce([{ orgId: "org1", userId: "u1" }]);
    analyzeMock.mockResolvedValueOnce({ healthScore: 85 });

    const res = await analyzeGET(reqWith());
    const body = await res.json();

    expect(body.analyzed).toBe(1);
    expect(body.skipped).toBe(1);
    expect(analyzeMock).toHaveBeenCalledOnce();
    expect(analyzeMock).toHaveBeenCalledWith({ caseId: "case_new", userId: "u1" });
  });

  it("captura error de analyzeCase y sigue con el siguiente", async () => {
    promptFindMany.mockResolvedValueOnce([]);
    caseFindMany.mockResolvedValueOnce([
      { id: "case_a", ref: "EXP-A", orgId: "org1" },
      { id: "case_b", ref: "EXP-B", orgId: "org1" },
    ]);
    memFindMany.mockResolvedValueOnce([{ orgId: "org1", userId: "u1" }]);
    analyzeMock
      .mockRejectedValueOnce(new Error("IA hot"))
      .mockResolvedValueOnce({ healthScore: 70 });

    const res = await analyzeGET(reqWith());
    const body = await res.json();

    expect(body.analyzed).toBe(1);
    expect(body.failed).toBe(1);
    expect(analyzeMock).toHaveBeenCalledTimes(2);
  });

  it("marca como error cases cuya org no tiene admin user para audit", async () => {
    promptFindMany.mockResolvedValueOnce([]);
    caseFindMany.mockResolvedValueOnce([
      { id: "case_x", ref: "EXP-X", orgId: "org_orphan" },
    ]);
    memFindMany.mockResolvedValueOnce([]); // ningun OWNER/MANAGER en org_orphan

    const res = await analyzeGET(reqWith());
    const body = await res.json();

    expect(body.analyzed).toBe(0);
    expect(body.failed).toBe(1);
    expect(analyzeMock).not.toHaveBeenCalled();
  });
});

// ─── /api/cron/demo-reset ──────────────────────────────────

describe("cron /demo-reset", () => {
  beforeEach(() => {
    resetAll();
    delete process.env.DEMO_ENABLED;
  });

  it("skip si DEMO_ENABLED no es 'true' (sin tocar DB ni validar auth)", async () => {
    const res = await demoGET(reqWith());
    const body = await res.json();
    expect(body.skipped).toBeDefined();
    expect(orgFindUnique).not.toHaveBeenCalled();
    expect(authMock).not.toHaveBeenCalled(); // gate por DEMO_ENABLED esta antes
  });

  it("rechaza 401 si DEMO_ENABLED=true pero secret invalido", async () => {
    process.env.DEMO_ENABLED = "true";
    authMock.mockReturnValueOnce(false);

    const res = await demoGET(reqWith());
    expect(res.status).toBe(401);
    expect(orgFindUnique).not.toHaveBeenCalled();
  });

  it("404 si la demo org no existe", async () => {
    process.env.DEMO_ENABLED = "true";
    orgFindUnique.mockResolvedValueOnce(null);

    const res = await demoGET(reqWith());
    expect(res.status).toBe(404);
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("404 si el demo owner user no existe", async () => {
    process.env.DEMO_ENABLED = "true";
    orgFindUnique.mockResolvedValueOnce({ id: "org_demo" });
    userFindUnique
      .mockResolvedValueOnce(null) // owner
      .mockResolvedValueOnce({ id: "u_op" }); // operator

    const res = await demoGET(reqWith());
    expect(res.status).toBe(404);
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("happy path: resetea cases pasando orgId, ownerId, operatorId", async () => {
    process.env.DEMO_ENABLED = "true";
    orgFindUnique.mockResolvedValueOnce({ id: "org_demo" });
    userFindUnique
      .mockResolvedValueOnce({ id: "u_owner" })
      .mockResolvedValueOnce({ id: "u_op" });
    resetMock.mockResolvedValueOnce({ deleted: 5, created: 5 });

    const res = await demoGET(reqWith());
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(resetMock).toHaveBeenCalledWith("org_demo", "u_owner", "u_op");
  });

  it("operator opcional: si no existe, se llama con null", async () => {
    process.env.DEMO_ENABLED = "true";
    orgFindUnique.mockResolvedValueOnce({ id: "org_demo" });
    userFindUnique
      .mockResolvedValueOnce({ id: "u_owner" })
      .mockResolvedValueOnce(null); // operator missing
    resetMock.mockResolvedValueOnce({ deleted: 0, created: 0 });

    await demoGET(reqWith());

    expect(resetMock).toHaveBeenCalledWith("org_demo", "u_owner", null);
  });

  it("captura error de resetDemoCases y devuelve 500 con mensaje", async () => {
    process.env.DEMO_ENABLED = "true";
    orgFindUnique.mockResolvedValueOnce({ id: "org_demo" });
    userFindUnique
      .mockResolvedValueOnce({ id: "u_owner" })
      .mockResolvedValueOnce({ id: "u_op" });
    resetMock.mockRejectedValueOnce(new Error("seed failed"));

    const res = await demoGET(reqWith());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/seed failed/);
  });
});
