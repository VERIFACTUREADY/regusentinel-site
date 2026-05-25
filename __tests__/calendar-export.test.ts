import { describe, it, expect } from "vitest";
import {
  buildGoogleCalendarUrl,
  buildIcsContent,
  buildIcsDataUrl,
} from "../src/lib/calendar-export";

const isoDate = (d: string) => new Date(d + "T00:00:00Z");

describe("buildGoogleCalendarUrl", () => {
  it("genera URL con action=TEMPLATE y título codificado", () => {
    const url = buildGoogleCalendarUrl({
      title: "Modelo 650 — EXP-2025-087",
      date: isoDate("2026-06-14"),
    });
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("text=Modelo+650");
  });

  it("usa rango all-day por defecto: DTEND = día siguiente", () => {
    const url = buildGoogleCalendarUrl({
      title: "Plazo",
      date: isoDate("2026-06-14"),
    });
    expect(url).toContain("dates=20260614%2F20260615");
  });

  it("incluye descripción y ubicación cuando se pasan", () => {
    const url = buildGoogleCalendarUrl({
      title: "Plazo",
      date: isoDate("2026-06-14"),
      description: "Modelo 650 — Heredera: María",
      location: "Sede AEAT Madrid",
    });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("details")).toBe("Modelo 650 — Heredera: María");
    expect(params.get("location")).toBe("Sede AEAT Madrid");
  });
});

describe("buildIcsContent", () => {
  it("genera un .ics válido con BEGIN/END VCALENDAR y VEVENT", () => {
    const ics = buildIcsContent({
      title: "Plazo Modelo 650",
      date: isoDate("2026-06-14"),
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("SUMMARY:Plazo Modelo 650");
  });

  it("formatea fechas all-day como DTSTART;VALUE=DATE:YYYYMMDD", () => {
    const ics = buildIcsContent({
      title: "Plazo",
      date: isoDate("2026-06-14"),
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260614");
    expect(ics).toContain("DTEND;VALUE=DATE:20260615");
  });

  it("escapa comas, puntos y coma y saltos de línea en SUMMARY/DESCRIPTION", () => {
    const ics = buildIcsContent({
      title: "Plazo; importante",
      date: isoDate("2026-06-14"),
      description: "Línea 1\nLínea 2, con coma",
    });
    expect(ics).toContain("SUMMARY:Plazo\\; importante");
    expect(ics).toContain("DESCRIPTION:Línea 1\\nLínea 2\\, con coma");
  });

  it("incluye UID estable cuando se pasa", () => {
    const ics = buildIcsContent({ title: "X", date: isoDate("2026-06-14") }, "case-87@bariturpro.com");
    expect(ics).toContain("UID:case-87@bariturpro.com");
  });

  it("usa CRLF como separador de líneas (RFC-5545)", () => {
    const ics = buildIcsContent({ title: "X", date: isoDate("2026-06-14") });
    expect(ics).toContain("\r\n");
    // No debe haber LF sin CR delante
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
  });
});

describe("buildIcsDataUrl", () => {
  it("devuelve data: URL base64 que decodifica al ics correcto", () => {
    const url = buildIcsDataUrl({ title: "Plazo", date: isoDate("2026-06-14") });
    expect(url.startsWith("data:text/calendar;charset=utf-8;base64,")).toBe(true);
    const base64 = url.split(",")[1];
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    expect(decoded).toContain("BEGIN:VCALENDAR");
    expect(decoded).toContain("SUMMARY:Plazo");
  });
});
