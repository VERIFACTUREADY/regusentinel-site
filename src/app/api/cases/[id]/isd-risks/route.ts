import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { detectISDRisks, parseAppliedReductions } from "@/lib/isd-risk-detector";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: {
      province: true,
      hasUrbanProperty: true,
      propertyAcquisitionValue: true,
      propertyTransmissionValue: true,
      preexistingPatrimony: true,
      recentResidenceChange: true,
      previousResidenceProvince: true,
      appliedReductions: true,
      deceased: { select: { deathDate: true } },
    },
  });

  if (!c) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }

  const risks = detectISDRisks({
    deathDate: c.deceased?.deathDate ?? null,
    province: c.province,
    hasUrbanProperty: c.hasUrbanProperty,
    propertyAcquisitionValue: c.propertyAcquisitionValue,
    propertyTransmissionValue: c.propertyTransmissionValue,
    preexistingPatrimony: c.preexistingPatrimony,
    recentResidenceChange: c.recentResidenceChange,
    previousResidenceProvince: c.previousResidenceProvince,
    appliedReductions: parseAppliedReductions(c.appliedReductions),
  });

  return NextResponse.json({ risks });
}
