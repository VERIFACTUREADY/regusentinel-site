import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { generateModelo650PDF } from "@/lib/modelo650-pdf";

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
      province: true,
      hasDeceasedInsurance: true,
      categories: true,
      deceased: { select: { fullName: true, deathDate: true, dni: true } },
      contact: { select: { fullName: true, relationship: true, email: true, phone: true } },
    },
  });

  if (!c) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: { name: true },
  });

  const pdfBytes = await generateModelo650PDF({
    caseRef: c.ref,
    deceased: {
      fullName: c.deceased?.fullName ?? "Sin datos",
      dni: c.deceased?.dni ?? null,
      deathDate: c.deceased?.deathDate ?? null,
      province: c.province ?? null,
    },
    contact: c.contact
      ? {
          fullName: c.contact.fullName,
          relationship: c.contact.relationship ?? null,
          email: c.contact.email ?? null,
          phone: c.contact.phone ?? null,
        }
      : null,
    estimatedInheritanceValue: null,
    hasDeceasedInsurance: c.hasDeceasedInsurance,
    categories: c.categories,
    orgName: org?.name ?? "BARITUR PRO",
    generatedAt: new Date(),
  });

  const filename = `borrador-modelo650-${c.ref.replace(/\//g, "-")}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
