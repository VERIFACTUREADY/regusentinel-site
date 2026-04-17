import { describe, it, expect } from "vitest";

const plans = [
  { name: "Inicia", monthly: 149, annual: 1490, setup: 0, maxUsers: 2, includedCases: 15 },
  { name: "Despacho", monthly: 349, annual: 3490, setup: 299, maxUsers: 5, includedCases: 50 },
  { name: "Firma", monthly: 749, annual: 7490, setup: 990, maxUsers: 20, includedCases: 200 },
] as const;

describe("Pricing calculations", () => {
  it("annual price is always less than 12x monthly", () => {
    for (const plan of plans) {
      expect(plan.annual).toBeLessThan(plan.monthly * 12);
    }
  });

  it("annual discount is approximately 17% (2 months free)", () => {
    for (const plan of plans) {
      const fullYear = plan.monthly * 12;
      const discount = ((fullYear - plan.annual) / fullYear) * 100;
      expect(discount).toBeGreaterThanOrEqual(16);
      expect(discount).toBeLessThanOrEqual(18);
    }
  });

  it("savings label is correct (monthly*12 - annual)", () => {
    for (const plan of plans) {
      const saved = plan.monthly * 12 - plan.annual;
      expect(saved).toBeGreaterThan(0);
      expect(saved).toBe(plan.monthly * 12 - plan.annual);
    }
  });

  it("effective monthly rate when annual is less than monthly", () => {
    for (const plan of plans) {
      const effectiveMonthly = Math.round(plan.annual / 12);
      expect(effectiveMonthly).toBeLessThan(plan.monthly);
    }
  });

  it("plans are ordered by price ascending", () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].monthly).toBeGreaterThan(plans[i - 1].monthly);
      expect(plans[i].annual).toBeGreaterThan(plans[i - 1].annual);
    }
  });

  it("user limits scale with plan tier", () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].maxUsers).toBeGreaterThan(plans[i - 1].maxUsers);
    }
  });

  it("included cases scale with plan tier", () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].includedCases).toBeGreaterThan(plans[i - 1].includedCases);
    }
  });

  it("Inicia has no setup fee", () => {
    expect(plans[0].setup).toBe(0);
  });

  it("Despacho and Firma have setup fees", () => {
    expect(plans[1].setup).toBeGreaterThan(0);
    expect(plans[2].setup).toBeGreaterThan(0);
    expect(plans[2].setup).toBeGreaterThan(plans[1].setup);
  });
});
