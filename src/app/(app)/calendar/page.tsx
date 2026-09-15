import type { Metadata } from "next";
import { CalendarClient } from "./CalendarClient";

export const metadata: Metadata = { title: "Calendario de plazos — Heredia" };

export default function CalendarPage() {
  return <CalendarClient />;
}
