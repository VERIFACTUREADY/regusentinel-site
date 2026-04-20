import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.update")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { taskIds, status, assigneeId } = body;

  if (!Array.isArray(taskIds) || taskIds.length === 0 || taskIds.length > 100) {
    return NextResponse.json({ error: "1-100 tareas requeridas" }, { status: 400 });
  }

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, case: { orgId: session.user.orgId, deletedAt: null } },
    select: { id: true, title: true, caseId: true, status: true },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ error: "No se encontraron tareas validas" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (assigneeId !== undefined) data.assigneeId = assigneeId || null;

  await prisma.task.updateMany({
    where: { id: { in: tasks.map((t) => t.id) } },
    data,
  });

  const action = status ? `task.batch_${status.toLowerCase()}` : "task.batch_assigned";
  const details = status
    ? `${tasks.length} tareas marcadas como ${status}`
    : assigneeId
      ? `${tasks.length} tareas reasignadas`
      : `${tasks.length} tareas desasignadas`;

  const caseIds = Array.from(new Set(tasks.map((t) => t.caseId)));
  for (const caseId of caseIds) {
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId,
      action,
      details,
    });
  }

  return NextResponse.json({ updated: tasks.length });
}
