import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const orgId = session.user.orgId;
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter"); // "unread" | null

  const whereCase = {
    orgId,
    deletedAt: null as null,
    ...(filter === "unread"
      ? { portalMessages: { some: { fromFamily: true, readAt: null } } }
      : { portalMessages: { some: {} } }),
  };

  const cases = await prisma.case.findMany({
    where: whereCase,
    select: {
      id: true,
      ref: true,
      status: true,
      deceased: { select: { fullName: true } },
      contact: { select: { fullName: true } },
      portalMessages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fromFamily: true,
          authorName: true,
          content: true,
          readAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const conversations = cases
    .map((c) => {
      const unreadCount = c.portalMessages.filter((m) => m.fromFamily && !m.readAt).length;
      const lastMsg = c.portalMessages[c.portalMessages.length - 1] ?? null;
      return {
        caseId: c.id,
        caseRef: c.ref,
        caseStatus: c.status,
        deceasedName: c.deceased?.fullName ?? null,
        contactName: c.contact?.fullName ?? null,
        unreadCount,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              fromFamily: lastMsg.fromFamily,
              createdAt: lastMsg.createdAt,
            }
          : null,
        messageCount: c.portalMessages.length,
      };
    })
    // Sort: unread first, then by last message date
    .sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      if (!a.lastMessage || !b.lastMessage) return 0;
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return NextResponse.json({ conversations, totalUnread, total: conversations.length });
}
