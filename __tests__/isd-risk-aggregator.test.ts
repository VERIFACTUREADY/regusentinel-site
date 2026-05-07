import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma BEFORE importing the SUT so its top-level `import { prisma }`
// resolves to the mock, not the real client.
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    case: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../src/lib/prisma";
import { getOrgRiskOverview } from "../src/lib/isd-risk-aggregator";

const findMany = prisma.case.findMany as unknown as ReturnType<typeof vi.fn>;

function daysAgo(d: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date;
}

describe("getOrgRiskOverview", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("returns zeros when org has no cases", async () => {
    findMany.mockResolvedValueOnce([]);
    const result = await getOrgRiskOverview("org-1");
    expect(result.totalCasesAnalyzed).toBe(0);
    expect(result.totalActiveAlerts).toBe(0);
    expect(result.topCases).toEqual([]);
    expect(result.countsBySeverity).toEqual({ critical: 0, warning: 0, info: 0 });
  });

  it("counts severity correctly across multiple cases", async () => {
    findMany.mockResolvedValueOnce([
      // Case 1: ISD overdue (critical) and unknown_province (info)
      {
        id: "c1",
        ref: "EXP-001",
        province: null,
        deceased: { fullName: "Alice", deathDate: daysAgo(200) },
      },
      // Case 2: ISD 30d (warning) and missing_province (warning)
      {
        id: "c2",
        ref: "EXP-002",
        province: null,
        deceased: { fullName: "Bob", deathDate: daysAgo(160) },
      },
      // Case 3: clean (no risks)
      {
        id: "c3",
        ref: "EXP-003",
        province: "madrid",
        deceased: { fullName: "Carol", deathDate: daysAgo(7) },
      },
    ]);

    const result = await getOrgRiskOverview("org-1");
    expect(result.totalCasesAnalyzed).toBe(3);
    expect(result.countsBySeverity.critical).toBeGreaterThanOrEqual(1);
    expect(result.totalActiveAlerts).toBeGreaterThan(0);
    expect(result.topCases).toHaveLength(2); // c3 has no risks, excluded
  });

  it("sorts top cases with critical severity first", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "c-warn",
        ref: "EXP-WARN",
        province: "madrid",
        deceased: { fullName: "WarnGuy", deathDate: daysAgo(160) },
      },
      {
        id: "c-crit",
        ref: "EXP-CRIT",
        province: "madrid",
        deceased: { fullName: "CritGuy", deathDate: daysAgo(200) },
      },
    ]);

    const result = await getOrgRiskOverview("org-1");
    expect(result.topCases[0].topRiskSeverity).toBe("critical");
    expect(result.topCases[0].caseRef).toBe("EXP-CRIT");
  });

  it("respects the limit param", async () => {
    const cases = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      ref: `EXP-${i}`,
      province: null,
      deceased: { fullName: `Person${i}`, deathDate: daysAgo(200 + i) },
    }));
    findMany.mockResolvedValueOnce(cases);

    const result = await getOrgRiskOverview("org-1", 3);
    expect(result.topCases).toHaveLength(3);
    expect(result.totalCasesAnalyzed).toBe(10);
  });

  it("handles cases without deceased data", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "c1",
        ref: "EXP-NO-DEATH",
        province: "madrid",
        deceased: null,
      },
    ]);

    const result = await getOrgRiskOverview("org-1");
    expect(result.totalCasesAnalyzed).toBe(1);
    expect(result.totalActiveAlerts).toBe(0);
  });

  it("filters out closed cases via the where clause", async () => {
    findMany.mockResolvedValueOnce([]);
    await getOrgRiskOverview("org-1");
    const callArgs = findMany.mock.calls[0][0];
    expect(callArgs.where.status.notIn).toContain("CLOSED");
    expect(callArgs.where.status.notIn).toContain("ARCHIVED");
    expect(callArgs.where.deletedAt).toBeNull();
  });

  it("returns case ref and deceased name in summary", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "c1",
        ref: "EXP-XYZ",
        province: null,
        deceased: { fullName: "Test Person", deathDate: daysAgo(200) },
      },
    ]);

    const result = await getOrgRiskOverview("org-1");
    expect(result.topCases[0].caseRef).toBe("EXP-XYZ");
    expect(result.topCases[0].deceasedName).toBe("Test Person");
    expect(result.topCases[0].riskCount).toBeGreaterThan(0);
    expect(result.topCases[0].topRiskTitle).toBeTruthy();
  });
});
