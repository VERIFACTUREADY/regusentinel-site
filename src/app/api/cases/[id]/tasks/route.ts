import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const tasks = await prisma.task.findMany({
    where: { caseId: params.id, case: { orgId: session.user.orgId } },
    include: { assignee: { select: { id: true, name: true, email: true } }, approval: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.create")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({ where: { id: params.id, orgId: session.user.orgId } });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json();
  const task = await prisma.task.create({
    data: {
      caseId: params.id,
      category: body.category,
      title: body.title,
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      assigneeId: body.assigneeId,
      sortOrder: body.sortOrder || 0,
    },
  });

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.update")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { taskId, status, assigneeId } = body;

  const task = await prisma.task.findFirst({
    where: { id: taskId, caseId: params.id, case: { orgId: session.user.orgId } },
  });
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(status && { status }),
      ...(assigneeId !== undefined && { assigneeId }),
    },
  });

  if (status && status !== task.status) {
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: `task.${status.toLowerCase()}`,
      details: `Tarea "${task.title}" marcada como ${status}`,
    });
  }

  if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: "task.assigned",
      details: assigneeId
        ? `Tarea "${task.title}" asignada`
        : `Tarea "${task.title}" desasignada`,
    });
  }

  return NextResponse.json(updated);
}
