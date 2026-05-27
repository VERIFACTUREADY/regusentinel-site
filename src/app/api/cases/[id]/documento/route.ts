import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getTemplateBySlug, renderTemplate, DOCUMENT_TEMPLATES } from "@/lib/document-templates";
import { generateTemplatePDF } from "@/lib/template-pdf";
import { prefillTemplateFromCase } from "@/lib/case-document-prefill";

export const dynamic = "force-dynamic";

/**
 * GET: lista las plantillas disponibles con su pre-relleno desde el expediente.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: {
      province: true,
      deceased: { select: { fullName: true, dni: true, deathDate: true } },
      contact: { select: { fullName: true, relationship: true, email: true, phone: true } },
    },
  });

  if (!c) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }

  const caseData = {
    deceasedName: c.deceased?.fullName ?? null,
    deceasedDni: c.deceased?.dni ?? null,
    deathDate: c.deceased?.deathDate ?? null,
    contactName: c.contact?.fullName ?? null,
    contactRelationship: c.contact?.relationship ?? null,
    contactEmail: c.contact?.email ?? null,
    contactPhone: c.contact?.phone ?? null,
    province: c.province,
  };

  const templates = DOCUMENT_TEMPLATES.map((t) => {
    const prefilled = prefillTemplateFromCase(t.slug, caseData);
    return {
      slug: t.slug,
      title: t.title,
      description: t.description,
      destinatario: t.destinatario,
      category: t.category,
      fields: t.fields,
      prefilled,
    };
  });

  return NextResponse.json({ templates });
}

/**
 * POST: genera el PDF de una plantilla concreta con los valores finales.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true, ref: true },
  });
  if (!c) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const template = getTemplateBySlug(slug);
  if (!template) {
    return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  }

  const values: Record<string, string> = {};
  if (body.values && typeof body.values === "object") {
    for (const f of template.fields) {
      const raw = body.values[f.key];
      if (typeof raw === "string") values[f.key] = raw.slice(0, 1000).trim();
      else if (typeof raw === "number") values[f.key] = String(raw);
    }
  }

  for (const f of template.fields) {
    if (f.required && (!values[f.key] || values[f.key].length < 1)) {
      return NextResponse.json(
        { error: `El campo "${f.label}" es obligatorio` },
        { status: 400 }
      );
    }
  }

  const rendered = renderTemplate(template, values);
  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: { name: true },
  });

  const pdfBytes = await generateTemplatePDF({
    ...rendered,
    remitenteName: values.remitenteName || "[Nombre del remitente]",
    remitenteAddress: values.remitenteAddress || "",
    remitenteEmail: values.remitenteEmail || "",
    remitentePhone: values.remitentePhone || "",
    recipientLabel: template.destinatario,
    place: typeof body.place === "string" ? body.place.slice(0, 80) : undefined,
    generatedBy: org?.name ?? "Heredia",
    generatedAt: new Date(),
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "case.document_generated",
    details: `Documento "${template.title}" generado para ${c.ref}`,
  });

  const filename = `${template.slug}-${c.ref.replace(/\//g, "-")}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
