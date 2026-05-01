import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface NotifPrefs {
  dailyBriefing: boolean;
  weeklyDigest: boolean;
  taskOverdue: boolean;
  portalMessage: boolean;
  isdAlerts: boolean;
}

export const DEFAULT_PREFS: NotifPrefs = {
  dailyBriefing: true,
  weeklyDigest: true,
  taskOverdue: true,
  portalMessage: true,
  isdAlerts: true,
};

export function parsePrefs(raw: unknown): NotifPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS };
  const r = raw as Record<string, unknown>;
  return {
    dailyBriefing: r.dailyBriefing !== false,
    weeklyDigest: r.weeklyDigest !== false,
    taskOverdue: r.taskOverdue !== false,
    portalMessage: r.portalMessage !== false,
    isdAlerts: r.isdAlerts !== false,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, orgId: session.user.orgId },
    select: { notifPrefs: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const prefs = parsePrefs(membership.notifPrefs);
  return NextResponse.json({ prefs });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const incoming = body.prefs as Partial<NotifPrefs> | undefined;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const prefs: NotifPrefs = {
    dailyBriefing: incoming.dailyBriefing !== false,
    weeklyDigest: incoming.weeklyDigest !== false,
    taskOverdue: incoming.taskOverdue !== false,
    portalMessage: incoming.portalMessage !== false,
    isdAlerts: incoming.isdAlerts !== false,
  };

  await prisma.membership.updateMany({
    where: { userId: session.user.id, orgId: session.user.orgId },
    data: { notifPrefs: prefs as unknown as Record<string, boolean> },
  });

  return NextResponse.json({ prefs });
}
