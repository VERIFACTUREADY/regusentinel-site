/**
 * Aplica las migraciones de Prisma durante el build (Vercel no ejecuta
 * `npm start`, así que este es el único punto donde podemos migrar la DB
 * de producción automáticamente).
 *
 * Casos que cubre:
 *  - DB vacía            → `migrate deploy` crea todo el esquema.
 *  - DB ya migrada       → `migrate deploy` es un no-op.
 *  - DB creada con `db push` (sin historial de migraciones, error P3005)
 *                        → sincroniza el esquema con `db push` y marca la
 *                          baseline como aplicada. Sin resets manuales.
 *  - Sin DATABASE_URL    → se omite con aviso (builds de CI sin DB).
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASELINE = "20260708000000_init_heredia";

// La CLI de Prisma carga .env por su cuenta; este guard también debe verlo.
const envFileHasDbUrl = (() => {
  try {
    return /^\s*DATABASE_URL\s*=\s*['"]?.+/m.test(readFileSync(".env", "utf8"));
  } catch {
    return false;
  }
})();

if (!process.env.DATABASE_URL && !envFileHasDbUrl) {
  console.warn("[migrate-deploy] DATABASE_URL no definida — se omiten las migraciones (build sin DB).");
  process.exit(0);
}

function run(cmd) {
  console.log(`[migrate-deploy] $ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function tryDeploy() {
  // Capturamos la salida para poder detectar P3005 y a la vez mostrarla.
  const out = execSync("npx prisma migrate deploy 2>&1 || true", { encoding: "utf8" });
  console.log(out);
  if (/All migrations have been successfully applied|No pending migrations/i.test(out)) return "ok";
  if (out.includes("P3005")) return "needs-baseline";
  return "failed";
}

let result = tryDeploy();

if (result === "needs-baseline") {
  console.log("[migrate-deploy] La DB tiene esquema pero no historial de migraciones (P3005). Sincronizando y marcando baseline…");
  // 1. Alinea el esquema existente con schema.prisma (añade columnas/tablas nuevas).
  run("npx prisma db push --accept-data-loss --skip-generate");
  // 2. Marca la migración baseline como aplicada para futuros deploys.
  run(`npx prisma migrate resolve --applied ${BASELINE}`);
  result = tryDeploy();
}

if (result !== "ok") {
  console.error("[migrate-deploy] No se pudieron aplicar las migraciones. Revisa DATABASE_URL y la salida anterior.");
  process.exit(1);
}

console.log("[migrate-deploy] Esquema de base de datos al día.");
