/**
 * LA PUERTA DE VULNERABILIDADES NO PUEDE ABRIRSE SOLA.
 *
 * EL DEFECTO QUE VIGILAN ESTAS PRUEBAS
 * ------------------------------------
 * `npm audit` sale con código != 0 en dos situaciones que no se parecen en
 * nada: cuando ENCUENTRA vulnerabilidades y cuando NO HA PODIDO MIRAR (registro
 * caído, 401, sin red). `scripts/audit-gate.mjs` las trataba igual: parseaba
 * `err.stdout` y seguía con lo que saliera.
 *
 * Un fallo operativo también devuelve JSON válido, sólo que con la forma
 * `{ "error": { "code": "E401", … } }`. Sin `vulnerabilities`, el recuento
 * daba cero, la puerta anunciaba «0 vulnerabilidades criticas, 0 altas» y salía
 * con 0. Es decir: **una caída del registro de npm ponía la puerta en verde**.
 *
 * Eso es peor que no tener puerta, porque da por comprobado algo que nadie ha
 * comprobado. Estas pruebas fijan las dos mitades: lo que debe seguir pasando y
 * lo que debe fallar.
 *
 * POR QUÉ UN `npm` DE MENTIRA Y NO UN MOCK
 * ----------------------------------------
 * Lo que se está probando es precisamente la interpretación de un SUBPROCESO:
 * su código de salida, su stdout y su forma. Un mock del módulo saltaría justo
 * la parte que falló. Se ejecuta el script de verdad con un `npm` de prueba
 * primero en el PATH; no se toca la red ni el registro real.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const RAIZ = path.join(__dirname, "..");
const PUERTA = path.join(RAIZ, "scripts", "audit-gate.mjs");

let directorio: string;

beforeAll(() => {
  directorio = mkdtempSync(path.join(tmpdir(), "puerta-auditoria-"));
});

afterAll(() => {
  rmSync(directorio, { recursive: true, force: true });
});

/** Informe con la forma que produce `npm audit --json` de verdad. */
function informe(vulnerabilities: unknown) {
  return JSON.stringify({ vulnerabilities, metadata: { vulnerabilities: {} } });
}

const CRITICA = {
  paquete_de_prueba: {
    severity: "critical",
    via: [
      {
        url: "https://github.com/advisories/GHSA-prue-bade-test",
        title: "Critica de prueba",
        severity: "critical",
      },
    ],
  },
};

/**
 * Ejecuta la puerta con un `npm` de prueba que se comporta como diga `guion`.
 *
 * `$*` permite distinguir la primera auditoría (`--omit=dev`) de la segunda.
 */
function ejecutarPuertaCon(guion: string): { salida: number; texto: string } {
  const falso = path.join(directorio, "npm");
  writeFileSync(falso, `#!/usr/bin/env bash\n${guion}\n`);
  chmodSync(falso, 0o755);

  try {
    const texto = execFileSync("node", [PUERTA], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: `${directorio}:${process.env.PATH}` },
    });
    return { salida: 0, texto };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { salida: e.status ?? -1, texto: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("Puerta de vulnerabilidades: lo que debe seguir pasando", () => {
  it("un informe limpio y valido pasa", () => {
    const r = ejecutarPuertaCon(`echo '${informe({})}'; exit 0`);
    expect(r.salida, r.texto).toBe(0);
    expect(r.texto).toContain("0 vulnerabilidades criticas");
  });

  it("un informe VALIDO con hallazgos se interpreta aunque npm salga con codigo != 0", () => {
    /*
     * Este es el camino normal de `npm audit`: encontrar algo y salir con 1.
     * Si la correccion del fail-open hubiera roto esto, la puerta habria
     * dejado de detectar vulnerabilidades reales.
     */
    const r = ejecutarPuertaCon(`echo '${informe(CRITICA)}'; exit 1`);
    expect(r.salida).toBe(1);
    expect(r.texto).toContain("CRITICAS en dependencias de produccion");
    expect(r.texto).toContain("GHSA-prue-bade-test");
  });
});

describe("Puerta de vulnerabilidades: lo que NO puede pasar en verde", () => {
  it("un error operativo de npm en JSON valido NO se cuenta como cero vulnerabilidades", () => {
    // El defecto original: esto salia con 0 diciendo «0 vulnerabilidades».
    const r = ejecutarPuertaCon(
      `echo '{"error":{"code":"E401","summary":"Unable to authenticate"}}'; exit 1`,
    );
    expect(r.salida, "una caida del registro no puede dar la puerta por pasada").toBe(1);
    expect(r.texto).toContain("no ha podido ejecutarse");
    expect(r.texto).toContain("E401");
    expect(r.texto).not.toContain("0 vulnerabilidades criticas");
  });

  it("no filtra el detalle crudo del error del registro", () => {
    /*
     * El resumen de npm puede arrastrar cabeceras o URLs con credenciales.
     * Solo debe salir el codigo.
     */
    const r = ejecutarPuertaCon(
      `echo '{"error":{"code":"E401","summary":"Basic realm=npm token=SECRETO-QUE-NO-DEBE-SALIR"}}'; exit 1`,
    );
    expect(r.salida).toBe(1);
    expect(r.texto).not.toContain("SECRETO-QUE-NO-DEBE-SALIR");
  });

  it("una salida que no es JSON falla con un diagnostico, no con una traza", () => {
    const r = ejecutarPuertaCon(`echo 'esto no es json'; exit 1`);
    expect(r.salida).toBe(1);
    expect(r.texto).toContain("no es JSON valido");
  });

  it("un informe sin la estructura esperada no se interpreta como limpio", () => {
    // JSON valido, pero sin `metadata`: no es un informe.
    const r = ejecutarPuertaCon(`echo '{"vulnerabilities":{}}'; exit 0`);
    expect(r.salida).toBe(1);
    expect(r.texto).toContain("no tiene la forma esperada");
  });

  it("npm que no produce nada falla cerrado", () => {
    const r = ejecutarPuertaCon(`exit 127`);
    expect(r.salida).toBe(1);
    expect(r.texto).toContain("no ha devuelto ningun informe");
  });

  it("un fallo en la SEGUNDA auditoria (arbol completo) tampoco pasa en silencio", () => {
    /*
     * La segunda pasada es la que vigila las criticas de herramientas de
     * desarrollo. Si falla y nadie se entera, esa vigilancia desaparece sin
     * que ningun rojo lo anuncie.
     */
    const r = ejecutarPuertaCon(
      `if [ "$*" = "audit --json --omit=dev" ]; then echo '${informe({})}'; exit 0; ` +
        `else echo '{"error":{"code":"ENETUNREACH"}}'; exit 1; fi`,
    );
    expect(r.salida).toBe(1);
    expect(r.texto).toContain("arbol completo");
    expect(r.texto).toContain("ENETUNREACH");
  });
});
