import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireOrgPermission("tasks.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const url = new URL(req.url);
  const assignee = url.searchParams.get("assignee");
  const months = Math.min(parseInt(url.searchParams.get("months") || "6"), 12);

  const now = new Date();
  const pastLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const futureLimit = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);

  const conditions: Record<string, unknown>[] = [
    { case: { orgId: session.user.orgId, deletedAt: null } },
    { OR: [
      { deadline: { gte: pastLimit, lte: futureLimit } },
      { deadline: null, dueDate: { gte: pastLimit, lte: futureLimit } },
    ] },
    { status: { notIn: ["SKIPPED"] } },
  ];

  if (assignee === "me") {
    conditions.push({ assigneeId: session.user.id });
  } else if (assignee && assignee !== "") {
    conditions.push({ assigneeId: assignee });
  }

  const tasks = await prisma.task.findMany({
    where: { AND: conditions } as any,
    include: {
      case: { select: { id: true, ref: true, isUrgent: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { deadline: "asc" },
    take: 200,
  });

  const weekEnd = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const monthEnd = now.getTime() + 30 * 24 * 60 * 60 * 1000;
  let overdue = 0, thisWeek = 0, thisMonth = 0;
  for (const t of tasks) {
    const effective = t.deadline ?? (t as any).dueDate;
    if (!effective || t.status === "DONE") continue;
    const dl = new Date(effective).getTime();
    if (dl < now.getTime()) { overdue++; continue; }
    if (dl <= weekEnd) thisWeek++;
    if (dl <= monthEnd) thisMonth++;
  }

  return NextResponse.json({ tasks, overdue, thisWeek, thisMonth });
}
