import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ANTES de los imports — los crons resuelven prisma/email/audit al
// momento de cargar el modulo, y queremos las versiones mockeadas.
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    subscription: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    demoRequest: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendTrialExpiringNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

// Por defecto, el helper de auth deja pasar; los tests de rechazo lo
// re-mockean dentro del bloque.
vi.mock("../src/lib/cron-auth", () => ({
  validateCronSecret: vi.fn().mockReturnValue(true),
}));

import { prisma } from "../src/lib/prisma";
import { sendEmail, sendTrialExpiringNotification } from "../src/lib/email";
import { logAudit } from "../src/lib/audit";
import { validateCronSecret } from "../src/lib/cron-auth";

import { GET as trialExpiredGET } from "../src/app/api/cron/trial-expired/route";
import { GET as trialExpiringGET } from "../src/app/api/cron/trial-expiring/route";
import { GET as staleLeadsGET } from "../src/app/api/cron/stale-leads/route";

const subFindMany = prisma.subscription.findMany as unknown as ReturnType<typeof vi.fn>;
const subUpdateMany = prisma.subscription.updateMany as unknown as ReturnType<typeof vi.fn>;
const leadsFindMany = prisma.demoRequest.findMany as unknown as ReturnType<typeof vi.fn>;
const emailMock = sendEmail as unknown as ReturnType<typeof vi.fn>;
const expiringMock = sendTrialExpiringNotification as unknown as ReturnType<typeof vi.fn>;
const auditMock = logAudit as unknown as ReturnType<typeof vi.fn>;
const authMock = validateCronSecret as unknown as ReturnType<typeof vi.fn>;

function fakeReq(): any {
  const url = new URL("http://localhost/api/cron/foo");
  return {
    headers: { get: () => "Bearer test" },
    nextUrl: url,
  };
}

function resetAll() {
  subFindMany.mockReset();
  subUpdateMany.mockReset();
  leadsFindMany.mockReset();
  emailMock.mockReset();
  expiringMock.mockReset();
  auditMock.mockReset();
  authMock.mockReset();
  authMock.mockReturnValue(true);
  emailMock.mockResolvedValue(undefined);
  expiringMock.mockResolvedValue(undefined);
  auditMock.mockResolvedValue(undefined);
}

function trialingSub(opts: {
  id: string;
  orgId: string;
  orgName: string;
  plan: "INICIA" | "DESPACHO" | "FIRMA";
  expiresInDays: number;
  ownerEmail?: string | null;
  ownerName?: string | null;
}) {
  const date = new Date();
  date.setDate(date.getDate() + opts.expiresInDays);
  return {
    id: opts.id,
    orgId: opts.orgId,
    plan: opts.plan,
    status: "trialing",
    currentPeriodEnd: date,
    org: {
      name: opts.orgName,
      slug: opts.orgName.toLowerCase().replace(/\s+/g, "-"),
      members:
        opts.ownerEmail === null
          ? []
          : [{ user: { email: opts.ownerEmail ?? "owner@example.com", name: opts.ownerName ?? "Owner" } }],
    },
  };
}

// ─── /api/cron/trial-expired ───────────────────────────────

describe("cron /trial-expired", () => {
  beforeEach(() => {
    resetAll();
    delete process.env.LEADS_NOTIFY_EMAIL;
  });

  it("rechaza con 401 si el secret del cron no es valido", async () => {
    authMock.mockReturnValueOnce(false);
    const res = await trialExpiredGET(fakeReq());
    expect(res.status).toBe(401);
    expect(subFindMany).not.toHaveBeenCalled();
  });

  it("devuelve 0 si no hay trials expirados (no llama updateMany ni sendEmail)", async () => {
    subFindMany.mockResolvedValueOnce([]);
    const res = await trialExpiredGET(fakeReq());
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(body.suspended).toBe(0);
    expect(subUpdateMany).not.toHaveBeenCalled();
    expect(emailMock).not.toHaveBeenCalled();
  });

  it("cancela trials expirados, audit log + email al owner por cada uno", async () => {
    subFindMany.mockResolvedValueOnce([
      trialingSub({ id: "sub_a", orgId: "org_a", orgName: "Despacho A", plan: "DESPACHO", expiresInDays: -1, ownerEmail: "a@a.com" }),
      trialingSub({ id: "sub_b", orgId: "org_b", orgName: "Despacho B", plan: "INICIA", expiresInDays: -3, ownerEmail: "b@b.com" }),
    ]);
    subUpdateMany.mockResolvedValueOnce({ count: 2 });

    const res = await trialExpiredGET(fakeReq());
    const body = await res.json();

    expect(body.processed).toBe(2);
    expect(body.suspended).toBe(2);
    expect(subUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sub_a", "sub_b"] } },
      data: { status: "canceled" },
    });
    expect(auditMock).toHaveBeenCalledTimes(2);
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org_a", action: "subscription.trial_expired" }));
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org_b", action: "subscription.trial_expired" }));
    expect(emailMock).toHaveBeenCalledTimes(2);
  });

  it("salta el email cuando el trial expirado no tiene owner email", async () => {
    subFindMany.mockResolvedValueOnce([
      trialingSub({ id: "sub_orphan", orgId: "org_orphan", orgName: "Org sin owner", plan: "INICIA", expiresInDays: -1, ownerEmail: null }),
    ]);
    subUpdateMany.mockResolvedValueOnce({ count: 1 });

    const res = await trialExpiredGET(fakeReq());
    expect(res.status).toBe(200);
    expect(subUpdateMany).toHaveBeenCalledOnce(); // cancela igualmente
    expect(auditMock).toHaveBeenCalledOnce(); // audit log se hace
    expect(emailMock).not.toHaveBeenCalled(); // pero no hay email
  });

  it("envia digest a LEADS_NOTIFY_EMAIL cuando esta configurado", async () => {
    process.env.LEADS_NOTIFY_EMAIL = "ops@heredia.app";
    subFindMany.mockResolvedValueOnce([
      trialingSub({ id: "sub_x", orgId: "org_x", orgName: "Org X", plan: "DESPACHO", expiresInDays: -2, ownerEmail: "x@x.com" }),
    ]);
    subUpdateMany.mockResolvedValueOnce({ count: 1 });

    await trialExpiredGET(fakeReq());

    // 1 email al owner + 1 digest al equipo = 2 sendEmail
    expect(emailMock).toHaveBeenCalledTimes(2);
    const calls = emailMock.mock.calls.map((c) => c[0].to);
    expect(calls).toContain("ops@heredia.app");
    expect(calls).toContain("x@x.com");
  });
});

