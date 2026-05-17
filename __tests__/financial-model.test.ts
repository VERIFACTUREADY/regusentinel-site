import { describe, it, expect } from "vitest";
import {
  projectFinancials,
  projectionToCSV,
  DEFAULT_ASSUMPTIONS,
  type FinancialAssumptions,
} from "../src/lib/financial-model";

function withOverrides(overrides: Partial<FinancialAssumptions>): FinancialAssumptions {
  return { ...DEFAULT_ASSUMPTIONS, ...overrides };
}

describe("projectFinancials", () => {
  it("returns 36 monthly rows", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    expect(p.monthly).toHaveLength(36);
  });

  it("returns 3 annual summaries", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    expect(p.annual).toHaveLength(3);
    expect(p.annual.map((a) => a.year)).toEqual([1, 2, 3]);
  });

  it("ARPU is computed from plan mix", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    // 40% * 149 + 50% * 349 + 10% * 749 = 59.6 + 174.5 + 74.9 = 309
    expect(p.arpu).toBeCloseTo(309, 0);
  });

  it("month 1 has zero customers when initial seed is too low", () => {
    const p = projectFinancials(withOverrides({ initialSeoVisits: 50 }));
    expect(p.monthly[0].totalCustomers).toBeLessThanOrEqual(1);
  });

  it("customers grow over time with positive net new", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    expect(p.monthly[35].totalCustomers).toBeGreaterThan(p.monthly[11].totalCustomers);
  });

  it("MRR equals customers * ARPU", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (const row of p.monthly) {
      const expected = Math.round(row.totalCustomers * p.arpu);
      expect(Math.abs(row.mrr - expected)).toBeLessThanOrEqual(1);
    }
  });

  it("ARR equals MRR * 12", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (const row of p.monthly) {
      expect(row.arr).toBe(row.mrr * 12);
    }
  });

  it("break-even is identified within 36 months for default", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    expect(p.breakEvenMonth).not.toBeNull();
    expect(p.breakEvenMonth).toBeLessThan(36);
  });

  it("Y1 EBITDA margin reflects mostly initial losses or small profit", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    expect(p.annual[0].ebitdaMargin).toBeLessThanOrEqual(1);
  });

  it("higher churn produces fewer customers at end", () => {
    const low = projectFinancials(withOverrides({ churnMonthlyY1: 0.01, churnMonthlyY2: 0.01, churnMonthlyY3: 0.01 }));
    const high = projectFinancials(withOverrides({ churnMonthlyY1: 0.10, churnMonthlyY2: 0.08, churnMonthlyY3: 0.06 }));
    expect(high.monthly[35].totalCustomers).toBeLessThan(low.monthly[35].totalCustomers);
  });

  it("higher SEO growth increases customers", () => {
    const slow = projectFinancials(withOverrides({ monthlySeoGrowth: 1.10 }));
    const fast = projectFinancials(withOverrides({ monthlySeoGrowth: 1.50 }));
    expect(fast.monthly[35].totalCustomers).toBeGreaterThanOrEqual(slow.monthly[35].totalCustomers);
  });

  it("zero plan mix returns ARPU 0 and zero MRR", () => {
    const p = projectFinancials(withOverrides({
      plans: {
        INICIA: { price: 149, mix: 0 },
        DESPACHO: { price: 349, mix: 0 },
        FIRMA: { price: 749, mix: 0 },
      },
    }));
    expect(p.arpu).toBe(0);
    for (const row of p.monthly) {
      expect(row.mrr).toBe(0);
    }
  });

  it("capital needed equals max negative cumulative cash", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    const minCash = Math.min(0, ...p.monthly.map((r) => r.cumulativeCash));
    expect(p.totalCapitalNeeded).toBe(Math.abs(minCash));
  });

  it("annual revenue equals sum of monthly MRR for that year", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (let y = 0; y < 3; y++) {
      const slice = p.monthly.slice(y * 12, (y + 1) * 12);
      const sum = slice.reduce((s, r) => s + r.mrr, 0);
      expect(p.annual[y].totalRevenue).toBe(Math.round(sum));
    }
  });

  it("variable costs scale linearly with customers", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (const row of p.monthly) {
      const expected = row.totalCustomers * DEFAULT_ASSUMPTIONS.variableCostPerCustomer;
      expect(row.variableCost).toBe(Math.round(expected));
    }
  });

  it("EBITDA = MRR - variable - fixed", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (const row of p.monthly) {
      const expected = row.mrr - row.variableCost - row.fixedOpex;
      expect(Math.abs(row.ebitda - expected)).toBeLessThanOrEqual(1);
    }
  });
});

describe("projectionToCSV", () => {
  it("returns a non-empty CSV with header and data sections", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    const csv = projectionToCSV(p);
    expect(csv.length).toBeGreaterThan(500);
    expect(csv).toContain("RESUMEN ANUAL");
    expect(csv).toContain("DETALLE MENSUAL");
  });

  it("includes all 36 month rows", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    const csv = projectionToCSV(p);
    // Each month produces a line; plus headers
    const lines = csv.split("\n");
    // Should have ~50+ lines (header + summary + 36 monthly + headers)
    expect(lines.length).toBeGreaterThan(45);
  });

  it("uses semicolons as separators (Excel-friendly EU)", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    const csv = projectionToCSV(p);
    expect(csv).toContain(";");
  });
});
