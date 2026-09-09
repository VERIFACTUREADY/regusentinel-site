import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { parsePrefs } from "@/lib/notif-prefs";
import {
  fetchBriefingData,
  briefingTotalItems,
  buildBriefingSubject,
  buildBriefingHtml,
} from "@/lib/daily-briefing-builder";
import { validateCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXTAUTH_URL || "https://app.heredia.app";

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const now = new Date();

  const memberships = await prisma.membership.findMany({
    where: { role: { in: ["OWNER", "MANAGER"] } },
    select: {
      orgId: true,
      userId: true,
      notifPrefs: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const results: { userId: string; email: string; sent: boolean; items: number; skipped?: string; error?: string }[] = [];

  for (const m of memberships) {
    const user = m.user;
    if (!user.email) continue;

    const prefs = parsePrefs(m.notifPrefs);
    if (!prefs.dailyBriefing) {
      results.push({ userId: user.id, email: user.email, sent: false, items: 0, skipped: "preference" });
      continue;
    }

    try {
      const data = await fetchBriefingData({
        orgId: m.orgId,
        userId: user.id,
        userName: user.name || user.email.split("@")[0],
        now,
        appUrl: APP_URL,
      });

      const totalItems = briefingTotalItems(data);

      if (totalItems === 0 && data.dueTomorrow.length === 0) {
        results.push({ userId: user.id, email: user.email, sent: false, items: 0 });
        continue;
      }

      const html = buildBriefingHtml(data);
      const subject = buildBriefingSubject(data.overdueTasks.length, data.isdCritical.length, data.dueToday.length);

      if (!dryRun) {
        await sendEmail({ to: user.email, subject, html });
      }

      results.push({ userId: user.id, email: user.email, sent: !dryRun, items: totalItems });
    } catch (err: any) {
      results.push({ userId: user.id, email: user.email, sent: false, items: 0, error: String(err?.message ?? err) });
    }
  }

  const sent = results.filter((r) => r.sent).length;
  console.log(`[cron/daily-briefing] users=${memberships.length} sent=${sent} dryRun=${dryRun}`);
  return NextResponse.json({ dryRun, sent, total: memberships.length, results });
}

export const POST = GET;
