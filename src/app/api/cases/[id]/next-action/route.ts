import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { detectISDRisks, parseAppliedReductions } from "@/lib/isd-risk-detector";
import { computeNextAction, type NextActionTask } from "@/lib/next-action";

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
      status: true,
      province: true,
      hasUrbanProperty: true,
      propertyAcquisitionValue: true,
      propertyTransmissionValue: true,
      preexistingPatrimony: true,
      recentResidenceChange: true,
      previousResidenceProvince: true,
      appliedReductions: true,
      deceased: { select: { deathDate: true } },
      tasks: {
        select: { id: true, title: true, status: true, deadline: true, dueDate: true, blockReason: true },
      },
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

  const tasks: NextActionTask[] = c.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status as NextActionTask["status"],
    deadline: t.deadline ?? t.dueDate ?? null,
    blockReason: t.blockReason,
  }));

  const nextAction = computeNextAction({
    caseStatus: c.status,
    risks: risks.map((r) => ({ id: r.id, severity: r.severity, title: r.title })),
    tasks,
  });

  return NextResponse.json({ nextAction });
}
