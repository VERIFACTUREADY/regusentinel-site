import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const url = new URL(req.url);
  const assignee = url.searchParams.get("assignee");
  const months = Math.min(parseInt(url.searchParams.get("months") || "6"), 12);

  const now = new Date();
  const pastLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const futureLimit = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);

  const conditions: Record<string, unknown>[] = [
    { case: { orgId: session.user.orgId, deletedAt: null } },
    { deadline: { gte: pastLimit, lte: futureLimit } },
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
    if (!t.deadline || t.status === "DONE") continue;
    const dl = new Date(t.deadline).getTime();
    if (dl < now.getTime()) { overdue++; continue; }
    if (dl <= weekEnd) thisWeek++;
    if (dl <= monthEnd) thisMonth++;
  }

  return NextResponse.json({ tasks, overdue, thisWeek, thisMonth });
}
