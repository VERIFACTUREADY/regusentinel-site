/**
 * Cifrado autenticado de secretos guardados en base de datos.
 *
 * ESTADO ANTERIOR
 * ---------------
 * `Organization.customWebhookSecret` se guardaba en texto plano. Cualquiera con
 * acceso de lectura a la base de datos —una copia de seguridad, un volcado de
 * depuración, un error de configuración de permisos— obtenía el secreto HMAC
 * con el que el cliente valida que los eventos vienen de nosotros.
 *
 * FORMATO: `v1.<iv_base64url>.<tag_base64url>.<ciphertext_base64url>`
 *
 * El prefijo de versión permite rotar el algoritmo más adelante sin ambigüedad
 * y distinguir un valor cifrado de uno heredado en texto plano.
 *
 * CLAVE: `SECRETS_ENCRYPTION_KEY`, 32 bytes en base64 o hex. Independiente de
 * `NEXTAUTH_SECRET` a propósito: rotar la de sesiones no debe obligar a
 * redescifrar secretos, ni al revés.
 *
 *   openssl rand -base64 32
 *
 * ROTACIÓN: cambiar la clave invalida los valores ya cifrados. El
 * procedimiento está documentado en el README (descifrar con la anterior,
 * volver a cifrar con la nueva, desplegar).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // recomendado para GCM
const KEY_BYTES = 32;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      "SECRETS_ENCRYPTION_KEY no está configurada. Genera una con `openssl rand -base64 32`.",
    );
    this.name = "MissingEncryptionKeyError";
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

function loadKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) throw new MissingEncryptionKeyError();

  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (key.length !== KEY_BYTES) {
    throw new MissingEncryptionKeyError();
  }
  return key;
}

/** ¿Está configurado el cifrado? Permite degradar con un mensaje claro. */
export function encryptionAvailable(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** ¿El valor tiene el formato cifrado? Si no, es un valor heredado en claro. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${VERSION}.`) && value.split(".").length === 4;
}

/**
 * Descifra un valor. Si el tag de autenticación no cuadra —porque alguien ha
 * manipulado el ciphertext en la base de datos— lanza en vez de devolver
 * basura: eso es justamente lo que aporta GCM frente a un cifrado sin
 * autenticar.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) {
    throw new DecryptionError("El valor no tiene el formato cifrado esperado.");
  }

  const key = loadKey();
  const [, ivPart, tagPart, dataPart] = stored.split(".");

  let iv: Buffer, tag: Buffer, ciphertext: Buffer;
  try {
    iv = Buffer.from(ivPart, "base64url");
    tag = Buffer.from(tagPart, "base64url");
    ciphertext = Buffer.from(dataPart, "base64url");
  } catch {
    throw new DecryptionError("Formato del secreto cifrado no válido.");
  }

  if (iv.length !== IV_BYTES || tag.length !== 16) {
    throw new DecryptionError("Formato del secreto cifrado no válido.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new DecryptionError(
      "No se pudo descifrar el secreto: clave incorrecta o contenido manipulado.",
    );
  }
}

/**
 * Lee un secreto que puede estar cifrado o ser un valor heredado en texto
 * plano (guardado antes de esta fase). Devuelve `null` si no se puede usar.
 *
 * Los valores heredados se siguen aceptando para no romper integraciones ya
 * configuradas; el script de migración de secretos los reescribe cifrados.
 */
export function readSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!isEncrypted(stored)) return stored; // heredado en claro
  try {
    return decryptSecret(stored);
  } catch (err) {
    console.error("No se pudo descifrar un secreto outbound:", (err as Error).message);
    return null;
  }
}

/**
 * Prepara un secreto para guardarlo. Si el cifrado no está configurado, lanza:
 * es preferible rechazar la operación a guardar el secreto en claro sin que
 * nadie se entere.
 */
export function writeSecret(plaintext: string): string {
  return encryptSecret(plaintext);
}

/** Enmascara un secreto para mostrarlo sin revelarlo. */
export function maskSecret(plaintext: string | null): string | null {
  if (!plaintext) return null;
  if (plaintext.length <= 8) return "••••••••";
  return `${plaintext.slice(0, 4)}••••••••${plaintext.slice(-4)}`;
}