// ─── /api/cron/trial-expiring ──────────────────────────────

describe("cron /trial-expiring", () => {
  beforeEach(() => {
    resetAll();
    delete process.env.LEADS_NOTIFY_EMAIL;
  });

  it("rechaza con 401 si el secret no es valido", async () => {
    authMock.mockReturnValueOnce(false);
    const res = await trialExpiringGET(fakeReq());
    expect(res.status).toBe(401);
    expect(subFindMany).not.toHaveBeenCalled();
  });

  it("devuelve notified=0 si no hay trials proximos a expirar", async () => {
    subFindMany.mockResolvedValueOnce([]);
    const res = await trialExpiringGET(fakeReq());
    const body = await res.json();
    expect(body.notified).toBe(0);
    expect(expiringMock).not.toHaveBeenCalled();
  });

  it("envia notificacion al owner por cada trial con menos de 3 dias", async () => {
    subFindMany.mockResolvedValueOnce([
      trialingSub({ id: "s1", orgId: "o1", orgName: "Despacho 1", plan: "DESPACHO", expiresInDays: 2, ownerEmail: "o1@o.com", ownerName: "Owner 1" }),
      trialingSub({ id: "s2", orgId: "o2", orgName: "Despacho 2", plan: "FIRMA", expiresInDays: 1, ownerEmail: "o2@o.com", ownerName: "Owner 2" }),
    ]);

    const res = await trialExpiringGET(fakeReq());
    const body = await res.json();

    expect(body.notified).toBe(2);
    expect(expiringMock).toHaveBeenCalledTimes(2);
    expect(expiringMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgName: "Despacho 1",
        ownerEmail: "o1@o.com",
        plan: "DESPACHO",
      })
    );
  });

  it("salta trials sin owner email", async () => {
    subFindMany.mockResolvedValueOnce([
      trialingSub({ id: "s1", orgId: "o1", orgName: "Sin owner", plan: "INICIA", expiresInDays: 2, ownerEmail: null }),
    ]);
    const res = await trialExpiringGET(fakeReq());
    const body = await res.json();
    expect(body.notified).toBe(0);
    expect(expiringMock).not.toHaveBeenCalled();
  });
});

// ─── /api/cron/stale-leads ─────────────────────────────────

describe("cron /stale-leads", () => {
  beforeEach(() => {
    resetAll();
    delete process.env.LEADS_NOTIFY_EMAIL;
  });

  it("rechaza con 401 si el secret no es valido", async () => {
    authMock.mockReturnValueOnce(false);
    const res = await staleLeadsGET(fakeReq());
    expect(res.status).toBe(401);
  });

  it("skip si LEADS_NOTIFY_EMAIL no esta configurado (no toca DB)", async () => {
    const res = await staleLeadsGET(fakeReq());
    const body = await res.json();
    expect(body.skipped).toBeDefined();
    expect(leadsFindMany).not.toHaveBeenCalled();
    expect(emailMock).not.toHaveBeenCalled();
  });

  it("devuelve staleCount=0 cuando no hay leads frios", async () => {
    process.env.LEADS_NOTIFY_EMAIL = "ops@heredia.app";
    leadsFindMany.mockResolvedValueOnce([]);
    const res = await staleLeadsGET(fakeReq());
    const body = await res.json();
    expect(body.staleCount).toBe(0);
    expect(emailMock).not.toHaveBeenCalled();
  });

  it("envia digest con plural cuando hay >1 lead frio", async () => {
    process.env.LEADS_NOTIFY_EMAIL = "ops@heredia.app";
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    leadsFindMany.mockResolvedValueOnce([
      { name: "Andrea", email: "a@a.com", company: "Gestoria A", createdAt: tenDaysAgo },
      { name: "Bruno", email: "b@b.com", company: null, createdAt: tenDaysAgo },
    ]);

    const res = await staleLeadsGET(fakeReq());
    const body = await res.json();

    expect(body.staleCount).toBe(2);
    expect(emailMock).toHaveBeenCalledOnce();
    const call = emailMock.mock.calls[0][0];
    expect(call.to).toBe("ops@heredia.app");
    expect(call.subject).toMatch(/2 leads/);
    expect(call.html).toContain("Andrea");
    expect(call.html).toContain("Bruno");
  });

  it("usa singular en el subject cuando hay 1 lead frio", async () => {
    process.env.LEADS_NOTIFY_EMAIL = "ops@heredia.app";
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    leadsFindMany.mockResolvedValueOnce([
      { name: "Carla", email: "c@c.com", company: "Despacho C", createdAt: fiveDaysAgo },
    ]);

    await staleLeadsGET(fakeReq());

    const call = emailMock.mock.calls[0][0];
    expect(call.subject).toMatch(/1 lead /);
    expect(call.subject).not.toMatch(/leads/);
  });
});
