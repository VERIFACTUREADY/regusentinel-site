import { describe, it, expect } from "vitest";
import { buildActionQueue, type QueueCaseInput } from "../src/lib/action-queue";
import type { NextActionTask } from "../src/lib/next-action";

function daysAgo(d: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date;
}

function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 86400000);
}

function task(overrides: Partial<NextActionTask> = {}): NextActionTask {
  return { id: "t1", title: "Tarea", status: "PENDING", deadline: null, ...overrides };
}

function caseInput(overrides: Partial<QueueCaseInput> = {}): QueueCaseInput {
  return {
    caseId: "c1",
    caseRef: "EXP-001",
    deceasedName: "Persona Ejemplo",
    caseStatus: "INTAKE",
    province: "madrid",
    deathDate: daysAgo(30),
    tasks: [],
    ...overrides,
  };
}

describe("buildActionQueue", () => {
  it("returns an empty queue for no cases", () => {
    const r = buildActionQueue([]);
    expect(r.items).toEqual([]);
    expect(r.totalCases).toBe(0);
  });

  it("computes a next action for each case", () => {
    const r = buildActionQueue([
      caseInput({ caseId: "a", caseRef: "EXP-A", tasks: [task({ deadline: daysFromNow(-5) })] }),
      caseInput({ caseId: "b", caseRef: "EXP-B", tasks: [task({ deadline: daysFromNow(20) })] }),
    ]);
    expect(r.items).toHaveLength(2);
    expect(r.items.every((i) => i.action.action.length > 0)).toBe(true);
  });

  it("sorts critical actions before lower urgency", () => {
    const r = buildActionQueue([
      caseInput({ caseId: "low", caseRef: "EXP-LOW", deathDate: daysAgo(5), tasks: [task({ deadline: daysFromNow(60) })] }),
      // death 200 days ago -> ISD overdue -> critical
      caseInput({ caseId: "crit", caseRef: "EXP-CRIT", deathDate: daysAgo(200) }),
    ]);
    expect(r.items[0].caseId).toBe("crit");
    expect(r.items[0].action.urgency).toBe("critical");
  });

  it("excludes closed cases (urgency none)", () => {
    const r = buildActionQueue([
      caseInput({ caseId: "closed", caseStatus: "CLOSED" }),
      caseInput({ caseId: "open", tasks: [task({ deadline: daysFromNow(-3) })] }),
    ]);
    expect(r.items.some((i) => i.caseId === "closed")).toBe(false);
    expect(r.items.some((i) => i.caseId === "open")).toBe(true);
  });

  it("counts cases by urgency", () => {
    const r = buildActionQueue([
      caseInput({ caseId: "crit", deathDate: daysAgo(200) }),
      caseInput({ caseId: "high", deathDate: daysAgo(30), tasks: [task({ deadline: daysFromNow(-10) })] }),
    ]);
    expect(r.countsByUrgency.critical).toBeGreaterThanOrEqual(1);
    expect(r.countsByUrgency.high).toBeGreaterThanOrEqual(1);
  });

  it("respects the limit", () => {
    const cases = Array.from({ length: 15 }, (_, i) =>
      caseInput({ caseId: `c${i}`, caseRef: `EXP-${i}`, deathDate: daysAgo(200 + i) })
    );
    const r = buildActionQueue(cases, 5);
    expect(r.items).toHaveLength(5);
    expect(r.totalCases).toBe(15);
  });

  it("preserves caseRef and deceasedName in items", () => {
    const r = buildActionQueue([
      caseInput({ caseId: "x", caseRef: "EXP-XYZ", deceasedName: "Maria Test", deathDate: daysAgo(200) }),
    ]);
    expect(r.items[0].caseRef).toBe("EXP-XYZ");
    expect(r.items[0].deceasedName).toBe("Maria Test");
  });

  it("totalCases counts all input cases, even closed ones", () => {
    const r = buildActionQueue([
      caseInput({ caseId: "a", caseStatus: "CLOSED" }),
      caseInput({ caseId: "b" }),
    ]);
    expect(r.totalCases).toBe(2);
    expect(r.items.length).toBeLessThanOrEqual(2);
  });

  it("a case with all tasks done suggests closing it (low urgency)", () => {
    const r = buildActionQueue([
      caseInput({
        caseId: "done",
        deathDate: daysAgo(20),
        tasks: [task({ id: "x", status: "DONE" }), task({ id: "y", status: "SKIPPED" })],
      }),
    ]);
    expect(r.items[0].action.urgency).toBe("low");
    expect(r.items[0].action.action).toMatch(/cerrar/i);
  });
});
