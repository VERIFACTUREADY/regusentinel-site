import { describe, it, expect } from "vitest";
import {
  computeNextAction,
  type NextActionInput,
  type NextActionTask,
  type NextActionRisk,
} from "../src/lib/next-action";

function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 86400000);
}

function task(overrides: Partial<NextActionTask> = {}): NextActionTask {
  return {
    id: "t1",
    title: "Tarea de prueba",
    status: "PENDING",
    deadline: null,
    ...overrides,
  };
}

function input(overrides: Partial<NextActionInput> = {}): NextActionInput {
  return {
    caseStatus: "INTAKE",
    risks: [],
    tasks: [],
    ...overrides,
  };
}

describe("computeNextAction - priority order", () => {
  it("returns 'closed' for archived cases", () => {
    const r = computeNextAction(input({ caseStatus: "CLOSED" }));
    expect(r.urgency).toBe("none");
    expect(r.action).toMatch(/cerrado/i);
  });

  it("ISD overdue is the top priority", () => {
    const r = computeNextAction(input({
      risks: [{ id: "isd_overdue", severity: "critical", title: "Plazo vencido" }],
      tasks: [task({ status: "BLOCKED" })],
    }));
    expect(r.urgency).toBe("critical");
    expect(r.action).toMatch(/Modelo 650 de inmediato/i);
  });

  it("ISD critical beats overdue tasks", () => {
    const r = computeNextAction(input({
      risks: [{ id: "isd_critical", severity: "critical", title: "Quedan 5 dias" }],
      tasks: [task({ deadline: daysFromNow(-10) })],
    }));
    expect(r.urgency).toBe("critical");
    expect(r.action).toMatch(/esta semana/i);
  });

  it("overdue tasks come after ISD risks", () => {
    const r = computeNextAction(input({
      tasks: [task({ id: "late", title: "Pedir certificado", deadline: daysFromNow(-5) })],
    }));
    expect(r.urgency).toBe("high");
    expect(r.action).toContain("Pedir certificado");
    expect(r.relatedTaskId).toBe("late");
  });

  it("picks the most overdue task first", () => {
    const r = computeNextAction(input({
      tasks: [
        task({ id: "a", title: "A", deadline: daysFromNow(-2) }),
        task({ id: "b", title: "B", deadline: daysFromNow(-20) }),
      ],
    }));
    expect(r.relatedTaskId).toBe("b");
  });

  it("mentions count when multiple tasks are overdue", () => {
    const r = computeNextAction(input({
      tasks: [
        task({ id: "a", title: "A", deadline: daysFromNow(-2) }),
        task({ id: "b", title: "B", deadline: daysFromNow(-3) }),
      ],
    }));
    expect(r.reason).toMatch(/1 mas/);
  });

  it("extension window closing is flagged when no overdue tasks", () => {
    const r = computeNextAction(input({
      risks: [{ id: "extension_window_closing", severity: "warning", title: "Quedan 10 dias para prorroga" }],
    }));
    expect(r.action).toMatch(/prorroga/i);
    expect(r.urgency).toBe("high");
  });

  it("blocked tasks surface after deadline risks", () => {
    const r = computeNextAction(input({
      tasks: [task({ id: "blk", title: "Tasacion", status: "BLOCKED", blockReason: "Esperando tasador" })],
    }));
    expect(r.action).toContain("Desbloquear");
    expect(r.action).toContain("Tasacion");
    expect(r.reason).toContain("Esperando tasador");
    expect(r.relatedTaskId).toBe("blk");
  });

  it("ISD 30d warning surfaces when nothing more urgent", () => {
    const r = computeNextAction(input({
      risks: [{ id: "isd_30d", severity: "warning", title: "Quedan 25 dias" }],
    }));
    expect(r.action).toMatch(/Preparar/i);
    expect(r.urgency).toBe("high");
  });

  it("missing province is flagged", () => {
    const r = computeNextAction(input({
      risks: [{ id: "missing_province", severity: "warning", title: "Sin provincia" }],
    }));
    expect(r.action).toMatch(/provincia/i);
  });

  it("upcoming task with deadline is suggested", () => {
    const r = computeNextAction(input({
      tasks: [task({ id: "next", title: "Certificado bancario", deadline: daysFromNow(20) })],
    }));
    expect(r.action).toContain("Certificado bancario");
    expect(r.relatedTaskId).toBe("next");
  });

  it("upcoming task within 14 days is medium urgency", () => {
    const r = computeNextAction(input({
      tasks: [task({ id: "soon", title: "X", deadline: daysFromNow(7) })],
    }));
    expect(r.urgency).toBe("medium");
  });

  it("upcoming task far away is low urgency", () => {
    const r = computeNextAction(input({
      tasks: [task({ id: "far", title: "X", deadline: daysFromNow(60) })],
    }));
    expect(r.urgency).toBe("low");
  });

  it("open task without deadline is suggested at low urgency", () => {
    const r = computeNextAction(input({
      tasks: [task({ id: "nodate", title: "Llamar a la familia", deadline: null })],
    }));
    expect(r.action).toContain("Llamar a la familia");
    expect(r.urgency).toBe("low");
  });

  it("no tasks at all suggests applying a template", () => {
    const r = computeNextAction(input({ tasks: [] }));
    expect(r.action).toMatch(/plantilla/i);
  });

  it("all tasks done suggests closing the case", () => {
    const r = computeNextAction(input({
      tasks: [
        task({ id: "a", status: "DONE" }),
        task({ id: "b", status: "SKIPPED" }),
      ],
    }));
    expect(r.action).toMatch(/cerrar/i);
    expect(r.urgency).toBe("low");
  });

  it("ignores completed tasks when looking for overdue", () => {
    const r = computeNextAction(input({
      tasks: [task({ id: "done", status: "DONE", deadline: daysFromNow(-30) })],
    }));
    // The done task should not be reported as overdue
    expect(r.action).not.toContain("Completar:");
  });

  it("handles invalid deadline strings gracefully", () => {
    const r = computeNextAction(input({
      tasks: [task({ id: "bad", title: "Tarea", deadline: "not-a-date" })],
    }));
    // Falls through to the no-deadline open task branch
    expect(r.relatedTaskId).toBe("bad");
  });
});
