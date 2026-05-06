import { describe, it, expect } from "vitest";
import {
  calculateISD,
  calculateCuotaIntegra,
  calculateReducciones,
  getCoeficienteMultiplicador,
  getReferenceBonification,
  getCCAABonification,
  calculateISDForCCAA,
  compareCCAAs,
  CCAA_LABELS,
  PROVINCIA_TO_CCAA,
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

describe("getCCAABonification (progressive autonomic rules)", () => {
  it("Madrid: 99% for groups I-II, 25% for III, 0% for IV", () => {
    expect(getCCAABonification("MADRID", "I", 100000).pct).toBe(99);
    expect(getCCAABonification("MADRID", "II", 500000).pct).toBe(99);
    expect(getCCAABonification("MADRID", "III", 100000).pct).toBe(25);
    expect(getCCAABonification("MADRID", "IV", 100000).pct).toBe(0);
  });

  it("Cataluña: progressive inverse bonification by base", () => {
    expect(getCCAABonification("CATALUNA", "II", 50000).pct).toBe(99);
    expect(getCCAABonification("CATALUNA", "II", 150000).pct).toBe(97);
    expect(getCCAABonification("CATALUNA", "II", 400000).pct).toBe(90);
    expect(getCCAABonification("CATALUNA", "II", 800000).pct).toBe(70);
    expect(getCCAABonification("CATALUNA", "II", 2000000).pct).toBe(50);
  });

  it("Castilla-La Mancha: scaled bonification", () => {
    expect(getCCAABonification("CASTILLA_LA_MANCHA", "II", 100000).pct).toBe(100);
    expect(getCCAABonification("CASTILLA_LA_MANCHA", "II", 200000).pct).toBe(95);
    expect(getCCAABonification("CASTILLA_LA_MANCHA", "II", 270000).pct).toBe(90);
    expect(getCCAABonification("CASTILLA_LA_MANCHA", "II", 290000).pct).toBe(85);
    expect(getCCAABonification("CASTILLA_LA_MANCHA", "II", 500000).pct).toBe(80);
  });

  it("Cantabria: 100% up to 100k, 90% above", () => {
    expect(getCCAABonification("CANTABRIA", "II", 50000).pct).toBe(100);
    expect(getCCAABonification("CANTABRIA", "II", 150000).pct).toBe(90);
  });

  it("Foral regimes flagged", () => {
    expect(getCCAABonification("NAVARRA", "II", 100000).foralRegime).toBe(true);
    expect(getCCAABonification("PAIS_VASCO", "II", 100000).foralRegime).toBe(true);
    expect(getCCAABonification("MADRID", "II", 100000).foralRegime).toBe(false);
  });

  it("returns explanatory note per CCAA and group", () => {
    const r = getCCAABonification("MADRID", "II", 100000);
    expect(r.note.length).toBeGreaterThan(20);
    expect(r.note.toLowerCase()).toContain("madrid");
  });
});

describe("calculateISDForCCAA", () => {
  it("Madrid grupo II 200k → casi 0 cuota a pagar (99% bonificación)", () => {
    const r = calculateISDForCCAA("MADRID", {
      group: "II", baseImponible: 200000, preexistingPatrimony: 0,
    });
    expect(r.cuotaAPagar).toBeLessThan(500);
    expect(r.cuotaTributaria).toBeGreaterThan(20000);
  });

  it("Asturias grupo II 200k → cuota completa (sin bonificación)", () => {
    const r = calculateISDForCCAA("ASTURIAS", {
      group: "II", baseImponible: 200000, preexistingPatrimony: 0,
    });
    expect(r.cuotaAPagar).toBe(r.cuotaTributaria);
    expect(r.bonificacionCcaa).toBe(0);
  });
});

describe("compareCCAAs", () => {
  it("returns 17 CCAAs sorted by cuota a pagar", () => {
    const list = compareCCAAs({
      group: "II", baseImponible: 200000, preexistingPatrimony: 0,
    });
    expect(list).toHaveLength(17);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].cuotaAPagar).toBeGreaterThanOrEqual(list[i - 1].cuotaAPagar);
    }
  });

  it("includes Madrid among the cheapest for groups I-II", () => {
    const list = compareCCAAs({
      group: "II", baseImponible: 200000, preexistingPatrimony: 0,
    });
    const madrid = list.find((c) => c.ccaa === "MADRID");
    expect(madrid).toBeDefined();
    expect(madrid!.cuotaAPagar).toBeLessThan(500);
  });

  it("Asturias is among the most expensive (no general bonification)", () => {
    const list = compareCCAAs({
      group: "II", baseImponible: 200000, preexistingPatrimony: 0,
    });
    const asturias = list.find((c) => c.ccaa === "ASTURIAS");
    expect(asturias!.cuotaAPagar).toBeGreaterThan(20000);
  });

  it("provides label for every CCAA", () => {
    const list = compareCCAAs({
      group: "II", baseImponible: 200000, preexistingPatrimony: 0,
    });
    list.forEach((c) => {
      expect(CCAA_LABELS[c.ccaa]).toBeDefined();
      expect(c.label).toBe(CCAA_LABELS[c.ccaa]);
    });
  });
});

describe("PROVINCIA_TO_CCAA mapping", () => {
  it("maps known provinces to their CCAA", () => {
    expect(PROVINCIA_TO_CCAA["madrid"]).toBe("MADRID");
    expect(PROVINCIA_TO_CCAA["barcelona"]).toBe("CATALUNA");
    expect(PROVINCIA_TO_CCAA["sevilla"]).toBe("ANDALUCIA");
    expect(PROVINCIA_TO_CCAA["bizkaia"]).toBe("PAIS_VASCO");
  });

  it("does not map invalid province", () => {
    expect(PROVINCIA_TO_CCAA["narnia"]).toBeUndefined();
  });
});
