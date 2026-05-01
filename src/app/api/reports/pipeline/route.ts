import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = [
  "INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS",
  "READY_TO_SEND", "SENT", "FOLLOW_UP",
] as const;

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Recepción",
  VALIDATION: "Validación",
  IN_PROGRESS: "En trámite",
  PENDING_DOCS: "Docs. pendientes",
  READY_TO_SEND: "Listo para enviar",
  SENT: "Enviado",
  FOLLOW_UP: "Seguimiento",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const orgId = session.user.orgId;
  const now = Date.now();

  // Active cases: status, createdAt, updatedAt
  const activeCases = await prisma.case.findMany({
    where: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
    select: { status: true, createdAt: true, updatedAt: true },
  });

  // Closed/archived cases in last 18 months: resolution time
  const since18m = new Date(now - 18 * 30 * 24 * 60 * 60 * 1000);
  const closedCases = await prisma.case.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: { in: ["CLOSED", "ARCHIVED"] },
      closedAt: { gte: since18m },
    },
    select: { createdAt: true, closedAt: true },
  });

  // Monthly creation + closure for throughput (12 months)
  const since12m = new Date(now - 12 * 30 * 24 * 60 * 60 * 1000);
  const allRecentCases = await prisma.case.findMany({
    where: {
      orgId,
      deletedAt: null,
      OR: [
        { createdAt: { gte: since12m } },
        { closedAt: { gte: since12m } },
      ],
    },
    select: { createdAt: true, closedAt: true, status: true },
  });

  // ── Stage breakdown ──────────────────────────────────────
  const stageMap: Record<string, { count: number; daysInStage: number[]; totalAge: number[] }> = {};
  for (const s of ACTIVE_STATUSES) {
    stageMap[s] = { count: 0, daysInStage: [], totalAge: [] };
  }

  for (const c of activeCases) {
    const entry = stageMap[c.status];
    if (!entry) continue;
    entry.count++;
    const daysInStage = Math.floor((now - new Date(c.updatedAt).getTime()) / 86400000);
    const totalAge = Math.floor((now - new Date(c.createdAt).getTime()) / 86400000);
    entry.daysInStage.push(daysInStage);
    entry.totalAge.push(totalAge);
  }

  const stages = ACTIVE_STATUSES.map((s) => {
    const e = stageMap[s];
    const sortedInStage = [...e.daysInStage].sort((a, b) => a - b);
    const sortedAge = [...e.totalAge].sort((a, b) => a - b);
    return {
      status: s,
      label: STATUS_LABELS[s] ?? s,
      count: e.count,
      avgDaysInStage: e.daysInStage.length ? Math.round(e.daysInStage.reduce((a, b) => a + b, 0) / e.daysInStage.length) : null,
      medianDaysInStage: median(sortedInStage) || null,
      p90DaysInStage: percentile(sortedInStage, 90) || null,
      avgTotalAge: e.totalAge.length ? Math.round(e.totalAge.reduce((a, b) => a + b, 0) / e.totalAge.length) : null,
      // Staleness: cases stuck > 30d in stage
      stale30d: e.daysInStage.filter((d) => d > 30).length,
      stale60d: e.daysInStage.filter((d) => d > 60).length,
    };
  });

  // ── Resolution time distribution ────────────────────────
  const resolutionDays = closedCases
    .filter((c) => c.closedAt)
    .map((c) => Math.floor((new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()) / 86400000))
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);

  const resolutionStats = {
    count: resolutionDays.length,
    avg: resolutionDays.length ? Math.round(resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length) : null,
    median: median(resolutionDays) || null,
    p25: percentile(resolutionDays, 25) || null,
    p75: percentile(resolutionDays, 75) || null,
    p90: percentile(resolutionDays, 90) || null,
    // Distribution buckets: 0-30, 31-60, 61-90, 91-120, 121-180, 181+
    buckets: [
      { label: "0–30d", count: resolutionDays.filter((d) => d <= 30).length },
      { label: "31–60d", count: resolutionDays.filter((d) => d > 30 && d <= 60).length },
      { label: "61–90d", count: resolutionDays.filter((d) => d > 60 && d <= 90).length },
      { label: "91–120d", count: resolutionDays.filter((d) => d > 90 && d <= 120).length },
      { label: "121–180d", count: resolutionDays.filter((d) => d > 120 && d <= 180).length },
      { label: "181d+", count: resolutionDays.filter((d) => d > 180).length },
    ],
  };

  // ── Monthly throughput ───────────────────────────────────
  const monthlyThroughput: { month: string; created: number; closed: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const label = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
    const created = allRecentCases.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return t >= mStart.getTime() && t < mEnd.getTime();
    }).length;
    const closed = allRecentCases.filter((c) => {
      if (!c.closedAt) return false;
      const t = new Date(c.closedAt).getTime();
      return t >= mStart.getTime() && t < mEnd.getTime();
    }).length;
    monthlyThroughput.push({ month: label, created, closed });
  }

  // ── Active case total + overall WIP ─────────────────────
  const totalActive = activeCases.length;
  const totalStale30d = stages.reduce((a, s) => a + s.stale30d, 0);

  return NextResponse.json({
    stages,
    resolutionStats,
    monthlyThroughput,
    totalActive,
    totalStale30d,
  });
}
