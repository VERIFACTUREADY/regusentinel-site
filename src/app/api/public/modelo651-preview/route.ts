import { NextRequest, NextResponse } from "next/server";
import { generateModelo651PDF } from "@/lib/modelo651-pdf";
import { rateLimit, PUBLIC_API_CORS_HEADERS } from "@/lib/api-rate-limit";
import { CCAA_LABELS, type CCAAKey, type ParentescoGroup } from "@/lib/isd-calculator";

export const dynamic = "force-dynamic";

const VALID_CCAA = Object.keys(CCAA_LABELS) as CCAAKey[];
const VALID_GROUPS: ParentescoGroup[] = ["I", "II", "III", "IV"];
const VALID_TIPO_BIEN = ["dinero", "inmueble", "valores", "vehiculo", "otros"] as const;
const VALID_REDUCCION = ["ninguna", "vivienda-habitual-hijo", "dinero-para-vivienda-hijo", "empresa-familiar"] as const;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_API_CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { bucket: "modelo651-preview", max: 8, windowMs: 60_000 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));

  const donanteName = typeof body.donanteName === "string" ? body.donanteName.trim() : "";
  if (!donanteName || donanteName.length < 2 || donanteName.length > 200) {
    return NextResponse.json(
      { error: "donanteName es obligatorio (2-200 caracteres)" },
      { status: 400, headers: PUBLIC_API_CORS_HEADERS }
    );
  }

  const donatarioName = typeof body.donatarioName === "string" ? body.donatarioName.trim() : "";
  if (!donatarioName || donatarioName.length < 2 || donatarioName.length > 200) {
    return NextResponse.json(
      { error: "donatarioName es obligatorio (2-200 caracteres)" },
      { status: 400, headers: PUBLIC_API_CORS_HEADERS }
    );
  }

  let donationDate: Date | null = null;
  if (body.donationDate) {
    const d = new Date(body.donationDate);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "donationDate debe ser una fecha ISO valida" },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
    if (d.getFullYear() < 1990 || d.getFullYear() > 2100) {
      return NextResponse.json(
        { error: "donationDate fuera de rango" },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
    donationDate = d;
  }

  const tipoBien = VALID_TIPO_BIEN.includes(body.tipoBien) ? body.tipoBien : "otros";
  const reduccion = VALID_REDUCCION.includes(body.reduccion) ? body.reduccion : "ninguna";
  const ccaa: CCAAKey | null = VALID_CCAA.includes(body.ccaa) ? body.ccaa : null;
  const group: ParentescoGroup | null = VALID_GROUPS.includes(body.group) ? body.group : null;

  let baseImponible: number | null = null;
  if (body.baseImponible != null) {
    const n = Number(body.baseImponible);
    if (!isFinite(n) || n < 0 || n > 100_000_000) {
      return NextResponse.json(
        { error: "baseImponible fuera de rango (0 a 100.000.000)" },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
    baseImponible = n;
  }

  const donanteDni = typeof body.donanteDni === "string" ? body.donanteDni.trim().slice(0, 20) : null;
  const donatarioDni = typeof body.donatarioDni === "string" ? body.donatarioDni.trim().slice(0, 20) : null;
  const relationship = typeof body.relationship === "string" ? body.relationship.trim().slice(0, 100) : null;
  const province = typeof body.province === "string" ? body.province.trim().slice(0, 80) : null;

  const pdfBytes = await generateModelo651PDF({
    caseRef: "BORRADOR-PREVIEW",
    donante: { fullName: donanteName, dni: donanteDni },
    donatario: { fullName: donatarioName, dni: donatarioDni, relationship, province },
    donationDate,
    tipoBien,
    baseImponible,
    reduccion,
    ccaa,
    group,
    orgName: "Heredia - Borrador gratuito",
    generatedAt: new Date(),
  });

  const filename = `borrador-modelo651-${Date.now()}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      ...PUBLIC_API_CORS_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
