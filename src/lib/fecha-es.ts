/**
 * Fechas civiles en la zona horaria del usuario español (Europe/Madrid).
 *
 * EL DEFECTO QUE ESTO CIERRA
 * ---------------------------
 * El panel y el resumen del día calculaban «hoy», «el día del mes» y los
 * cortes de semana con la hora LOCAL DEL SERVIDOR:
 *
 *     const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 *     d.setHours(0, 0, 0, 0);  const dia = d.getDate();
 *
 * El servidor —tanto el de la CI como el de producción— corre en UTC. Madrid
 * va una hora por delante en invierno y dos en verano, así que:
 *
 *   - Una tarea con plazo el 21 de agosto a las 00:30 de Madrid se guarda como
 *     2026-08-20T22:30:00Z. `getDate()` en el servidor devolvía 20: el
 *     calendario del panel la pintaba en la casilla del día ANTERIOR al que el
 *     gestor tiene escrito en su expediente.
 *   - Entre las 00:00 y las 02:00 de Madrid, para el servidor todavía es el día
 *     de ayer. «Para hoy» listaba las tareas de ayer y ocultaba las de hoy,
 *     justo a la hora en la que alguien entra a repasar el día.
 *
 * Aquí no se toca ninguna regla de negocio ni ningún plazo fiscal: sólo se
 * traduce un instante a la fecha del calendario que el usuario tiene delante.
 *
 * Se usa `Intl` con `timeZone: "Europe/Madrid"`, que ya conoce el cambio de
 * hora de cada año. No se resta un número fijo de horas a propósito: eso
 * volvería a fallar los dos domingos del año en que cambia la hora.
 */

export const ZONA_ES = "Europe/Madrid";

/**
 * Minutos que hay que sumar a UTC para obtener la hora civil de Madrid en ese
 * instante concreto (+60 en invierno, +120 en verano).
 */
function desplazamientoMadrid(instante: Date): number {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_ES,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const partes: Record<string, string> = {};
  for (const parte of formato.formatToParts(instante)) {
    if (parte.type !== "literal") partes[parte.type] = parte.value;
  }

  const comoSiFueraUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );

  // Se descartan los milisegundos del instante original porque `Intl` no los
  // devuelve; si no, el desplazamiento saldría con un resto de hasta 999 ms.
  const sinMilisegundos = Math.floor(instante.getTime() / 1000) * 1000;
  return (comoSiFueraUtc - sinMilisegundos) / 60000;
}

/** Día del calendario español de ese instante, como «AAAA-MM-DD». */
export function diaCivilES(instante: Date): string {
  // `en-CA` formatea justamente como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_ES,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

/** Año, mes (1-12) y día del calendario español. */
export function partesCivilesES(instante: Date): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = diaCivilES(instante).split("-").map(Number);
  return { anio, mes, dia };
}

/**
 * Instante exacto en que empieza (00:00:00.000 de Madrid) el día civil
 * indicado. `mes` va de 1 a 12.
 *
 * Se converge en dos pasadas: la primera estima el desplazamiento con la hora
 * UTC del mismo día y la segunda lo recalcula ya sobre el instante corregido,
 * que es lo que hace falta en las semanas del cambio de hora. La medianoche
 * de Madrid nunca es ambigua —el salto es a las 02:00 o a las 03:00—, así que
 * dos pasadas bastan.
 */
export function inicioDelDiaES(anio: number, mes: number, dia: number): Date {
  const medianocheComoUtc = Date.UTC(anio, mes - 1, dia, 0, 0, 0, 0);
  const primera = medianocheComoUtc - desplazamientoMadrid(new Date(medianocheComoUtc)) * 60000;
  const segunda = medianocheComoUtc - desplazamientoMadrid(new Date(primera)) * 60000;
  return new Date(segunda);
}

