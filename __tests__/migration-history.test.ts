/**
 * Guardian del historial de migraciones.
 *
 * POR QUE EXISTE
 * --------------
 * En esta rama se detecto que el historial de migraciones habia sido
 * REEMPLAZADO por un baseline nuevo (`20260708000000_init_heredia`), borrando
 * las 8 migraciones que una base de produccion ya tenia aplicadas. Como
 * consecuencia `migrate deploy` fallaba con P3005 sobre cualquier base
 * existente, y el deploy "resolvia" ese fallo ejecutando
 * `prisma db push --accept-data-loss`, que puede destruir datos.
 *
 * Este test congela el historial: si alguien borra o modifica una migracion ya
 * publicada, falla y explica por que. Las migraciones nuevas se pueden anadir
 * libremente; lo unico prohibido es tocar las que ya existen.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "..", "prisma", "migrations");

/**
 * Migraciones publicadas y su huella. NO se editan salvo que se anada una
 * migracion nueva (entonces se anade su entrada, nunca se cambia una previa).
 *
 * Para regenerar tras anadir una migracion:
 *   node -e "const{createHash}=require('crypto'),{readFileSync,readdirSync}=require('fs');
 *   for(const d of readdirSync('prisma/migrations').filter(x=>x!=='migration_lock.toml').sort())
 *   console.log(\`  \"\${d}\": \"\${createHash('sha256').update(readFileSync('prisma/migrations/'+d+'/migration.sql','utf8').replace(/\\r\\n/g,'\\n')).digest('hex').slice(0,16)}\",\`)"
 */
const HISTORIAL_CONGELADO: Record<string, string> = {
  "20260406193236_init": "6d9492e34b619453",
  "20260524000000_add_case_fiscal_fields": "253b84196251c97d",
  "20260524100000_add_residence_change": "c5693618a9e85bb7",
  "20260524105000_notification_channel_prerequisites": "a9b5b08d9a5a1737",
  "20260524110000_add_outbound_integrations": "b1fd1bbb0249c796",
  "20260524120000_add_teams_webhook": "3a0173bee03c6e8a",
  "20260524130000_add_applied_reductions": "f06bca03325448fa",
  "20260524140000_add_referencia_catastral": "3af007fde4298249",
  "20260529000000_add_stripe_event_idempotency": "e09353ac9744ff61",
  "20260530000000_align_schema_with_models": "b522b557d8b9fba4",
  "20260804225123_portal_consent_document_visibility": "67251e1a56f4f464",
  "20260804230440_stripe_event_retryable": "ba2b4f8ca1acde2d",
  "20260804232000_notification_delivery_dedupe": "bd854050c603032f",
  "20260804234500_retention_ai_privacy": "45c3ce0f1cf235ff",
  "20260805000000_case_ref_unique_per_org": "f3d1ea2a3c8ab4c3",
  "20260805120000_stripe_event_recovery": "3416f5142cc5ac93",
  "20260805140000_notification_delivery_state": "e788ee70de80cc74",
  "20260805160000_retention_states_and_evidence": "a50d3c379a653cc9",
  "20260805180000_workflow_partial_deliveries": "0d28d81da68c98d7",
  "20260805200000_case_counter": "abfb1f9f40dbfde8",
  "20260806000000_workflow_claim_before_send": "4ddc64df31599e58",
  "20260806120000_invitaciones": "9579eab038223447",
  "20260909184718_subidas_directas_a_almacenamiento": "61ee2c792112ab32",
};

function huella(nombre: string): string {
  const ruta = join(MIGRATIONS_DIR, nombre, "migration.sql");
  const contenido = readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(contenido).digest("hex").slice(0, 16);
}

function migracionesEnDisco(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((d) => d !== "migration_lock.toml")
    .sort();
}

