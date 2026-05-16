import { describe, it, expect } from "vitest";
import {
  calculateHerenciaCost,
  estimateNotaria,
  estimateRegistro,
  estimateGestoria,
  type HerenciaCostInput,
} from "../src/lib/herencia-cost";

function baseInput(overrides: Partial<HerenciaCostInput> = {}): HerenciaCostInput {
  return {
    valorHerencia: 200000,
    ccaa: "MADRID",
    group: "II",
    preexistingPatrimony: 0,
    hasProperty: false,
    property: null,
    includeGestoria: false,
    ...overrides,
  };
}

const sampleProperty = {
  valorCatastralTotal: 120000,
  valorCatastralSuelo: 60000,
  anyosTenencia: 15,
  tipoGravamenMunicipal: 0.3,
  valorAdquisicion: 100000,
  valorTransmision: 180000,
};

describe("estimateNotaria", () => {
  it("returns 0 for zero value", () => {
    expect(estimateNotaria(0)).toBe(0);
  });

  it("scales up with value", () => {
    expect(estimateNotaria(300000)).toBeGreaterThan(estimateNotaria(50000));
  });

  it("returns a reasonable amount for a typical estate", () => {
    const fee = estimateNotaria(200000);
    expect(fee).toBeGreaterThan(100);
    expect(fee).toBeLessThan(3000);
  });
});

describe("estimateRegistro", () => {
  it("returns 0 for zero value", () => {
    expect(estimateRegistro(0)).toBe(0);
  });

  it("scales up with value", () => {
    expect(estimateRegistro(400000)).toBeGreaterThan(estimateRegistro(80000));
  });

  it("returns a reasonable amount for a typical property", () => {
    const fee = estimateRegistro(180000);
    expect(fee).toBeGreaterThan(50);
    expect(fee).toBeLessThan(2000);
  });
});

describe("estimateGestoria", () => {
  it("is higher when there is a property", () => {
    expect(estimateGestoria(200000, true)).toBeGreaterThan(estimateGestoria(200000, false));
  });

  it("grows for large estates", () => {
    expect(estimateGestoria(800000, false)).toBeGreaterThan(estimateGestoria(100000, false));
  });
});

describe("calculateHerenciaCost", () => {
  it("includes ISD and notaria for a no-property estate", () => {
    const r = calculateHerenciaCost(baseInput());
    const keys = r.lines.map((l) => l.key);
    expect(keys).toContain("isd");
    expect(keys).toContain("notaria");
    expect(keys).not.toContain("plusvalia");
    expect(keys).not.toContain("registro");
  });

  it("includes plusvalia and registro when there is a property", () => {
    const r = calculateHerenciaCost(baseInput({ hasProperty: true, property: sampleProperty }));
    const keys = r.lines.map((l) => l.key);
    expect(keys).toContain("plusvalia");
    expect(keys).toContain("registro");
  });

  it("includes gestoria only when requested", () => {
    const without = calculateHerenciaCost(baseInput({ includeGestoria: false }));
    const withG = calculateHerenciaCost(baseInput({ includeGestoria: true }));
    expect(without.lines.some((l) => l.key === "gestoria")).toBe(false);
    expect(withG.lines.some((l) => l.key === "gestoria")).toBe(true);
  });

  it("total equals the sum of all lines", () => {
    const r = calculateHerenciaCost(baseInput({ hasProperty: true, property: sampleProperty, includeGestoria: true }));
    const sum = r.lines.reduce((s, l) => s + l.amount, 0);
    expect(Math.abs(r.total - sum)).toBeLessThan(0.5);
  });

  it("computes the cost as a percentage of the inheritance", () => {
    const r = calculateHerenciaCost(baseInput({ valorHerencia: 200000 }));
    expect(r.pctOfHerencia).toBeCloseTo((r.total / 200000) * 100, 1);
  });

  it("Madrid ISD line is low for group II (99% bonification)", () => {
    const r = calculateHerenciaCost(baseInput({ ccaa: "MADRID", group: "II", valorHerencia: 200000 }));
    const isd = r.lines.find((l) => l.key === "isd")!;
    // 99% bonification -> cuota should be a small fraction
    expect(isd.amount).toBeLessThan(2000);
  });

  it("a CCAA without bonification produces a much higher ISD line", () => {
    const madrid = calculateHerenciaCost(baseInput({ ccaa: "MADRID", group: "II" }));
    const asturias = calculateHerenciaCost(baseInput({ ccaa: "ASTURIAS", group: "II" }));
    const madridISD = madrid.lines.find((l) => l.key === "isd")!.amount;
    const asturiasISD = asturias.lines.find((l) => l.key === "isd")!.amount;
    expect(asturiasISD).toBeGreaterThan(madridISD);
  });

  it("plusvalia line shows 'no sujeto' when the property lost value", () => {
    const r = calculateHerenciaCost(baseInput({
      hasProperty: true,
      property: { ...sampleProperty, valorAdquisicion: 250000, valorTransmision: 180000 },
    }));
    const plusvalia = r.lines.find((l) => l.key === "plusvalia")!;
    expect(plusvalia.amount).toBe(0);
    expect(plusvalia.note.toLowerCase()).toContain("no sujeto");
  });

  it("never returns a negative total", () => {
    const r = calculateHerenciaCost(baseInput({ valorHerencia: 0 }));
    expect(r.total).toBeGreaterThanOrEqual(0);
  });

  it("every line has a label and a note", () => {
    const r = calculateHerenciaCost(baseInput({ hasProperty: true, property: sampleProperty, includeGestoria: true }));
    for (const l of r.lines) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.note.length).toBeGreaterThan(0);
      expect(l.amount).toBeGreaterThanOrEqual(0);
    }
  });
});
