import { NextRequest, NextResponse } from "next/server";
import { detectISDRisks } from "@/lib/isd-risk-detector";
import { rateLimit, PUBLIC_API_CORS_HEADERS } from "@/lib/api-rate-limit";
import { CCAA_LABELS, type ParentescoGroup } from "@/lib/isd-calculator";

export const dynamic = "force-dynamic";

const VALID_GROUPS: ParentescoGroup[] = ["I", "II", "III", "IV"];

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_API_CORS_HEADERS });
}

/**
 * Public endpoint: detects ISD risks (deadlines, missing province, threshold proximity).
 * Pure function — no DB access.
 *
 * Body:
 *   {
 *     "deathDate": "2024-12-15",        // ISO date or null
 *     "province": "madrid",              // string or null
 *     "estimatedInheritanceValue": 100000, // optional number
 *     "group": "II"                       // optional ParentescoGroup
 *   }
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { bucket: "isd-risks", max: 60 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));

  let deathDate: Date | null = null;
  if (body.deathDate) {
    const d = new Date(body.deathDate);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "deathDate must be a valid ISO date" },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
    deathDate = d;
  }

  const province: string | null = typeof body.province === "string" && body.province.trim() ? body.province.trim() : null;

  let estimatedInheritanceValue: number | null = null;
  if (body.estimatedInheritanceValue != null) {
    const n = Number(body.estimatedInheritanceValue);
    if (!isFinite(n) || n < 0 || n > 100_000_000) {
      return NextResponse.json(
        { error: "estimatedInheritanceValue out of range" },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
    estimatedInheritanceValue = n;
  }

  let group: ParentescoGroup | null = null;
  if (body.group) {
    if (!VALID_GROUPS.includes(body.group)) {
      return NextResponse.json(
        { error: "group must be one of I, II, III, IV" },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
    group = body.group;
  }

  const risks = detectISDRisks({
    deathDate,
    province,
    estimatedInheritanceValue,
    group,
  });

  return NextResponse.json(
    {
      risks,
      meta: {
        ccaaCount: Object.keys(CCAA_LABELS).length,
        engine: "deterministic",
      },
    },
    { headers: PUBLIC_API_CORS_HEADERS }
  );
}
