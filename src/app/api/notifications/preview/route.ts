import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchBriefingData,
  briefingTotalItems,
  buildBriefingSubject,
  buildBriefingHtml,
} from "@/lib/daily-briefing-builder";
import { classifyCases, buildHtmlDigest } from "@/lib/digest-builder";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXTAUTH_URL || "https://app.heredia.app";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "daily-briefing";
  const orgId = session.user.orgId;
  const now = new Date();

  if (type === "weekly-digest") {
    const cases = await prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "ARCHIVED"] },
        deceased: { deathDate: { not: null } },
      },
      select: {
        id: true,
        ref: true,
        province: true,
        deceased: { select: { fullName: true, deathDate: true } },
        contact: { select: { fullName: true, phone: true } },
      },
    });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const digestCases = classifyCases(cases as any, now, 90);
    const html = buildHtmlDigest(digestCases, now, org?.name);
    const subject =
      digestCases.length === 0
        ? "📋 Digest ISD — sin plazos próximos"
        : digestCases.filter((c) => c.urgency === "critical").length > 0
        ? `⚠️ Digest ISD — ${digestCases.filter((c) => c.urgency === "critical").length} expediente${digestCases.filter((c) => c.urgency === "critical").length !== 1 ? "s" : ""} crítico${digestCases.filter((c) => c.urgency === "critical").length !== 1 ? "s" : ""}`
        : `📋 Digest ISD — ${digestCases.length} expediente${digestCases.length !== 1 ? "s" : ""} próximo${digestCases.length !== 1 ? "s" : ""}`;

    return NextResponse.json({
      subject,
      html,
      totalItems: digestCases.length,
      wouldSend: digestCases.length > 0,
    });
  }

  if (type !== "daily-briefing") {
    return NextResponse.json({ error: "Tipo no soportado" }, { status: 400 });
  }

  const data = await fetchBriefingData({
    orgId,
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
