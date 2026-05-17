import type { Metadata } from "next";
import { CalendarClient } from "./CalendarClient";

export const metadata: Metadata = { title: "Calendario de plazos — BARITUR PRO" };

export default function CalendarPage() {
  return <CalendarClient />;
}
