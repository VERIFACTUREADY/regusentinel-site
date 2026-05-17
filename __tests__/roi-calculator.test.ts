import { describe, it, expect } from "vitest";
import { calculateROI, recommendPlan } from "../src/lib/roi-calculator";

describe("calculateROI", () => {
  it("returns the plan price for INICIA", () => {
    const r = calculateROI({ expedientesPorMes: 20, horasPorExpediente: 8, costeHora: 30, plan: "INICIA" });
    expect(r.costePlanMensual).toBe(149);
  });

  it("returns the plan price for DESPACHO", () => {
    const r = calculateROI({ expedientesPorMes: 50, horasPorExpediente: 8, costeHora: 30, plan: "DESPACHO" });
    expect(r.costePlanMensual).toBe(349);
  });

  it("returns the plan price for FIRMA", () => {
    const r = calculateROI({ expedientesPorMes: 200, horasPorExpediente: 8, costeHora: 30, plan: "FIRMA" });
    expect(r.costePlanMensual).toBe(749);
  });

  it("computes hours saved per expediente at 40% of input hours", () => {
    const r = calculateROI({ expedientesPorMes: 10, horasPorExpediente: 10, costeHora: 30, plan: "INICIA" });
    expect(r.horasAhorradasPorExpediente).toBe(4);
    expect(r.horasAhorradasMes).toBe(40);
  });

  it("computes hours savings in euros", () => {
    const r = calculateROI({ expedientesPorMes: 10, horasPorExpediente: 10, costeHora: 30, plan: "INICIA" });
    expect(r.ahorroHorasMensual).toBe(40 * 30); // 1200
  });

  it("includes error-avoidance value", () => {
    const r = calculateROI({ expedientesPorMes: 50, horasPorExpediente: 8, costeHora: 30, plan: "DESPACHO" });
    // 50 expedientes * 1/50 prob error * 350 € = 350 €
    expect(r.ahorroErroresMensual).toBe(350);
  });

  it("computes net savings (savings minus plan cost)", () => {
    const r = calculateROI({ expedientesPorMes: 50, horasPorExpediente: 8, costeHora: 30, plan: "DESPACHO" });
    expect(r.ahorroNetoMensual).toBe(r.ahorroTotalMensual - 349);
  });

  it("annual savings are 12x monthly", () => {
    const r = calculateROI({ expedientesPorMes: 50, horasPorExpediente: 8, costeHora: 30, plan: "DESPACHO" });
    expect(r.ahorroNetoAnual).toBe(r.ahorroNetoMensual * 12);
  });

  it("payback is short for high-volume orgs", () => {
    const r = calculateROI({ expedientesPorMes: 100, horasPorExpediente: 8, costeHora: 35, plan: "DESPACHO" });
    expect(r.paybackMeses).toBeLessThan(1); // pays itself in less than a month
  });

  it("payback is Infinity if savings are zero", () => {
    const r = calculateROI({ expedientesPorMes: 0, horasPorExpediente: 0, costeHora: 0, plan: "INICIA" });
    expect(r.paybackMeses).toBe(Infinity);
  });

  it("multiplicador is at least 1 when savings are positive", () => {
    const r = calculateROI({ expedientesPorMes: 100, horasPorExpediente: 8, costeHora: 30, plan: "DESPACHO" });
    expect(r.multiplicador).toBeGreaterThan(1);
  });

  it("never returns negative net savings", () => {
    const r = calculateROI({ expedientesPorMes: 1, horasPorExpediente: 1, costeHora: 5, plan: "FIRMA" });
    expect(r.ahorroNetoMensual).toBeGreaterThanOrEqual(0);
  });

  it("computes extra capacity equivalents", () => {
    const r = calculateROI({ expedientesPorMes: 50, horasPorExpediente: 10, costeHora: 30, plan: "DESPACHO" });
    // 50 * 4h saved = 200h saved; 200h / (10 * 0.6 = 6h per remaining expediente) = ~33
    expect(r.expedientesExtraEquivalentes).toBeGreaterThan(0);
  });
});

describe("recommendPlan", () => {
  it("recommends INICIA for low volume", () => {
    expect(recommendPlan(5)).toBe("INICIA");
    expect(recommendPlan(30)).toBe("INICIA");
  });

  it("recommends DESPACHO for medium volume", () => {
    expect(recommendPlan(31)).toBe("DESPACHO");
    expect(recommendPlan(100)).toBe("DESPACHO");
  });

  it("recommends FIRMA for high volume", () => {
    expect(recommendPlan(101)).toBe("FIRMA");
    expect(recommendPlan(500)).toBe("FIRMA");
  });
});
