import { describe, it, expect } from "vitest";
import { heuristicAnalysis } from "../src/lib/case-analyzer";

const aDay = 24 * 60 * 60 * 1000;

function buildCase(overrides: any = {}) {
  return {
    id: "case-1",
    ref: "EXP-001",
    status: "IN_PROGRESS",
    isUrgent: false,
    deceased: { fullName: "Juan Perez", deathDate: new Date(Date.now() - 30 * aDay) },
    contact: { fullName: "Maria Perez" },
    tasks: [],
    documents: [],
    ...overrides,
  };
}

describe("heuristicAnalysis", () => {
  it("returns excellent score for empty case with fresh death date", () => {
    const result = heuristicAnalysis(buildCase());
    expect(result.healthScore).toBeGreaterThanOrEqual(90);
    expect(result.status).toBe("excellent");
  });

  it("flags critical when ISD deadline is < 30 days", () => {
    const result = heuristicAnalysis(
      buildCase({ deceased: { fullName: "X", deathDate: new Date(Date.now() - 160 * aDay) } })
    );
    expect(result.criticalIssues.some((i) => i.title.includes("ISD"))).toBe(true);
    expect(result.suggestedActions.some((a) => a.title.includes("prorroga"))).toBe(true);
    expect(result.healthScore).toBeLessThan(80);
  });

  it("flags blocked tasks when 3+ are blocked", () => {
    const tasks = Array.from({ length: 3 }, (_, i) => ({
      id: `t${i}`,
      status: "BLOCKED",
      category: "BANCOS",
      title: `Tarea ${i}`,
    }));
    const result = heuristicAnalysis(buildCase({ tasks }));
    expect(result.criticalIssues.some((i) => i.title.includes("bloquead"))).toBe(true);
    expect(result.healthScore).toBeLessThan(90);
  });

  it("computes progress percentage in summary", () => {
    const tasks = [
      { id: "t1", status: "DONE", category: "BANCOS", title: "A" },
      { id: "t2", status: "DONE", category: "BANCOS", title: "B" },
      { id: "t3", status: "PENDING", category: "BANCOS", title: "C" },
      { id: "t4", status: "PENDING", category: "BANCOS", title: "D" },
    ];
    const result = heuristicAnalysis(buildCase({ tasks }));
    expect(result.summary).toContain("4 tareas");
    expect(result.summary).toContain("50%");
  });

  it("identifies overdue tasks", () => {
    const tasks = [
      {
        id: "t1",
        status: "PENDING",
        category: "BANCOS",
        title: "Vencida",
        deadline: new Date(Date.now() - 5 * aDay),
      },
    ];
    const result = heuristicAnalysis(buildCase({ tasks }));
    expect(result.suggestedActions.some((a) => a.title.includes("vencida"))).toBe(true);
  });

  it("clamps score within 0-100", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      status: "BLOCKED",
      category: "BANCOS",
      title: `T${i}`,
      deadline: new Date(Date.now() - 5 * aDay),
    }));
    const result = heuristicAnalysis(
      buildCase({
        tasks,
        deceased: { fullName: "X", deathDate: new Date(Date.now() - 170 * aDay) },
      })
    );
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
    expect(result.status).toBe("critical");
  });

  it("returns valid status enum", () => {
    const result = heuristicAnalysis(buildCase());
    expect(["excellent", "good", "warning", "critical"]).toContain(result.status);
  });

  it("includes generatedAt timestamp", () => {
    const result = heuristicAnalysis(buildCase());
    expect(result.generatedAt).toBeTruthy();
    expect(new Date(result.generatedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
