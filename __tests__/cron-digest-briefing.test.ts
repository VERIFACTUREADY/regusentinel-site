import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    case: { findMany: vi.fn() },
    membership: { findMany: vi.fn() },
  },
}));

vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/digest-builder", () => ({
  classifyCases: vi.fn((cases: any[]) =>
    cases.map((c) => ({ ...c, urgency: c._fakeUrgency ?? "calm" }))
  ),
  buildHtmlDigest: vi.fn(() => "<html>digest</html>"),
}));

vi.mock("../src/lib/notif-prefs", () => ({
  parsePrefs: vi.fn((raw: any) => ({
    dailyBriefing: raw?.dailyBriefing !== false,
    weeklyDigest: raw?.weeklyDigest !== false,
    ...raw,
  })),
}));

vi.mock("../src/lib/daily-briefing-builder", () => ({
  fetchBriefingData: vi.fn(),
  briefingTotalItems: vi.fn((data: any) => data?._fakeTotal ?? 0),
  buildBriefingSubject: vi.fn(() => "Daily briefing"),
  buildBriefingHtml: vi.fn(() => "<html>briefing</html>"),
}));

vi.mock("../src/lib/cron-auth", () => ({
  validateCronSecret: vi.fn().mockReturnValue(true),
}));

import { prisma } from "../src/lib/prisma";
import { sendEmail } from "../src/lib/email";
import { classifyCases } from "../src/lib/digest-builder";
import { fetchBriefingData } from "../src/lib/daily-briefing-builder";
import { validateCronSecret } from "../src/lib/cron-auth";

import { GET as digestGET } from "../src/app/api/cron/digest-isd/route";
import { GET as briefingGET } from "../src/app/api/cron/daily-briefing/route";

const orgFindMany = prisma.organization.findMany as unknown as ReturnType<typeof vi.fn>;
const caseFindMany = prisma.case.findMany as unknown as ReturnType<typeof vi.fn>;
const memFindMany = prisma.membership.findMany as unknown as ReturnType<typeof vi.fn>;
const emailMock = sendEmail as unknown as ReturnType<typeof vi.fn>;
const classifyMock = classifyCases as unknown as ReturnType<typeof vi.fn>;
const fetchBriefingMock = fetchBriefingData as unknown as ReturnType<typeof vi.fn>;
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
  orgFindMany.mockReset();
  caseFindMany.mockReset();
  memFindMany.mockReset();
  emailMock.mockReset();
  classifyMock.mockReset();
  fetchBriefingMock.mockReset();
  authMock.mockReset();
  authMock.mockReturnValue(true);
  emailMock.mockResolvedValue(undefined);
  // Default classifier behavior: pass urgency from _fakeUrgency field.
  classifyMock.mockImplementation((cases: any[]) =>
    cases.map((c) => ({ ...c, urgency: c._fakeUrgency ?? "calm" }))
  );
}

// ─── /api/cron/digest-isd ──────────────────────────────────

