import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateChecklist } from "@/lib/autopilot";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const auth = await requireOrgPermission("autopilot.run");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const body = await req.json();
  const { caseId } = body;

  const c = await prisma.case.findFirst({
    where: { id: caseId, orgId: session.user.orgId },
    include: { deceased: true, contact: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const checklist = await generateChecklist(c, session.user.id);

  const deathDate = c.deceased?.deathDate ? new Date(c.deceased.deathDate) : null;

  const taskData = checklist.map((item) => {
    let deadline: Date | null = null;
    if (deathDate && item.deadlineOffsetDays) {
      deadline = new Date(deathDate.getTime() + item.deadlineOffsetDays * 24 * 60 * 60 * 1000);
    }
    return {
      caseId,
      category: item.category,
      title: item.title,
      description: item.description,
      sortOrder: item.sortOrder,
      deadline,
    };
  });

  await prisma.task.createMany({ data: taskData });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId,
    action: "autopilot.checklist_generated",
    details: `${taskData.length} tareas generadas por autopilot`,
  });

  return NextResponse.json({ count: taskData.length });
}
