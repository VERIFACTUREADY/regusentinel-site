import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [recentAlerts, unreadCount] = await Promise.all([
    prisma.notificationLog.findMany({
      where: { orgId: session.user.orgId, status: "SENT" },
      select: {
        id: true,
        kind: true,
        recipient: true,
        createdAt: true,
        case: { select: { id: true, ref: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.notificationLog.count({
      where: {
        orgId: session.user.orgId,
        status: "SENT",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return NextResponse.json({ alerts: recentAlerts, unreadCount });
}
