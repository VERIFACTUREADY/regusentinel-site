import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * `consulta-segura` importa `next/headers`, que fuera de una petición lanza.
 * Se sustituye por un doble controlado para poder probar las dos cosas que
 * importan: que un fallo NO se convierte en un valor, y que la inyección de
 * fallos está apagada salvo que el entorno la encienda explícitamente.
 */
const cookieDoble = { valor: undefined as string | undefined };

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (nombre: string) =>
      nombre === "e2e-fallos" && cookieDoble.valor !== undefined
        ? { name: nombre, value: cookieDoble.valor }
        : undefined,
  }),
}));

import { consultar, datosDe, listaDe, algunoFalla, fallos } from "@/lib/consulta-segura";

const entornoOriginal = process.env.E2E_INYECCION_FALLOS;

beforeEach(() => {
  cookieDoble.valor = undefined;
  delete process.env.E2E_INYECCION_FALLOS;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  if (entornoOriginal === undefined) delete process.env.E2E_INYECCION_FALLOS;
  else process.env.E2E_INYECCION_FALLOS = entornoOriginal;
});

describe("consultar: el fallo nunca se disfraza de dato", () => {
  it("devuelve los datos cuando la consulta va bien", async () => {
    const r = await consultar("prueba", async () => 42);
    expect(r).toEqual({ ok: true, datos: 42 });
    expect(datosDe(r)).toBe(42);
  });

  it("un cero REAL se distingue de un fallo", async () => {
    const cero = await consultar("cero", async () => 0);
    const roto = await consultar("roto", async () => {
      throw new Error("connection terminated");
    });

    // Éste es el corazón del defecto que se corrige: antes los dos casos
    // llegaban a la pantalla como el número 0.
    expect(datosDe(cero)).toBe(0);
    expect(datosDe(roto)).toBeNull();
    expect(cero.ok).toBe(true);
    expect(roto.ok).toBe(false);
  });

  it("una lista vacía REAL se distingue de un fallo", async () => {
    const vacia = await consultar("vacia", async () => [] as number[]);
    const rota = await consultar("rota", async () => {
      throw new Error("timeout");
    });

    expect(vacia.ok).toBe(true);
    expect(rota.ok).toBe(false);
    // `listaDe` devuelve [] en ambos casos —para poder recorrerla— pero quien
    // pinta debe mirar `.ok`, que es lo único que distingue los dos casos.
    expect(listaDe(vacia)).toEqual([]);
    expect(listaDe(rota)).toEqual([]);
  });

  it("conserva el mensaje del error", async () => {
    const r = await consultar("x", async () => {
      throw new Error("relation \"Task\" does not exist");
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("relation");
  });

  it("no se traga un fallo que no sea un Error", async () => {
    const r = await consultar("x", async () => {
      throw "algo raro";
    });
    expect(r.ok).toBe(false);
  });

  it("registra el nombre de la consulta que ha fallado", async () => {
    await consultar("aprobacionesPendientes", async () => {
      throw new Error("boom");
    });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("aprobacionesPendientes"),
      expect.anything(),
    );
  });
});

describe("ayudantes de agregación", () => {
  it("algunoFalla detecta un único fallo entre varios aciertos", async () => {
    const a = await consultar("a", async () => 1);
    const b = await consultar("b", async () => 2);
    const c = await consultar("c", async () => {
      throw new Error("no");
    });
    expect(algunoFalla(a, b)).toBe(false);
    expect(algunoFalla(a, b, c)).toBe(true);
  });

  it("fallos enumera sólo los caídos, por su nombre", async () => {
    const bien = await consultar("bien", async () => 1);
    const mal = await consultar("mal", async () => {
      throw new Error("no");
    });
    expect(fallos({ "las aprobaciones": mal, "los expedientes": bien })).toEqual([
      "las aprobaciones",
    ]);
  });
});

describe("inyección de fallos: apagada salvo que el entorno la encienda", () => {
  it("con la cookie puesta pero SIN la variable de entorno, no pasa nada", async () => {
    cookieDoble.valor = "expedientesActivos";
    const r = await consultar("expedientesActivos", async () => 7);
    // Es el caso de producción: en Vercel la variable no existe, así que
    // cualquiera puede ponerse esa cookie y no consigue absolutamente nada.
    expect(r).toEqual({ ok: true, datos: 7 });
  });

  it("con la variable a 1 y la cookie puesta, esa consulta falla", async () => {
    process.env.E2E_INYECCION_FALLOS = "1";
    cookieDoble.valor = "expedientesActivos";
    const r = await consultar("expedientesActivos", async () => 7);
    expect(r.ok).toBe(false);
  });

  it("sólo falla la consulta nombrada; las demás siguen respondiendo", async () => {
    process.env.E2E_INYECCION_FALLOS = "1";
    cookieDoble.valor = "expedientesActivos";
    const otra = await consultar("tareasPendientes", async () => 3);
    // Esto es lo que permite comprobar la degradación PARCIAL.
    expect(otra).toEqual({ ok: true, datos: 3 });
  });

  it("acepta varias consultas separadas por comas", async () => {
    process.env.E2E_INYECCION_FALLOS = "1";
    cookieDoble.valor = "expedientesActivos, tareasPendientes";
    expect((await consultar("expedientesActivos", async () => 1)).ok).toBe(false);
    expect((await consultar("tareasPendientes", async () => 1)).ok).toBe(false);
    expect((await consultar("tareasListas", async () => 1)).ok).toBe(true);
  });

  it("no confunde un nombre con otro que lo contenga", async () => {
    process.env.E2E_INYECCION_FALLOS = "1";
    cookieDoble.valor = "tareas";
    // "tareasPendientes" NO debe caer por llevar "tareas" dentro.
    expect((await consultar("tareasPendientes", async () => 1)).ok).toBe(true);
  });

  it("con la variable a cualquier otro valor tampoco se activa", async () => {
    process.env.E2E_INYECCION_FALLOS = "true";
    cookieDoble.valor = "expedientesActivos";
    expect((await consultar("expedientesActivos", async () => 1)).ok).toBe(true);
  });
});
