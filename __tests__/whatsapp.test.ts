import { describe, it, expect } from "vitest";
import { normalizePhoneForWhatsApp, buildWhatsAppUrl } from "../src/lib/whatsapp";

describe("normalizePhoneForWhatsApp", () => {
  it("devuelve null para entradas vacías", () => {
    expect(normalizePhoneForWhatsApp(null)).toBeNull();
    expect(normalizePhoneForWhatsApp(undefined)).toBeNull();
    expect(normalizePhoneForWhatsApp("")).toBeNull();
    expect(normalizePhoneForWhatsApp("   ")).toBeNull();
  });

  it("quita el prefijo +", () => {
    expect(normalizePhoneForWhatsApp("+34612345678")).toBe("34612345678");
  });

  it("quita el prefijo 00", () => {
    expect(normalizePhoneForWhatsApp("0034612345678")).toBe("34612345678");
  });

  it("añade 34 a un móvil nacional español de 9 dígitos", () => {
    expect(normalizePhoneForWhatsApp("612345678")).toBe("34612345678");
    expect(normalizePhoneForWhatsApp("712345678")).toBe("34712345678");
    expect(normalizePhoneForWhatsApp("912345678")).toBe("34912345678");
  });

  it("respeta espacios, paréntesis y guiones", () => {
    expect(normalizePhoneForWhatsApp("+34 (612) 34-56-78")).toBe("34612345678");
    expect(normalizePhoneForWhatsApp("612.345.678")).toBe("34612345678");
  });

  it("rechaza números demasiado cortos (no internacionales y no 9 dígitos)", () => {
    expect(normalizePhoneForWhatsApp("12345")).toBeNull();
    expect(normalizePhoneForWhatsApp("123456")).toBeNull();
  });

  it("rechaza números demasiado largos", () => {
    expect(normalizePhoneForWhatsApp("1234567890123456")).toBeNull();
  });

  it("acepta números internacionales no españoles ya con prefijo", () => {
    expect(normalizePhoneForWhatsApp("+5215512345678")).toBe("5215512345678");
    expect(normalizePhoneForWhatsApp("+447123456789")).toBe("447123456789");
  });
});

describe("buildWhatsAppUrl", () => {
  it("construye la URL básica sin texto", () => {
    expect(buildWhatsAppUrl({ phone: "+34612345678" })).toBe("https://wa.me/34612345678");
  });

  it("incluye el texto codificado", () => {
    const url = buildWhatsAppUrl({ phone: "612345678", text: "Hola, ¿cómo va el expediente?" });
    expect(url).toMatch(/^https:\/\/wa\.me\/34612345678\?text=/);
    expect(decodeURIComponent(url!.split("?text=")[1])).toBe("Hola, ¿cómo va el expediente?");
  });

  it("ignora texto vacío o sólo espacios", () => {
    expect(buildWhatsAppUrl({ phone: "612345678", text: "" })).toBe("https://wa.me/34612345678");
    expect(buildWhatsAppUrl({ phone: "612345678", text: "   " })).toBe("https://wa.me/34612345678");
  });

  it("devuelve null cuando el teléfono no es válido", () => {
    expect(buildWhatsAppUrl({ phone: "123" })).toBeNull();
    expect(buildWhatsAppUrl({ phone: null })).toBeNull();
  });

  it("trim del texto antes de codificar", () => {
    const url = buildWhatsAppUrl({ phone: "612345678", text: "   hola   " });
    expect(decodeURIComponent(url!.split("?text=")[1])).toBe("hola");
  });
});
