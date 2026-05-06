import { NextRequest, NextResponse } from "next/server";
import {
  calculateISD,
  calculateISDForCCAA,
  compareCCAAs,
  CCAA_LABELS,
  type ISDInputs,
  type CCAAKey,
  type ParentescoGroup,
} from "@/lib/isd-calculator";
import { rateLimit, PUBLIC_API_CORS_HEADERS } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

const VALID_GROUPS: ParentescoGroup[] = ["I", "II", "III", "IV"];
const VALID_CCAAS = Object.keys(CCAA_LABELS) as CCAAKey[];

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_API_CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { bucket: "isd-calc", max: 60 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));

  if (!VALID_GROUPS.includes(body.group)) {
    return NextResponse.json({ error: "Grupo invalido" }, { status: 400, headers: PUBLIC_API_CORS_HEADERS });
  }
  if (body.ccaa && !VALID_CCAAS.includes(body.ccaa)) {
    return NextResponse.json({ error: "CCAA invalida" }, { status: 400, headers: PUBLIC_API_CORS_HEADERS });
  }

  const baseImponible = Number(body.baseImponible);
  if (!isFinite(baseImponible) || baseImponible <= 0 || baseImponible > 100_000_000) {
    return NextResponse.json({ error: "Base imponible fuera de rango" }, { status: 400, headers: PUBLIC_API_CORS_HEADERS });
  }

  const inputs: Omit<ISDInputs, "ccaaBonificationPct"> = {
    group: body.group,
    ageIfMinor: body.ageIfMinor != null ? Math.max(0, Math.min(20, Number(body.ageIfMinor))) : null,
    baseImponible,
    preexistingPatrimony: Math.max(0, Number(body.preexistingPatrimony) || 0),
    dwellingReduction: Boolean(body.dwellingReduction),
    dwellingValue: Math.max(0, Number(body.dwellingValue) || 0),
    disability: ["none", "33-65", "65+"].includes(body.disability) ? body.disability : "none",
    lifeInsuranceAmount: Math.max(0, Number(body.lifeInsuranceAmount) || 0),
  };

  const ccaa = body.ccaa as CCAAKey | undefined;
  const result = ccaa
    ? calculateISDForCCAA(ccaa, inputs)
    : calculateISD({ ...inputs, ccaaBonificationPct: 0 });

  const comparison = compareCCAAs(inputs);

  return NextResponse.json(
    { result, comparison, ccaa: ccaa ?? null },
    { headers: PUBLIC_API_CORS_HEADERS }
  );
}
