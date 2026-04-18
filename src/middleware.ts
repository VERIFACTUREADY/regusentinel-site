import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10; // max attempts per window

const RATE_LIMITED_PATHS = [
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/register",
];

function getRateLimitKey(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  return `${ip}:${req.nextUrl.pathname}`;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (req.method === "POST" && RATE_LIMITED_PATHS.some((p) => pathname.startsWith(p))) {
    const key = getRateLimitKey(req);
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (entry && now < entry.resetAt) {
      if (entry.count >= RATE_LIMIT_MAX) {
        return NextResponse.json(
          { error: "Demasiados intentos. Espera unos minutos." },
          { status: 429 }
        );
      }
      entry.count++;
    } else {
      rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    }

    // Cleanup old entries periodically
    if (rateLimitMap.size > 10000) {
      rateLimitMap.forEach((v, k) => {
        if (now >= v.resetAt) rateLimitMap.delete(k);
      });
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    "/api/auth/:path*",
    "/api/register",
    "/dashboard/:path*",
    "/cases/:path*",
    "/billing/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
