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
  if (!hasPermission(session.user.role, "workflow.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "30")));
  const status = url.searchParams.get("status");
  const ruleId = url.searchParams.get("ruleId");

  const where: Record<string, unknown> = {
    rule: { orgId: session.user.orgId },
  };
  if (status) where.status = status;
  if (ruleId) where.ruleId = ruleId;

  const [logs, total] = await Promise.all([
    prisma.workflowLog.findMany({
      where: where as any,
      include: {
        rule: { select: { id: true, name: true } },
        case: { select: { id: true, ref: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.workflowLog.count({ where: where as any }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
