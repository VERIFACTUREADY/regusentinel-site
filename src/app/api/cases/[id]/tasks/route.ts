import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createTaskSchema, updateTaskSchema } from "@/lib/validations";
import { findCaseInOrg, findTaskInCase, findActiveMember, validateTaskDependency } from "@/lib/tenancy";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { triggerWorkflow, claveDeEvento } from "@/lib/workflow-engine";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("tasks.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const tasks = await prisma.task.findMany({
    where: { caseId: params.id, case: { orgId: session.user.orgId } },
    include: { assignee: { select: { id: true, name: true, email: true } }, approval: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("tasks.create");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await findCaseInOrg(params.id, session.user.orgId);
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const parsed = createTaskSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // El asignado debe ser miembro vivo de ESTA organización. Antes se guardaba
  // el id sin comprobar nada: se podía asignar la tarea a un usuario de otro
  // tenant, que además recibía el email con el nombre del fallecido.
  if (data.assigneeId) {
    const member = await findActiveMember(data.assigneeId, session.user.orgId);
    if (!member) {
      return NextResponse.json(
        { error: "El usuario asignado no pertenece a esta organización" },
        { status: 400 },
      );
    }
  }

  const task = await prisma.task.create({
    data: {
      caseId: params.id,
      category: data.category,
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate ?? null,
      assigneeId: data.assigneeId ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("tasks.update");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const parsed = updateTaskSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const {
    taskId, status, assigneeId, blockReason, blockedUntil,
    dependsOnId, deadline, dueDate, title, description,
  } = parsed.data;

  const task = await findTaskInCase(taskId, params.id, session.user.orgId);
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

  // El asignado debe ser miembro vivo de esta organización.
  if (assigneeId) {
    const member = await findActiveMember(assigneeId, session.user.orgId);
    if (!member) {
      return NextResponse.json(
        { error: "El usuario asignado no pertenece a esta organización" },
        { status: 400 },
      );
    }
  }

  // La dependencia debe ser otra tarea del MISMO expediente, no puede ser la
  // propia tarea y no puede cerrar un ciclo. Antes no se comprobaba ninguna de
  // las tres cosas: `dependsOnId` podía apuntar a una tarea de otro tenant.
  if (dependsOnId) {
    const check = await validateTaskDependency(
      taskId, dependsOnId, params.id, session.user.orgId,
    );
    if (!check.ok) {
      const message =
        check.reason === "self_dependency"
          ? "Una tarea no puede depender de sí misma"
          : check.reason === "cycle"
            ? "Esa dependencia crearía un ciclo entre tareas"
            : check.reason === "too_deep"
              ? "La cadena de dependencias es demasiado larga para poder comprobarla. Simplifícala antes de añadir esta."
              : "La tarea de la que quieres depender no pertenece a este expediente";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      ...(status && { status }),
      ...(assigneeId !== undefined && { assigneeId: assigneeId ?? null }),
      ...(status === "BLOCKED" && {
        blockReason: blockReason ?? null,
        blockedUntil: blockedUntil ?? null,
      }),
      ...(status && status !== "BLOCKED" && {
        blockReason: null,
        blockedUntil: null,
      }),
      ...(dependsOnId !== undefined && { dependsOnId: dependsOnId ?? null }),
      ...(deadline !== undefined && { deadline: deadline ?? null }),
      ...(dueDate !== undefined && { dueDate: dueDate ?? null }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description ?? null }),
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
      /*
       * La versión de la tarea tras la escritura. Sin ella la clave era
       * `(tarea, estado, ventana)`: pasar a EN CURSO, volver a PENDIENTE y
       * volver a EN CURSO dentro de cinco minutos se tragaba la tercera
       * transición, y el aviso no salía la segunda vez.
       */
      eventKey: claveDeEvento.estadoTarea(taskId, updated.updatedAt),
    }).catch(console.error);

    // When a task is completed, notify assignees of tasks that were waiting on it
    if (status === "DONE" || status === "SKIPPED") {
      const dependents = await prisma.task.findMany({
        where: { dependsOnId: taskId, status: { in: ["PENDING", "BLOCKED"] } },
        select: { id: true, title: true, assigneeId: true, assignee: { select: { email: true, name: true } } },
      });
      const caseData = dependents.length > 0
        ? await prisma.case.findUnique({ where: { id: params.id }, select: { ref: true } })
        : null;
      for (const dep of dependents) {
        if (dep.assigneeId && dep.assigneeId !== session.user.id && dep.assignee?.email) {
          sendEmail({
            to: dep.assignee.email,
            subject: `Prerrequisito completado: ${dep.title} — ${caseData?.ref || ""}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#1a1a2e;">Tu tarea ya puede avanzar</h2>
                <p style="font-size:15px;color:#333;">
                  Hola ${dep.assignee.name || ""},<br/>
                  La tarea <strong>${task.title}</strong> ha sido completada. Tu tarea <strong>${dep.title}</strong> en el expediente <strong>${caseData?.ref || params.id}</strong> ya puede continuar.
                </p>
                <p style="text-align:center;margin:24px 0;">
                  <a href="${process.env.NEXTAUTH_URL || "https://app.heredia.app"}/cases/${params.id}"
                     style="background-color:#7c3aed;color:white;padding:12px 32px;
                            border-radius:6px;text-decoration:none;font-weight:600;">
                    Ver expediente
                  </a>
                </p>
                <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
                <p style="color:#999;font-size:12px;">Heredia — Gestion post-mortem profesional</p>
              </div>
            `,
          }).catch(console.error);
        }
      }
    }
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
                <a href="${process.env.NEXTAUTH_URL || "https://app.heredia.app"}/cases/${params.id}"
                   style="background-color:#1e40af;color:white;padding:12px 32px;
                          border-radius:6px;text-decoration:none;font-weight:600;">
                  Ver expediente
                </a>
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
              <p style="color:#999;font-size:12px;">Heredia — Gestion post-mortem profesional</p>
            </div>
          `,
        }).catch(console.error);
      }
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("tasks.delete");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId requerido" }, { status: 400 });

  const task = await prisma.task.findFirst({
    where: { id: taskId, caseId: params.id, case: { orgId: session.user.orgId } },
  });
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

  await prisma.task.delete({ where: { id: taskId } });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: params.id,
    action: "task.deleted",
    details: `Tarea eliminada: "${task.title}"`,
  });

  return NextResponse.json({ ok: true });
}
