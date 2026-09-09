import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildFamilySummary, type FamilySummaryTask } from "@/lib/family-summary";
import { generateFamilySummaryPDF } from "@/lib/family-summary-pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: {
      ref: true,
      status: true,
      deceased: { select: { fullName: true, deathDate: true } },
      tasks: { select: { title: true, status: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!c) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: { name: true },
  });
  const orgName = org?.name ?? "Heredia";

  const tasks: FamilySummaryTask[] = c.tasks.map((t) => ({
    title: t.title,
    status: t.status as FamilySummaryTask["status"],
  }));

  const summary = buildFamilySummary({
    deceasedName: c.deceased?.fullName ?? null,
    caseStatus: c.status,
    deathDate: c.deceased?.deathDate ?? null,
    tasks,
    orgName,
  });

  const pdfBytes = await generateFamilySummaryPDF({
    summary,
    caseRef: c.ref,
    orgName,
    generatedAt: new Date(),
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "case.family_summary_generated",
    details: `Resumen para la familia generado para ${c.ref}`,
  });

  const filename = `resumen-familia-${c.ref.replace(/\//g, "-")}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
