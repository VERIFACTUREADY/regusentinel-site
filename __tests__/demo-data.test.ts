import { describe, it, expect } from "vitest";

const DEMO_ORG_SLUG = "gestoria-demo";
const DEMO_OWNER_EMAIL = "admin@heredia.app";
const DEMO_OPERATOR_EMAIL = "operador@heredia.app";
const DEMO_VIEWER_EMAIL = "viewer@heredia.app";
const DEMO_PASSWORD = "admin123";

const VALID_STATUSES = ["INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS", "READY_TO_SEND", "SENT", "FOLLOW_UP", "CLOSED", "ARCHIVED"];

const DEMO_CASE_SPECS = [
  { ref: "EXP-DEMO-0001", status: "INTAKE", deathDaysAgo: 4 },
  { ref: "EXP-DEMO-0002", status: "IN_PROGRESS", deathDaysAgo: 62 },
  { ref: "EXP-DEMO-0003", status: "PENDING_DOCS", deathDaysAgo: 125 },
  { ref: "EXP-DEMO-0004", status: "FOLLOW_UP", deathDaysAgo: 168, isUrgent: true },
  { ref: "EXP-DEMO-0005", status: "CLOSED", deathDaysAgo: 205 },
  { ref: "EXP-DEMO-0006", status: "SENT", deathDaysAgo: 310 },
];

describe("Demo data constants", () => {
  it("demo org slug is non-empty and lowercase", () => {
    expect(DEMO_ORG_SLUG).toMatch(/^[a-z0-9-]+$/);
  });

  it("demo emails are valid format", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test(DEMO_OWNER_EMAIL)).toBe(true);
    expect(emailRegex.test(DEMO_OPERATOR_EMAIL)).toBe(true);
    expect(emailRegex.test(DEMO_VIEWER_EMAIL)).toBe(true);
  });

  it("all demo emails are distinct", () => {
    const emails = new Set([DEMO_OWNER_EMAIL, DEMO_OPERATOR_EMAIL, DEMO_VIEWER_EMAIL]);
    expect(emails.size).toBe(3);
  });

  it("demo password is at least 6 characters", () => {
    expect(DEMO_PASSWORD.length).toBeGreaterThanOrEqual(6);
  });

  it("all case refs have the EXP-DEMO- prefix", () => {
    for (const spec of DEMO_CASE_SPECS) {
      expect(spec.ref).toMatch(/^EXP-DEMO-\d{4}$/);
    }
  });

  it("all case refs are unique", () => {
    const refs = new Set(DEMO_CASE_SPECS.map((s) => s.ref));
    expect(refs.size).toBe(DEMO_CASE_SPECS.length);
  });

  it("all case statuses are valid CaseStatus values", () => {
    for (const spec of DEMO_CASE_SPECS) {
      expect(VALID_STATUSES).toContain(spec.status);
    }
  });

  it("deathDaysAgo spans from recent to >6 months to cover all ISD buckets", () => {
    const minDays = Math.min(...DEMO_CASE_SPECS.map((s) => s.deathDaysAgo));
    const maxDays = Math.max(...DEMO_CASE_SPECS.map((s) => s.deathDaysAgo));
    expect(minDays).toBeLessThan(7);
    expect(maxDays).toBeGreaterThan(180);
  });

  it("at least one case is marked urgent", () => {
    expect(DEMO_CASE_SPECS.some((s) => s.isUrgent)).toBe(true);
  });

  it("covers at least 4 different statuses", () => {
    const statuses = new Set(DEMO_CASE_SPECS.map((s) => s.status));
    expect(statuses.size).toBeGreaterThanOrEqual(4);
  });
});
