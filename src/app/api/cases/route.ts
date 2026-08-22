import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nextCaseRef } from "@/lib/tenancy";
import { checkCaseLimit, planOf, lockOrgForLimits } from "@/lib/plan-limits";

import { createCaseSchema } from "@/lib/validations";
import { getChecklistForCategories } from "@/lib/checklist-rules";
import { logAudit } from "@/lib/audit";
import { calculateTaskDeadlines } from "@/lib/deadline-engine";
import { triggerWorkflow, claveDeEvento } from "@/lib/workflow-engine";

/** Tope de plan alcanzado. Aborta la transaccion y se traduce a 403. */
class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

/**
 * P2002 sobre el indice (orgId, ref): otra alta simultanea se quedo con la
 * referencia que habiamos elegido. Es reintentable.
 */
function isUniqueRefConflict(err: unknown): boolean {
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e?.code !== "P2002") return false;
  const target = e.meta?.target;
  const fields = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return fields.includes("ref");
}

export async function GET(req: NextRequest) {
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const urgent = url.searchParams.get("urgent");
  const province = url.searchParams.get("province");
  const isdExpiring = url.searchParams.get("isdExpiring"); // "30" | "60" = days threshold
  const myTasks = url.searchParams.get("myTasks"); // filter cases where current user has active tasks
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100);

  const now = new Date();
  const conditions: Record<string, unknown>[] = [
    { orgId: session.user.orgId, deletedAt: null },
  ];
  if (status) conditions.push({ status });
  if (category) conditions.push({ categories: { has: category } });
  if (urgent === "true") conditions.push({ isUrgent: true });
  if (province) conditions.push({ province });
  if (isdExpiring) {
    const days = parseInt(isdExpiring) || 30;
    const minDeathDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const maxDeathDate = new Date(now.getTime() - (180 - days) * 24 * 60 * 60 * 1000);
    conditions.push({
      status: { notIn: ["CLOSED", "ARCHIVED"] },
      deceased: { deathDate: { gte: minDeathDate, lte: maxDeathDate } },
    });
  }
  if (search) {
    conditions.push({
      OR: [
        { ref: { contains: search, mode: "insensitive" } },
        { deceased: { fullName: { contains: search, mode: "insensitive" } } },
        { contact: { fullName: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (myTasks === "true") {
    conditions.push({
      tasks: { some: { assigneeId: session.user.id, status: { notIn: ["DONE", "SKIPPED"] } } },
    });
  }
  const where = { AND: conditions };

  const [cases, total] = await Promise.all([
    prisma.case.findMany({
      where: where as any,
      include: { deceased: true, contact: true },
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.case.count({ where: where as any }),
  ]);

  // Attach latest health score from analysis logs
  const caseIds = cases.map((c) => c.id);
  const healthLogs = caseIds.length
    ? await prisma.promptLog.findMany({
        where: { caseId: { in: caseIds }, action: "analyze_case" },
        select: { caseId: true, response: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const healthMap: Record<string, number | null> = {};
  for (const log of healthLogs) {
    if (log.caseId && !(log.caseId in healthMap)) {
      try {
        const r = JSON.parse(log.response || "{}");
        healthMap[log.caseId] = typeof r.healthScore === "number" ? r.healthScore : null;
      } catch {
        healthMap[log.caseId] = null;
      }
    }
  }
  const casesWithHealth = cases.map((c) => ({ ...c, healthScore: healthMap[c.id] ?? null }));

  return NextResponse.json({ cases: casesWithHealth, total, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgPermission("cases.create");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  try {
    const body = await req.json();
    const { caseTemplateId } = body;
    const data = createCaseSchema.parse(body);

    // El limite de plan se comprueba DENTRO de la transaccion (mas abajo),
    // no aqui: contar fuera y crear despues deja una ventana en la que varias
    // peticiones simultaneas ven el mismo recuento y todas pasan el tope.
    const plan = await planOf(session.user.orgId);

    // La referencia se genera DENTRO de la transaccion, a partir del maximo ya
    // existente para el anyo en curso. Antes se hacia `count + 1` fuera de la
    // transaccion, asi que dos altas simultaneas producian la misma referencia
    // y nada en la base de datos lo impedia.
    //
    // La restriccion @@unique([orgId, ref]) cierra la ventana que queda: si dos
    // transacciones eligen el mismo numero, una falla con P2002 y reintentamos.
    const createCaseTransaction = () =>
      prisma.$transaction(async (tx) => {
      // Serializa por organizacion la comprobacion de limite y la asignacion
      // de referencia.
      await lockOrgForLimits(session.user.orgId, tx);

      const limit = await checkCaseLimit(session.user.orgId, plan, tx);
      if (!limit.allowed) throw new PlanLimitError(limit.message!);

      const ref = await nextCaseRef(session.user.orgId, tx);
      const c = await tx.case.create({
        data: {
          orgId: session.user.orgId!,
          ref,
          categories: data.categories,
          province: data.province,
          isUrgent: data.isUrgent || false,
          hasDeceasedInsurance: data.hasDeceasedInsurance || false,
          consentAccepted: data.consentAccepted,
          consentDate: data.consentAccepted ? new Date() : null,
          deceased: {
            create: {
              fullName: data.deceasedName,
              deathDate: data.deathDate ? new Date(data.deathDate) : null,
              dni: data.deceasedDni,
            },
          },
          contact: {
            create: {
              fullName: data.contactName,
              phone: data.contactPhone,
              email: data.contactEmail,
              relationship: data.contactRelationship,
            },
          },
        },
        include: { deceased: true, contact: true },
      });

      const deathDate = data.deathDate ? new Date(data.deathDate) : new Date();

      if (caseTemplateId) {
        // Apply the chosen template instead of auto-checklist
        const tpl = await tx.caseTemplate.findFirst({
          where: { id: caseTemplateId, orgId: session.user.orgId! },
          include: { tasks: { orderBy: { sortOrder: "asc" } } },
        });
        if (tpl) {
          for (let i = 0; i < tpl.tasks.length; i++) {
            const t = tpl.tasks[i];
            const deadline = t.deadlineOffsetDays
              ? new Date(deathDate.getTime() + t.deadlineOffsetDays * 86400000)
              : null;
            const deadlines = t.deadlineOffsetDays
              ? calculateTaskDeadlines(deathDate, null, t.title)
              : { blockedUntil: null, blockReason: null };
            await tx.task.create({
              data: {
                caseId: c.id,
                category: t.category,
                title: t.title,
                description: t.description ?? null,
                sortOrder: i,
                deadline,
                blockedUntil: deadlines.blockedUntil ?? null,
                blockReason: deadlines.blockReason ?? null,
                status: (deadlines.blockedUntil && deadlines.blockedUntil > new Date()
                  ? "BLOCKED"
                  : "PENDING") as "BLOCKED" | "PENDING",
              },
            });
          }
        }
      } else {
        // Auto-generate tasks from checklist rules with deadlines
        const tasks = getChecklistForCategories(data.categories);
        for (const task of tasks) {
          const deadlines = calculateTaskDeadlines(deathDate, task.docTag, task.title);
          await tx.task.create({
            data: {
              caseId: c.id,
              category: task.category,
              title: task.title,
              description: task.description,
              sortOrder: task.sortOrder,
              docTag: task.docTag,
              blockedUntil: deadlines.blockedUntil,
              deadline: deadlines.deadline,
              blockReason: deadlines.blockReason,
              status: deadlines.blockedUntil && deadlines.blockedUntil > new Date() ? "BLOCKED" : "PENDING",
            },
          });
        }
      }

      // Update usage record
      const month = new Date().toISOString().slice(0, 7);
      await tx.usageRecord.upsert({
        where: { orgId_month: { orgId: session.user.orgId!, month } },
        create: { orgId: session.user.orgId!, month, casesCreated: 1 },
        update: { casesCreated: { increment: 1 } },
      });

      return c;
    });

    // Reintento acotado ante colisión de referencia con un alta simultánea.
    const MAX_REF_ATTEMPTS = 5;
    let newCase: Awaited<ReturnType<typeof createCaseTransaction>> | null = null;

    for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt++) {
      try {
        newCase = await createCaseTransaction();
        break;
      } catch (err) {
        if (err instanceof PlanLimitError) {
          return NextResponse.json({ error: err.message }, { status: 403 });
        }
        if (isUniqueRefConflict(err) && attempt < MAX_REF_ATTEMPTS - 1) continue;
        throw err;
      }
    }

    if (!newCase) {
      return NextResponse.json(
        { error: "No se pudo asignar una referencia única al expediente. Inténtalo de nuevo." },
        { status: 409 },
      );
    }

    const ref = newCase.ref;

    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: newCase.id,
      action: "case.created",
      details: `Expediente ${ref} creado`,
    });

    triggerWorkflow({
      type: "CASE_CREATED",
      orgId: session.user.orgId,
      caseId: newCase.id,
      userId: session.user.id,
      // Un expediente se crea una vez: su id identifica el hecho de forma
      // estable ante una reentrega, y es distinto para cada alta.
      eventKey: claveDeEvento.expedienteCreado(newCase.id),
    }).catch(console.error);

    const full = await prisma.case.findUnique({
      where: { id: newCase.id },
      include: { deceased: true, contact: true, tasks: true },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Datos invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Create case error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
