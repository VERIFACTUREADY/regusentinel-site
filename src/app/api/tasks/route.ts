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
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

  const conditions: Record<string, unknown>[] = [
    { case: { orgId: session.user.orgId, deletedAt: null } },
  ];

  if (assignee === "me") {
    conditions.push({ assigneeId: session.user.id });
  } else if (assignee === "unassigned") {
    conditions.push({ assigneeId: null });
  } else if (assignee) {
    conditions.push({ assigneeId: assignee });
  }

  if (status) {
    const statuses = status.split(",");
    conditions.push(
      statuses.length === 1
        ? { status: statuses[0] }
        : { status: { in: statuses } }
    );
  }

  if (category) conditions.push({ category });

  const where = { AND: conditions };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where: where as any,
      include: {
        case: { select: { id: true, ref: true, isUrgent: true } },
        assignee: { select: { id: true, name: true, email: true } },
        _count: { select: { notes: true } },
        dependsOn: { select: { id: true, title: true, status: true } },
      },
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where: where as any }),
  ]);

  return NextResponse.json({ tasks, total, page, limit });
}