/** Comienzo del día español al que pertenece ese instante. */
export function inicioDelDiaDeES(instante: Date): Date {
  const { anio, mes, dia } = partesCivilesES(instante);
  return inicioDelDiaES(anio, mes, dia);
}

/**
 * Último milisegundo del día español al que pertenece ese instante.
 * Se calcula como «comienzo del día siguiente menos 1 ms» para que funcione
 * también los días de 23 y de 25 horas.
 */
export function finDelDiaDeES(instante: Date): Date {
  const inicio = inicioDelDiaDeES(instante);
  return new Date(sumarDiasES(inicio, 1).getTime() - 1);
}

/**
 * Suma días de CALENDARIO, no de 24 horas.
 *
 * `fecha.getTime() + n * 86400000` se desvía una hora en cada cambio de
 * horario: sumarle 7 días al 25 de octubre daba las 23:00 del día 31, no las
 * 00:00 del 1 de noviembre.
 */
export function sumarDiasES(instante: Date, dias: number): Date {
  const { anio, mes, dia } = partesCivilesES(instante);
  // `Date.UTC` normaliza los desbordes por sí solo: el día 32 de agosto pasa a
  // ser el 1 de septiembre, y el 32 de diciembre al 1 de enero del año que
  // viene. Se opera en UTC porque aquí sólo interesa la aritmética del
  // calendario; el instante real lo fija después `inicioDelDiaES`.
  const civil = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return inicioDelDiaES(
    civil.getUTCFullYear(),
    civil.getUTCMonth() + 1,
    civil.getUTCDate(),
  );
}

/**
 * Días de calendario completos entre dos instantes, contando por fecha civil
 * española. Positivo si `hasta` es posterior.
 *
 * Contar con `(b - a) / 86400000` daba 6,96 días donde el usuario ve 7 y el
 * redondeo cambiaba de resultado según la hora del día.
 */
export function diasCivilesEntreES(desde: Date, hasta: Date): number {
  const a = partesCivilesES(desde);
  const b = partesCivilesES(hasta);
  const utcA = Date.UTC(a.anio, a.mes - 1, a.dia);
  const utcB = Date.UTC(b.anio, b.mes - 1, b.dia);
  return Math.round((utcB - utcA) / 86400000);
}

/** Día de la semana español: 0 domingo … 6 sábado. */
export function diaSemanaES(instante: Date): number {
  const nombre = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_ES,
    weekday: "short",
  }).format(instante);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nombre);
}

/**
 * Fecha y hora cortas, SIEMPRE en la zona española: `22/08/26 14:35`.
 *
 * EL DEFECTO QUE CORRIGE
 * ----------------------
 * Las tablas escribían `new Date(x).toLocaleString("es-ES", {...})` sin
 * `timeZone`. `Intl` toma entonces la zona de quien ejecuta, y eso son DOS
 * zonas distintas para el mismo texto:
 *
 *   - en el render del servidor, la del proceso de Node (UTC en producción);
 *   - al hidratar, la del navegador de quien mira (Madrid).
 *
 * Las consecuencias eran dos, y ninguna cosmética. La primera es que en
 * horario de verano el servidor pintaba las horas dos menos de las reales, y
 * durante un instante se veían así. La segunda es peor: el texto del servidor
 * y el del cliente no coincidían, React abortaba la hidratación de la pantalla
 * entera (errores #425 y #422) y volvía a dibujarla desde cero en el cliente.
 *
 * Fijando la zona, servidor y cliente escriben lo mismo, y lo que escriben es
 * la hora de Madrid, que es la que le sirve a quien lo lee.
 */
export function fechaHoraCortaES(instante: Date | string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: ZONA_ES,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof instante === "string" ? new Date(instante) : instante);
}

/** Fecha y hora completas en la zona española: `22/08/2026, 14:35:07`. */
export function fechaHoraLargaES(instante: Date | string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: ZONA_ES,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(typeof instante === "string" ? new Date(instante) : instante);
}
