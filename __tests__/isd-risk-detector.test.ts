import { describe, it, expect } from "vitest";
import { detectISDRisks, parseAppliedReductions } from "../src/lib/isd-risk-detector";

function isoYearsAhead(years: number, extraDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  d.setDate(d.getDate() + extraDays);
  return d.toISOString().slice(0, 10);
}

function isoYearsAgo(years: number, extraDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + extraDays);
  return d.toISOString().slice(0, 10);
}

function daysAgo(d: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date;
}

describe("detectISDRisks", () => {
  it("returns no risks when deathDate is missing", () => {
    expect(detectISDRisks({ deathDate: null, province: "madrid" })).toEqual([]);
  });

  it("flags ISD overdue when more than 6 months passed", () => {
    const risks = detectISDRisks({ deathDate: daysAgo(200), province: "madrid" });
    const overdue = risks.find((r) => r.id === "isd_overdue");
    expect(overdue).toBeDefined();
    expect(overdue!.severity).toBe("critical");
    expect(overdue!.title).toMatch(/vencido/i);
  });

  it("flags ISD critical (≤7d)", () => {
    const risks = detectISDRisks({ deathDate: daysAgo(176), province: "madrid" });
    const critical = risks.find((r) => r.id === "isd_critical");
    expect(critical).toBeDefined();
    expect(critical!.severity).toBe("critical");
  });

  it("flags ISD 30d warning", () => {
    const risks = detectISDRisks({ deathDate: daysAgo(160), province: "madrid" });
    const warn = risks.find((r) => r.id === "isd_30d");
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe("warning");
  });

  it("flags extension window closing in last month of months 4-5", () => {
    const risks = detectISDRisks({ deathDate: daysAgo(130), province: "madrid" });
    const ext = risks.find((r) => r.id === "extension_window_closing");
    expect(ext).toBeDefined();
    expect(ext!.severity).toBe("warning");
  });

  it("does not flag extension when ISD is already in critical zone", () => {
    const risks = detectISDRisks({ deathDate: daysAgo(176), province: "madrid" });
    expect(risks.find((r) => r.id === "extension_window_closing")).toBeUndefined();
  });

  it("flags missing province", () => {
    const risks = detectISDRisks({ deathDate: daysAgo(30), province: null });
    expect(risks.find((r) => r.id === "missing_province")).toBeDefined();
  });

  it("flags unknown province", () => {
    const risks = detectISDRisks({ deathDate: daysAgo(30), province: "Atlantis" });
    const unk = risks.find((r) => r.id === "unknown_province");
    expect(unk).toBeDefined();
    expect(unk!.description).toContain("Atlantis");
  });

  it("does not flag missing province when province is valid", () => {
    const risks = detectISDRisks({ deathDate: daysAgo(30), province: "madrid" });
    expect(risks.find((r) => r.id === "missing_province")).toBeUndefined();
    expect(risks.find((r) => r.id === "unknown_province")).toBeUndefined();
  });

  it("flags foral regime for Navarra and Pais Vasco", () => {
    const navarraRisks = detectISDRisks({ deathDate: daysAgo(30), province: "navarra" });
    expect(navarraRisks.find((r) => r.id === "foral_regime")).toBeDefined();

    const pvRisks = detectISDRisks({ deathDate: daysAgo(30), province: "bizkaia" });
    expect(pvRisks.find((r) => r.id === "foral_regime")).toBeDefined();
  });

  it("flags Asturias as no general bonification for group II", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "asturias",
      group: "II",
    });
    expect(risks.find((r) => r.id === "no_general_bonification")).toBeDefined();
  });

  it("does not flag Madrid as no bonification (it has 99%)", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      group: "II",
    });
    expect(risks.find((r) => r.id === "no_general_bonification")).toBeUndefined();
  });

  it("flags threshold proximity in Cataluna", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "barcelona",
      estimatedInheritanceValue: 95000,
      group: "II",
    });
    const thr = risks.find((r) => r.id.startsWith("threshold_CATALUNA"));
    expect(thr).toBeDefined();
    expect(thr!.severity).toBe("info");
  });

  it("flags threshold crossed in Cataluna with warning severity", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "barcelona",
      estimatedInheritanceValue: 105000,
      group: "II",
    });
    const thr = risks.find((r) => r.id.startsWith("threshold_CATALUNA"));
    expect(thr).toBeDefined();
    expect(thr!.severity).toBe("warning");
  });

  it("does not flag threshold for Madrid (no progressive scale)", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      estimatedInheritanceValue: 100000,
      group: "II",
    });
    expect(risks.find((r) => r.id.startsWith("threshold_"))).toBeUndefined();
  });

  it("does not flag threshold for groups without bonification (e.g. group IV)", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "barcelona",
      estimatedInheritanceValue: 100000,
      group: "IV",
    });
    expect(risks.find((r) => r.id.startsWith("threshold_"))).toBeUndefined();
  });

  it("returns empty array for happy case (Madrid, fresh death, group II)", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(7),
      province: "madrid",
      group: "II",
    });
    expect(risks).toEqual([]);
  });
});

