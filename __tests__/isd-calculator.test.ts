import { describe, it, expect } from "vitest";
import {
  calculateISD,
  calculateCuotaIntegra,
  calculateReducciones,
  getCoeficienteMultiplicador,
  getReferenceBonification,
} from "../src/lib/isd-calculator";

describe("calculateCuotaIntegra (state scale)", () => {
  it("returns 0 for non-positive base", () => {
    expect(calculateCuotaIntegra(0)).toBe(0);
    expect(calculateCuotaIntegra(-1000)).toBe(0);
  });

  it("applies first bracket rate (7.65%) for low values", () => {
    expect(calculateCuotaIntegra(5000)).toBeCloseTo(5000 * 0.0765, 1);
  });

  it("applies progressive scale across brackets", () => {
    // 10,000 = 7,993.46 * 0.0765 + (10,000 - 7,993.46) * 0.085
    const expected = 7993.46 * 0.0765 + (10000 - 7993.46) * 0.085;
    expect(calculateCuotaIntegra(10000)).toBeCloseTo(expected, 1);
  });

  it("applies top bracket (34%) for very large bases", () => {
    // base > 797,555.08 should hit 34% on the excess
    const result = calculateCuotaIntegra(1000000);
    expect(result).toBeGreaterThan(199637); // approximate
  });
});

describe("calculateReducciones", () => {
  it("applies 15,956.87€ base reduction for Group II", () => {
    const r = calculateReducciones({
      group: "II",
      baseImponible: 100000,
      preexistingPatrimony: 0,
    });
    expect(r.reduccionParentesco).toBeCloseTo(15956.87, 2);
    expect(r.total).toBeCloseTo(15956.87, 2);
  });

  it("zero reduction for Group IV", () => {
    const r = calculateReducciones({
      group: "IV",
      baseImponible: 100000,
      preexistingPatrimony: 0,
    });
    expect(r.reduccionParentesco).toBe(0);
  });

  it("adds per-year reduction for Group I minor under 21", () => {
    const r = calculateReducciones({
      group: "I",
      ageIfMinor: 10,
      baseImponible: 50000,
      preexistingPatrimony: 0,
    });
    // 11 years under 21: 15956.87 + 11 * 3990.72 = ~59,855
    // Capped at 47,858.59
    expect(r.reduccionParentesco).toBe(47858.59);
  });

  it("applies dwelling reduction (95%, capped at 122,606.47)", () => {
    const r = calculateReducciones({
      group: "II",
      baseImponible: 500000,
      preexistingPatrimony: 0,
      dwellingReduction: true,
      dwellingValue: 200000,
    });
    expect(r.reduccionVivienda).toBe(122606.47); // 95% of 200k = 190k > cap
  });

  it("applies disability reduction", () => {
    const r = calculateReducciones({
      group: "II",
      baseImponible: 100000,
      preexistingPatrimony: 0,
      disability: "65+",
    });
    expect(r.reduccionDiscapacidad).toBe(150253.03);
  });

  it("applies life insurance reduction only for Group I/II", () => {
    const groupII = calculateReducciones({
      group: "II",
      baseImponible: 100000,
      preexistingPatrimony: 0,
      lifeInsuranceAmount: 20000,
    });
    expect(groupII.reduccionSeguroVida).toBe(9195.49); // capped

    const groupIV = calculateReducciones({
      group: "IV",
      baseImponible: 100000,
      preexistingPatrimony: 0,
      lifeInsuranceAmount: 20000,
    });
    expect(groupIV.reduccionSeguroVida).toBe(0);
  });
});

describe("getCoeficienteMultiplicador", () => {
  it("returns 1.0 for Group II low patrimony", () => {
    expect(getCoeficienteMultiplicador("II", 100000)).toBe(1.0);
  });

  it("returns 2.0 for Group IV low patrimony", () => {
    expect(getCoeficienteMultiplicador("IV", 100000)).toBe(2.0);
  });

  it("returns 2.4 for Group IV very high patrimony", () => {
    expect(getCoeficienteMultiplicador("IV", 5000000)).toBe(2.4);
  });

  it("steps up coefficient with patrimony brackets", () => {
    expect(getCoeficienteMultiplicador("I", 500000)).toBe(1.05);
    expect(getCoeficienteMultiplicador("I", 3000000)).toBe(1.1);
  });
});

describe("calculateISD (full)", () => {
  it("zero tax when reductions exceed base", () => {
    const r = calculateISD({
      group: "II",
      baseImponible: 10000,
      preexistingPatrimony: 0,
    });
    expect(r.baseLiquidable).toBe(0);
    expect(r.cuotaTributaria).toBe(0);
    expect(r.cuotaAPagar).toBe(0);
  });

  it("applies CCAA bonification correctly", () => {
    const r = calculateISD({
      group: "II",
      baseImponible: 200000,
      preexistingPatrimony: 0,
      ccaaBonificationPct: 99,
    });
    expect(r.bonificacionCcaa).toBeCloseTo(r.cuotaTributaria * 0.99, 1);
    expect(r.cuotaAPagar).toBeCloseTo(r.cuotaTributaria * 0.01, 1);
  });

  it("clamps bonification to 0-100", () => {
    const r1 = calculateISD({
      group: "II", baseImponible: 100000, preexistingPatrimony: 0, ccaaBonificationPct: 150,
    });
    expect(r1.cuotaAPagar).toBe(0);

    const r2 = calculateISD({
      group: "II", baseImponible: 100000, preexistingPatrimony: 0, ccaaBonificationPct: -50,
    });
    expect(r2.bonificacionCcaa).toBe(0);
  });

  it("realistic case: spouse inheriting 300k€ with no dwelling", () => {
    const r = calculateISD({
      group: "II",
      baseImponible: 300000,
      preexistingPatrimony: 100000,
      ccaaBonificationPct: 0, // no CCAA bonification
    });
    expect(r.totalReducciones).toBe(15956.87);
    expect(r.baseLiquidable).toBe(300000 - 15956.87);
    expect(r.cuotaTributaria).toBeGreaterThan(40000);
    expect(r.cuotaTributaria).toBeLessThan(60000);
  });

  it("returns rounded euros (2 decimals)", () => {
    const r = calculateISD({ group: "II", baseImponible: 50000, preexistingPatrimony: 0 });
    const decimalsOf = (n: number) => (n.toString().split(".")[1] || "").length;
    expect(decimalsOf(r.cuotaTributaria)).toBeLessThanOrEqual(2);
    expect(decimalsOf(r.cuotaAPagar)).toBeLessThanOrEqual(2);
  });
});

describe("getReferenceBonification", () => {
  it("returns 99% for Madrid Group II", () => {
    expect(getReferenceBonification("Madrid", "II")).toBe(99);
  });

  it("returns 0 for unknown province", () => {
    expect(getReferenceBonification("Marte", "II")).toBe(0);
    expect(getReferenceBonification(null, "II")).toBe(0);
    expect(getReferenceBonification(undefined, "II")).toBe(0);
  });

  it("returns 0 for Group IV in any CCAA (most don't bonify)", () => {
    expect(getReferenceBonification("Madrid", "IV")).toBe(0);
    expect(getReferenceBonification("Andalucía", "IV")).toBe(0);
  });

  it("maps Catalan provinces to Cataluña", () => {
    // Cataluña has 0% reference (specific scale, gestor must adjust)
    expect(getReferenceBonification("Barcelona", "II")).toBe(0);
  });

  it("maps Galician provinces", () => {
    expect(getReferenceBonification("Pontevedra", "II")).toBe(99);
  });
});
