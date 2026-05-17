import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { calculateTaskDeadlines } from "@/lib/deadline-engine";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.create")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { templateId, skipDuplicates = true } = body;

  if (!templateId) {
    return NextResponse.json({ error: "templateId requerido" }, { status: 400 });
  }

  const [caseData, template] = await Promise.all([
    prisma.case.findFirst({
      where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
      include: {
        deceased: { select: { deathDate: true } },
        tasks: { select: { title: true, category: true } },
      },
    }),
    prisma.caseTemplate.findFirst({
      where: { id: templateId, orgId: session.user.orgId },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  if (!caseData) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

  const existingKeys = new Set(
    caseData.tasks.map((t) => `${t.category}::${t.title.trim().toLowerCase()}`)
  );

  const deathDate = caseData.deceased?.deathDate
    ? new Date(caseData.deceased.deathDate)
    : new Date();

  // Determine starting sortOrder
  const maxSort = await prisma.task.aggregate({
    where: { caseId: params.id },
    _max: { sortOrder: true },
  });
  const baseSort = (maxSort._max.sortOrder ?? -1) + 1;

  const tasksToCreate = template.tasks
    .filter((t) => {
      if (!skipDuplicates) return true;
      return !existingKeys.has(`${t.category}::${t.title.trim().toLowerCase()}`);
    })
    .map((t, i) => {
      const deadlines = t.deadlineOffsetDays
        ? calculateTaskDeadlines(deathDate, null, t.title)
        : { deadline: null, blockedUntil: null, blockReason: null };

      // Override with explicit offset if provided
      const deadline = t.deadlineOffsetDays
        ? new Date(deathDate.getTime() + t.deadlineOffsetDays * 86400000)
        : null;

      return {
        caseId: params.id,
        category: t.category,
        title: t.title,
        description: t.description ?? null,
        sortOrder: baseSort + i,
        deadline,
        blockedUntil: deadlines.blockedUntil ?? null,
        blockReason: deadlines.blockReason ?? null,
        status: (deadlines.blockedUntil && deadlines.blockedUntil > new Date()
          ? "BLOCKED"
          : "PENDING") as "BLOCKED" | "PENDING",
      };
    });

  if (tasksToCreate.length === 0) {
    return NextResponse.json({ added: 0, message: "Todas las tareas ya existen en el expediente" });
  }

  await prisma.task.createMany({ data: tasksToCreate });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: params.id,
    action: "case.template_applied",
    details: `Plantilla "${template.name}" aplicada — ${tasksToCreate.length} tareas añadidas`,
  });

  return NextResponse.json({ added: tasksToCreate.length, templateName: template.name });
}