describe("detectISDRisks — patrimonio preexistente", () => {
  it("flags patrimonio preexistente cerca del primer tramo (402.678 €)", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      group: "II",
      preexistingPatrimony: 380000,
    });
    const r = risks.find((x) => x.id.startsWith("patrimony_bracket_"));
    expect(r).toBeDefined();
    expect(r!.severity).toBe("info");
    expect(r!.title).toMatch(/cerca del tramo/i);
  });

  it("flags patrimonio preexistente que ya cruzó el primer tramo", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      group: "II",
      preexistingPatrimony: 420000,
    });
    const r = risks.find((x) => x.id.startsWith("patrimony_bracket_"));
    expect(r).toBeDefined();
    expect(r!.severity).toBe("warning");
    expect(r!.title).toMatch(/cruza el tramo/i);
  });

  it("no flagea si el patrimonio está fuera del corredor ±10%", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      preexistingPatrimony: 150000,
    });
    expect(risks.find((r) => r.id.startsWith("patrimony_bracket_"))).toBeUndefined();
  });

  it("aplica el coeficiente del grupo III en el mensaje", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      group: "III",
      preexistingPatrimony: 420000,
    });
    const r = risks.find((x) => x.id.startsWith("patrimony_bracket_"));
    expect(r).toBeDefined();
    expect(r!.description).toContain("1,5882");
  });

  it("detecta tramo de 2 millones", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      preexistingPatrimony: 1980000,
    });
    const r = risks.find((x) => x.id === "patrimony_bracket_2007380.43");
    expect(r).toBeDefined();
  });
});

describe("detectISDRisks — plusvalía municipal (IIVTNU)", () => {
  it("no flagea plusvalía si no hay inmueble urbano declarado", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(160),
      province: "madrid",
    });
    expect(risks.find((r) => r.id.startsWith("plusvalia"))).toBeUndefined();
  });

  it("flagea plusvalía crítica (≤7 días) cuando hay inmueble urbano", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(176),
      province: "madrid",
      hasUrbanProperty: true,
    });
    const r = risks.find((x) => x.id === "plusvalia_critical");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("critical");
  });

  it("flagea plusvalía vencida si el plazo ya pasó", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(220),
      province: "madrid",
      hasUrbanProperty: true,
    });
    const r = risks.find((x) => x.id === "plusvalia_overdue");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("critical");
  });

  it("flagea plusvalía a 30 días", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(160),
      province: "madrid",
      hasUrbanProperty: true,
    });
    const r = risks.find((x) => x.id === "plusvalia_30d");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("warning");
  });

  it("flagea ventana de prórroga IIVTNU en el mes 4-5", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(130),
      province: "madrid",
      hasUrbanProperty: true,
    });
    const r = risks.find((x) => x.id === "plusvalia_extension_window");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("warning");
  });

  it("detecta no sujeción si valor adquisición ≥ valor transmisión", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      hasUrbanProperty: true,
      propertyAcquisitionValue: 200000,
      propertyTransmissionValue: 180000,
    });
    const r = risks.find((x) => x.id === "plusvalia_no_incremento");
    expect(r).toBeDefined();
    expect(r!.description).toMatch(/no sujeta|no sujet/i);
  });

  it("no detecta no sujeción si la transmisión sube respecto a adquisición", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      hasUrbanProperty: true,
      propertyAcquisitionValue: 150000,
      propertyTransmissionValue: 200000,
    });
    expect(risks.find((r) => r.id === "plusvalia_no_incremento")).toBeUndefined();
  });
});

describe("detectISDRisks — cambio de residencia (art. 28 Ley 22/2009)", () => {
  it("no flagea si recentResidenceChange es false", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      recentResidenceChange: false,
    });
    expect(risks.find((r) => r.id === "residence_change_5y")).toBeUndefined();
  });

  it("flagea info si la CCAA actual bonifica fuerte sin previa conocida", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      group: "II",
      recentResidenceChange: true,
    });
    const r = risks.find((x) => x.id === "residence_change_5y");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("info");
    expect(r!.description).toMatch(/art\. 28 Ley 22\/2009/);
  });

  it("escala a warning si la CCAA previa bonifica menos que la actual", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      group: "II",
      recentResidenceChange: true,
      previousResidenceProvince: "asturias",
    });
    const r = risks.find((x) => x.id === "residence_change_5y");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("warning");
    expect(r!.title).toMatch(/Madrid/);
    expect(r!.title).toMatch(/Asturias/);
  });

  it("no flagea si la CCAA actual no bonifica fuerte", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "asturias",
      group: "II",
      recentResidenceChange: true,
      previousResidenceProvince: "madrid",
    });
    expect(risks.find((r) => r.id === "residence_change_5y")).toBeUndefined();
  });
});

