import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/s3", () => ({ deleteFile: vi.fn() }));
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    organization: { findMany: vi.fn(), findUnique: vi.fn() },
    case: { updateMany: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    promptLog: { findMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
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
import { deleteFile } from "../src/lib/s3";
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
const caseFindUnique = prisma.case.findUnique as unknown as ReturnType<typeof vi.fn>;
const caseUpdate = prisma.case.update as unknown as ReturnType<typeof vi.fn>;
const caseDelete = prisma.case.delete as unknown as ReturnType<typeof vi.fn>;
const promptDeleteMany = prisma.promptLog.deleteMany as unknown as ReturnType<typeof vi.fn>;
const txMock = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;
const deleteFileMock = deleteFile as unknown as ReturnType<typeof vi.fn>;
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
  for (const m of [orgFindMany, orgFindUnique, caseUpdateMany, caseFindMany, caseFindUnique, caseUpdate, caseDelete, promptDeleteMany, txMock, deleteFileMock, promptFindMany, memFindMany, userFindUnique, emailMock, auditMock, analyzeMock, resetMock, authMock]) {
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
    // Sin expedientes pendientes de purga salvo que la prueba diga lo contrario.
    caseFindMany.mockResolvedValue([]);
    promptDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("rechaza 401 si el secret no es valido", async () => {
    authMock.mockReturnValueOnce(false);
    const res = await retentionGET(reqWith());
    expect(res.status).toBe(401);
    expect(orgFindMany).not.toHaveBeenCalled();
  });

  it("no purga nada si ninguna org tiene expedientes vencidos", async () => {
    orgFindMany.mockResolvedValueOnce([{ id: "org1", name: "Despacho A", retentionDays: 90 }]);
    caseUpdateMany.mockResolvedValue({ count: 0 });

    const res = await retentionGET(reqWith());
    const body = await res.json();

    expect(body.purged).toBe(0);
    expect(body.scheduledForPurge).toBe(0);
    expect(emailMock).not.toHaveBeenCalled();
  });

  it("programa la purga en dos fases: borrado logico y fecha de purga", async () => {
    // El borrado logico ya no es el final del proceso: es la primera fase.
    orgFindMany.mockResolvedValueOnce([{ id: "org1", name: "Despacho A", retentionDays: 30 }]);
    caseUpdateMany.mockResolvedValueOnce({ count: 2 });

    const res = await retentionGET(reqWith());
    const body = await res.json();

    expect(body.scheduledForPurge).toBe(2);

    const call = caseUpdateMany.mock.calls[0][0];
    expect(call.where.orgId).toBe("org1");
    expect(call.where.status).toBe("CLOSED");
    expect(call.where.deletedAt).toBe(null);
    // Ahora ademas se fija la fecha de purga real.
    expect(call.data.deletedAt).toBeInstanceOf(Date);
    expect(call.data.purgeScheduledAt).toBeInstanceOf(Date);

    const cutoff = call.where.closedAt.lt as Date;
    const esperado = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(Date.now() - cutoff.getTime() - esperado)).toBeLessThan(60 * 1000);
  });

  it("purga de verdad los expedientes cuya fecha de purga ha llegado", async () => {
    orgFindMany.mockResolvedValueOnce([{ id: "org1", name: "Despacho A", retentionDays: 90 }]);
    caseUpdateMany.mockResolvedValue({ count: 0 });
    caseFindMany.mockResolvedValueOnce([{ id: "case-1" }]);
    caseFindUnique.mockResolvedValueOnce({
      id: "case-1",
      ref: "EXP-2026-0001",
      orgId: "org1",
      purgedAt: null,
      documents: [{ id: "d1", fileKey: "k/1" }],
    });
    deleteFileMock.mockResolvedValue(undefined);
    txMock.mockImplementation(async (cb: any) =>
      cb({
        promptLog: { deleteMany: vi.fn() },
        auditLog: { updateMany: vi.fn() },
        notificationLog: { deleteMany: vi.fn() },
        case: { delete: vi.fn() },
      }),
    );

    const res = await retentionGET(reqWith());
    const body = await res.json();

    // El objeto de S3 se borra DE VERDAD: antes solo se ponia deletedAt y el
    // fichero seguia en el bucket indefinidamente.
    expect(deleteFileMock).toHaveBeenCalledWith("k/1");
    expect(body.purged).toBe(1);
    expect(caseDelete).not.toHaveBeenCalled(); // se borra dentro de la transaccion
  });

  it("si S3 falla, NO marca el expediente como purgado", async () => {
    orgFindMany.mockResolvedValueOnce([{ id: "org1", name: "Despacho A", retentionDays: 90 }]);
    caseUpdateMany.mockResolvedValue({ count: 0 });
    caseFindMany.mockResolvedValueOnce([{ id: "case-1" }]);
    caseFindUnique.mockResolvedValueOnce({
      id: "case-1",
      ref: "EXP-2026-0002",
      orgId: "org1",
      purgedAt: null,
      documents: [{ id: "d1", fileKey: "k/1" }],
    });
    deleteFileMock.mockRejectedValue(new Error("S3 caido"));
    caseUpdate.mockResolvedValue({});

    const res = await retentionGET(reqWith());
    const body = await res.json();

    expect(body.purgeFailed).toBe(1);
    // Se registra el error para reintento y NO se borra la fila: decir que el
    // dato esta eliminado mientras sigue en S3 seria falso.
    expect(caseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ purgeAttempts: { increment: 1 } }),
      }),
    );
    expect(txMock).not.toHaveBeenCalled();
  });

  it("purga tambien los PromptLog vencidos", async () => {
    orgFindMany.mockResolvedValueOnce([]);
    promptDeleteMany.mockResolvedValueOnce({ count: 7 });

    const res = await retentionGET(reqWith());
    expect((await res.json()).promptLogsPurged).toBe(7);
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
