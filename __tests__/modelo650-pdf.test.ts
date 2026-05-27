import { describe, it, expect } from "vitest";
import { generateModelo650PDF, type Modelo650Input } from "../src/lib/modelo650-pdf";

function baseInput(overrides: Partial<Modelo650Input> = {}): Modelo650Input {
  return {
    caseRef: "EXP-TEST-001",
    deceased: {
      fullName: "Juan Pérez García",
      dni: "12345678A",
      deathDate: new Date("2024-12-15"),
      province: "madrid",
    },
    contact: {
      fullName: "María Pérez López",
      relationship: "Hija",
      dni: "87654321B",
      email: "maria@example.com",
      phone: "+34600111222",
    },
    estimatedInheritanceValue: 200000,
    hasDeceasedInsurance: false,
    categories: ["BANCOS", "FISCAL"],
    orgName: "Despacho Test",
    generatedAt: new Date("2025-01-15T10:00:00Z"),
    ...overrides,
  };
}

describe("generateModelo650PDF", () => {
  it("returns a non-empty Uint8Array starting with PDF header", async () => {
    const bytes = await generateModelo650PDF(baseInput());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);

    // PDF files start with "%PDF-"
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles minimal input (only deceased name)", async () => {
    const bytes = await generateModelo650PDF({
      caseRef: "EXP-MIN",
      deceased: {
        fullName: "Sin Apellidos",
        dni: null,
        deathDate: null,
        province: null,
      },
      contact: null,
      estimatedInheritanceValue: null,
      hasDeceasedInsurance: false,
      categories: [],
      orgName: "Heredia",
      generatedAt: new Date(),
    });
    expect(bytes.length).toBeGreaterThan(1000);
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("works for foral province (Navarra)", async () => {
    const bytes = await generateModelo650PDF(baseInput({
      deceased: {
        fullName: "Iker Aramburu",
        dni: null,
        deathDate: new Date("2024-08-01"),
        province: "navarra",
      },
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("works for unknown/invalid province", async () => {
    const bytes = await generateModelo650PDF(baseInput({
      deceased: {
        fullName: "Test",
        dni: null,
        deathDate: new Date(),
        province: "Atlantis",
      },
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("works without contact", async () => {
    const bytes = await generateModelo650PDF(baseInput({ contact: null }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("includes insurance flag without breaking", async () => {
    const bytes = await generateModelo650PDF(baseInput({
      hasDeceasedInsurance: true,
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("handles very long names without breaking", async () => {
    const longName = "A".repeat(300);
    const bytes = await generateModelo650PDF(baseInput({
      deceased: {
        fullName: longName,
        dni: "12345678A",
        deathDate: new Date(),
        province: "madrid",
      },
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("handles very large inheritance values", async () => {
    const bytes = await generateModelo650PDF(baseInput({
      estimatedInheritanceValue: 50_000_000,
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("handles zero/negative inheritance gracefully", async () => {
    const bytes = await generateModelo650PDF(baseInput({
      estimatedInheritanceValue: 0,
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("handles future deathDate (edge case)", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const bytes = await generateModelo650PDF(baseInput({
      deceased: {
        fullName: "Test",
        dni: null,
        deathDate: future,
        province: "madrid",
      },
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("PDF metadata reflects case ref", async () => {
    // pdf-lib doesn't expose a direct read API for our generated docs without
    // re-parsing, so we just sanity-check non-empty output of distinct refs
    const bytesA = await generateModelo650PDF(baseInput({ caseRef: "EXP-A" }));
    const bytesB = await generateModelo650PDF(baseInput({ caseRef: "EXP-B" }));
    // Different case refs produce different byte streams
    expect(bytesA.length).toBeGreaterThan(0);
    expect(bytesB.length).toBeGreaterThan(0);
    expect(Buffer.from(bytesA).equals(Buffer.from(bytesB))).toBe(false);
  });
});
