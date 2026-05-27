import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { buildFamilySummary, type FamilySummaryTask } from "@/lib/family-summary";
import { generateFamilySummaryPDF } from "@/lib/family-summary-pdf";

export const dynamic = "force-dynamic";

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
