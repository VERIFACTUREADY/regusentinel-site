import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { createCaseSchema } from "@/lib/validations";
import { getChecklistForCategories } from "@/lib/checklist-rules";
import { logAudit } from "@/lib/audit";
import { calculateTaskDeadlines } from "@/lib/deadline-engine";
import { triggerWorkflow } from "@/lib/workflow-engine";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const urgent = url.searchParams.get("urgent");
  const province = url.searchParams.get("province");
  const isdExpiring = url.searchParams.get("isdExpiring"); // "30" | "60" = days threshold
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

  return NextResponse.json({ cases, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.create")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { caseTemplateId } = body;
    const data = createCaseSchema.parse(body);

    // Check plan limits (includedCases per mes; excedentes facturados aparte).
    const sub = await prisma.subscription.findUnique({ where: { orgId: session.user.orgId } });
    if (sub?.plan === "INICIA") {
      const month = new Date().toISOString().slice(0, 7);
      const usage = await prisma.usageRecord.findUnique({
        where: { orgId_month: { orgId: session.user.orgId, month } },
      });
      if (usage && usage.casesCreated >= 15) {
        return NextResponse.json(
          { error: "Limite de expedientes alcanzado para el plan Inicia (15/mes). Actualiza a Despacho." },
          { status: 403 }
        );
      }
    }

    // Generate ref
    const count = await prisma.case.count({ where: { orgId: session.user.orgId } });
    const ref = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const newCase = await prisma.$transaction(async (tx) => {
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
