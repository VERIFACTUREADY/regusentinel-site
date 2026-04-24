import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { triggerWorkflow } from "@/lib/workflow-engine";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.update")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const orgId = session.user.orgId;
  const userId = session.user.id;

  const body = await req.json();
  const { taskIds, status, assigneeId } = body;

  if (!Array.isArray(taskIds) || taskIds.length === 0 || taskIds.length > 100) {
    return NextResponse.json({ error: "1-100 tareas requeridas" }, { status: 400 });
  }

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, case: { orgId, deletedAt: null } },
    select: { id: true, title: true, caseId: true, status: true, category: true },
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
  await Promise.all(caseIds.map((caseId) =>
    logAudit({
      orgId,
      userId,
      caseId,
      action,
      details,
    })
  ));

  // Fire-and-forget workflow triggers for task status changes
  if (status) {
    Promise.allSettled(
      tasks.map((t) =>
        triggerWorkflow({
          type: "TASK_STATUS_CHANGED",
          orgId,
          caseId: t.caseId,
          userId,
          taskId: t.id,
          taskStatus: status,
          taskCategory: t.category,
        })
      )
    ).catch(console.error);
  }

  return NextResponse.json({ updated: tasks.length });
}
