import { describe, it, expect } from "vitest";
import {
  normalizeReferenciaCatastral,
  isValidReferenciaCatastral,
  buildCatastroConsultaUrl,
  buildCatastroMapaUrl,
} from "../src/lib/catastro";

// Ejemplo real de RC válida: 20 caracteres, dígitos + letras de verificación.
const VALID_RC = "9872023VH5797S0001WX";

describe("normalizeReferenciaCatastral", () => {
  it("acepta una RC válida tal cual", () => {
    expect(normalizeReferenciaCatastral(VALID_RC)).toBe(VALID_RC);
  });

  it("convierte a mayúsculas", () => {
    expect(normalizeReferenciaCatastral(VALID_RC.toLowerCase())).toBe(VALID_RC);
  });

  it("quita espacios y guiones", () => {
    expect(normalizeReferenciaCatastral("9872023 VH5797S 0001WX")).toBe(VALID_RC);
    expect(normalizeReferenciaCatastral("9872023-VH5797S-0001WX")).toBe(VALID_RC);
  });

  it("rechaza referencias con menos de 20 caracteres", () => {
    expect(normalizeReferenciaCatastral("9872023VH5797S0001")).toBeNull();
  });

  it("rechaza referencias con caracteres no permitidos", () => {
    expect(normalizeReferenciaCatastral("9872023VH5797S0001W?")).toBeNull();
  });

  it("rechaza null y undefined", () => {
    expect(normalizeReferenciaCatastral(null)).toBeNull();
    expect(normalizeReferenciaCatastral(undefined)).toBeNull();
    expect(normalizeReferenciaCatastral("")).toBeNull();
  });
});

describe("isValidReferenciaCatastral", () => {
  it("true para RC bien formada", () => {
    expect(isValidReferenciaCatastral(VALID_RC)).toBe(true);
  });
  it("false para RC mal formada", () => {
    expect(isValidReferenciaCatastral("123")).toBe(false);
  });
});

describe("buildCatastroConsultaUrl", () => {
  it("construye URL a la sede con RefC en query", () => {
    const url = buildCatastroConsultaUrl(VALID_RC);
    expect(url).toBe(`https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCConCiud.aspx?RefC=${VALID_RC}`);
  });
  it("devuelve null para RC inválida", () => {
    expect(buildCatastroConsultaUrl("invalid")).toBeNull();
  });
});

describe("buildCatastroMapaUrl", () => {
  it("construye URL del visor cartográfico", () => {
    const url = buildCatastroMapaUrl(VALID_RC);
    expect(url).toBe(`https://www1.sedecatastro.gob.es/Cartografia/GeneraGraficoParcela.aspx?ReferenciaCatastral=${VALID_RC}`);
  });
  it("normaliza antes de construir la URL", () => {
    const url = buildCatastroMapaUrl(VALID_RC.toLowerCase());
    expect(url).toContain(VALID_RC);
  });
});
