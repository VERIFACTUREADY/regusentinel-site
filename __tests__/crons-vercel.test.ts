/**
 * Los crons declarados en `vercel.json` deben caber en el plan Hobby.
 *
 * POR QUE ESTA PRUEBA EXISTE
 * --------------------------
 * El plan Hobby solo admite crons de frecuencia DIARIA. Cuando `vercel.json`
 * declaraba uno cada 10 minutos, Vercel rechazaba el despliegue **entero antes
 * de compilar**: llegaba «Deployment failed.» uno o dos segundos despues del
 * push, mientras el build de este proyecto tarda entre 70 y 90. El sintoma no
 * se parecia en nada a la causa, y costo encontrarlo.
 *
 * El proceso afectado —la recuperacion de cobros de Stripe— no era
 * prescindible, asi que conserva su frecuencia y cambio de disparador: vive en
 * `.github/workflows/crons.yml`, cada 10 minutos, y `vercel.json` conserva una
 * ejecucion diaria de respaldo por si GitHub desactiva los workflows
 * programados tras 60 dias de inactividad.
 *
 * Esta prueba impide que esa correccion se deshaga sin querer al anadir un
 * cron nuevo. Falla en la CI, en segundos, en vez de fallar en el despliegue.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const RAIZ = path.join(__dirname, "..");
const vercel = JSON.parse(readFileSync(path.join(RAIZ, "vercel.json"), "utf8")) as {
  crons?: { path: string; schedule: string }[];
};

const crons = vercel.crons ?? [];

/**
 * ¿Este `schedule` puede dispararse mas de una vez al dia?
 *
 * Solo importan los dos primeros campos. Minuto y hora tienen que ser un valor
 * FIJO: en cuanto uno de los dos admite varios valores —`*`, un paso `/`, una
 * lista `,` o un rango `-`— el cron se dispara varias veces en el mismo dia.
 * Los campos de dia y mes solo pueden reducir la frecuencia, nunca aumentarla,
 * asi que no se miran.
 */
function esMasDeUnaVezAlDia(schedule: string): boolean {
  const [minuto, hora] = schedule.trim().split(/\s+/);
  const variosValores = (campo: string) => /[*/,-]/.test(campo);
  return variosValores(minuto) || variosValores(hora);
}

describe("Crons de vercel.json", () => {
  it("hay crons declarados", () => {
    expect(crons.length).toBeGreaterThan(0);
  });

  it("ninguno se dispara mas de una vez al dia (limite del plan Hobby)", () => {
    const incompatibles = crons
      .filter((c) => esMasDeUnaVezAlDia(c.schedule))
      .map((c) => `${c.path} (${c.schedule})`);

    expect(
      incompatibles,
      "Hobby rechaza el despliegue ENTERO antes de compilar si un cron es " +
        "mas frecuente que diario. Si el proceso necesita mas frecuencia, va a " +
        ".github/workflows/crons.yml, no aqui.",
    ).toEqual([]);
  });

  it("cada cron apunta a un manejador de ruta que existe", () => {
    /*
     * Un cron hacia una ruta borrada se dispara igual y responde 404 sin que
     * nadie mire. El proceso deja de ejecutarse y no falla nada a la vista.
     */
    const inexistentes = crons
      .filter((c) => !existsSync(path.join(RAIZ, "src/app", c.path, "route.ts")))
      .map((c) => c.path);

    expect(inexistentes, "crons que apuntan a rutas que no existen").toEqual([]);
  });

  it("la recuperacion de cobros conserva su respaldo diario en Vercel", () => {
    /*
     * El disparo frecuente vive en GitHub Actions, que en repositorios publicos
     * se DESACTIVA tras 60 dias sin actividad. Este respaldo es lo que impide
     * que los reintentos de cobro se paren del todo y en silencio.
     */
    const respaldo = crons.find((c) => c.path === "/api/cron/stripe-recovery");
    expect(respaldo, "falta el respaldo diario de stripe-recovery").toBeDefined();
    expect(esMasDeUnaVezAlDia(respaldo!.schedule)).toBe(false);
  });
});
