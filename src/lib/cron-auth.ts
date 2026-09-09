/**
 * Validacion del CRON_SECRET con comparacion en tiempo constante.
 *
 * Vercel Cron envia "Authorization: Bearer <CRON_SECRET>" en cada disparo.
 * Algunos schedulers externos no permiten headers custom y mandan el secret
 * como query param ?secret=...; soportamos ambos.
 *
 * El compare directo con !== filtra timing entre bytes correctos vs incorrectos,
 * lo cual en un setup adversarial muy fino podria revelar bits del secret.
 * timingSafeEqual elimina esa fuga.
 *
 * Fail-closed: si CRON_SECRET no esta configurado, rechazamos todo (en lugar
 * de dejar el endpoint abierto). Para dev local, set CRON_SECRET en .env.
 */

import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function validateCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader && safeEquals(authHeader, `Bearer ${expected}`)) return true;

  const secretParam = req.nextUrl.searchParams.get("secret") ?? "";
  if (secretParam && safeEquals(secretParam, expected)) return true;

  return false;
}

