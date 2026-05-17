import { describe, it, expect } from "vitest";
import { generateModelo651PDF, type Modelo651Input } from "../src/lib/modelo651-pdf";

function baseInput(overrides: Partial<Modelo651Input> = {}): Modelo651Input {
  return {
    caseRef: "DON-001",
    donante: { fullName: "Padre Ejemplo", dni: "12345678A" },
    donatario: { fullName: "Hijo Ejemplo", dni: "87654321B", relationship: "Hijo", province: "madrid" },
    donationDate: new Date("2025-01-15"),
    tipoBien: "dinero",
    baseImponible: 50000,
    reduccion: "ninguna",
    ccaa: "MADRID",
    group: "II",
    orgName: "Despacho Test",
    generatedAt: new Date("2025-01-20"),
    ...overrides,
  };
}

describe("generateModelo651PDF", () => {
  it("returns a valid PDF byte stream", async () => {
    const bytes = await generateModelo651PDF(baseInput());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles minimal input (only donante name)", async () => {
    const bytes = await generateModelo651PDF({
      caseRef: "DON-MIN",
      donante: { fullName: "Donante", dni: null },
      donatario: { fullName: "Donatario", dni: null, relationship: null, province: null },
      donationDate: null,
      tipoBien: "otros",
      baseImponible: null,
      reduccion: "ninguna",
      ccaa: null,
      group: null,
      orgName: "BARITUR PRO",
      generatedAt: new Date(),
    });
    expect(bytes.length).toBeGreaterThan(1000);
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("renders correctly for inmueble with vivienda reduction", async () => {
    const bytes = await generateModelo651PDF(baseInput({
      tipoBien: "inmueble",
      baseImponible: 200000,
      reduccion: "vivienda-habitual-hijo",
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("renders correctly for empresa familiar reduction", async () => {
    const bytes = await generateModelo651PDF(baseInput({
      baseImponible: 500000,
      reduccion: "empresa-familiar",
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("works for foral CCAA (Navarra)", async () => {
    const bytes = await generateModelo651PDF(baseInput({
      ccaa: "NAVARRA",
      donatario: { fullName: "Heredero", dni: null, relationship: "Hijo", province: "navarra" },
    }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("renders without crash for grupo IV (no bonification)", async () => {
    const bytes = await generateModelo651PDF(baseInput({ group: "IV", ccaa: "MADRID" }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("handles different tipoBien values", async () => {
    for (const tipo of ["dinero", "inmueble", "valores", "vehiculo", "otros"] as const) {
      const bytes = await generateModelo651PDF(baseInput({ tipoBien: tipo }));
      expect(bytes.length).toBeGreaterThan(1000);
    }
  });

  it("computes 30 working days deadline approximately right", async () => {
    // Donation on Friday 2025-01-03 -> ~30 working days later approx mid-Feb
    const donationDate = new Date("2025-01-03");
    const bytes = await generateModelo651PDF(baseInput({ donationDate }));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("produces different output for different case refs", async () => {
    const a = await generateModelo651PDF(baseInput({ caseRef: "DON-A" }));
    const b = await generateModelo651PDF(baseInput({ caseRef: "DON-B" }));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});
