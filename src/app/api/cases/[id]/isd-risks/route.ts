import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { detectISDRisks } from "@/lib/isd-risk-detector";

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
      province: true,
      hasUrbanProperty: true,
      propertyAcquisitionValue: true,
      propertyTransmissionValue: true,
      preexistingPatrimony: true,
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
  });

  return NextResponse.json({ risks });
}
