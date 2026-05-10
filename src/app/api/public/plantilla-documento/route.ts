import { NextRequest, NextResponse } from "next/server";
import { getTemplateBySlug, renderTemplate } from "@/lib/document-templates";
import { generateTemplatePDF } from "@/lib/template-pdf";
import { rateLimit, PUBLIC_API_CORS_HEADERS } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_API_CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { bucket: "plantilla-documento", max: 12, windowMs: 60_000 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const template = getTemplateBySlug(slug);
  if (!template) {
    return NextResponse.json(
      { error: "Plantilla no encontrada" },
      { status: 404, headers: PUBLIC_API_CORS_HEADERS }
    );
  }

  const values: Record<string, string> = {};
  if (body.values && typeof body.values === "object") {
    for (const f of template.fields) {
      const raw = body.values[f.key];
      if (typeof raw === "string") {
        values[f.key] = raw.slice(0, 1000).trim();
      } else if (typeof raw === "number") {
        values[f.key] = String(raw);
      }
    }
  }

  // Validate required fields
  for (const f of template.fields) {
    if (f.required && (!values[f.key] || values[f.key].length < 1)) {
      return NextResponse.json(
        { error: `El campo "${f.label}" es obligatorio` },
        { status: 400, headers: PUBLIC_API_CORS_HEADERS }
      );
    }
  }

  const rendered = renderTemplate(template, values);

  const pdfBytes = await generateTemplatePDF({
    ...rendered,
    remitenteName: values.remitenteName || "[Nombre del remitente]",
    remitenteAddress: values.remitenteAddress || "",
    remitenteEmail: values.remitenteEmail || "",
    remitentePhone: values.remitentePhone || "",
    recipientLabel: template.destinatario,
    place: typeof body.place === "string" ? body.place.slice(0, 80) : undefined,
    generatedBy: "BARITUR PRO - Plantilla gratuita",
    generatedAt: new Date(),
  });

  const filename = `${template.slug}-${Date.now()}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      ...PUBLIC_API_CORS_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