describe("detectISDRisks — mantenimiento de reducciones art. 20", () => {
  it("no flagea si no hay reducciones aplicadas", () => {
    const risks = detectISDRisks({ deathDate: daysAgo(30), province: "madrid" });
    expect(risks.find((r) => r.id.startsWith("reduction_maintenance"))).toBeUndefined();
  });

  it("flagea info cuando la reducción está dentro del ±30 días del vencimiento", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      appliedReductions: [
        // 5 años menos 15 días → vence en 15 días
        { type: "VIVIENDA_HABITUAL", appliedDate: isoYearsAgo(5, 15), maintenanceYears: 5 },
      ],
    });
    const r = risks.find((x) => x.id === "reduction_maintenance_30d_VIVIENDA_HABITUAL");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("info");
  });

  it("escala a warning cuando quedan ≤7 días", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      appliedReductions: [
        { type: "EMPRESA_FAMILIAR", appliedDate: isoYearsAgo(10, 5), maintenanceYears: 10 },
      ],
    });
    const r = risks.find((x) => x.id === "reduction_maintenance_7d_EMPRESA_FAMILIAR");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("warning");
  });

  it("flagea cumplimiento cuando el periodo ya pasó (hasta 30 días después)", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      appliedReductions: [
        { type: "VIVIENDA_HABITUAL", appliedDate: isoYearsAgo(5, -15), maintenanceYears: 5 },
      ],
    });
    const r = risks.find((x) => x.id === "reduction_maintenance_passed_VIVIENDA_HABITUAL");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("info");
    expect(r!.title).toMatch(/cumplido/i);
  });

  it("no flagea reducciones muy antiguas (>30d después del aniversario)", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      appliedReductions: [
        { type: "VIVIENDA_HABITUAL", appliedDate: isoYearsAgo(6), maintenanceYears: 5 },
      ],
    });
    expect(risks.find((x) => x.id.startsWith("reduction_maintenance"))).toBeUndefined();
  });

  it("no flagea reducciones lejos del aniversario", () => {
    const risks = detectISDRisks({
      deathDate: daysAgo(30),
      province: "madrid",
      appliedReductions: [
        { type: "VIVIENDA_HABITUAL", appliedDate: isoYearsAgo(2), maintenanceYears: 5 },
      ],
    });
    expect(risks.find((x) => x.id.startsWith("reduction_maintenance"))).toBeUndefined();
  });
});

describe("parseAppliedReductions", () => {
  it("acepta un array bien formado", () => {
    const parsed = parseAppliedReductions([
      { type: "VIVIENDA_HABITUAL", appliedDate: "2026-04-15", maintenanceYears: 5 },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe("VIVIENDA_HABITUAL");
  });

  it("descarta entradas con tipo desconocido", () => {
    const parsed = parseAppliedReductions([
      { type: "TIPO_INVENTADO", appliedDate: "2026-04-15", maintenanceYears: 5 },
      { type: "EMPRESA_FAMILIAR", appliedDate: "2026-04-15", maintenanceYears: 10 },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe("EMPRESA_FAMILIAR");
  });

  it("descarta entradas sin fecha o sin años de mantenimiento", () => {
    const parsed = parseAppliedReductions([
      { type: "VIVIENDA_HABITUAL", maintenanceYears: 5 },
      { type: "VIVIENDA_HABITUAL", appliedDate: "2026-04-15" },
      { type: "VIVIENDA_HABITUAL", appliedDate: "", maintenanceYears: 5 },
      { type: "VIVIENDA_HABITUAL", appliedDate: "2026-04-15", maintenanceYears: 0 },
    ]);
    expect(parsed).toEqual([]);
  });

  it("devuelve [] para valores no-array", () => {
    expect(parseAppliedReductions(null)).toEqual([]);
    expect(parseAppliedReductions(undefined)).toEqual([]);
    expect(parseAppliedReductions("string")).toEqual([]);
    expect(parseAppliedReductions(42)).toEqual([]);
  });

  it("preserva el campo note opcional", () => {
    const parsed = parseAppliedReductions([
      { type: "OTRA", appliedDate: "2026-04-15", maintenanceYears: 5, note: "Discapacidad ≥65%" },
    ]);
    expect(parsed[0].note).toBe("Discapacidad ≥65%");
  });
});
