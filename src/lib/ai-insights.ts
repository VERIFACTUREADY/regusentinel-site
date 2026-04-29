import { prisma } from "./prisma";

export interface AiInsightsData {
  thirtyDays: {
    casesAnalyzed: number;
    chatMessages: number;
    isdCalculations: number;
    estimatedHoursSaved: number;
  };
  riskiestCases: {
    caseId: string;
    ref: string;
    deceasedName: string | null;
    healthScore: number;
    status: string;
    summary: string;
    analyzedAt: string;
  }[];
  totalCasesAnalyzed: number;
  averageScore: number | null;
}

/**
 * Time savings (rough estimates per AI feature use):
 * - Case analysis: ~30 min of manual review
 * - ISD calculation: ~45 min of manual computation + verification
 * - Chat exchange: ~5 min of doc/portal lookup
 */
const TIME_SAVED_MIN_PER_ANALYSIS = 30;
const TIME_SAVED_MIN_PER_ISD = 45;
const TIME_SAVED_MIN_PER_CHAT = 5;

export async function getAiInsights(orgId: string): Promise<AiInsightsData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [analyses30d, chats30d, isd30d, allAnalyses] = await Promise.all([
    prisma.promptLog.count({
      where: {
        case: { orgId, deletedAt: null },
        action: "analyze_case",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.promptLog.count({
      where: {
        case: { orgId, deletedAt: null },
        action: "case_chat",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.auditLog.count({
      where: {
        orgId,
        action: "case.isd_calculated",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.promptLog.findMany({
      where: {
        case: { orgId, deletedAt: null },
        action: "analyze_case",
      },
      include: {
        case: {
          select: {
            id: true,
            ref: true,
            status: true,
            deletedAt: true,
            deceased: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  // Deduplicate: keep only the latest analysis per case
  const latestByCase = new Map<string, typeof allAnalyses[0]>();
  for (const log of allAnalyses) {
    if (!log.caseId) continue;
    if (!latestByCase.has(log.caseId)) {
      latestByCase.set(log.caseId, log);
    }
  }

  const analyzedCases: AiInsightsData["riskiestCases"] = [];
  let scoreSum = 0;
  let scoreCount = 0;

  for (const log of Array.from(latestByCase.values())) {
    if (!log.case || log.case.deletedAt) continue;
    if (log.case.status === "CLOSED" || log.case.status === "ARCHIVED") continue;
    try {
      const parsed = JSON.parse(log.response);
      if (typeof parsed.healthScore === "number") {
        scoreSum += parsed.healthScore;
        scoreCount += 1;
        analyzedCases.push({
          caseId: log.case.id,
          ref: log.case.ref,
          deceasedName: log.case.deceased?.fullName || null,
          healthScore: parsed.healthScore,
          status: parsed.status || "good",
          summary: String(parsed.summary || "").slice(0, 200),
          analyzedAt: log.createdAt.toISOString(),
        });
      }
    } catch {
      // ignore malformed entries
    }
  }

  const riskiest = analyzedCases
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 5);

  const estimatedMinutesSaved =
    analyses30d * TIME_SAVED_MIN_PER_ANALYSIS +
    isd30d * TIME_SAVED_MIN_PER_ISD +
    chats30d * TIME_SAVED_MIN_PER_CHAT;

  return {
    thirtyDays: {
      casesAnalyzed: analyses30d,
      chatMessages: chats30d,
      isdCalculations: isd30d,
      estimatedHoursSaved: Math.round((estimatedMinutesSaved / 60) * 10) / 10,
    },
    riskiestCases: riskiest,
    totalCasesAnalyzed: scoreCount,
    averageScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
  };
}