describe("Historial de migraciones", () => {
  it("ninguna migracion publicada ha sido eliminada", () => {
    const enDisco = new Set(migracionesEnDisco());
    const faltan = Object.keys(HISTORIAL_CONGELADO).filter((m) => !enDisco.has(m));

    expect(
      faltan,
      `Se han ELIMINADO migraciones publicadas: ${faltan.join(", ")}.\n` +
        "Una base de datos que ya las tenga aplicadas quedara con historial\n" +
        "inconsistente y `migrate deploy` fallara con P3005. Si el esquema debe\n" +
        "cambiar, anade una migracion NUEVA en vez de borrar una existente.",
    ).toEqual([]);
  });

  it("ninguna migracion publicada ha sido modificada", () => {
    const modificadas: string[] = [];

    for (const [nombre, esperada] of Object.entries(HISTORIAL_CONGELADO)) {
      // Huella vacia = migracion registrada pero cuyo contenido aun no se ha
      // congelado (se congela en el primer despliegue). Se comprueba solo que
      // exista.
      if (!esperada) continue;
      if (!existsSync(join(MIGRATIONS_DIR, nombre, "migration.sql"))) continue;

      const actual = huella(nombre);
      if (actual !== esperada) modificadas.push(`${nombre} (esperada ${esperada}, actual ${actual})`);
    }

    expect(
      modificadas,
      `Se han MODIFICADO migraciones ya publicadas:\n  ${modificadas.join("\n  ")}\n\n` +
        "Prisma guarda un checksum de cada migracion aplicada: cambiarla hace\n" +
        "que `migrate deploy` falle en cualquier base que ya la tuviera.\n" +
        "Corrige el esquema con una migracion nueva.",
    ).toEqual([]);
  });

  it("toda migracion en disco esta registrada en el historial congelado", () => {
    const noRegistradas = migracionesEnDisco().filter((m) => !(m in HISTORIAL_CONGELADO));

    expect(
      noRegistradas,
      `Migraciones nuevas sin registrar: ${noRegistradas.join(", ")}.\n` +
        "Anadelas a HISTORIAL_CONGELADO en este test para que queden protegidas.",
    ).toEqual([]);
  });

  it("ninguna migracion contiene operaciones destructivas no justificadas", () => {
    // Estas dos si contienen un DROP COLUMN deliberado y documentado: mueven el
    // dato a una columna nueva ANTES de retirar la antigua.
    const CON_DROP_JUSTIFICADO = new Set([
      "20260804230440_stripe_event_retryable",
      "20260804234500_retention_ai_privacy",
    ]);

    const infractoras: string[] = [];

    for (const nombre of migracionesEnDisco()) {
      const ruta = join(MIGRATIONS_DIR, nombre, "migration.sql");
      if (!existsSync(ruta)) continue;

      const sql = readFileSync(ruta, "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n");

      if (/DROP\s+TABLE|TRUNCATE/i.test(sql)) infractoras.push(`${nombre}: DROP TABLE/TRUNCATE`);
      if (/DROP\s+COLUMN/i.test(sql) && !CON_DROP_JUSTIFICADO.has(nombre)) {
        infractoras.push(`${nombre}: DROP COLUMN`);
      }
    }

    expect(infractoras, `Migraciones destructivas:\n  ${infractoras.join("\n  ")}`).toEqual([]);
  });
});

describe("El despliegue no puede destruir datos", () => {
  const raiz = join(__dirname, "..");

  it("ningun script ejecuta `db push`", () => {
    const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
    const scripts: string[] = Object.values(pkg.scripts ?? {});

    const infractores = scripts.filter((s) => /prisma\s+db\s+push/.test(s));
    expect(
      infractores,
      "`prisma db push` reescribe el esquema sin migracion y puede destruir datos.",
    ).toEqual([]);
  });

  it("ningun script usa --accept-data-loss", () => {
    const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
    const scripts: string[] = Object.values(pkg.scripts ?? {});

    expect(scripts.filter((s) => s.includes("accept-data-loss"))).toEqual([]);
  });

  it("el script de despliegue no contiene `db push` ni `--accept-data-loss` ejecutables", () => {
    const script = readFileSync(join(raiz, "scripts", "migrate-deploy.mjs"), "utf8");

    // Se excluyen los comentarios: el fichero EXPLICA por que no se usa.
    const codigo = script
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/*"))
      .join("\n");

    expect(/db["'\s,\]]*push/.test(codigo), "db push ejecutable en el script de deploy").toBe(false);
    expect(codigo.includes("accept-data-loss")).toBe(false);
    expect(/migrate["'\s,\]]*reset/.test(codigo), "migrate reset en el script de deploy").toBe(false);
  });

  it("`npm run build` no toca la base de datos", () => {
    const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
    const build: string = pkg.scripts.build;

    // `prisma generate` solo escribe el cliente en node_modules: no toca la DB.
    expect(build).not.toMatch(/migrate\s+deploy/);
    expect(build).not.toMatch(/db\s+push/);
    expect(build).not.toMatch(/migrate-deploy/);
    expect(build).not.toMatch(/migrate\s+dev/);
  });
});
