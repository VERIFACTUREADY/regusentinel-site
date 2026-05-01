import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildHtmlDigest, classifyCases } from "@/lib/digest-builder";
import { parsePrefs } from "@/app/api/settings/notifications/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secretParam = req.nextUrl.searchParams.get("secret");
  const provided = authHeader?.replace("Bearer ", "") || secretParam;

  if (CRON_SECRET && provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const now = new Date();

  // Only send on Mondays unless forced
  const forceDay = req.nextUrl.searchParams.get("force") === "1";
  if (!forceDay && now.getDay() !== 1) {
    return NextResponse.json({ skipped: true, reason: "Not Monday" });
  }

  // Get all orgs with active subscriptions
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  const results: { orgId: string; orgName: string; sent: number; skipped: boolean; error?: string }[] = [];

  for (const org of orgs) {
    try {
      const cases = await prisma.case.findMany({
        where: {
          orgId: org.id,
          deletedAt: null,
          status: { notIn: ["CLOSED", "ARCHIVED"] },
          deceased: {
            deathDate: { gte: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) },
          },
        },
        select: {
          id: true,
          ref: true,
          province: true,
          deceased: { select: { fullName: true, deathDate: true } },
          contact: { select: { fullName: true, phone: true } },
        },
      });

      const digestCases = classifyCases(cases as any, now, 90);

      // Only send if there are urgent/warning cases
      const actionable = digestCases.filter((c) => c.urgency === "critical" || c.urgency === "warning");
      if (actionable.length === 0) {
        results.push({ orgId: org.id, orgName: org.name, sent: 0, skipped: true });
        continue;
      }

      // Get OWNER/MANAGER emails for this org, filtered by notification prefs
      const admins = await prisma.membership.findMany({
        where: { orgId: org.id, role: { in: ["OWNER", "MANAGER"] } },
        select: { notifPrefs: true, user: { select: { email: true, name: true } } },
      });

      const emails = admins
        .filter((m) => parsePrefs(m.notifPrefs).weeklyDigest)
        .map((m) => m.user.email)
        .filter(Boolean) as string[];
      if (emails.length === 0) {
        results.push({ orgId: org.id, orgName: org.name, sent: 0, skipped: true });
        continue;
      }

      const html = buildHtmlDigest(digestCases, now, org.name);
      const critical = digestCases.filter((c) => c.urgency === "critical").length;
      const subject = critical > 0
        ? `⚠️ ${critical} expediente${critical !== 1 ? "s" : ""} con ISD urgente — Digest BARITUR PRO`
        : `📋 Digest semanal de plazos ISD — BARITUR PRO`;

      if (!dryRun) {
        for (const email of emails) {
          await sendEmail({ to: email, subject, html });
        }
      }

      results.push({ orgId: org.id, orgName: org.name, sent: dryRun ? 0 : emails.length, skipped: false });
    } catch (err: any) {
      results.push({ orgId: org.id, orgName: org.name, sent: 0, skipped: false, error: String(err?.message ?? err) });
    }
  }

  const totalSent = results.reduce((acc, r) => acc + r.sent, 0);
  const totalOrgs = results.filter((r) => !r.skipped).length;
  console.log(`[cron/digest-isd] orgs=${totalOrgs} emails=${totalSent} dryRun=${dryRun}`);

  return NextResponse.json({ dryRun, orgs: results, totalSent, totalOrgs });
}

export const POST = GET;
