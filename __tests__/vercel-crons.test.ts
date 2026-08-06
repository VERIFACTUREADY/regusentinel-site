import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Los crons de `vercel.json` deben caber en el plan Hobby.
 *
 * POR QUE ESTA PRUEBA
 * -------------------
 * El plan Hobby de Vercel sólo admite crons de frecuencia diaria. Con uno cada
 * 10 minutos declarado en `vercel.json`, Vercel RECHAZABA EL DESPLIEGUE ENTERO
 * antes de compilar: el estado «Deployment failed.» llegaba 0-2 segundos
 * después del push, cuando el build de este proyecto tarda entre 70 y 90.
 *
 * Es un fallo especialmente difícil de diagnosticar porque no deja rastro en la
 * CI: el código compila perfectamente, todas las pruebas pasan, y aun así nada
 * se despliega. Basta con que alguien añada un cron frecuente para volver a
 * tumbar los despliegues sin que ninguna otra comprobación se entere.
 *
 * Los procesos que necesitan más frecuencia se disparan desde GitHub Actions
 * (`.github/workflows/crons.yml`). Ver `docs/CRONS.md`.
 */

type Cron = { path: string; schedule: string };

const vercelJson = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
) as { crons?: Cron[] };

const crons = vercelJson.crons ?? [];

/**
 * Un campo de cron dispara una sola vez si es un número concreto. Cualquier
 * `*`, lista (`,`), rango (`-`) o paso (`/`) significa más de un disparo.
 */
function esValorUnico(campo: string): boolean {
  return /^\d+$/.test(campo);
}

describe("crons de vercel.json en plan Hobby", () => {
  it("hay crons declarados", () => {
    expect(crons.length).toBeGreaterThan(0);
  });

  it("ninguno se ejecuta más de una vez al día", () => {
    const frecuentes = crons.filter((c) => {
      const [minuto, hora] = c.schedule.trim().split(/\s+/);
      return !esValorUnico(minuto) || !esValorUnico(hora);
    });

    expect(
      frecuentes.map((c) => `${c.path} (${c.schedule})`),
      "Hobby sólo admite crons diarios: con uno más frecuente, Vercel rechaza " +
        "el despliegue ANTES de compilar y ninguna otra comprobación lo detecta. " +
        "Muévelo a .github/workflows/crons.yml y documéntalo en docs/CRONS.md.",
    ).toEqual([]);
  });

  it("cada ruta declarada existe como endpoint de cron", () => {
    // Una ruta inexistente también hace fallar el despliegue en Vercel.
    const inexistentes = crons.filter((c) => {
      try {
        readFileSync(join(process.cwd(), "src/app", c.path, "route.ts"));
        return false;
      } catch {
        return true;
      }
    });

    expect(inexistentes.map((c) => c.path)).toEqual([]);
  });

  it("el proceso de recuperación de Stripe conserva su frecuencia en Actions", () => {
    // Salió de vercel.json por el límite del plan, no porque sobrara: es lo que
    // reintenta los cobros fallidos antes de que la suscripción se cancele
    // sola. Si alguien lo borra del workflow, se pierde en silencio.
    const workflow = readFileSync(
      join(process.cwd(), ".github/workflows/crons.yml"),
      "utf8",
    );

    expect(workflow).toContain("/api/cron/stripe-recovery");
    expect(workflow).toContain('cron: "*/10 * * * *"');
  });
});
