import { NextRequest, NextResponse } from "next/server";
import type { AuditLog, Task, TaskStatus } from "@prisma/client";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createTaskSchema, updateTaskSchema } from "@/lib/validations";
import { findCaseInOrg, findTaskInCase, findActiveMember, validateTaskDependency } from "@/lib/tenancy";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { triggerWorkflow, claveDeEvento } from "@/lib/workflow-engine";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  /*
   * EL ESTADO SE ESCRIBE CON UN COMPARA-Y-INTERCAMBIA, Y SÓLO AHÍ.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Había ya una reclamación atómica (`updateMany` condicionado al estado
   * leído) para decidir quién audita y quién emite el evento. Estaba bien,
   * pero **no era el único que escribía el estado**: justo después, el
   * `task.update` de abajo volvía a incluir `status`. Es decir, la petición
   * que PERDÍA la reclamación —y que por tanto no auditaba ni emitía nada—
   * escribía igualmente su estado encima del ganador.
   *
   * Reproducido contra la ruta real, con dos PATCH simultáneos sobre una tarea
   * en PENDIENTE (A -> HECHA, B -> EN CURSO), el resultado era: las dos
   * peticiones respondían 200, la base quedaba en EN CURSO y la auditoría
   * contenía únicamente `task.done`. Es decir: **el estado cambió sin ninguna
   * entrada de auditoría, sin evento y sin automatización**. Quien mira el
   * historial ve una historia que no coincide con la fila. En un expediente de
   * herencia eso es exactamente lo que no puede pasar: el histórico ES la
   * prueba de lo que se hizo y cuándo.
   *
   * LA SEMÁNTICA ELEGIDA: RECHAZAR LO CADUCO, NO PISARLO
   * ---------------------------------------------------
   * `updateMany` condicionado al estado observado es atómico: sólo una de las
   * dos peticiones obtiene `count === 1`, y esa reclamación es **la única
   * escritura del estado**. La perdedora ya no escribe nada; se relee el
   * estado real y se responde según lo que la petición pedía:
   *
   *   - Pedía **el mismo estado** que ya hay: su intención está cumplida. Se
   *     responde 200 y se sigue con el resto de campos, pero NO se audita ni
   *     se emite un segundo evento: hubo una sola transición de negocio y sólo
   *     puede constar una vez.
   *   - Pedía **otro estado**: la petición se apoya en una pantalla anterior a
   *     la decisión de otra persona. Se responde **409** con el estado real y
   *     **no se escribe absolutamente nada**, tampoco los demás campos, porque
   *     todos salen de esa misma lectura caduca.
   *
   * Se descartó la alternativa (encadenar las dos como dos transiciones
   * reales) porque deshace en silencio la decisión que un compañero acaba de
   * tomar, basándose en una pantalla anterior a ella, y ninguno de los dos se
   * entera. Rechazar y contar el estado real es el mismo patrón atómico que ya
   * usan el cron de desbloqueo y las reclamaciones del motor.
   *
   * LA TRANSICIÓN Y SU AUDITORÍA SE CONFIRMAN JUNTAS
   * -----------------------------------------------
   * La reclamación, la escritura de los demás campos y la fila de `AuditLog`
   * de la transición van en UNA transacción. Antes eran tres operaciones
   * confirmadas por separado, y entre la primera y la tercera cabía un fallo:
   * el estado quedaba escrito y la auditoría no llegaba a existir. Y como la
   * identidad del evento ES esa fila, tampoco habría evento ni automatización.
   * Un estado que nadie puede justificar es peor que un cambio que no ocurre.
   *
   * Dentro de la transacción no se llama a nadie de fuera. El motor de
   * automatizaciones y los correos van DESPUÉS del commit: mantener abierta
   * una transacción mientras se espera a un proveedor de correo bloquea la
   * fila y agota el pool con la primera lentitud del proveedor.
   */
  type Resultado =
    | { tipo: "aplicado"; tarea: Task; transicion: AuditLog | null }
    | { tipo: "no_encontrada" }
    | { tipo: "conflicto"; actual: TaskStatus };

  const resultado = await prisma.$transaction(async (tx): Promise<Resultado> => {
    let ganaLaTransicion = false;

    if (status) {
      const reclamo = await tx.task.updateMany({
        where: { id: task.id, status: task.status },
        data: { status },
      });

      if (reclamo.count === 0) {
        // La fila se movió entre la lectura y la escritura.
        const actual = await tx.task.findFirst({
          where: { id: task.id, case: { orgId: session.user.orgId } },
          select: { status: true },
        });
        if (!actual) return { tipo: "no_encontrada" };
        if (actual.status !== status) return { tipo: "conflicto", actual: actual.status };
        // Mismo destino: alguien se nos adelantó con la MISMA transición. La
        // intención está cumplida, así que esto es un éxito idempotente; lo
        // que no puede es constar dos veces.
      } else {
        ganaLaTransicion = status !== task.status;
      }
    }

    const tarea = await tx.task.update({
      where: { id: task.id },
      data: {
        // `status` NO se escribe aquí: lo escribe —y sólo él— el
        // compara-y-intercambia de arriba.
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

    const transicion =
      status && ganaLaTransicion
        ? await logAudit(
            {
              orgId: session.user.orgId,
              userId: session.user.id,
              caseId: params.id,
              action: `task.${status.toLowerCase()}`,
              details: `Tarea "${task.title}" marcada como ${status}`,
            },
            tx,
          )
        : null;

    // La auditoría de la asignación acompaña a la escritura de `assigneeId`,
    // por el mismo motivo: o constan las dos, o no consta ninguna.
    if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
      await logAudit(
        {
          orgId: session.user.orgId,
          userId: session.user.id,
          caseId: params.id,
          action: "task.assigned",
          details: assigneeId
            ? `Tarea "${task.title}" asignada`
            : `Tarea "${task.title}" desasignada`,
        },
        tx,
      );
    }

    return { tipo: "aplicado", tarea, transicion };
  });

  if (resultado.tipo === "no_encontrada") {
    return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  }
  if (resultado.tipo === "conflicto") {
    return NextResponse.json(
      {
        error: `La tarea ya no está en ${task.status}: otra persona la ha marcado como ${resultado.actual}. No se ha cambiado nada; revisa el estado actual antes de volver a intentarlo.`,
        currentStatus: resultado.actual,
      },
      { status: 409 },
    );
  }

  const updated = resultado.tarea;

  /*
   * A PARTIR DE AQUÍ, TODO ESTÁ YA CONFIRMADO EN LA BASE.
   *
   * Nada de lo que sigue puede deshacer la transición, y ninguna de estas
   * llamadas se hace con la transacción abierta.
   */
  const transicion = resultado.transicion;
  if (status && transicion) {
    triggerWorkflow({
      type: "TASK_STATUS_CHANGED",
      orgId: session.user.orgId,
      caseId: params.id,
      userId: session.user.id,
      taskId,
      taskStatus: status,
      taskCategory: task.category,
      /*
       * La identidad del evento es la fila de auditoría que acaba de
       * registrar ESTA transición. Sólo existe si la transición se ganó y se
       * registró, así que estado, historial y evento hablan del mismo hecho.
       */
      eventKey: claveDeEvento.transicionAuditada(transicion.id),
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

  // La auditoría de esta asignación ya se ha escrito dentro de la transacción;
  // aquí sólo queda el aviso, que es una llamada externa.
  if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
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

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
