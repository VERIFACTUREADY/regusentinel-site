#!/usr/bin/env node
/**
 * Aplica las migraciones pendientes SOLO en un despliegue de PRODUCCION de
 * Vercel. En cualquier otro contexto no toca ninguna base de datos.
 *
 * LA CONTRADICCION QUE RESUELVE
 * -----------------------------
 * El README afirmaba que las migraciones «se aplican solas durante el build».
 * No era cierto: `npm run build` ejecutaba `check-legal-config`,
 * `prisma generate` y `next build`, y nada mas. `scripts/migrate-deploy.mjs`
 * existia pero era un paso suelto que nadie invocaba automaticamente.
 *
 * O sea: un despliegue de produccion podia publicar codigo nuevo contra un
 * esquema viejo. El fallo aparece despues, en tiempo de ejecucion, como una
 * columna que no existe —y para entonces la version nueva ya esta sirviendo
 * peticiones a usuarios reales—.
 *
 * COMO SE GARANTIZA AHORA
 * -----------------------
 *   - Se engancha al final de `npm run build`, DESPUES de `next build`. Si la
 *     aplicacion no compila, no se migra: no tiene sentido mover el esquema
 *     para una version que no va a publicarse.
 *   - Vercel promueve el despliegue cuando el comando de build termina bien.
 *     Migrar aqui es migrar ANTES de que la version nueva quede operativa.
 *   - Si `migrate deploy` falla, este script sale con codigo != 0, el build
 *     falla y Vercel NO promueve el despliegue: sigue sirviendo el anterior.
 *   - `prisma migrate deploy` solo aplica las migraciones pendientes y toma un
 *     bloqueo de aviso en PostgreSQL mientras lo hace, asi que dos builds
 *     simultaneos se serializan y cada migracion se aplica UNA vez.
 *
 * QUE NO HACE, A PROPOSITO
 * ------------------------
 * Ni `db push`, ni `migrate reset`, ni `--accept-data-loss`. Toda la logica de
 * aplicacion vive en `scripts/migrate-deploy.mjs`, que ya se niega a reparar
 * nada por su cuenta; aqui solo se decide CUANDO invocarlo.
 *
 * UN PREVIEW NUNCA MIGRA
 * ----------------------
 * `VERCEL_ENV` vale `production`, `preview` o `development`. Solo el primero
 * migra. Un Preview comparte a menudo la `DATABASE_URL` de produccion, asi que
 * dejarle aplicar migraciones significaria que abrir un PR modifica el esquema
 * de produccion sin que nadie lo haya aprobado.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ENTORNO = process.env.VERCEL_ENV;

function salir(mensaje) {
  console.log(`[migrar-en-produccion] ${mensaje}`);
  process.exit(0);
}

// Fuera de Vercel no hay despliegue que valga: build local, CI, contenedor.
if (!process.env.VERCEL) {
  salir("no es un build de Vercel; no se migra nada.");
}

if (ENTORNO !== "production") {
  salir(
    `VERCEL_ENV=${ENTORNO ?? "(sin definir)"}: no se migra. ` +
      "Un Preview nunca aplica migraciones sobre la base de produccion.",
  );
}

/*
 * En produccion la ausencia de DATABASE_URL NO es motivo para seguir. Si se
 * dejara pasar, el despliegue se publicaria sin haber migrado y sin que nadie
 * lo notara hasta que fallara una consulta.
 */
if (!process.env.DATABASE_URL) {
  console.error(
    "[migrar-en-produccion] ERROR: VERCEL_ENV=production pero falta DATABASE_URL.\n" +
      "\n" +
      "El despliegue se detiene aqui: publicar sin migrar dejaria la version\n" +
      "nueva sirviendo contra un esquema viejo.\n" +
      "\n" +
      "Definela en Vercel > Project > Settings > Environment Variables, para el\n" +
      "entorno Production, y vuelve a desplegar.\n",
  );
  process.exit(1);
}

console.log("[migrar-en-produccion] Despliegue de PRODUCCION: aplicando migraciones pendientes.");

try {
  execFileSync("node", [path.join(AQUI, "migrate-deploy.mjs")], { stdio: "inherit" });
} catch {
  console.error(
    "\n[migrar-en-produccion] Las migraciones NO se han aplicado.\n" +
      "El build falla a proposito para que Vercel no promueva este despliegue:\n" +
      "el anterior sigue sirviendo, contra un esquema que si le corresponde.\n",
  );
  process.exit(1);
}

console.log("[migrar-en-produccion] Esquema al dia antes de publicar.");
