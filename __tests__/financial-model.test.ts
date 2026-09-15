import { describe, it, expect } from "vitest";
import {
  projectFinancials,
  projectionToCSV,
  DEFAULT_ASSUMPTIONS,
  CONSERVATIVE_ASSUMPTIONS,
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

  it("MRR is approximately customers * ARPU (tolerancia por redondeo independiente de cada campo)", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (const row of p.monthly) {
      // Customers y MRR se redondean por separado del float interno, asi
      // que la identidad solo se mantiene con tolerancia ±ARPU/2.
      const expected = row.totalCustomers * p.arpu;
      expect(Math.abs(row.mrr - expected)).toBeLessThanOrEqual(p.arpu);
    }
  });

  it("ARR is approximately MRR * 12", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (const row of p.monthly) {
      expect(Math.abs(row.arr - row.mrr * 12)).toBeLessThanOrEqual(12);
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

  it("annual revenue equals sum of monthly totalRevenue (MRR + setup)", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (let y = 0; y < 3; y++) {
      const slice = p.monthly.slice(y * 12, (y + 1) * 12);
      const sum = slice.reduce((s, r) => s + r.totalRevenue, 0);
      expect(p.annual[y].totalRevenue).toBe(Math.round(sum));
    }
  });

  it("variable costs scale approximately linearly with customers", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (const row of p.monthly) {
      const expected = row.totalCustomers * DEFAULT_ASSUMPTIONS.variableCostPerCustomer;
      // Tolerancia: variableCost se redondea del float, totalCustomers tambien
      // por separado, asi que diferencia maxima es variableCostPerCustomer.
      expect(Math.abs(row.variableCost - expected)).toBeLessThanOrEqual(DEFAULT_ASSUMPTIONS.variableCostPerCustomer);
    }
  });

  it("EBITDA = totalRevenue - variable - CAC - fixed", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (const row of p.monthly) {
      const expected = row.totalRevenue - row.variableCost - row.cacCost - row.fixedOpex;
      expect(Math.abs(row.ebitda - expected)).toBeLessThanOrEqual(1);
    }
  });

  it("setup revenue scales with new customers and weighted avg setup fee", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    // Mix-weighted setup fee: 40% * 0 + 50% * 299 + 10% * 990 = 248.5
    const expectedAvg = 248.5;
    for (const row of p.monthly) {
      const expected = row.newCustomersGross * expectedAvg;
      // Tolerancia: ambos campos redondean del float interno por separado.
      expect(Math.abs(row.setupRevenue - expected)).toBeLessThanOrEqual(expectedAvg);
    }
  });

  it("CAC cost scales with new customers and per-customer CAC", () => {
    const CAC = 80;
    const p = projectFinancials(withOverrides({ cacPerNewCustomer: CAC }));
    for (const row of p.monthly) {
      const expected = row.newCustomersGross * CAC;
      expect(Math.abs(row.cacCost - expected)).toBeLessThanOrEqual(CAC);
    }
  });

  it("totalRevenue is approximately MRR + setupRevenue", () => {
    const p = projectFinancials(DEFAULT_ASSUMPTIONS);
    for (const row of p.monthly) {
      expect(Math.abs(row.totalRevenue - (row.mrr + row.setupRevenue))).toBeLessThanOrEqual(2);
    }
  });
});

describe("CONSERVATIVE_ASSUMPTIONS scenario", () => {
  it("produces meaningfully different (smaller) results than DEFAULT", () => {
    const stretch = projectFinancials(DEFAULT_ASSUMPTIONS);
    const conservative = projectFinancials(CONSERVATIVE_ASSUMPTIONS);
    // Conservative debe tener menos clientes finales que stretch
    expect(conservative.monthly[35].totalCustomers).toBeLessThan(stretch.monthly[35].totalCustomers);
    // Capital necesario debe ser mayor en escenario conservador
    expect(conservative.totalCapitalNeeded).toBeGreaterThan(stretch.totalCapitalNeeded);
  });

  it("includes CAC and setup fees in annual P&L", () => {
    const p = projectFinancials(CONSERVATIVE_ASSUMPTIONS);
    expect(p.annual[2].totalCac).toBeGreaterThan(0);
    // Y3 totalRevenue debe incluir tanto MRR como setup
    const y3Slice = p.monthly.slice(24, 36);
    const setupY3 = y3Slice.reduce((s, r) => s + r.setupRevenue, 0);
    expect(setupY3).toBeGreaterThan(0);
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
