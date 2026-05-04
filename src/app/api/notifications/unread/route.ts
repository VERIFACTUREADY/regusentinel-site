import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const orgId = session.user.orgId;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isdMinDeathDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const isdMaxDeathDate = new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000); // 180-30 = 150 days ago

  const [storedAlerts, overdueTasksRaw, blockedTasksRaw, isdCasesRaw, unreadPortalRaw] = await Promise.all([
    // Stored notification logs (email alerts sent by cron)
    prisma.notificationLog.findMany({
      where: { orgId, status: "sent", createdAt: { gte: sevenDaysAgo } },
      select: {
        id: true,
        kind: true,
        recipient: true,
        createdAt: true,
        case: { select: { id: true, ref: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    // Overdue tasks (deadline passed, not completed)
    prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        status: { notIn: ["DONE", "SKIPPED"] },
        OR: [{ deadline: { lt: now } }, { deadline: null, dueDate: { lt: now } }],
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        dueDate: true,
        case: { select: { id: true, ref: true } },
      },
      orderBy: { deadline: "asc" },
      take: 5,
    }),
    // Tasks blocked for > 7 days
    prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null },
        status: "BLOCKED",
        updatedAt: { lte: sevenDaysAgo },
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        case: { select: { id: true, ref: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 5,
    }),
    // Cases with ISD deadline < 30 days (not yet flagged by cron)
    prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "ARCHIVED"] },
        deceased: { deathDate: { gte: isdMinDeathDate, lte: isdMaxDeathDate } },
      },
      select: {
        id: true,
        ref: true,
        deceased: { select: { deathDate: true } },
      },
      take: 5,
    }),
    // Unread portal messages from families
    prisma.portalMessage.findMany({
      where: {
        case: { orgId, deletedAt: null },
        fromFamily: true,
        readAt: null,
      },
      select: {
        id: true,
        createdAt: true,
        authorName: true,
        case: { select: { id: true, ref: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Build synthetic live alert objects (same shape as storedAlerts)
  const liveAlerts: typeof storedAlerts = [];

  for (const t of overdueTasksRaw) {
    liveAlerts.push({
      id: `overdue:${t.id}`,
      kind: "TASK_OVERDUE",
      recipient: t.title,
      createdAt: t.deadline ?? (t as any).dueDate ?? now,
      case: t.case,
    } as any);
  }

  for (const t of blockedTasksRaw) {
    liveAlerts.push({
      id: `blocked:${t.id}`,
      kind: "TASK_STUCK",
      recipient: t.title,
      createdAt: t.updatedAt,
      case: t.case,
    } as any);
  }

  for (const c of isdCasesRaw) {
    if (!c.deceased?.deathDate) continue;
    const daysLeft = 180 - Math.floor((now.getTime() - c.deceased.deathDate.getTime()) / (1000 * 60 * 60 * 24));
    liveAlerts.push({
      id: `isd:${c.id}`,
      kind: daysLeft <= 7 ? "ISD_7D" : "ISD_30D",
      recipient: `${daysLeft}d restantes`,
      createdAt: now,
      case: { id: c.id, ref: c.ref },
    } as any);
  }

  for (const msg of unreadPortalRaw) {
    liveAlerts.push({
      id: `portal:${msg.id}`,
      kind: "PORTAL_MESSAGE",
      recipient: msg.authorName || "Familia",
      createdAt: msg.createdAt,
      case: msg.case,
    } as any);
  }

  // Merge: live alerts first (sorted by urgency via kind), then stored
  const URGENCY_ORDER: Record<string, number> = {
    TASK_OVERDUE: 0,
    ISD_7D: 1,
    TASK_STUCK: 2,
    PORTAL_MESSAGE: 3,
    ISD_30D: 4,
  };
  liveAlerts.sort((a, b) => (URGENCY_ORDER[a.kind] ?? 9) - (URGENCY_ORDER[b.kind] ?? 9));

  const allAlerts = [...liveAlerts, ...storedAlerts].slice(0, 15);
  const unreadCount = liveAlerts.length + storedAlerts.length;

  return NextResponse.json({ alerts: allAlerts, unreadCount });
}
