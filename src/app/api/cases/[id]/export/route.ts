import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateDossierPdf } from "@/lib/pdf";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    include: {
      deceased: true,
      contact: true,
      tasks: {
        include: { dependsOn: { select: { title: true, status: true } } },
        orderBy: { sortOrder: "asc" },
      },
      documents: true,
    },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const tasksForPdf = c.tasks.map((t) => ({
    ...t,
    dependsOnTitle: (t as any).dependsOn?.title ?? null,
    dependsOnStatus: (t as any).dependsOn?.status ?? null,
  }));
  const pdfBuffer = await generateDossierPdf(c, tasksForPdf, c.documents);

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: params.id,
    action: "case.export_dossier",
    details: `Dossier PDF generado para ${c.ref}`,
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dossier-${c.ref}.pdf"`,
    },
  });
}
