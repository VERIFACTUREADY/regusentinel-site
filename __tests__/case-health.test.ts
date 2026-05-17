import { describe, it, expect } from "vitest";
import { computeCaseHealth, type CaseHealthInput } from "../src/lib/case-health";

function daysAgo(d: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date;
}

function baseInput(overrides: Partial<CaseHealthInput> = {}): CaseHealthInput {
  return {
    totalTasks: 10,
    doneTasks: 5,
    blockedTasks: 0,
    overdueTasks: 0,
    deathDate: daysAgo(30),
    province: "madrid",
    hasDeceasedName: true,
    hasContact: true,
    documentCount: 5,
    lastUpdatedAt: daysAgo(1),
    status: "INTAKE",
    ...overrides,
  };
}

describe("computeCaseHealth", () => {
  it("returns a score between 0 and 100", () => {
    const r = computeCaseHealth(baseInput());
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("returns 5 factors that sum to the score", () => {
    const r = computeCaseHealth(baseInput());
    expect(r.factors).toHaveLength(5);
    const sum = r.factors.reduce((s, f) => s + f.points, 0);
    expect(sum).toBe(r.score);
  });

  it("a perfect case scores high (grade A or B)", () => {
    const r = computeCaseHealth(baseInput({
      totalTasks: 10,
      doneTasks: 10,
      blockedTasks: 0,
      overdueTasks: 0,
      documentCount: 8,
      lastUpdatedAt: daysAgo(0),
      deathDate: daysAgo(10),
    }));
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(["A", "B"]).toContain(r.grade);
  });

  it("a neglected case scores low (grade D or E)", () => {
    const r = computeCaseHealth(baseInput({
      totalTasks: 10,
      doneTasks: 0,
      blockedTasks: 3,
      overdueTasks: 5,
      documentCount: 0,
      lastUpdatedAt: daysAgo(60),
      deathDate: daysAgo(200),
      province: null,
      hasContact: false,
    }));
    expect(r.score).toBeLessThan(40);
    expect(["D", "E"]).toContain(r.grade);
  });

  it("completion rate drives the progress factor", () => {
    const low = computeCaseHealth(baseInput({ totalTasks: 10, doneTasks: 1 }));
    const high = computeCaseHealth(baseInput({ totalTasks: 10, doneTasks: 9 }));
    const lowProg = low.factors.find((f) => f.key === "progress")!;
    const highProg = high.factors.find((f) => f.key === "progress")!;
    expect(highProg.points).toBeGreaterThan(lowProg.points);
  });

  it("overdue tasks reduce the deadline factor", () => {
    const clean = computeCaseHealth(baseInput({ overdueTasks: 0 }));
    const overdue = computeCaseHealth(baseInput({ overdueTasks: 4 }));
    const cleanDl = clean.factors.find((f) => f.key === "deadline")!;
    const overdueDl = overdue.factors.find((f) => f.key === "deadline")!;
    expect(overdueDl.points).toBeLessThan(cleanDl.points);
  });

  it("overdue ISD deadline penalizes the deadline factor", () => {
    const fresh = computeCaseHealth(baseInput({ deathDate: daysAgo(10) }));
    const overdue = computeCaseHealth(baseInput({ deathDate: daysAgo(220) }));
    const freshDl = fresh.factors.find((f) => f.key === "deadline")!;
    const overdueDl = overdue.factors.find((f) => f.key === "deadline")!;
    expect(overdueDl.points).toBeLessThan(freshDl.points);
  });

  it("closed cases are not penalized for past ISD deadline", () => {
    const openOverdue = computeCaseHealth(baseInput({ deathDate: daysAgo(220), status: "INTAKE" }));
    const closedOverdue = computeCaseHealth(baseInput({ deathDate: daysAgo(220), status: "CLOSED" }));
    const openDl = openOverdue.factors.find((f) => f.key === "deadline")!;
    const closedDl = closedOverdue.factors.find((f) => f.key === "deadline")!;
    expect(closedDl.points).toBeGreaterThanOrEqual(openDl.points);
  });

  it("missing data reduces the data factor and reports what's missing", () => {
    const r = computeCaseHealth(baseInput({
      hasDeceasedName: false,
      deathDate: null,
      province: null,
      hasContact: false,
    }));
    const dataFactor = r.factors.find((f) => f.key === "data")!;
    expect(dataFactor.points).toBe(0);
    expect(dataFactor.hint).toContain("provincia");
  });

  it("full data gives full data points and no hint", () => {
    const r = computeCaseHealth(baseInput());
    const dataFactor = r.factors.find((f) => f.key === "data")!;
    expect(dataFactor.points).toBe(dataFactor.maxPoints);
    expect(dataFactor.hint).toBeNull();
  });

  it("document count drives the docs factor", () => {
    const none = computeCaseHealth(baseInput({ documentCount: 0 }));
    const some = computeCaseHealth(baseInput({ documentCount: 5 }));
    const noneDocs = none.factors.find((f) => f.key === "docs")!;
    const someDocs = some.factors.find((f) => f.key === "docs")!;
    expect(noneDocs.points).toBe(0);
    expect(someDocs.points).toBe(someDocs.maxPoints);
  });

  it("stale cases lose recency points", () => {
    const recent = computeCaseHealth(baseInput({ lastUpdatedAt: daysAgo(1) }));
    const stale = computeCaseHealth(baseInput({ lastUpdatedAt: daysAgo(45) }));
    const recentR = recent.factors.find((f) => f.key === "recency")!;
    const staleR = stale.factors.find((f) => f.key === "recency")!;
    expect(recentR.points).toBe(recentR.maxPoints);
    expect(staleR.points).toBe(0);
  });

  it("topIssue points to the factor with the biggest loss", () => {
    const r = computeCaseHealth(baseInput({
      totalTasks: 10,
      doneTasks: 0, // big progress loss
      documentCount: 5,
    }));
    expect(r.topIssue).toBeTruthy();
    expect(r.topIssue).toContain("tarea");
  });

  it("case with no tasks gets a partial progress score with hint", () => {
    const r = computeCaseHealth(baseInput({ totalTasks: 0, doneTasks: 0 }));
    const prog = r.factors.find((f) => f.key === "progress")!;
    expect(prog.points).toBeGreaterThan(0);
    expect(prog.points).toBeLessThan(prog.maxPoints);
    expect(prog.hint).toContain("plantilla");
  });

  it("grade labels are consistent with score thresholds", () => {
    expect(computeCaseHealth(baseInput({ totalTasks: 10, doneTasks: 10, documentCount: 8, lastUpdatedAt: daysAgo(0), deathDate: daysAgo(5) })).grade).toBe("A");
    const critical = computeCaseHealth(baseInput({
      totalTasks: 10, doneTasks: 0, blockedTasks: 5, overdueTasks: 8,
      documentCount: 0, lastUpdatedAt: daysAgo(90), deathDate: daysAgo(300),
      province: null, hasContact: false, hasDeceasedName: false,
    }));
    expect(["D", "E"]).toContain(critical.grade);
  });
});
