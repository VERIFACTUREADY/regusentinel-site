import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { computeCaseHealth } from "@/lib/case-health";

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
      updatedAt: true,
      deceased: { select: { fullName: true, deathDate: true } },
      contact: { select: { id: true } },
      tasks: { select: { status: true, deadline: true, dueDate: true } },
      documents: { select: { id: true } },
    },
  });

  if (!c) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }

  const now = Date.now();
  const doneTasks = c.tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
  const blockedTasks = c.tasks.filter((t) => t.status === "BLOCKED").length;
  const overdueTasks = c.tasks.filter((t) => {
    if (t.status === "DONE" || t.status === "SKIPPED") return false;
    const dl = t.deadline ?? t.dueDate;
    return dl != null && new Date(dl).getTime() < now;
  }).length;

  const health = computeCaseHealth({
    totalTasks: c.tasks.length,
    doneTasks,
    blockedTasks,
    overdueTasks,
    deathDate: c.deceased?.deathDate ?? null,
    province: c.province,
    hasDeceasedName: Boolean(c.deceased?.fullName),
    hasContact: Boolean(c.contact),
    documentCount: c.documents.length,
    lastUpdatedAt: c.updatedAt,
    status: c.status,
  });

  return NextResponse.json({ health });
}
