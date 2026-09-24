/**
 * Cifrado autenticado de secretos outbound.
 *
 * Antes `customWebhookSecret` se guardaba en texto plano: cualquier copia de
 * seguridad o volcado exponia el secreto HMAC con el que el cliente verifica
 * que los eventos vienen de nosotros.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  readSecret,
  maskSecret,
  encryptionAvailable,
  DecryptionError,
  MissingEncryptionKeyError,
} from "../src/lib/secret-crypto";

const CLAVE = Buffer.alloc(32, 7).toString("base64");

beforeAll(() => {
  process.env.SECRETS_ENCRYPTION_KEY = CLAVE;
});

describe("Cifrado y descifrado", () => {
  it("ida y vuelta conserva el valor", () => {
    const secreto = "mi-secreto-hmac-de-32-caracteres!";
    expect(decryptSecret(encryptSecret(secreto))).toBe(secreto);
  });

  it("el ciphertext no contiene el texto en claro", () => {
    const cifrado = encryptSecret("SECRETO-VISIBLE-EN-CLARO");
    expect(cifrado).not.toContain("SECRETO");
    expect(Buffer.from(cifrado, "utf8").toString()).not.toContain("VISIBLE");
  });

  it("dos cifrados del mismo valor son distintos (IV aleatorio)", () => {
    const a = encryptSecret("igual");
    const b = encryptSecret("igual");
    expect(a).not.toBe(b);
    // Pero ambos descifran al mismo valor.
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("el formato lleva version, IV, tag y datos", () => {
    const partes = encryptSecret("x").split(".");
    expect(partes).toHaveLength(4);
    expect(partes[0]).toBe("v1");
  });

  it("soporta UTF-8 y cadenas largas", () => {
    const raro = "ñÁÉ€🔐 " + "x".repeat(500);
    expect(decryptSecret(encryptSecret(raro))).toBe(raro);
  });
});

describe("Autenticacion: manipular el ciphertext falla", () => {
  it("alterar los datos provoca fallo de autenticacion", () => {
    const cifrado = encryptSecret("secreto-original");
    const [v, iv, tag, datos] = cifrado.split(".");

    // Cambiamos un byte de los datos.
    const buf = Buffer.from(datos, "base64url");
    buf[0] = buf[0] ^ 0xff;
    const manipulado = [v, iv, tag, buf.toString("base64url")].join(".");

    // GCM detecta la manipulacion: lanza en vez de devolver basura.
    expect(() => decryptSecret(manipulado)).toThrow(DecryptionError);
  });

  it("alterar el tag provoca fallo de autenticacion", () => {
    const [v, iv, tag, datos] = encryptSecret("secreto").split(".");
    const buf = Buffer.from(tag, "base64url");
    buf[0] = buf[0] ^ 0xff;
    expect(() => decryptSecret([v, iv, buf.toString("base64url"), datos].join("."))).toThrow(
      DecryptionError,
    );
  });

  it("alterar el IV provoca fallo de autenticacion", () => {
    const [v, iv, tag, datos] = encryptSecret("secreto").split(".");
    const buf = Buffer.from(iv, "base64url");
    buf[0] = buf[0] ^ 0xff;
    expect(() => decryptSecret([v, buf.toString("base64url"), tag, datos].join("."))).toThrow(
      DecryptionError,
    );
  });

  it("una clave distinta no descifra", () => {
    const cifrado = encryptSecret("secreto");
    const original = process.env.SECRETS_ENCRYPTION_KEY;
    process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    try {
      expect(() => decryptSecret(cifrado)).toThrow(DecryptionError);
    } finally {
      process.env.SECRETS_ENCRYPTION_KEY = original;
    }
  });
});

describe("Deteccion de formato y valores heredados", () => {
  it("reconoce un valor cifrado", () => {
    expect(isEncrypted(encryptSecret("x"))).toBe(true);
  });

  it("no confunde un valor en claro con uno cifrado", () => {
    expect(isEncrypted("secreto-en-claro")).toBe(false);
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted("v1.solo.tres")).toBe(false);
  });

  it("readSecret acepta valores heredados en claro sin romper integraciones", () => {
    // Guardados antes de esta fase; el script de migracion los reescribe.
    expect(readSecret("secreto-antiguo-en-claro")).toBe("secreto-antiguo-en-claro");
  });

  it("readSecret descifra un valor cifrado", () => {
    expect(readSecret(encryptSecret("nuevo"))).toBe("nuevo");
  });

  it("readSecret devuelve null si no puede descifrar, en vez de basura", () => {
    const [v, iv, tag, datos] = encryptSecret("x").split(".");
    const buf = Buffer.from(datos, "base64url");
    buf[0] = buf[0] ^ 0xff;
    expect(readSecret([v, iv, tag, buf.toString("base64url")].join("."))).toBeNull();
  });

  it("readSecret devuelve null para vacio", () => {
    expect(readSecret(null)).toBeNull();
    expect(readSecret("")).toBeNull();
  });
});

describe("Configuracion de la clave", () => {
  it("sin clave, cifrar lanza en vez de guardar en claro", () => {
    const original = process.env.SECRETS_ENCRYPTION_KEY;
    delete process.env.SECRETS_ENCRYPTION_KEY;
    try {
      expect(encryptionAvailable()).toBe(false);
      expect(() => encryptSecret("x")).toThrow(MissingEncryptionKeyError);
    } finally {
      process.env.SECRETS_ENCRYPTION_KEY = original;
    }
  });

  it("una clave de longitud incorrecta se rechaza", () => {
    const original = process.env.SECRETS_ENCRYPTION_KEY;
    process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    try {
      expect(encryptionAvailable()).toBe(false);
    } finally {
      process.env.SECRETS_ENCRYPTION_KEY = original;
    }
  });

  it("acepta la clave en hex ademas de en base64", () => {
    const original = process.env.SECRETS_ENCRYPTION_KEY;
    process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("hex");
    try {
      expect(encryptionAvailable()).toBe(true);
      expect(decryptSecret(encryptSecret("hex"))).toBe("hex");
    } finally {
      process.env.SECRETS_ENCRYPTION_KEY = original;
    }
  });
});

describe("Enmascarado", () => {
  it("no revela el secreto completo", () => {
    const m = maskSecret("supersecretovalor12345");
    expect(m).not.toContain("secretovalor");
    expect(m).toContain("•");
  });

  it("un secreto corto se oculta entero", () => {
    expect(maskSecret("corto")).toBe("••••••••");
  });

  it("null sigue siendo null", () => {
    expect(maskSecret(null)).toBeNull();
  });
});
