import { describe, it, expect } from "vitest";
import {
  buildPostMortemGuide,
  summarizeGuide,
  PHASE_LABELS,
  type GuideInput,
} from "../src/lib/post-mortem-guide";

function daysAgo(d: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date;
}

function baseInput(overrides: Partial<GuideInput> = {}): GuideInput {
  return {
    deathDate: daysAgo(30),
    province: "madrid",
    hasWill: true,
    hasRealEstate: false,
    hasLifeInsurance: false,
    hasVehicles: false,
    hasBusiness: false,
    ...overrides,
  };
}

describe("buildPostMortemGuide", () => {
  it("returns base steps for minimal input", () => {
    const steps = buildPostMortemGuide(baseInput());
    expect(steps.length).toBeGreaterThan(5);
    // Always includes the Modelo 650 step
    expect(steps.some((s) => s.id === "modelo-650")).toBe(true);
  });

  it("includes copia-testamento when hasWill is true", () => {
    const steps = buildPostMortemGuide(baseInput({ hasWill: true }));
    expect(steps.some((s) => s.id === "copia-testamento")).toBe(true);
    expect(steps.some((s) => s.id === "declaracion-herederos")).toBe(false);
  });

  it("includes declaracion-herederos when hasWill is false", () => {
    const steps = buildPostMortemGuide(baseInput({ hasWill: false }));
    expect(steps.some((s) => s.id === "declaracion-herederos")).toBe(true);
    expect(steps.some((s) => s.id === "copia-testamento")).toBe(false);
  });

  it("includes real-estate steps only when hasRealEstate is true", () => {
    const without = buildPostMortemGuide(baseInput({ hasRealEstate: false }));
    const withRE = buildPostMortemGuide(baseInput({ hasRealEstate: true }));
    expect(without.some((s) => s.id === "tasacion-inmuebles")).toBe(false);
    expect(without.some((s) => s.id === "plusvalia-municipal")).toBe(false);
    expect(withRE.some((s) => s.id === "tasacion-inmuebles")).toBe(true);
    expect(withRE.some((s) => s.id === "plusvalia-municipal")).toBe(true);
    expect(withRE.some((s) => s.id === "cambio-titularidad-inmuebles")).toBe(true);
  });

  it("includes insurance steps only when hasLifeInsurance is true", () => {
    const withIns = buildPostMortemGuide(baseInput({ hasLifeInsurance: true }));
    expect(withIns.some((s) => s.id === "reclamar-seguros")).toBe(true);
    const without = buildPostMortemGuide(baseInput({ hasLifeInsurance: false }));
    expect(without.some((s) => s.id === "reclamar-seguros")).toBe(false);
  });

  it("includes vehicle step only when hasVehicles is true", () => {
    expect(
      buildPostMortemGuide(baseInput({ hasVehicles: true })).some((s) => s.id === "cambio-titularidad-vehiculos")
    ).toBe(true);
    expect(
      buildPostMortemGuide(baseInput({ hasVehicles: false })).some((s) => s.id === "cambio-titularidad-vehiculos")
    ).toBe(false);
  });

  it("includes business step only when hasBusiness is true", () => {
    expect(
      buildPostMortemGuide(baseInput({ hasBusiness: true })).some((s) => s.id === "valoracion-negocio")
    ).toBe(true);
    expect(
      buildPostMortemGuide(baseInput({ hasBusiness: false })).some((s) => s.id === "valoracion-negocio")
    ).toBe(false);
  });

  it("steps are ordered by deadlineDays ascending", () => {
    const steps = buildPostMortemGuide(baseInput({ hasRealEstate: true }));
    let lastDeadline = -Infinity;
    for (const s of steps) {
      if (s.deadlineDays == null) continue;
      expect(s.deadlineDays).toBeGreaterThanOrEqual(lastDeadline);
      lastDeadline = s.deadlineDays;
    }
  });

  it("computes deadlineDate when deathDate is provided", () => {
    const death = daysAgo(10);
    const steps = buildPostMortemGuide(baseInput({ deathDate: death }));
    const isd = steps.find((s) => s.id === "modelo-650")!;
    expect(isd.deadlineDate).not.toBeNull();
    // ISD deadline = death + 180 days
    const expected = new Date(death.getTime() + 180 * 86400000);
    expect(Math.abs(isd.deadlineDate!.getTime() - expected.getTime())).toBeLessThan(86400000);
  });

  it("deadlineDate is null when deathDate is null", () => {
    const steps = buildPostMortemGuide(baseInput({ deathDate: null }));
    for (const s of steps) {
      expect(s.deadlineDate).toBeNull();
    }
  });

  it("marks steps as overdue when their deadline has passed", () => {
    // Death 200 days ago -> ISD (180d) is overdue
    const steps = buildPostMortemGuide(baseInput({ deathDate: daysAgo(200) }));
    const isd = steps.find((s) => s.id === "modelo-650")!;
    expect(isd.urgency).toBe("overdue");
  });

  it("marks early steps as overdue and ISD as later for a fresh death", () => {
    const steps = buildPostMortemGuide(baseInput({ deathDate: daysAgo(2) }));
    const isd = steps.find((s) => s.id === "modelo-650")!;
    expect(isd.urgency).toBe("later");
  });
});

describe("summarizeGuide", () => {
  it("counts total steps", () => {
    const input = baseInput({ hasRealEstate: true, hasLifeInsurance: true });
    const steps = buildPostMortemGuide(input);
    const summary = summarizeGuide(steps, input);
    expect(summary.totalSteps).toBe(steps.length);
  });

  it("computes daysUntilISD from deathDate", () => {
    const input = baseInput({ deathDate: daysAgo(30) });
    const steps = buildPostMortemGuide(input);
    const summary = summarizeGuide(steps, input);
    // 180 - 30 = ~150 days remaining
    expect(summary.daysUntilISD).toBeGreaterThan(145);
    expect(summary.daysUntilISD).toBeLessThan(155);
  });

  it("daysUntilISD is null when deathDate is null", () => {
    const input = baseInput({ deathDate: null });
    const steps = buildPostMortemGuide(input);
    const summary = summarizeGuide(steps, input);
    expect(summary.daysUntilISD).toBeNull();
  });

  it("overdue count is positive for an old death", () => {
    const input = baseInput({ deathDate: daysAgo(220) });
    const steps = buildPostMortemGuide(input);
    const summary = summarizeGuide(steps, input);
    expect(summary.overdue).toBeGreaterThan(0);
  });
});

describe("PHASE_LABELS", () => {
  it("has a label for every phase used by the steps", () => {
    const steps = buildPostMortemGuide(baseInput({ hasRealEstate: true, hasVehicles: true, hasBusiness: true, hasLifeInsurance: true }));
    for (const s of steps) {
      expect(PHASE_LABELS[s.phase]).toBeTruthy();
    }
  });
});
