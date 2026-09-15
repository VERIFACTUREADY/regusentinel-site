/**
 * Cifra los `customWebhookSecret` que quedasen en texto plano.
 *
 * Antes de la fase de hardening el secreto HMAC del webhook del cliente se
 * guardaba en claro. `readSecret()` sigue aceptando esos valores para no
 * romper integraciones ya configuradas, pero deben migrarse.
 *
 * Uso:
 *   SECRETS_ENCRYPTION_KEY=... DATABASE_URL=... node scripts/encrypt-existing-secrets.mjs
 *   ... --dry-run    (sólo informa, no escribe)
 *
 * Es idempotente: los valores ya cifrados se ignoran.
 */
import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "node:crypto";

const DRY_RUN = process.argv.includes("--dry-run");

function loadKey() {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    console.error("Falta SECRETS_ENCRYPTION_KEY. Genera una con: openssl rand -base64 32");
    process.exit(1);
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    console.error("SECRETS_ENCRYPTION_KEY debe ser de 32 bytes (base64 o hex).");
    process.exit(1);
  }
  return key;
}

// Mismo formato que src/lib/secret-crypto.ts: v1.iv.tag.ciphertext
function encrypt(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

const isEncrypted = (v) => typeof v === "string" && v.startsWith("v1.") && v.split(".").length === 4;

const key = loadKey();
const prisma = new PrismaClient();

const orgs = await prisma.organization.findMany({
  where: { customWebhookSecret: { not: null } },
  select: { id: true, name: true, customWebhookSecret: true },
});

let migrados = 0, yaCifrados = 0;

for (const org of orgs) {
  if (isEncrypted(org.customWebhookSecret)) {
    yaCifrados++;
    continue;
  }
  console.log(`${DRY_RUN ? "[dry-run] " : ""}cifrando secreto de ${org.name} (${org.id})`);
  if (!DRY_RUN) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { customWebhookSecret: encrypt(org.customWebhookSecret, key) },
    });
  }
  migrados++;
}

console.log(`\nOrganizaciones con secreto: ${orgs.length}`);
console.log(`  ya cifrados: ${yaCifrados}`);
console.log(`  ${DRY_RUN ? "por cifrar" : "cifrados ahora"}: ${migrados}`);

await prisma.$disconnect();
