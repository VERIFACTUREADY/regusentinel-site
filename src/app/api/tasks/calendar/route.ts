import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireOrgPermission("tasks.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month"); // "2026-04"
  const assignee = url.searchParams.get("assignee");
  const category = url.searchParams.get("category");

  const now = new Date();
  const target = monthParam ? new Date(`${monthParam}-01`) : now;
  const year = target.getFullYear();
  const month = target.getMonth();

  // Include a few days before/after for calendar grid edges
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0, 23, 59, 59);

  const conditions: Record<string, unknown>[] = [
    { case: { orgId: session.user.orgId, deletedAt: null } },
    {
      OR: [
        { deadline: { gte: from, lte: to } },
        { dueDate: { gte: from, lte: to } },
      ],
    },
    { status: { notIn: ["DONE", "SKIPPED"] } },
  ];

  if (assignee === "me") conditions.push({ assigneeId: session.user.id });
  else if (assignee) conditions.push({ assigneeId: assignee });
  if (category) conditions.push({ category });

  const tasks = await prisma.task.findMany({
    where: { AND: conditions } as any,
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      deadline: true,
      dueDate: true,
      case: { select: { id: true, ref: true, isUrgent: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
    take: 500,
  });

  // Group by date string "YYYY-MM-DD", preferring deadline over dueDate
  const byDate: Record<string, typeof tasks> = {};
  for (const task of tasks) {
    const date = task.deadline ?? task.dueDate;
    if (!date) continue;
    const key = new Date(date).toISOString().slice(0, 10);
    (byDate[key] ??= []).push(task);
  }

  // Stats relative to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);
  let overdue = 0, thisWeek = 0, thisMonth = 0;
  for (const task of tasks) {
    const date = task.deadline ?? task.dueDate;
    if (!date) continue;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d < today) { overdue++; continue; }
    if (d <= weekEnd) thisWeek++;
    if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()) thisMonth++;
  }

  return NextResponse.json({ byDate, stats: { overdue, thisWeek, thisMonth } });
}
