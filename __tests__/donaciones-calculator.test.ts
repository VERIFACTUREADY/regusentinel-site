import { describe, it, expect } from "vitest";
import {
  calculateDonacion,
  compareDonacionCCAAs,
  getDonacionBonification,
} from "../src/lib/donaciones-calculator";

describe("calculateDonacion", () => {
  it("returns zero cuota for zero base", () => {
    const r = calculateDonacion({ group: "II", baseImponible: 0, preexistingPatrimony: 0 });
    expect(r.cuotaAPagar).toBe(0);
    expect(r.cuotaIntegra).toBe(0);
  });

  it("does NOT apply parentesco reduction (unlike sucesiones)", () => {
    // En sucesiones grupo II tiene reduccion base de 15.956,87 €.
    // En donaciones esa reduccion no aplica.
    const r = calculateDonacion({ group: "II", baseImponible: 50000, preexistingPatrimony: 0, reduccionTipo: "ninguna" });
    expect(r.baseLiquidable).toBe(50000); // toda la base tributa
  });

  it("applies vivienda-habitual-hijo reduction at 95%", () => {
    const r = calculateDonacion({
      group: "II",
      baseImponible: 200000,
      preexistingPatrimony: 0,
      reduccionTipo: "vivienda-habitual-hijo",
    });
    expect(r.reduccionAplicada).toBe(190000);
    expect(r.baseLiquidable).toBe(10000);
  });

  it("applies empresa-familiar reduction at 95%", () => {
    const r = calculateDonacion({
      group: "I",
      baseImponible: 500000,
      preexistingPatrimony: 0,
      reduccionTipo: "empresa-familiar",
    });
    expect(r.reduccionAplicada).toBe(475000);
    expect(r.baseLiquidable).toBe(25000);
  });

  it("applies dinero-para-vivienda reduction at 80%", () => {
    const r = calculateDonacion({
      group: "II",
      baseImponible: 100000,
      preexistingPatrimony: 0,
      reduccionTipo: "dinero-para-vivienda-hijo",
    });
    expect(r.reduccionAplicada).toBe(80000);
    expect(r.baseLiquidable).toBe(20000);
  });

  it("applies CCAA bonification when ccaa provided (Madrid 99% group II)", () => {
    const r = calculateDonacion(
      { group: "II", baseImponible: 100000, preexistingPatrimony: 0 },
      "MADRID"
    );
    // Debe haber bonificacion casi total
    expect(r.bonificacionCcaa).toBeGreaterThan(r.cuotaTributaria * 0.95);
    expect(r.cuotaAPagar).toBeLessThan(r.cuotaTributaria * 0.05);
  });

  it("does NOT apply bonification when ccaa is omitted", () => {
    const r = calculateDonacion({ group: "II", baseImponible: 100000, preexistingPatrimony: 0 });
    expect(r.bonificacionCcaa).toBe(0);
    expect(r.cuotaAPagar).toBe(r.cuotaTributaria);
  });

  it("uses higher coeficiente for group IV", () => {
    const rII = calculateDonacion({ group: "II", baseImponible: 50000, preexistingPatrimony: 0 });
    const rIV = calculateDonacion({ group: "IV", baseImponible: 50000, preexistingPatrimony: 0 });
    expect(rIV.cuotaTributaria).toBeGreaterThan(rII.cuotaTributaria);
    expect(rIV.coeficienteMultiplicador).toBeGreaterThanOrEqual(2.0);
  });

  it("Cataluña does not bonify donaciones (returns 0%)", () => {
    const b = getDonacionBonification("CATALUNA", "II");
    expect(b.pct).toBe(0);
  });

  it("Asturias does not bonify donaciones either", () => {
    const b = getDonacionBonification("ASTURIAS", "II");
    expect(b.pct).toBe(0);
  });

  it("Madrid bonifies group I and II at 99%", () => {
    expect(getDonacionBonification("MADRID", "I").pct).toBe(99);
    expect(getDonacionBonification("MADRID", "II").pct).toBe(99);
  });

  it("Madrid does NOT bonify groups III and IV (donaciones)", () => {
    expect(getDonacionBonification("MADRID", "III").pct).toBe(0);
    expect(getDonacionBonification("MADRID", "IV").pct).toBe(0);
  });

  it("Foral CCAAs are flagged correctly", () => {
    expect(getDonacionBonification("NAVARRA", "II").foralRegime).toBe(true);
    expect(getDonacionBonification("PAIS_VASCO", "II").foralRegime).toBe(true);
    expect(getDonacionBonification("MADRID", "II").foralRegime).toBe(false);
  });
});

describe("compareDonacionCCAAs", () => {
  it("returns 17 entries sorted by cuota ascending", () => {
    const r = compareDonacionCCAAs({ group: "II", baseImponible: 200000, preexistingPatrimony: 0 });
    expect(r).toHaveLength(17);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].cuotaAPagar).toBeGreaterThanOrEqual(r[i - 1].cuotaAPagar);
    }
  });

  it("includes label and bonification info", () => {
    const r = compareDonacionCCAAs({ group: "II", baseImponible: 100000, preexistingPatrimony: 0 });
    for (const row of r) {
      expect(typeof row.label).toBe("string");
      expect(row.label.length).toBeGreaterThan(0);
      expect(typeof row.bonificacionPct).toBe("number");
      expect(typeof row.foralRegime).toBe("boolean");
    }
  });

  it("Madrid is among the cheaper CCAAs for group II", () => {
    const r = compareDonacionCCAAs({ group: "II", baseImponible: 200000, preexistingPatrimony: 0 });
    const madridRank = r.findIndex((row) => row.ccaa === "MADRID");
    // Madrid at 99% bonification ties with Andalucía/CYL/Extremadura/etc.;
    // should be in the top half (rank < 9)
    expect(madridRank).toBeLessThan(9);
  });

  it("group IV produces same cuota everywhere except foral (no bonification)", () => {
    const r = compareDonacionCCAAs({ group: "IV", baseImponible: 100000, preexistingPatrimony: 0 });
    const nonForal = r.filter((row) => !row.foralRegime);
    // todas las no-forales con grupo IV deberian tener mismo cuota o muy similar
    const cuotas = new Set(nonForal.map((row) => Math.round(row.cuotaAPagar)));
    expect(cuotas.size).toBeLessThanOrEqual(2); // todas iguales o casi
  });
});
