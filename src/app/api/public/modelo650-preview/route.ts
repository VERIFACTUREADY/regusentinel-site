import { NextRequest, NextResponse } from "next/server";
import { generateModelo650PDF } from "@/lib/modelo650-pdf";
import { rateLimit, PUBLIC_API_CORS_HEADERS } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_API_CORS_HEADERS });
}

/**
 * Public lead-magnet endpoint: generates a Modelo 650 working draft PDF
 * from a minimal payload. No auth required, but rate-limited harder than
 * the read-only endpoints because PDF generation is heavier.
 *
 * Body:
 *   {
 *     "deceasedName": "...",
 *     "deceasedDni": "...",        (optional)
 *     "deathDate": "2024-12-15",    (optional ISO date)
 *     "province": "madrid",         (optional)
 *     "contactName": "...",         (optional)
 *     "contactRelationship": "...", (optional)
 *     "estimatedValue": 200000,     (optional number)
 *     "hasInsurance": false         (optional boolean)
 *   }
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { bucket: "modelo650-preview", max: 8, windowMs: 60_000 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));

  const deceasedName = typeof body.deceasedName === "string" ? body.deceasedName.trim() : "";
  if (!deceasedName || deceasedName.length < 2 || deceasedName.length > 200) {
    return NextResponse.json(
      { error: "deceasedName es obligatorio (2-200 caracteres)" },
      { status: 400, headers: PUBLIC_API_CORS_HEADERS }
    );
  }

  let deathDate: Date | null = null;
  if (body.deathDate) {
    const d = new Date(body.deathDate);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "deathDate debe ser una fecha ISO válida" },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
    // sanity: not in the future, not before 1900
    const now = Date.now();
    if (d.getTime() > now || d.getFullYear() < 1900) {
      return NextResponse.json(
        { error: "deathDate fuera de rango válido" },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
    deathDate = d;
  }

  let estimatedValue: number | null = null;
  if (body.estimatedValue != null) {
    const n = Number(body.estimatedValue);
    if (!isFinite(n) || n < 0 || n > 100_000_000) {
      return NextResponse.json(
        { error: "estimatedValue fuera de rango (0 a 100.000.000)" },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
    estimatedValue = n;
  }

  const province = typeof body.province === "string" && body.province.trim()
    ? body.province.trim().slice(0, 80)
    : null;
  const deceasedDni = typeof body.deceasedDni === "string" ? body.deceasedDni.trim().slice(0, 20) : null;
  const contactName = typeof body.contactName === "string" ? body.contactName.trim().slice(0, 200) : null;
  const contactRel = typeof body.contactRelationship === "string" ? body.contactRelationship.trim().slice(0, 100) : null;

  const pdfBytes = await generateModelo650PDF({
    caseRef: "BORRADOR-PREVIEW",
    deceased: {
      fullName: deceasedName,
      dni: deceasedDni,
      deathDate,
      province,
    },
    contact: contactName
      ? {
          fullName: contactName,
          relationship: contactRel,
          email: null,
          phone: null,
        }
      : null,
    estimatedInheritanceValue: estimatedValue,
    hasDeceasedInsurance: Boolean(body.hasInsurance),
    categories: [],
    orgName: "Heredia — Borrador gratuito",
    generatedAt: new Date(),
  });

  const filename = `borrador-modelo650-${Date.now()}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      ...PUBLIC_API_CORS_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
