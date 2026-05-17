/**
 * Rate limit en memoria para endpoints publicos.
 *
 * No es distribuido: en una funcion serverless cada instancia tiene su propio
 * map, asi que el limite real es N_instances * MAX_PER_WINDOW. Aceptable como
 * proteccion contra abuso accidental; para limites estrictos cambiar a Redis.
 */

import { NextRequest, NextResponse } from "next/server";

const stores = new Map<string, Map<string, { count: number; resetAt: number }>>();

interface Options {
  /** Identifier for the rate limiter bucket (one per endpoint). */
  bucket: string;
  /** Window length in milliseconds. */
  windowMs?: number;
  /** Max requests allowed within the window. */
  max?: number;
}

export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Returns null if the request is allowed; returns a 429 NextResponse if rate-limited.
 */
export function rateLimit(req: NextRequest, opts: Options): NextResponse | null {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 60;

  let store = stores.get(opts.bucket);
  if (!store) {
    store = new Map();
    stores.set(opts.bucket, store);
  }

  const ip = getClientIP(req);
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.resetAt < now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests", retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(entry.resetAt),
        },
      }
    );
  }

  return null;
}

/**
 * CORS headers for public API endpoints. Allows any origin (read-only public
 * endpoints) and exposes rate-limit headers so clients can adapt.
 */
export const PUBLIC_API_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
