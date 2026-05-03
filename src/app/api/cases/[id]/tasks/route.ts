import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { triggerWorkflow } from "@/lib/workflow-engine";

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
  const { taskId, status, assigneeId, blockReason, blockedUntil } = body;

  const task = await prisma.task.findFirst({
    where: { id: taskId, caseId: params.id, case: { orgId: session.user.orgId } },
  });
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(status && { status }),
      ...(assigneeId !== undefined && { assigneeId }),
      ...(status === "BLOCKED" && {
        blockReason: blockReason ?? null,
        blockedUntil: blockedUntil ? new Date(blockedUntil) : null,
      }),
      ...(status && status !== "BLOCKED" && {
        blockReason: null,
        blockedUntil: null,
      }),
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
    triggerWorkflow({
      type: "TASK_STATUS_CHANGED",
      orgId: session.user.orgId,
      caseId: params.id,
      userId: session.user.id,
      taskId,
      taskStatus: status,
      taskCategory: task.category,
    }).catch(console.error);
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

    if (assigneeId && assigneeId !== session.user.id) {
      const [assignee, caseData] = await Promise.all([
        prisma.user.findUnique({ where: { id: assigneeId }, select: { email: true, name: true } }),
        prisma.case.findUnique({ where: { id: params.id }, select: { ref: true } }),
      ]);
      if (assignee?.email) {
        sendEmail({
          to: assignee.email,
          subject: `Tarea asignada: ${task.title} — ${caseData?.ref || ""}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#1a1a2e;">Nueva tarea asignada</h2>
              <p style="font-size:15px;color:#333;">
                Hola ${assignee.name || ""},<br/>
                Se te ha asignado la tarea <strong>${task.title}</strong> en el expediente <strong>${caseData?.ref || params.id}</strong>.
              </p>
              <p style="text-align:center;margin:24px 0;">
                <a href="${process.env.NEXTAUTH_URL || "https://app.baritur.pro"}/cases/${params.id}"
                   style="background-color:#1e40af;color:white;padding:12px 32px;
                          border-radius:6px;text-decoration:none;font-weight:600;">
                  Ver expediente
                </a>
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
              <p style="color:#999;font-size:12px;">BARITUR PRO — Gestion post-mortem profesional</p>
            </div>
          `,
        }).catch(console.error);
      }
    }
  }

  return NextResponse.json(updated);
}
