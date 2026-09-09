/**
 * Helpers para añadir eventos al calendario del usuario sin OAuth:
 *
 *  - buildGoogleCalendarUrl: URL https://calendar.google.com/.../render?... que
 *    abre el formulario "Nuevo evento" de Google Calendar con todo
 *    pre-rellenado. El usuario sólo pulsa "Guardar".
 *
 *  - buildIcsContent: cadena con un .ics RFC-5545 mínimo y válido que
 *    se sirve como data URL o como descarga. Lo abren Outlook, Apple
 *    Calendar, Thunderbird y cualquier otro cliente ICS.
 *
 * Trabajamos en eventos all-day por defecto (los plazos del ISD son
 * fechas tope, no horas concretas).
 */

export interface CalendarEvent {
  /** Título corto del evento — aparece en la agenda. */
  title: string;
  /** Descripción larga, plain text. */
  description?: string;
  /** Lugar (opcional). En Heredia normalmente "Sede electrónica" o ciudad. */
  location?: string;
  /** Fecha del evento. Si endDate no se pasa, se asume all-day del mismo día. */
  date: Date;
  endDate?: Date;
  /** Si true, se trata como evento all-day (sin horas). Por defecto true. */
  allDay?: boolean;
}

/** Formatea una fecha como YYYYMMDD (para all-day) o YYYYMMDDTHHmmssZ. */
function formatForCalendar(d: Date, allDay: boolean): string {
  if (allDay) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  }
  // RFC-5545 UTC: 19980119T070000Z
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** Devuelve el día siguiente en UTC (DTEND es exclusivo para all-day). */
function nextDayUTC(d: Date): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + 1);
  return out;
}

/**
 * URL para añadir el evento en Google Calendar.
 * Doc: https://github.com/InteractionDesignFoundation/add-event-to-calendar-docs/blob/master/services/google.md
 */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const allDay = event.allDay !== false;
  const start = formatForCalendar(event.date, allDay);
  const endDate = event.endDate ?? (allDay ? nextDayUTC(event.date) : event.date);
  const end = formatForCalendar(endDate, allDay);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escapa los caracteres especiales de iCalendar (RFC-5545 §3.3.11). */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Construye el cuerpo de un fichero .ics válido para un sólo evento. */
export function buildIcsContent(event: CalendarEvent, uid?: string): string {
  const allDay = event.allDay !== false;
  const start = formatForCalendar(event.date, allDay);
  const endDate = event.endDate ?? (allDay ? nextDayUTC(event.date) : event.date);
  const end = formatForCalendar(endDate, allDay);
  const dtStamp = formatForCalendar(new Date(), false);
  const eventUid = uid || `${dtStamp}-${Math.random().toString(36).slice(2, 10)}@heredia.app`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Heredia//Plazos ISD//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${eventUid}`,
    `DTSTAMP:${dtStamp}`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n") + "\r\n";
}

/** Útil para descargar desde el cliente sin endpoint del server. */
export function buildIcsDataUrl(event: CalendarEvent, uid?: string): string {
  const ics = buildIcsContent(event, uid);
  // text/calendar es el MIME RFC-5545. base64 para evitar problemas con
  // saltos de línea en data URLs.
  return `data:text/calendar;charset=utf-8;base64,${Buffer.from(ics, "utf8").toString("base64")}`;
}
