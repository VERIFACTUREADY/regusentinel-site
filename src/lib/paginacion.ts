/**
 * Lectura de los parámetros de paginación de una query string.
 *
 * EL DEFECTO QUE CORRIGE
 * ----------------------
 * Los listados hacían `parseInt(url.searchParams.get("page") || "1")` y se lo
 * pasaban a Prisma tal cual. Eso rompe de tres maneras distintas:
 *
 *   - `?page=abc` → `parseInt` devuelve NaN, `Math.max(1, NaN)` sigue siendo
 *     NaN, y `skip: NaN` hace que Prisma lance. Respuesta: 500.
 *   - `?page=0` o `?page=-3` → `skip` negativo, que Prisma tampoco acepta.
 *   - `?limit=-5` → `Math.min(-5, 100)` es -5, y `take` negativo en Prisma
 *     NO es un error: significa «los últimos N en orden inverso». La página
 *     devolvía datos reales, ordenados al revés y sin que nada lo indicase.
 *
 * Un parámetro de URL es entrada del cliente: puede venir de un enlace
 * copiado a mano, de un marcador viejo o de un rastreador. Ninguno de esos
 * casos debería producir un 500 ni una página silenciosamente equivocada.
 */
export function leerPaginacion(
  params: URLSearchParams,
  opciones: { limitePorDefecto: number; limiteMaximo: number },
): { pagina: number; limite: number } {
  return {
    pagina: enteroPositivo(params.get("page"), 1, Number.MAX_SAFE_INTEGER, 1),
    limite: enteroPositivo(
      params.get("limit"),
      1,
      opciones.limiteMaximo,
      opciones.limitePorDefecto,
    ),
  };
}

/**
 * Convierte a entero dentro de [minimo, maximo]. Devuelve `porDefecto` si el
 * valor falta o no es un número finito; recorta si se sale del rango.
 */
export function enteroPositivo(
  bruto: string | null,
  minimo: number,
  maximo: number,
  porDefecto: number,
): number {
  if (bruto === null || bruto.trim() === "") return porDefecto;
  const n = Number(bruto);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(maximo, Math.max(minimo, Math.trunc(n)));
}
