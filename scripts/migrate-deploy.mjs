#!/usr/bin/env node
/**
 * Despliegue de migraciones. **Paso separado del build.**
 *
 * QUE HACIA ANTES ESTE FICHERO Y POR QUE SE HA REESCRITO
 * -----------------------------------------------------
 * Se ejecutaba dentro de `npm run build` y, cuando `migrate deploy` fallaba con
 * P3005 (base con esquema pero sin historial), respondia ejecutando:
 *
 *     prisma db push --accept-data-loss --skip-generate
 *
 * Eso da permiso explicito a Prisma para DESTRUIR datos —columnas y tablas que
 * no encajen con el esquema— sin revision humana, durante un build automatico
 * y contra produccion. Es la operacion mas peligrosa que puede haber en un
 * pipeline de despliegue.
 *
 * La causa raiz de aquel P3005 era que el historial de migraciones se habia
 * quedado 75 columnas por detras de `schema.prisma`. Eso esta corregido con la
 * migracion incremental `20260530000000_align_schema_with_models`, asi que
 * `migrate deploy` basta y no hay ningun caso que justifique `db push`.
 *
 * REGLAS QUE ESTE SCRIPT CUMPLE
 * -----------------------------
 *   1. Nunca ejecuta `db push`, ni con `--accept-data-loss` ni sin el.
 *   2. Nunca ejecuta `migrate reset`.
 *   3. Solo aplica migraciones incrementales ya revisadas y versionadas.
 *   4. Si la base esta en un estado que las migraciones no pueden resolver,
 *      FALLA y pide intervencion humana en vez de improvisar.
 *
 * Uso:
 *   npm run db:deploy              # aplica las migraciones pendientes
 *   npm run db:deploy -- --check   # solo informa del estado, no escribe
 */
import { execFileSync } from "node:child_process";

const SOLO_COMPROBAR = process.argv.includes("--check");

if (!process.env.DATABASE_URL) {
  console.error(
    "[db:deploy] ERROR: falta DATABASE_URL.\n" +
      "Este paso es de DESPLIEGUE, no de build: debe ejecutarse con acceso a la\n" +
      "base de datos de destino y de forma explicita.",
  );
  process.exit(1);
}

function prisma(args) {
  return execFileSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

let salidaEstado = "";
try {
  salidaEstado = prisma(["migrate", "status"]);
  console.log(salidaEstado);
} catch (err) {
  // `migrate status` sale con codigo != 0 cuando hay migraciones pendientes:
  // eso no es un fallo, es informacion.
  salidaEstado = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  console.log(salidaEstado);
}

if (/P3005/.test(salidaEstado)) {
  console.error(
    "\n[db:deploy] ERROR P3005: la base tiene esquema pero no historial de migraciones.\n" +
      "\n" +
      "NO se va a sincronizar el esquema a la fuerza: destruiria datos sin revision.\n" +
      "\n" +
      "Resolucion manual, tras hacer copia de seguridad:\n" +
      "  1. Identifica que migraciones refleja ya el esquema actual.\n" +
      "  2. Marcalas como aplicadas una a una:\n" +
      "       npx prisma migrate resolve --applied <nombre_migracion>\n" +
      "  3. Vuelve a ejecutar `npm run db:deploy`.\n",
  );
  process.exit(1);
}

if (SOLO_COMPROBAR) {
  const pendientes = /have not yet been applied|not yet been applied/i.test(salidaEstado);
  if (pendientes) {
    console.error("[db:deploy] Hay migraciones pendientes de aplicar.");
    process.exit(2);
  }
  console.log("[db:deploy] La base esta al dia.");
  process.exit(0);
}

try {
  console.log("[db:deploy] Aplicando migraciones pendientes…");
  console.log(prisma(["migrate", "deploy"]));
  console.log("[db:deploy] Esquema al dia.");
} catch (err) {
  console.error(`${err.stdout ?? ""}${err.stderr ?? ""}`);
  console.error(
    "\n[db:deploy] Las migraciones NO se han podido aplicar.\n" +
      "El despliegue debe detenerse aqui. No se intenta ninguna reparacion\n" +
      "automatica: revisa el error, haz copia de seguridad y resuelve a mano.\n",
  );
  process.exit(1);
}
