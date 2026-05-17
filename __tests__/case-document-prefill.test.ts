import { describe, it, expect } from "vitest";
import {
  prefillTemplateFromCase,
  countPendingFields,
  type CasePrefillData,
} from "../src/lib/case-document-prefill";

function baseCaseData(overrides: Partial<CasePrefillData> = {}): CasePrefillData {
  return {
    deceasedName: "Maria Garcia Lopez",
    deceasedDni: "12345678A",
    deathDate: new Date("2024-12-15"),
    contactName: "Antonio Garcia Perez",
    contactRelationship: "Hijo/a",
    contactEmail: "antonio@example.com",
    contactPhone: "+34 600 123 456",
    province: "madrid",
    ...overrides,
  };
}

describe("prefillTemplateFromCase", () => {
  it("returns empty object for unknown template", () => {
    expect(prefillTemplateFromCase("does-not-exist", baseCaseData())).toEqual({});
  });

  it("fills deceased name and DNI for the bank letter", () => {
    const values = prefillTemplateFromCase("carta-banco-solicitud-saldos", baseCaseData());
    expect(values.deceasedName).toBe("Maria Garcia Lopez");
    expect(values.deceasedDni).toBe("12345678A");
  });

  it("fills deathDate in yyyy-mm-dd format", () => {
    const values = prefillTemplateFromCase("carta-banco-solicitud-saldos", baseCaseData());
    expect(values.deathDate).toBe("2024-12-15");
  });

  it("accepts deathDate as ISO string", () => {
    const values = prefillTemplateFromCase(
      "carta-banco-solicitud-saldos",
      baseCaseData({ deathDate: "2024-06-01T00:00:00.000Z" })
    );
    expect(values.deathDate).toBe("2024-06-01");
  });

  it("maps contact name to remitenteName", () => {
    const values = prefillTemplateFromCase("carta-banco-solicitud-saldos", baseCaseData());
    expect(values.remitenteName).toBe("Antonio Garcia Perez");
  });

  it("maps contact email and phone to remitente fields", () => {
    const values = prefillTemplateFromCase("carta-banco-solicitud-saldos", baseCaseData());
    expect(values.remitenteEmail).toBe("antonio@example.com");
    expect(values.remitentePhone).toBe("+34 600 123 456");
  });

  it("fills relationship when it matches a select option", () => {
    const values = prefillTemplateFromCase("carta-banco-solicitud-saldos", baseCaseData({ contactRelationship: "Hijo/a" }));
    expect(values.relationship).toBe("Hijo/a");
  });

  it("drops relationship when it does NOT match a select option", () => {
    const values = prefillTemplateFromCase(
      "carta-banco-solicitud-saldos",
      baseCaseData({ contactRelationship: "Primo segundo raro" })
    );
    expect(values.relationship).toBeUndefined();
  });

  it("does not fill fields the template does not have", () => {
    const values = prefillTemplateFromCase("carta-banco-solicitud-saldos", baseCaseData());
    // bancoName is not derivable from the case
    expect(values.bancoName).toBeUndefined();
  });

  it("handles missing case data gracefully (all null)", () => {
    const values = prefillTemplateFromCase("carta-banco-solicitud-saldos", {
      deceasedName: null,
      deceasedDni: null,
      deathDate: null,
      contactName: null,
      contactRelationship: null,
      contactEmail: null,
      contactPhone: null,
      province: null,
    });
    expect(Object.keys(values)).toHaveLength(0);
  });

  it("handles invalid deathDate string without crashing", () => {
    const values = prefillTemplateFromCase(
      "carta-banco-solicitud-saldos",
      baseCaseData({ deathDate: "not-a-date" })
    );
    expect(values.deathDate).toBeUndefined();
  });

  it("works for the prorroga template", () => {
    const values = prefillTemplateFromCase("solicitud-prorroga-modelo-650", baseCaseData());
    expect(values.deceasedName).toBe("Maria Garcia Lopez");
    expect(values.remitenteName).toBe("Antonio Garcia Perez");
  });

  it("works for the comunidad template (uses province)", () => {
    const values = prefillTemplateFromCase("comunicacion-comunidad-propietarios", baseCaseData());
    expect(values.deceasedName).toBe("Maria Garcia Lopez");
  });
});

describe("countPendingFields", () => {
  it("counts filled and pending fields", () => {
    const prefilled = prefillTemplateFromCase("carta-banco-solicitud-saldos", baseCaseData());
    const counts = countPendingFields("carta-banco-solicitud-saldos", prefilled);
    expect(counts.total).toBeGreaterThan(0);
    expect(counts.filled).toBeGreaterThan(0);
    expect(counts.filled + counts.pending).toBe(counts.total);
  });

  it("returns zeros for unknown template", () => {
    const counts = countPendingFields("does-not-exist", {});
    expect(counts.total).toBe(0);
    expect(counts.filled).toBe(0);
  });

  it("counts all fields pending when nothing is prefilled", () => {
    const counts = countPendingFields("carta-banco-solicitud-saldos", {});
    expect(counts.filled).toBe(0);
    expect(counts.pending).toBe(counts.total);
  });

  it("pendingRequired never exceeds pending", () => {
    const prefilled = prefillTemplateFromCase("carta-banco-solicitud-saldos", baseCaseData());
    const counts = countPendingFields("carta-banco-solicitud-saldos", prefilled);
    expect(counts.pendingRequired).toBeLessThanOrEqual(counts.pending);
  });
});
