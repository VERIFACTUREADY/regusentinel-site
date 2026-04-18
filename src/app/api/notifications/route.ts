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
  if (!hasPermission(session.user.role, "audit.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);
  const kind = url.searchParams.get("kind");
  const channel = url.searchParams.get("channel");
  const status = url.searchParams.get("status");

  const where: Record<string, unknown> = { orgId: session.user.orgId };
  if (kind) where.kind = kind;
  if (channel) where.channel = channel;
  if (status) where.status = status;

  const [logs, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where: where as any,
      include: {
        case: { select: { ref: true, deceased: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notificationLog.count({ where: where as any }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
