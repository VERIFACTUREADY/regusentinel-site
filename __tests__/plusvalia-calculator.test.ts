import { describe, it, expect } from "vitest";
import {
  calculatePlusvalia,
  getCoeficiente,
  COEFICIENTES_MAXIMOS,
  TIPO_GRAVAMEN_MAXIMO,
  type PlusvaliaInput,
} from "../src/lib/plusvalia-calculator";

function baseInput(overrides: Partial<PlusvaliaInput> = {}): PlusvaliaInput {
  return {
    valorCatastralTotal: 100000,
    valorCatastralSuelo: 50000,
    anyosTenencia: 10,
    tipoGravamen: 0.3,
    valorAdquisicion: 120000,
    valorTransmision: 200000,
    ...overrides,
  };
}

describe("getCoeficiente", () => {
  it("returns the coefficient for a given year count", () => {
    expect(getCoeficiente(10)).toBe(COEFICIENTES_MAXIMOS[10]);
    expect(getCoeficiente(5)).toBe(COEFICIENTES_MAXIMOS[5]);
  });

  it("caps at 20 years for longer holdings", () => {
    expect(getCoeficiente(25)).toBe(COEFICIENTES_MAXIMOS[20]);
    expect(getCoeficiente(50)).toBe(COEFICIENTES_MAXIMOS[20]);
  });

  it("handles 0 years (less than 1)", () => {
    expect(getCoeficiente(0)).toBe(COEFICIENTES_MAXIMOS[0]);
  });

  it("floors fractional years", () => {
    expect(getCoeficiente(10.9)).toBe(COEFICIENTES_MAXIMOS[10]);
  });
});

describe("calculatePlusvalia - metodo objetivo", () => {
  it("computes base as suelo x coeficiente", () => {
    const r = calculatePlusvalia(baseInput({ valorCatastralSuelo: 50000, anyosTenencia: 10 }));
    const coef = COEFICIENTES_MAXIMOS[10];
    expect(r.objetivo.base).toBeCloseTo(50000 * coef, 1);
  });

  it("computes cuota as base x tipo", () => {
    const r = calculatePlusvalia(baseInput({ valorCatastralSuelo: 50000, anyosTenencia: 10, tipoGravamen: 0.3 }));
    expect(r.objetivo.cuota).toBeCloseTo(r.objetivo.base * 0.3, 1);
  });

  it("estimates valorSuelo as 50% when not provided", () => {
    const r = calculatePlusvalia(baseInput({ valorCatastralTotal: 100000, valorCatastralSuelo: null }));
    // suelo estimado = 50000
    expect(r.porcentajeSuelo).toBeCloseTo(0.5, 2);
  });

  it("respects the maximum tipo de gravamen", () => {
    const r = calculatePlusvalia(baseInput({ tipoGravamen: 0.99 }));
    // tipo capped at 0.30 -> cuota = base * 0.30
    expect(r.objetivo.cuota).toBeCloseTo(r.objetivo.base * TIPO_GRAVAMEN_MAXIMO, 1);
  });
});

describe("calculatePlusvalia - metodo real", () => {
  it("computes base as incremento real x % suelo", () => {
    const r = calculatePlusvalia(baseInput({
      valorAdquisicion: 100000,
      valorTransmision: 200000,
      valorCatastralTotal: 100000,
      valorCatastralSuelo: 50000,
    }));
    // incremento 100000, % suelo 50% -> base 50000
    expect(r.real.base).toBeCloseTo(50000, 1);
  });

  it("flags operation as not subject when there is no gain", () => {
    const r = calculatePlusvalia(baseInput({
      valorAdquisicion: 250000,
      valorTransmision: 200000,
    }));
    expect(r.hayIncremento).toBe(false);
    expect(r.real.cuota).toBe(0);
    expect(r.metodoRecomendado).toBe("no-sujeto");
    expect(r.cuotaRecomendada).toBe(0);
  });

  it("marks real method as not applicable without adquisicion/transmision", () => {
    const r = calculatePlusvalia(baseInput({ valorAdquisicion: null, valorTransmision: null }));
    expect(r.real.aplicable).toBe(false);
  });
});

describe("calculatePlusvalia - recomendacion", () => {
  it("recommends the cheaper of the two methods", () => {
    const r = calculatePlusvalia(baseInput());
    expect(["objetivo", "real"]).toContain(r.metodoRecomendado);
    expect(r.cuotaRecomendada).toBe(Math.min(r.objetivo.cuota, r.real.cuota));
  });

  it("recommends objetivo when real is not applicable", () => {
    const r = calculatePlusvalia(baseInput({ valorAdquisicion: null, valorTransmision: null }));
    expect(r.metodoRecomendado).toBe("objetivo");
    expect(r.cuotaRecomendada).toBe(r.objetivo.cuota);
  });

  it("recommends no-sujeto and zero cuota when there is a real loss", () => {
    const r = calculatePlusvalia(baseInput({ valorAdquisicion: 300000, valorTransmision: 200000 }));
    expect(r.metodoRecomendado).toBe("no-sujeto");
    expect(r.cuotaRecomendada).toBe(0);
  });

  it("real method wins when the real gain is small", () => {
    // tiny real gain -> metodo real should be cheaper than objetivo
    const r = calculatePlusvalia(baseInput({
      valorAdquisicion: 199000,
      valorTransmision: 200000, // incremento 1000
      valorCatastralTotal: 100000,
      valorCatastralSuelo: 50000,
      anyosTenencia: 18, // high coeficiente -> objetivo expensive
    }));
    expect(r.metodoRecomendado).toBe("real");
    expect(r.real.cuota).toBeLessThan(r.objetivo.cuota);
  });

  it("objetivo wins when real gain is very large", () => {
    const r = calculatePlusvalia(baseInput({
      valorAdquisicion: 50000,
      valorTransmision: 500000, // huge gain
      valorCatastralTotal: 100000,
      valorCatastralSuelo: 50000,
      anyosTenencia: 10,
    }));
    expect(r.metodoRecomendado).toBe("objetivo");
  });
});

describe("calculatePlusvalia - edge cases", () => {
  it("handles zero catastral value gracefully", () => {
    const r = calculatePlusvalia(baseInput({ valorCatastralTotal: 0, valorCatastralSuelo: 0 }));
    expect(r.objetivo.cuota).toBe(0);
  });

  it("never returns negative cuota", () => {
    const r = calculatePlusvalia(baseInput({ valorAdquisicion: 500000, valorTransmision: 100000 }));
    expect(r.cuotaRecomendada).toBeGreaterThanOrEqual(0);
    expect(r.objetivo.cuota).toBeGreaterThanOrEqual(0);
    expect(r.real.cuota).toBeGreaterThanOrEqual(0);
  });

  it("exposes the coeficiente used", () => {
    const r = calculatePlusvalia(baseInput({ anyosTenencia: 7 }));
    expect(r.coeficienteObjetivo).toBe(COEFICIENTES_MAXIMOS[7]);
  });
});
