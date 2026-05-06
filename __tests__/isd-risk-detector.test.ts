import { describe, it, expect } from "vitest";
import { detectISDRisks } from "../src/lib/isd-risk-detector";

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
