import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { generateChecklist } from "@/lib/autopilot";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "autopilot.run")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { caseId } = body;

  const c = await prisma.case.findFirst({
    where: { id: caseId, orgId: session.user.orgId },
    include: { deceased: true, contact: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const checklist = await generateChecklist(c, session.user.id);

  // Create tasks from checklist
  const createdTasks = [];
  for (const item of checklist) {
    const task = await prisma.task.create({
      data: {
        caseId,
        category: item.category,
        title: item.title,
        description: item.description,
        sortOrder: item.sortOrder,
      },
    });
    createdTasks.push(task);
  }

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId,
    action: "autopilot.checklist_generated",
    details: `${createdTasks.length} tareas generadas por autopilot`,
  });

  return NextResponse.json({ tasks: createdTasks });
}
