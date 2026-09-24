import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolverConfiguracionAlmacenamiento } from "@/lib/s3";

/**
 * Configuracion de almacenamiento: S3_* explicito primero, Tigris como
 * respaldo solo cuando S3_* esta completamente ausente.
 *
 * EL DEFECTO REAL QUE ESTO CUBRE
 * -------------------------------
 * En Preview, las cinco S3_* estaban puestas en "Todos los entornos" con
 * valores de prueba (`S3_ENDPOINT=https://placeholder.r2.cloudflarestorage.com`,
 * `S3_ACCESS_KEY=placeholder`), mientras Tigris -ya conectado, con variables
 * gestionadas reales- se ignoraba por completo. La subida fallaba en el
 * TLS contra un host que no existe. Estas pruebas fijan el comportamiento
 * correcto: una S3_* presente pero invalida NUNCA se completa con Tigris,
 * se rechaza con un error claro.
 */

const VARIABLES_RELEVANTES = [
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET",
  "S3_REGION",
  "TIGRIS_STORAGE_ACCESS_KEY_ID",
  "TIGRIS_STORAGE_SECRET_ACCESS_KEY",
  "TIGRIS_STORAGE_BUCKET",
];

const ORIGINAL = { ...process.env };

beforeEach(() => {
  for (const v of VARIABLES_RELEVANTES) delete process.env[v];
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("resolverConfiguracionAlmacenamiento", () => {
  it("una configuracion S3_* completa y valida gana, aunque Tigris tambien este disponible", () => {
    process.env.S3_ENDPOINT = "https://s3.eu-west-1.amazonaws.com";
    process.env.S3_ACCESS_KEY = "AKIAEXAMPLE";
    process.env.S3_SECRET_KEY = "secreto-de-produccion";
    process.env.S3_BUCKET = "heredia-produccion";
    process.env.S3_REGION = "eu-west-1";
    // Tigris tambien disponible: no debe importar, S3_* gana siempre que sea valida.
    process.env.TIGRIS_STORAGE_ACCESS_KEY_ID = "tid_ejemplo";
    process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY = "tsecreto_ejemplo";
    process.env.TIGRIS_STORAGE_BUCKET = "tigris-bucket";

    const r = resolverConfiguracionAlmacenamiento();

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("no deberia fallar");
    expect(r.config).toEqual({
      endpoint: "https://s3.eu-west-1.amazonaws.com",
      accessKeyId: "AKIAEXAMPLE",
      secretAccessKey: "secreto-de-produccion",
      bucket: "heredia-produccion",
      region: "eu-west-1",
    });
  });

  it("MinIO (local/CI) sigue funcionando igual: S3_* completo y valido, aunque sea localhost", () => {
    process.env.S3_ENDPOINT = "http://127.0.0.1:9000";
    process.env.S3_ACCESS_KEY = "minioadmin";
    process.env.S3_SECRET_KEY = "minioadmin123";
    process.env.S3_BUCKET = "heredia-ci";
    process.env.S3_REGION = "us-east-1";

    const r = resolverConfiguracionAlmacenamiento();

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("no deberia fallar");
    expect(r.config.endpoint).toBe("http://127.0.0.1:9000");
    expect(r.config.bucket).toBe("heredia-ci");
  });

  it("sin S3_REGION, MinIO/S3_* sigue usando us-east-1 por defecto (compatibilidad exacta)", () => {
    process.env.S3_ENDPOINT = "http://127.0.0.1:9000";
    process.env.S3_ACCESS_KEY = "minioadmin";
    process.env.S3_SECRET_KEY = "minioadmin123";
    process.env.S3_BUCKET = "heredia-ci";
    // S3_REGION deliberadamente sin definir.

    const r = resolverConfiguracionAlmacenamiento();

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("no deberia fallar");
    expect(r.config.region).toBe("us-east-1");
  });

  it("Tigris se usa cuando las cinco S3_* estan completamente ausentes", () => {
    process.env.TIGRIS_STORAGE_ACCESS_KEY_ID = "tid_real";
    process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY = "tsecreto_real";
    process.env.TIGRIS_STORAGE_BUCKET = "heredia-preview";

    const r = resolverConfiguracionAlmacenamiento();

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("no deberia fallar");
    expect(r.config).toEqual({
      endpoint: "https://fly.storage.tigris.dev",
      accessKeyId: "tid_real",
      secretAccessKey: "tsecreto_real",
      bucket: "heredia-preview",
      region: "auto",
    });
  });

  it("una S3_* parcial falla cerrada: NO se completa con Tigris aunque este disponible y completo", () => {
    // Falta S3_SECRET_KEY y S3_BUCKET, pero hay AL MENOS una S3_* definida.
    process.env.S3_ENDPOINT = "https://s3.eu-west-1.amazonaws.com";
    process.env.S3_ACCESS_KEY = "AKIAEXAMPLE";
    process.env.TIGRIS_STORAGE_ACCESS_KEY_ID = "tid_real";
    process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY = "tsecreto_real";
    process.env.TIGRIS_STORAGE_BUCKET = "heredia-preview";

    const r = resolverConfiguracionAlmacenamiento();

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("deberia haber fallado");
    expect(r.error).toContain("S3_SECRET_KEY");
    expect(r.error).toContain("S3_BUCKET");
    // Ni rastro de que haya usado o mencionado Tigris: no se mezclan fuentes.
    expect(r.error).not.toContain("tid_real");
    expect(r.error).not.toContain("tsecreto_real");
    expect(r.error).not.toContain("heredia-preview");
  });

  it("una S3_* completa pero con un valor de prueba falla cerrada, y tampoco recurre a Tigris", () => {
    // Exactamente el defecto real reproducido: placeholder en endpoint y access key.
    process.env.S3_ENDPOINT = "https://placeholder.r2.cloudflarestorage.com";
    process.env.S3_ACCESS_KEY = "placeholder";
    process.env.S3_SECRET_KEY = "secreto-cualquiera";
    process.env.S3_BUCKET = "baritur-docs";
    process.env.TIGRIS_STORAGE_ACCESS_KEY_ID = "tid_real";
    process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY = "tsecreto_real";
    process.env.TIGRIS_STORAGE_BUCKET = "heredia-preview";

    const r = resolverConfiguracionAlmacenamiento();

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("deberia haber fallado");
    expect(r.error).toContain("S3_ENDPOINT");
    expect(r.error).toContain("S3_ACCESS_KEY");
    expect(r.error).toContain("placeholder");
    // No debe colarse ni el secreto legacy ni ninguna credencial de Tigris.
    expect(r.error).not.toContain("secreto-cualquiera");
    expect(r.error).not.toContain("tid_real");
    expect(r.error).not.toContain("tsecreto_real");
  });

  it("una Tigris incompleta falla cerrada cuando S3_* esta completamente ausente", () => {
    process.env.TIGRIS_STORAGE_ACCESS_KEY_ID = "tid_real";
    // Faltan TIGRIS_STORAGE_SECRET_ACCESS_KEY y TIGRIS_STORAGE_BUCKET.

    const r = resolverConfiguracionAlmacenamiento();

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("deberia haber fallado");
    expect(r.error).toContain("TIGRIS_STORAGE_SECRET_ACCESS_KEY");
    expect(r.error).toContain("TIGRIS_STORAGE_BUCKET");
  });

  it("sin ninguna variable definida falla cerrada con un mensaje que nombra ambos conjuntos", () => {
    const r = resolverConfiguracionAlmacenamiento();

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("deberia haber fallado");
    expect(r.error).toContain("S3_*");
    expect(r.error).toMatch(/TIGRIS_STORAGE/);
  });

  it("ningun mensaje de error contiene valores de las variables, solo sus nombres", () => {
    // Un secreto real de aspecto verosimil, distinguible de cualquier nombre
    // de variable, para comprobar que nunca aparece en el texto del error.
    const secretoDistintivo = "shhh-no-imprimir-esto-jamas-9f31";
    process.env.S3_ENDPOINT = "https://placeholder.example.com";
    process.env.S3_ACCESS_KEY = "cualquiera";
    process.env.S3_SECRET_KEY = secretoDistintivo;
    process.env.S3_BUCKET = "cualquier-bucket";

    const r = resolverConfiguracionAlmacenamiento();

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("deberia haber fallado (endpoint de prueba)");
    expect(r.error).not.toContain(secretoDistintivo);
    expect(r.error).not.toContain("cualquier-bucket");
  });
});
