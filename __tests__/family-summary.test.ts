import { describe, it, expect } from "vitest";
import { buildFamilySummary, type FamilySummaryInput, type FamilySummaryTask } from "../src/lib/family-summary";
import { generateFamilySummaryPDF } from "../src/lib/family-summary-pdf";

function daysAgo(d: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date;
}

function task(title: string, status: FamilySummaryTask["status"]): FamilySummaryTask {
  return { title, status };
}

function baseInput(overrides: Partial<FamilySummaryInput> = {}): FamilySummaryInput {
  return {
    deceasedName: "Maria Garcia Lopez",
    caseStatus: "IN_PROGRESS",
    deathDate: daysAgo(60),
    tasks: [
      task("Solicitar certificado de defuncion", "DONE"),
      task("Solicitar ultimas voluntades", "DONE"),
      task("Bloquear cuentas bancarias", "IN_PROGRESS"),
      task("Presentar el Modelo 650", "PENDING"),
    ],
    orgName: "Gestoria Ejemplo",
    ...overrides,
  };
}

describe("buildFamilySummary", () => {
  it("includes the deceased name in the title", () => {
    const s = buildFamilySummary(baseInput());
    expect(s.title).toContain("Maria Garcia Lopez");
  });

  it("falls back gracefully when there is no deceased name", () => {
    const s = buildFamilySummary(baseInput({ deceasedName: null }));
    expect(s.title).toContain("su familiar");
    expect(s.statusLine).toContain("su familiar");
  });

  it("computes progress percentage from done tasks", () => {
    const s = buildFamilySummary(baseInput());
    // 2 done of 4 -> 50%
    expect(s.progressPct).toBe(50);
  });

  it("counts SKIPPED tasks as completed", () => {
    const s = buildFamilySummary(baseInput({
      tasks: [task("A", "DONE"), task("B", "SKIPPED"), task("C", "PENDING"), task("D", "PENDING")],
    }));
    expect(s.progressPct).toBe(50);
  });

  it("groups tasks into completed / in-progress / pending sections", () => {
    const s = buildFamilySummary(baseInput());
    const headings = s.sections.map((sec) => sec.heading);
    expect(headings.some((h) => h.includes("completado"))).toBe(true);
    expect(headings.some((h) => h.includes("trabajando"))).toBe(true);
    expect(headings.some((h) => h.includes("Proximos"))).toBe(true);
  });

  it("includes a deadlines section when deathDate is known", () => {
    const s = buildFamilySummary(baseInput({ deathDate: daysAgo(60) }));
    const plazos = s.sections.find((sec) => sec.heading.includes("Plazos"));
    expect(plazos).toBeDefined();
    expect(plazos!.lines.some((l) => l.includes("Modelo 650"))).toBe(true);
  });

  it("omits the deadlines section when deathDate is null", () => {
    const s = buildFamilySummary(baseInput({ deathDate: null }));
    expect(s.sections.find((sec) => sec.heading.includes("Plazos"))).toBeUndefined();
  });

  it("status line reflects high progress", () => {
    const s = buildFamilySummary(baseInput({
      tasks: [task("A", "DONE"), task("B", "DONE"), task("C", "DONE"), task("D", "DONE"), task("E", "PENDING")],
    }));
    expect(s.progressPct).toBe(80);
    expect(s.statusLine).toMatch(/avanzada/i);
  });

  it("closed cases get a finished status and thank-you closing", () => {
    const s = buildFamilySummary(baseInput({ caseStatus: "CLOSED" }));
    expect(s.statusLine).toMatch(/finalizado/i);
    expect(s.closing).toMatch(/gracias/i);
  });

  it("handles a case with no tasks", () => {
    const s = buildFamilySummary(baseInput({ tasks: [] }));
    expect(s.progressPct).toBe(0);
    expect(s.statusLine).toMatch(/plan de trabajo/i);
  });

  it("overdue ISD shows a managing-it message instead of days left", () => {
    const s = buildFamilySummary(baseInput({ deathDate: daysAgo(220) }));
    const plazos = s.sections.find((sec) => sec.heading.includes("Plazos"))!;
    expect(plazos.lines.some((l) => l.includes("gestionando"))).toBe(true);
  });

  it("closing mentions the organization name", () => {
    const s = buildFamilySummary(baseInput({ orgName: "Despacho Test" }));
    expect(s.closing).toContain("Despacho Test");
  });
});

describe("generateFamilySummaryPDF", () => {
  it("produces a valid PDF", async () => {
    const summary = buildFamilySummary(baseInput());
    const bytes = await generateFamilySummaryPDF({
      summary,
      caseRef: "EXP-001",
      orgName: "Gestoria Ejemplo",
      generatedAt: new Date(),
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles a minimal summary (no tasks, no death date)", async () => {
    const summary = buildFamilySummary(baseInput({ tasks: [], deathDate: null, deceasedName: null }));
    const bytes = await generateFamilySummaryPDF({
      summary,
      caseRef: "EXP-MIN",
      orgName: "BARITUR PRO",
      generatedAt: new Date(),
    });
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("handles a case with many tasks (pagination)", async () => {
    const manyTasks: FamilySummaryTask[] = Array.from({ length: 40 }, (_, i) =>
      task(`Tarea numero ${i + 1} de la tramitacion de la herencia`, i % 2 === 0 ? "DONE" : "PENDING")
    );
    const summary = buildFamilySummary(baseInput({ tasks: manyTasks }));
    const bytes = await generateFamilySummaryPDF({
      summary,
      caseRef: "EXP-BIG",
      orgName: "Gestoria Ejemplo",
      generatedAt: new Date(),
    });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