describe("cron /digest-isd", () => {
  beforeEach(resetAll);

  it("rechaza 401 si el secret no es valido", async () => {
    authMock.mockReturnValueOnce(false);
    const res = await digestGET(reqWith());
    expect(res.status).toBe(401);
    expect(orgFindMany).not.toHaveBeenCalled();
  });

  it("skip si no es lunes y no se fuerza con ?force=1", async () => {
    // Forzar que hoy no sea lunes mockeando Date.prototype.getDay
    const original = Date.prototype.getDay;
    Date.prototype.getDay = function () { return 3; }; // miercoles
    try {
      const res = await digestGET(reqWith());
      const body = await res.json();
      expect(body.skipped).toBe(true);
      expect(body.reason).toMatch(/Monday/);
      expect(orgFindMany).not.toHaveBeenCalled();
    } finally {
      Date.prototype.getDay = original;
    }
  });

  it("?force=1 ejecuta aunque no sea lunes", async () => {
    const original = Date.prototype.getDay;
    Date.prototype.getDay = function () { return 3; };
    try {
      orgFindMany.mockResolvedValueOnce([]);
      const res = await digestGET(reqWith({ force: "1" }));
      const body = await res.json();
      expect(body.skipped).toBeUndefined();
      expect(orgFindMany).toHaveBeenCalled();
    } finally {
      Date.prototype.getDay = original;
    }
  });

  it("no envia email si ningun expediente esta en estado critical/warning", async () => {
    const original = Date.prototype.getDay;
    Date.prototype.getDay = function () { return 1; };
    try {
      orgFindMany.mockResolvedValueOnce([{ id: "org1", name: "Despacho A" }]);
      caseFindMany.mockResolvedValueOnce([
        { id: "c1", ref: "EXP-1", province: "Madrid", deceased: { fullName: "X", deathDate: new Date() }, contact: null, _fakeUrgency: "calm" },
      ]);

      const res = await digestGET(reqWith());
      const body = await res.json();

      expect(body.totalSent).toBe(0);
      expect(body.orgs[0].skipped).toBe(true);
      expect(emailMock).not.toHaveBeenCalled();
    } finally {
      Date.prototype.getDay = original;
    }
  });

  it("envia digest a admins con weeklyDigest=true cuando hay casos critical", async () => {
    const original = Date.prototype.getDay;
    Date.prototype.getDay = function () { return 1; };
    try {
      orgFindMany.mockResolvedValueOnce([{ id: "org1", name: "Despacho A" }]);
      caseFindMany.mockResolvedValueOnce([
        { id: "c1", ref: "EXP-1", province: "Madrid", deceased: { fullName: "X", deathDate: new Date() }, contact: null, _fakeUrgency: "critical" },
      ]);
      memFindMany.mockResolvedValueOnce([
        { notifPrefs: { weeklyDigest: true }, user: { email: "owner@a.com", name: "Andrea" } },
        { notifPrefs: { weeklyDigest: false }, user: { email: "opt-out@a.com", name: "Bruno" } },
      ]);

      const res = await digestGET(reqWith());
      const body = await res.json();

      expect(body.totalSent).toBe(1);
      expect(emailMock).toHaveBeenCalledOnce();
      expect(emailMock.mock.calls[0][0].to).toBe("owner@a.com");
      expect(emailMock.mock.calls[0][0].subject).toMatch(/⚠️.*ISD urgente/);
    } finally {
      Date.prototype.getDay = original;
    }
  });

  it("dryRun=1 contabiliza pero no envia emails", async () => {
    const original = Date.prototype.getDay;
    Date.prototype.getDay = function () { return 1; };
    try {
      orgFindMany.mockResolvedValueOnce([{ id: "org1", name: "Despacho A" }]);
      caseFindMany.mockResolvedValueOnce([
        { id: "c1", ref: "EXP-1", province: "Madrid", deceased: { fullName: "X", deathDate: new Date() }, contact: null, _fakeUrgency: "warning" },
      ]);
      memFindMany.mockResolvedValueOnce([
        { notifPrefs: { weeklyDigest: true }, user: { email: "owner@a.com", name: "Andrea" } },
      ]);

      const res = await digestGET(reqWith({ dry: "1" }));
      const body = await res.json();

      expect(body.dryRun).toBe(true);
      expect(emailMock).not.toHaveBeenCalled();
    } finally {
      Date.prototype.getDay = original;
    }
  });

  it("captura errores por org y sigue con las siguientes (no rompe todo el cron)", async () => {
    const original = Date.prototype.getDay;
    Date.prototype.getDay = function () { return 1; };
    try {
      orgFindMany.mockResolvedValueOnce([
        { id: "org1", name: "Despacho A" },
        { id: "org2", name: "Despacho B" },
      ]);
      caseFindMany
        .mockRejectedValueOnce(new Error("DB timeout en org1"))
        .mockResolvedValueOnce([]);

      const res = await digestGET(reqWith());
      const body = await res.json();

      expect(body.orgs[0].error).toMatch(/DB timeout/);
      expect(body.orgs[1].skipped).toBe(true);
    } finally {
      Date.prototype.getDay = original;
    }
  });
});

// ─── /api/cron/daily-briefing ──────────────────────────────

