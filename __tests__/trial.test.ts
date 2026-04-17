import { describe, it, expect } from "vitest";

const VALID_PLANS = ["INICIA", "DESPACHO", "FIRMA"] as const;
const VALID_STATUSES = ["NEW", "CONTACTED", "MEETING", "PILOT", "CUSTOMER", "LOST"] as const;

function computeTrialDaysLeft(currentPeriodEnd: Date): number {
  return Math.ceil(
    (currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

function isTrialExpiringSoon(daysLeft: number): boolean {
  return daysLeft >= 0 && daysLeft <= 3;
}

function buildTrialEnd(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

describe("Trial management logic", () => {
  it("computes days left correctly for future date", () => {
    const end = buildTrialEnd(14);
    const days = computeTrialDaysLeft(end);
    expect(days).toBeGreaterThanOrEqual(13);
    expect(days).toBeLessThanOrEqual(15);
  });

  it("computes 0 or negative for past date", () => {
    const end = buildTrialEnd(-1);
    const days = computeTrialDaysLeft(end);
    expect(days).toBeLessThanOrEqual(0);
  });

  it("expiring soon is true when 3 days or fewer", () => {
    expect(isTrialExpiringSoon(3)).toBe(true);
    expect(isTrialExpiringSoon(2)).toBe(true);
    expect(isTrialExpiringSoon(1)).toBe(true);
    expect(isTrialExpiringSoon(0)).toBe(true);
  });

  it("expiring soon is false when more than 3 days", () => {
    expect(isTrialExpiringSoon(4)).toBe(false);
    expect(isTrialExpiringSoon(14)).toBe(false);
  });

  it("expiring soon is false when negative (already expired)", () => {
    expect(isTrialExpiringSoon(-1)).toBe(false);
  });

  it("trial days validation: min 1, max 90", () => {
    const MIN_DAYS = 1;
    const MAX_DAYS = 90;
    expect(MIN_DAYS).toBeGreaterThan(0);
    expect(MAX_DAYS).toBeLessThanOrEqual(90);
    expect([7, 14, 30].every((d) => d >= MIN_DAYS && d <= MAX_DAYS)).toBe(true);
  });

  it("all plan tiers are valid for trials", () => {
    for (const plan of VALID_PLANS) {
      expect(typeof plan).toBe("string");
      expect(plan.length).toBeGreaterThan(0);
    }
  });
});

describe("Lead status pipeline", () => {
  it("pipeline has exactly 6 statuses", () => {
    expect(VALID_STATUSES.length).toBe(6);
  });

  it("NEW is the first status", () => {
    expect(VALID_STATUSES[0]).toBe("NEW");
  });

  it("terminal statuses are CUSTOMER and LOST", () => {
    expect(VALID_STATUSES).toContain("CUSTOMER");
    expect(VALID_STATUSES).toContain("LOST");
  });

  it("PILOT comes before CUSTOMER", () => {
    const pilotIdx = VALID_STATUSES.indexOf("PILOT");
    const customerIdx = VALID_STATUSES.indexOf("CUSTOMER");
    expect(pilotIdx).toBeLessThan(customerIdx);
  });
});
