import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "casetemplates.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const templates = await prisma.caseTemplate.findMany({
    where: { orgId: session.user.orgId },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "casetemplates.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, categories, isDefault, tasks } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: "La plantilla debe tener al menos una tarea" }, { status: 400 });
  }

  const template = await prisma.caseTemplate.create({
    data: {
      orgId: session.user.orgId,
      name: name.trim(),
      description: description?.trim() || null,
      categories: categories ?? [],
      isDefault: isDefault ?? false,
      tasks: {
        createMany: {
          data: tasks.map((t: any, i: number) => ({
            category: t.category,
            title: t.title?.trim(),
            description: t.description?.trim() || null,
            deadlineOffsetDays: t.deadlineOffsetDays ? Number(t.deadlineOffsetDays) : null,
            sortOrder: i,
          })),
        },
      },
    },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "casetemplate.created",
    details: `Plantilla "${template.name}" creada con ${template.tasks.length} tareas`,
  });

  return NextResponse.json(template, { status: 201 });
}
