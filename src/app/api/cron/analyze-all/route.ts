import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeCase } from "@/lib/case-analyzer";
import { validateCronSecret } from "@/lib/cron-auth";

// This endpoint is called by Vercel Cron / external scheduler.
// Protect with CRON_SECRET env var (set in Vercel project settings).

// How many cases to analyze per cron run (to stay within serverless timeout)
const BATCH_SIZE = 15;

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";

  // Find open cases not analyzed in the last 23h (slight buffer from 24h)
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000);
  const recentLogs = await prisma.promptLog.findMany({
    where: {
      action: "analyze_case",
      createdAt: { gte: cutoff },
    },
    select: { caseId: true },
    distinct: ["caseId"],
  });
  const recentIds = new Set(recentLogs.map((l) => l.caseId).filter(Boolean) as string[]);

  // Get all orgs with open cases
  const openCases = await prisma.case.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
    },
    select: { id: true, ref: true, orgId: true },
    orderBy: { updatedAt: "asc" },
    take: BATCH_SIZE * 3,
  });

  const toAnalyze = openCases
    .filter((c) => !recentIds.has(c.id))
    .slice(0, BATCH_SIZE);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldAnalyze: toAnalyze.length,
      totalOpen: openCases.length,
      recentlyAnalyzed: recentIds.size,
    });
  }

  // Find a system user per org for logging (use first admin/owner)
  const orgIds = Array.from(new Set(toAnalyze.map((c) => c.orgId)));
  const adminUsers = await prisma.membership.findMany({
    where: { orgId: { in: orgIds }, role: { in: ["OWNER", "MANAGER"] } },
    select: { orgId: true, userId: true },
    distinct: ["orgId"],
  });
  const orgUserMap = Object.fromEntries(adminUsers.map((m) => [m.orgId, m.userId]));

  const results: { caseId: string; ref: string; status: "ok" | "error"; healthScore?: number }[] = [];

  for (const c of toAnalyze) {
    const userId = orgUserMap[c.orgId];
    if (!userId) {
      results.push({ caseId: c.id, ref: c.ref, status: "error" });
      continue;
    }
    try {
      const analysis = await analyzeCase({ caseId: c.id, userId });
      results.push({ caseId: c.id, ref: c.ref, status: "ok", healthScore: analysis.healthScore });
    } catch {
      results.push({ caseId: c.id, ref: c.ref, status: "error" });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(`[cron/analyze-all] analyzed=${ok} failed=${failed} skipped=${openCases.length - toAnalyze.length}`);

  return NextResponse.json({
    analyzed: ok,
    failed,
    skipped: openCases.length - toAnalyze.length,
    total: openCases.length,
    results,
  });
}

// Allow Vercel to call this as POST too (for Vercel Cron jobs)
export const POST = GET;
