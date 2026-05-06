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

export const dynamic = "force-dynamic";

// Rate limit en memoria para abuso accidental. No bloquea picos legítimos
// porque el endpoint sólo computa (no hay DB ni IO), pero protege de bots
// haciendo scraping continuo.
const rateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > MAX_PER_WINDOW) return true;
  return false;
}

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || "unknown";
}

const VALID_GROUPS: ParentescoGroup[] = ["I", "II", "III", "IV"];
const VALID_CCAAS = Object.keys(CCAA_LABELS) as CCAAKey[];

export async function POST(req: NextRequest) {
  if (rateLimited(getIP(req))) {
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));

  if (!VALID_GROUPS.includes(body.group)) {
    return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
  }
  if (body.ccaa && !VALID_CCAAS.includes(body.ccaa)) {
    return NextResponse.json({ error: "CCAA inválida" }, { status: 400 });
  }

  const baseImponible = Number(body.baseImponible);
  if (!isFinite(baseImponible) || baseImponible <= 0 || baseImponible > 100_000_000) {
    return NextResponse.json({ error: "Base imponible fuera de rango" }, { status: 400 });
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

  return NextResponse.json({ result, comparison, ccaa: ccaa ?? null });
}
