import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("casetemplates.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const tpl = await prisma.caseTemplate.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!tpl) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(tpl);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("casetemplates.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const tpl = await prisma.caseTemplate.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
  });
  if (!tpl) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const { name, description, categories, isDefault, tasks } = body;

  const updated = await prisma.$transaction(async (tx) => {
    if (tasks !== undefined) {
      await tx.caseTemplateTask.deleteMany({ where: { templateId: params.id } });
      if (tasks.length > 0) {
        await tx.caseTemplateTask.createMany({
          data: tasks.map((t: any, i: number) => ({
            templateId: params.id,
            category: t.category,
            title: t.title?.trim(),
            description: t.description?.trim() || null,
            deadlineOffsetDays: t.deadlineOffsetDays ? Number(t.deadlineOffsetDays) : null,
            sortOrder: i,
          })),
        });
      }
    }

    return tx.caseTemplate.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(categories !== undefined && { categories }),
        ...(isDefault !== undefined && { isDefault }),
      },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "casetemplate.updated",
    details: `Plantilla "${updated.name}" actualizada`,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("casetemplates.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const tpl = await prisma.caseTemplate.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
  });
  if (!tpl) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.caseTemplate.delete({ where: { id: params.id } });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "casetemplate.deleted",
    details: `Plantilla "${tpl.name}" eliminada`,
  });

  return NextResponse.json({ success: true });
}
