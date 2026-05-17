import { describe, it, expect } from "vitest";
import { generateBankPack, getMissingBankDocs } from "../src/lib/bank-pack";

describe("Bank Pack Generator", () => {
  it("returns all docs as requirements", () => {
    const result = generateBankPack(new Set());
    expect(result.requirements.length).toBeGreaterThanOrEqual(10);
  });

  it("counts total as only required docs", () => {
    const result = generateBankPack(new Set());
    const requiredCount = result.requirements.filter((r) => r.required).length;
    expect(result.total).toBe(requiredCount);
  });

  it("marks zero ready when no tags available", () => {
    const result = generateBankPack(new Set());
    expect(result.ready).toBe(0);
  });

  it("counts ready docs when matching tags exist", () => {
    const tags = new Set(["certificado_defuncion", "modelo_650"]);
    const result = generateBankPack(tags);
    expect(result.ready).toBe(2);
  });

  it("counts doc as ready if any of its tags match", () => {
    const tags = new Set(["seguro_vida"]);
    const result = generateBankPack(tags);
    expect(result.ready).toBe(1);
  });

  it("does not double-count with overlapping tags", () => {
    const tags = new Set(["seguro_vida", "notificacion_seguro"]);
    const result = generateBankPack(tags);
    expect(result.ready).toBe(1);
  });

  it("getMissingBankDocs returns required docs without matching tags", () => {
    const tags = new Set(["certificado_defuncion"]);
    const missing = getMissingBankDocs(tags);
    expect(missing.every((d) => d.required)).toBe(true);
    expect(missing.some((d) => d.name === "Certificado de defuncion")).toBe(false);
  });

  it("getMissingBankDocs includes docs with empty docTags (always missing)", () => {
    const tags = new Set(["certificado_defuncion", "certificado_saldos", "modelo_650", "transferencia_titularidad_banco", "seguro_vida"]);
    const missing = getMissingBankDocs(tags);
    const emptyTagDocs = missing.filter((d) => d.docTags.length === 0);
    expect(emptyTagDocs.length).toBeGreaterThan(0);
  });
});