describe("cron /daily-briefing", () => {
  beforeEach(resetAll);

  it("rechaza 401 si el secret no es valido", async () => {
    authMock.mockReturnValueOnce(false);
    const res = await briefingGET(reqWith());
    expect(res.status).toBe(401);
    expect(memFindMany).not.toHaveBeenCalled();
  });

  it("salta usuarios con prefs.dailyBriefing=false", async () => {
    memFindMany.mockResolvedValueOnce([
      { orgId: "o1", userId: "u1", notifPrefs: { dailyBriefing: false }, user: { id: "u1", name: "X", email: "x@x.com" } },
    ]);

    const res = await briefingGET(reqWith());
    const body = await res.json();

    expect(body.sent).toBe(0);
    expect(body.results[0].skipped).toBe("preference");
    expect(fetchBriefingMock).not.toHaveBeenCalled();
    expect(emailMock).not.toHaveBeenCalled();
  });

  it("no envia email si el user no tiene items en su briefing", async () => {
    memFindMany.mockResolvedValueOnce([
      { orgId: "o1", userId: "u1", notifPrefs: { dailyBriefing: true }, user: { id: "u1", name: "X", email: "x@x.com" } },
    ]);
    fetchBriefingMock.mockResolvedValueOnce({ _fakeTotal: 0, dueTomorrow: [] });

    const res = await briefingGET(reqWith());
    const body = await res.json();

    expect(body.sent).toBe(0);
    expect(emailMock).not.toHaveBeenCalled();
  });

  it("envia email cuando el briefing tiene items", async () => {
    memFindMany.mockResolvedValueOnce([
      { orgId: "o1", userId: "u1", notifPrefs: { dailyBriefing: true }, user: { id: "u1", name: "Andrea", email: "a@a.com" } },
    ]);
    fetchBriefingMock.mockResolvedValueOnce({
      _fakeTotal: 3,
      dueTomorrow: [],
      overdueTasks: [],
      isdCritical: [],
      dueToday: [],
    });

    const res = await briefingGET(reqWith());
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(emailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "a@a.com" }));
  });

  it("dryRun=1 no envia email aunque haya items", async () => {
    memFindMany.mockResolvedValueOnce([
      { orgId: "o1", userId: "u1", notifPrefs: { dailyBriefing: true }, user: { id: "u1", name: "A", email: "a@a.com" } },
    ]);
    fetchBriefingMock.mockResolvedValueOnce({
      _fakeTotal: 5,
      dueTomorrow: [],
      overdueTasks: [],
      isdCritical: [],
      dueToday: [],
    });

    const res = await briefingGET(reqWith({ dry: "1" }));
    const body = await res.json();

    expect(body.dryRun).toBe(true);
    expect(body.sent).toBe(0);
    expect(emailMock).not.toHaveBeenCalled();
  });

  it("captura errores por usuario y sigue con los siguientes", async () => {
    memFindMany.mockResolvedValueOnce([
      { orgId: "o1", userId: "u1", notifPrefs: { dailyBriefing: true }, user: { id: "u1", name: "A", email: "a@a.com" } },
      { orgId: "o2", userId: "u2", notifPrefs: { dailyBriefing: true }, user: { id: "u2", name: "B", email: "b@b.com" } },
    ]);
    fetchBriefingMock
      .mockRejectedValueOnce(new Error("DB hot"))
      .mockResolvedValueOnce({ _fakeTotal: 1, dueTomorrow: [], overdueTasks: [], isdCritical: [], dueToday: [] });

    const res = await briefingGET(reqWith());
    const body = await res.json();

    expect(body.results[0].error).toMatch(/DB hot/);
    expect(body.results[1].sent).toBe(true);
    expect(emailMock).toHaveBeenCalledOnce();
    expect(emailMock.mock.calls[0][0].to).toBe("b@b.com");
  });

  it("salta memberships sin email", async () => {
    memFindMany.mockResolvedValueOnce([
      { orgId: "o1", userId: "u1", notifPrefs: { dailyBriefing: true }, user: { id: "u1", name: "X", email: null } },
    ]);

    const res = await briefingGET(reqWith());
    const body = await res.json();

    expect(body.sent).toBe(0);
    expect(body.results).toHaveLength(0); // continue antes de push
    expect(emailMock).not.toHaveBeenCalled();
  });
});
