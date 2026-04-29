import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { analyzeCase } from "@/lib/case-analyzer";

// Analyze up to this many cases per bulk run to avoid timeouts
const MAX_CASES_PER_RUN = 20;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "autopilot.run")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Find open cases not analyzed in the last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentlyAnalyzedLogs = await prisma.promptLog.findMany({
    where: {
      case: { orgId: session.user.orgId, deletedAt: null },
      action: "analyze_case",
      createdAt: { gte: oneDayAgo },
    },
    select: { caseId: true },
    distinct: ["caseId"],
  });
  const recentIds = new Set(recentlyAnalyzedLogs.map((l) => l.caseId).filter(Boolean) as string[]);

  const openCases = await prisma.case.findMany({
    where: {
      orgId: session.user.orgId,
      deletedAt: null,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
    },
    select: { id: true, ref: true },
    orderBy: { updatedAt: "asc" },
    take: MAX_CASES_PER_RUN * 3,
  });

  // Prioritize cases not recently analyzed
  const toAnalyze = openCases
    .filter((c) => !recentIds.has(c.id))
    .slice(0, MAX_CASES_PER_RUN);

  const results: { caseId: string; ref: string; status: "ok" | "error"; healthScore?: number }[] = [];

  for (const c of toAnalyze) {
    try {
      const analysis = await analyzeCase({ caseId: c.id, userId: session.user.id });
      results.push({ caseId: c.id, ref: c.ref, status: "ok", healthScore: analysis.healthScore });
    } catch {
      results.push({ caseId: c.id, ref: c.ref, status: "error" });
    }
  }

  const successful = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;
  const skipped = openCases.length - toAnalyze.length;

  return NextResponse.json({
    analyzed: successful,
    failed,
    skipped,
    total: openCases.length,
    results,
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const openCount = await prisma.case.count({
    where: {
      orgId: session.user.orgId,
      deletedAt: null,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
    },
  });

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const analyzedTodayCount = await prisma.promptLog.count({
    where: {
      case: { orgId: session.user.orgId, deletedAt: null },
      action: "analyze_case",
      createdAt: { gte: oneDayAgo },
    },
  });

  return NextResponse.json({ openCount, analyzedTodayCount });
}
