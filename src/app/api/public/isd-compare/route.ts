import { NextRequest, NextResponse } from "next/server";
import {
  compareCCAAs,
  CCAA_LABELS,
  type ParentescoGroup,
} from "@/lib/isd-calculator";
import { rateLimit, PUBLIC_API_CORS_HEADERS } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

const VALID_GROUPS: ParentescoGroup[] = ["I", "II", "III", "IV"];

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_API_CORS_HEADERS });
}

/**
 * Public endpoint: compares ISD across all 17 CCAAs.
 *
 * Query params:
 *   ?group=II                  (default II)
 *   &baseImponible=200000      (default 200000)
 *   &preexistingPatrimony=0    (default 0)
 *
 * Returns sorted array (cheapest first).
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { bucket: "isd-compare", max: 120 });
  if (limited) return limited;

  const url = new URL(req.url);
  const groupParam = url.searchParams.get("group") || "II";
  const baseParam = url.searchParams.get("baseImponible") || "200000";
  const preexistParam = url.searchParams.get("preexistingPatrimony") || "0";

  if (!VALID_GROUPS.includes(groupParam as ParentescoGroup)) {
    return NextResponse.json(
      { error: "group must be one of I, II, III, IV" },
      { status: 400, headers: PUBLIC_API_CORS_HEADERS }
    );
  }

  const baseImponible = Number(baseParam);
  if (!isFinite(baseImponible) || baseImponible <= 0 || baseImponible > 100_000_000) {
    return NextResponse.json(
      { error: "baseImponible must be a positive number up to 100,000,000" },
      { status: 400, headers: PUBLIC_API_CORS_HEADERS }
    );
  }

  const preexistingPatrimony = Number(preexistParam);
  if (!isFinite(preexistingPatrimony) || preexistingPatrimony < 0) {
    return NextResponse.json(
      { error: "preexistingPatrimony must be a non-negative number" },
      { status: 400, headers: PUBLIC_API_CORS_HEADERS }
    );
  }

  const results = compareCCAAs({
    group: groupParam as ParentescoGroup,
    baseImponible,
    preexistingPatrimony,
  });

  return NextResponse.json(
    {
      ccaaCount: Object.keys(CCAA_LABELS).length,
      group: groupParam,
      baseImponible,
      results,
    },
    {
      headers: {
        ...PUBLIC_API_CORS_HEADERS,
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
