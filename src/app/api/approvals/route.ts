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
  if (!hasPermission(session.user.role, "autopilot.approve")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);

  const where: Record<string, unknown> = { case: { orgId: session.user.orgId } };
  if (status) where.status = status;

  const [approvals, total] = await Promise.all([
    prisma.approval.findMany({
      where: where as any,
      include: {
        case: { select: { ref: true, deceased: { select: { fullName: true } } } },
        task: { select: { title: true } },
        reviewer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.approval.count({ where: where as any }),
  ]);

  return NextResponse.json({ approvals, total, page, limit });
}
