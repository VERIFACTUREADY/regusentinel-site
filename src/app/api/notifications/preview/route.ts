import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  fetchBriefingData,
  briefingTotalItems,
  buildBriefingSubject,
  buildBriefingHtml,
} from "@/lib/daily-briefing-builder";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXTAUTH_URL || "https://app.baritur.pro";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "daily-briefing";

  if (type !== "daily-briefing") {
    return NextResponse.json({ error: "Tipo no soportado" }, { status: 400 });
  }

  const now = new Date();
  const data = await fetchBriefingData({
    orgId: session.user.orgId,
    userId: session.user.id,
    userName: session.user.name || session.user.email?.split("@")[0] || "Equipo",
    now,
    appUrl: APP_URL,
  });

  const totalItems = briefingTotalItems(data);
  const subject = buildBriefingSubject(data.overdueTasks.length, data.isdCritical.length, data.dueToday.length);
  const html = buildBriefingHtml(data);

  return NextResponse.json({
    subject,
    html,
    totalItems,
    wouldSend: totalItems > 0 || data.dueTomorrow.length > 0,
  });
}
