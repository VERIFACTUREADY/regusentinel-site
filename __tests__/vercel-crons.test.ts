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

  it("conserva el respaldo diario de la recuperación de Stripe", () => {
    // GitHub desactiva los workflows programados de los repositorios públicos
    // tras 60 días sin actividad, y avisa sólo por correo al propietario. Si
    // eso ocurre y este respaldo no está, los cobros fallidos dejan de
    // reintentarse sin que nada falle a la vista.
    const respaldo = crons.find((c) => c.path === "/api/cron/stripe-recovery");

    expect(
      respaldo,
      "Falta el respaldo diario de /api/cron/stripe-recovery en vercel.json. " +
        "Es la única ejecución que sobrevive si GitHub desactiva el workflow " +
        "programado por inactividad.",
    ).toBeDefined();
  });
});

describe("workflow de crons frecuentes", () => {
  const workflow = readFileSync(
    join(process.cwd(), ".github/workflows/crons.yml"),
    "utf8",
  );

  it("mantiene la frecuencia de la recuperación de Stripe", () => {
    // Salió de vercel.json por el límite del plan, no porque sobrara: es lo que
    // reintenta los cobros fallidos antes de que la suscripción se cancele
    // sola. Si alguien lo borra del workflow, se pierde en silencio.
    expect(workflow).toContain("/api/cron/stripe-recovery");
    // Cada 10 minutos, evitando el minuto en punto, donde se acumulan los
    // disparos de todo el mundo y GitHub más retrasa o descarta.
    expect(workflow).toMatch(/cron:\s*"3-59\/10 \* \* \* \*"/);
  });

  it("no ofrece ningún otro endpoint de cron", () => {
    // El disparo manual sólo debe servir para este proceso. Un selector con
    // los once endpoints convierte el botón en un mando a distancia para
    // ejecutar cualquier tarea programada cuando a alguien le apetezca:
    // purgas de retención, envíos masivos o el reinicio de la demostración.
    const rutas = workflow.match(/\/api\/cron\/[a-z-]+/g) ?? [];
    const otras = rutas
      .filter((r) => r !== "/api/cron/stripe-recovery")
      .filter((r, i, todas) => todas.indexOf(r) === i);

    expect(
      otras,
      "El workflow sólo debe referirse a /api/cron/stripe-recovery.",
    ).toEqual([]);
  });

  it("no vuelca el cuerpo de la respuesta en los registros", () => {
    // Los registros de Actions de un repositorio público los lee cualquiera, y
    // el cuerpo de un endpoint de cobros puede traer importes, identificadores
    // de cliente o mensajes de error de Stripe. La ruta y el código HTTP
    // bastan para saber si ha ido bien.
    expect(workflow).toContain("-o /dev/null");

    const volcados = [
      /head\s+-c/,
      /\bcat\s+\/tmp/,
      /\btail\s+.*\/tmp/,
      // Guardar la respuesta en un fichero es el paso previo a imprimirla.
      /-o\s+\/tmp/,
    ].filter((patron) => patron.test(workflow));

    expect(
      volcados.map(String),
      "El workflow no debe guardar ni imprimir el cuerpo de la respuesta.",
    ).toEqual([]);
  });

  it("no pide permisos sobre el repositorio", () => {
    // Solo hace una petición HTTP saliente: no necesita el GITHUB_TOKEN.
    expect(workflow).toMatch(/^permissions:\s*\{\}\s*$/m);
  });

  it("tiene un límite de tiempo por debajo del intervalo de disparo", () => {
    // Sin límite, un job colgado se solapa con el siguiente disparo y dos
    // procesos trabajan a la vez sobre los mismos cobros.
    const limite = workflow.match(/timeout-minutes:\s*(\d+)/);
    expect(limite, "Falta timeout-minutes en el job.").not.toBeNull();
    expect(Number(limite![1])).toBeLessThanOrEqual(10);
  });
});
