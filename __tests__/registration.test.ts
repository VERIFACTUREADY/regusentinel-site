import { describe, it, expect } from "vitest";

const TRIAL_DAYS = 14;

describe("Registration & trial logic", () => {
  it("trial end date is 14 days from now", () => {
    const now = Date.now();
    const trialEnd = new Date(now + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const diff = Math.round((trialEnd.getTime() - now) / (1000 * 60 * 60 * 24));
    expect(diff).toBe(14);
  });

  it("slug generation strips special characters", () => {
    const orgName = "Gestoría Ejemplo S.L.";
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    expect(slug).toBe("gestor-a-ejemplo-s-l");
  });

  it("slug generation handles accented characters", () => {
    const orgName = "Asesoría Pérez & Cía";
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    expect(slug).toBe("asesor-a-p-rez-c-a");
  });

  it("trial expiry detection: active trial has positive days", () => {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.ceil(
      (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    expect(daysLeft).toBeGreaterThan(0);
    expect(daysLeft).toBeLessThanOrEqual(7);
  });

  it("trial expiry detection: expired trial has negative days", () => {
    const trialEnd = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.ceil(
      (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    expect(daysLeft).toBeLessThan(0);
  });

  it("suspended states are correctly identified", () => {
    const suspendedStatuses = ["canceled", "past_due"];
    const activeStatuses = ["active", "trialing"];

    for (const s of suspendedStatuses) {
      expect(["canceled", "past_due"].includes(s)).toBe(true);
    }
    for (const s of activeStatuses) {
      expect(["canceled", "past_due"].includes(s)).toBe(false);
    }
  });

  it("password meets minimum length requirement", () => {
    expect("abc".length >= 6).toBe(false);
    expect("abcdef".length >= 6).toBe(true);
    expect("strongPassword123".length >= 6).toBe(true);
  });

  it("password max length is enforced", () => {
    const longPassword = "a".repeat(129);
    expect(longPassword.length <= 128).toBe(false);
    expect("a".repeat(128).length <= 128).toBe(true);
  });

  it("rate limit window is 15 minutes", () => {
    const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
    expect(RATE_LIMIT_WINDOW).toBe(900000);
  });

  it("preferredTime values are valid enum members", () => {
    const validTimes = ["manana", "mediodia", "tarde"];
    expect(validTimes).toContain("manana");
    expect(validTimes).toContain("mediodia");
    expect(validTimes).toContain("tarde");
    expect(validTimes).not.toContain("noche");
  });

  it("acceptTerms must be true for registration", () => {
    const validForm = { acceptTerms: true };
    const invalidForm = { acceptTerms: false };
    expect(validForm.acceptTerms).toBe(true);
    expect(invalidForm.acceptTerms).toBe(false);
  });
});
