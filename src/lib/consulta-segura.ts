import { cookies } from "next/headers";

/**
 * Resultado EXPLÍCITO de una consulta de pantalla.
 *
 * EL DEFECTO QUE ESTO CIERRA
 * ---------------------------
 * `/dashboard` y `/today` envolvían cada consulta en un ayudante así:
 *
 *     async function safe<T>(fn: () => Promise<T>, fallback: T) {
 *       try { return await fn(); } catch { return fallback; }
 *     }
 *
 * con `0`, `[]` o `null` como respaldo. El resultado es que un fallo real de
 * PostgreSQL —conexiones agotadas, una migración a medias, un timeout— se
 * convertía en una pantalla tranquilizadora y FALSA:
 *
 *   - «Expedientes activos: 0» cuando había cuarenta;
 *   - «Aprobaciones pend.: 0» con seis esperando firma;
 *   - «Todos los expedientes en orden» en el Radar ISD;
 *   - «Nada pendiente de acción inmediata» en el Plan de acciones;
 *   - «Todo al día» en el resumen del día, que es literalmente lo contrario
 *     de lo que estaba pasando.
 *
 * Un cero es un dato. «No he podido consultarlo» es otra cosa. Mientras ambos
 * se representen igual, el usuario no tiene forma de distinguirlos y la
 * pantalla miente sin que nadie se entere.
 *
 * Por eso el resultado lleva SIEMPRE la distinción dentro, y quien pinta está
 * obligado a mirarla. No hay respaldo: no existe ningún valor de `T` que
 * signifique «error».
 *
 * DEGRADACIÓN PARCIAL, NO PANTALLA EN BLANCO
 * ------------------------------------------
 * Tampoco se deja caer la pantalla entera porque falle un bloque secundario.
 * Cada consulta se pide por separado y cada bloque decide qué enseñar: el que
 * cargó bien se ve con sus datos, y el que falló dice que ha fallado. El
 * usuario conserva lo que sí se pudo obtener y sabe exactamente qué le falta.
 */
export type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string };

/**
 * Nombre de cada consulta de las dos pantallas.
 *
 * Es un tipo cerrado a propósito: sirve de índice para las pruebas de
 * navegador (que fuerzan el fallo de una consulta concreta) y evita que un
 * bloque nuevo se cuele sin quedar inventariado.
 */
export type NombreConsulta = string;

/**
 * Ejecuta la consulta y devuelve el resultado etiquetado.
 *
 * El error se registra con su nombre para que en los registros del servidor se
 * vea QUÉ bloque falló, no un «query failed» anónimo.
 */
export async function consultar<T>(
  nombre: NombreConsulta,
  fn: () => Promise<T>,
): Promise<Resultado<T>> {
  if (await falloForzado(nombre)) {
    console.error(`[panel] fallo inyectado en pruebas: ${nombre}`);
    return { ok: false, error: `Fallo simulado de la consulta «${nombre}».` };
  }
  try {
    return { ok: true, datos: await fn() };
  } catch (err) {
    console.error(`[panel] la consulta «${nombre}» ha fallado:`, err);
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? err.message
          : "La consulta no ha podido completarse.",
    };
  }
}

/** Datos si la consulta fue bien; `null` si falló. Nunca un respaldo inventado. */
export function datosDe<T>(r: Resultado<T>): T | null {
  return r.ok ? r.datos : null;
}

/** Lista si la consulta fue bien; lista vacía SÓLO para poder iterar sin romper. */
export function listaDe<T>(r: Resultado<T[]>): T[] {
  return r.ok ? r.datos : [];
}

/** ¿Ha fallado alguna de estas consultas? */
export function algunoFalla(...resultados: Resultado<unknown>[]): boolean {
  return resultados.some((r) => !r.ok);
}

/**
 * Nombres de las consultas que han fallado, para poder enumerarlas al usuario.
 */
export function fallos(
  entradas: Record<string, Resultado<unknown>>,
): string[] {
  return Object.entries(entradas)
    .filter(([, r]) => !r.ok)
    .map(([nombre]) => nombre);
}

// ─── Inyección de fallos para las pruebas de navegador ─────────────────────

const COOKIE_FALLOS = "e2e-fallos";

/**
 * Interruptor de pruebas para provocar el fallo de una consulta CONCRETA desde
 * el navegador.
 *
 * POR QUÉ EXISTE
 * --------------
 * El camino de error de estas dos pantallas se calcula en el servidor, dentro
 * de componentes de servidor. No hay ninguna petición del navegador que
 * interceptar con `page.route()`, así que sin esto la única forma de probar
 * «qué ve el usuario cuando PostgreSQL falla» sería tirar la base de datos
 * entera —lo que rompe la sesión y la navegación y no prueba la degradación
 * PARCIAL, que es justo lo que hay que demostrar—.
 *
 * POR QUÉ NO ES UN AGUJERO
 * ------------------------
 * Sólo se lee si el proceso arrancó con `E2E_INYECCION_FALLOS=1`, que ponen
 * únicamente `scripts/e2e.sh` y el trabajo de E2E de la CI. En Vercel esa
 * variable no existe, así que la cookie es inerte: la función sale en la
 * primera línea sin mirarla siquiera.
 *
 * Además sólo puede provocar un fallo. No puede leer datos, ni saltarse
 * permisos, ni cambiar de organización.
 */
async function falloForzado(nombre: NombreConsulta): Promise<boolean> {
  if (process.env.E2E_INYECCION_FALLOS !== "1") return false;
  try {
    const valor = (await cookies()).get(COOKIE_FALLOS)?.value;
    if (!valor) return false;
    return decodeURIComponent(valor)
      .split(",")
      .map((s) => s.trim())
      .includes(nombre);
  } catch {
    // `cookies()` lanza fuera del contexto de una petición (por ejemplo al
    // prerenderizar). Ahí no hay pruebas que valgan: no se fuerza nada.
    return false;
  }
}
