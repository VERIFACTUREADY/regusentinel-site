import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOnboardingState } from "@/lib/onboarding";
import { OnboardingPanel } from "@/components/dashboard/onboarding-panel";
import { DemoHighlights } from "@/components/dashboard/demo-highlights";
import { MyTasksWidget } from "@/components/dashboard/my-tasks-widget";
import { UsageWidget } from "@/components/dashboard/usage-widget";
import { DeadlineCalendar } from "@/components/dashboard/deadline-calendar";
import { DEMO_ORG_SLUG } from "@/lib/demo-data";
import { CASE_STATUS_COLORS } from "@/lib/constants";
import { getAiInsights, type AiInsightsData } from "@/lib/ai-insights";
import Link from "next/link";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[dashboard] query failed:", err);
    return fallback;
  }
}

export default async function DashboardPage() {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }
  const orgId = session?.user?.orgId;
  if (!session || !orgId) return <p>No org</p>;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const userId = session.user.id;

  const calMonth = now.getMonth();
  const calYear = now.getFullYear();
  const calFrom = new Date(calYear, calMonth, 1);
  const calTo = new Date(calYear, calMonth + 1, 0, 23, 59, 59);
  const weekEnd = new Date(now.getTime() + 7 * 86400000);

  const isdAlertThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [activeCases, pendingTasks, blockedTasks, readyTasks, closedThisMonth, pendingApprovals, recentCases, recentLogs, upcomingDeadlines, onboarding, org, myTasks, calendarTasks, criticalBlockedTasks, teamWorkload, members] = await Promise.all([
    safe(() => prisma.case.count({
      where: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
    }), 0),
    safe(() => prisma.task.count({
      where: { case: { orgId, deletedAt: null }, status: { in: ["PENDING", "IN_PROGRESS"] } },
    }), 0),
    safe(() => prisma.task.count({
      where: { case: { orgId, deletedAt: null }, status: "BLOCKED" },
    }), 0),
    safe(() => prisma.task.count({
      where: { case: { orgId, deletedAt: null }, status: "READY" },
    }), 0),
    safe(() => prisma.case.count({
      where: { orgId, deletedAt: null, status: "CLOSED", closedAt: { gte: startOfMonth } },
    }), 0),
    safe(() => prisma.approval.count({
      where: { case: { orgId }, status: "PENDING" },
    }), 0),
    safe(() => prisma.case.findMany({
      where: { orgId, deletedAt: null },
      include: {
        deceased: { select: { fullName: true } },
        contact: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }), [] as any[]),
    safe(() => prisma.auditLog.findMany({
      where: { orgId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }), [] as any[]),
    safe(() => prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null },
        deadline: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), gte: now },
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      include: { case: { select: { ref: true } } },
      orderBy: { deadline: "asc" },
      take: 8,
    }), [] as any[]),
    safe(() => getOnboardingState(orgId), { show: false, steps: [], completed: 0, total: 0 } as any),
    safe(() => prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true },
    }), null),
    safe(() => prisma.task.findMany({
      where: {
        assigneeId: userId,
        case: { orgId, deletedAt: null },
        status: { in: ["PENDING", "IN_PROGRESS", "READY"] },
      },
      include: { case: { select: { id: true, ref: true, isUrgent: true } } },
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
      take: 8,
    }), [] as any[]),
    safe(() => prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null },
        OR: [
          { deadline: { gte: calFrom, lte: calTo } },
          { dueDate: { gte: calFrom, lte: calTo } },
        ],
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      select: { deadline: true, dueDate: true },
    }), [] as any[]),
    // Blocked tasks stuck for > 7 days — need immediate attention
    safe(() => prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null },
        status: "BLOCKED",
        updatedAt: { lte: sevenDaysAgo },
      },
      include: {
        case: { select: { id: true, ref: true, isUrgent: true, deceased: { select: { fullName: true } } } },
      },
      orderBy: { updatedAt: "asc" },
      take: 5,
    }), [] as any[]),
    // Team workload: tasks grouped by assignee and status
    safe(() => prisma.task.groupBy({
      by: ["assigneeId", "status"],
      where: { case: { orgId, deletedAt: null }, assigneeId: { not: null } },
      _count: true,
    }), [] as any[]),
    // Org members for name lookup
    safe(() => prisma.membership.findMany({
      where: { orgId },
      select: { userId: true, user: { select: { name: true, email: true } } },
    }), [] as any[]),
  ]);

  const aiInsights: AiInsightsData = await safe(
    () => getAiInsights(orgId),
    {
      thirtyDays: { casesAnalyzed: 0, chatMessages: 0, isdCalculations: 0, estimatedHoursSaved: 0 },
      riskiestCases: [],
      totalCasesAnalyzed: 0,
      averageScore: null,
    } as AiInsightsData
  );

  // In the public demo org surface 3 "try this" shortcuts so prospects
  // get to the wow-moments (urgente case, portal familia, pack banco)
  // in under 30 seconds.
  const isDemo =
    process.env.DEMO_ENABLED === "true" && org?.slug === DEMO_ORG_SLUG;
  let demoHighlights: {
    urgentCaseId: string | null;
    urgentCaseRef: string | null;
    portalToken: string | null;
    portalCaseRef: string | null;
    bankPackCaseId: string | null;
    bankPackCaseRef: string | null;
  } | null = null;
  if (isDemo) {
    const [urgent, portalCase, bankCase] = await Promise.all([
      safe(() => prisma.case.findFirst({
        where: { orgId, ref: "EXP-DEMO-0004" },
        select: { id: true, ref: true },
      }), null),
      safe(() => prisma.case.findFirst({
        where: { orgId, ref: "EXP-DEMO-0003" },
        select: { portalToken: true, ref: true },
      }), null),
      safe(() => prisma.case.findFirst({
        where: { orgId, ref: "EXP-DEMO-0002" },
        select: { id: true, ref: true },
      }), null),
    ]);
    demoHighlights = {
      urgentCaseId: urgent?.id ?? null,
      urgentCaseRef: urgent?.ref ?? null,
      portalToken: portalCase?.portalToken ?? null,
      portalCaseRef: portalCase?.ref ?? null,
      bankPackCaseId: bankCase?.id ?? null,
      bankPackCaseRef: bankCase?.ref ?? null,
    };
  }

  const kpis = [
    { label: "Expedientes activos", value: activeCases, color: "text-blue-600" },
    { label: "Tareas pendientes", value: pendingTasks, color: "text-orange-600" },
    { label: "Tareas bloqueadas", value: blockedTasks, color: "text-red-600" },
    { label: "Listas para accion", value: readyTasks, color: "text-yellow-600" },
    { label: "Aprobaciones pend.", value: pendingApprovals, color: "text-amber-600" },
    { label: "Cerrados este mes", value: closedThisMonth, color: "text-green-600" },
  ];

  // Build per-day buckets for the calendar widget
  const calByDay: Record<number, { overdue: number; soon: number; future: number }> = {};
  for (const t of calendarTasks) {
    const date = t.deadline ?? t.dueDate;
    if (!date) continue;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDate();
    const bucket = (calByDay[day] ??= { overdue: 0, soon: 0, future: 0 });
    if (d < now) bucket.overdue++;
    else if (d <= weekEnd) bucket.soon++;
    else bucket.future++;
  }
  const calendarDays = Object.entries(calByDay).map(([day, counts]) => ({
    date: `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ...counts,
  }));

  function daysUntil(date: Date): number {
    return Math.ceil((new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  const memberMap = Object.fromEntries(
    (members as any[]).map((m: any) => [m.userId, m.user.name || m.user.email])
  );
  const workloadByUser: Record<string, { name: string; active: number; blocked: number; done: number; total: number }> = {};
  for (const row of (teamWorkload as any[])) {
    if (!row.assigneeId) continue;
    if (!workloadByUser[row.assigneeId]) {
      workloadByUser[row.assigneeId] = { name: memberMap[row.assigneeId] || row.assigneeId, active: 0, blocked: 0, done: 0, total: 0 };
    }
    const entry = workloadByUser[row.assigneeId];
    entry.total += row._count;
    if (row.status === "DONE" || row.status === "SKIPPED") entry.done += row._count;
    else if (row.status === "BLOCKED") entry.blocked += row._count;
    else entry.active += row._count;
  }
  const workloadEntries = Object.values(workloadByUser).sort((a, b) => b.active - a.active).slice(0, 6);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {demoHighlights && <DemoHighlights {...demoHighlights} />}

      {onboarding.show && !isDemo && (
        <OnboardingPanel
          steps={onboarding.steps}
          completed={onboarding.completed}
          total={onboarding.total}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white p-4 rounded-lg border">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3">
          <MyTasksWidget initialTasks={myTasks as any} />
        </div>
        <div className="space-y-4">
          <DeadlineCalendar days={calendarDays} year={calYear} month={calMonth} />
          <UsageWidget />
        </div>
      </div>

      {/* Critical attention panel */}
      {(upcomingDeadlines.length > 0 || (criticalBlockedTasks as any[]).length > 0) && (
        <div className="mb-8">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Requiere atencion inmediata
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {upcomingDeadlines.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Plazos proximos (30 dias)
                </h3>
                <div className="space-y-2">
                  {upcomingDeadlines.map((task: any) => {
                    const days = daysUntil(task.deadline!);
                    const urgent = days <= 7;
                    return (
                      <div key={task.id} className="flex items-center justify-between text-sm">
                        <Link href={`/cases/${task.caseId}`} className={`hover:underline ${urgent ? "text-red-800 font-medium" : "text-red-700"}`}>
                          <span className="font-mono text-xs mr-2">{task.case.ref}</span>
                          {task.title}
                        </Link>
                        <span className={`px-2 py-0.5 rounded text-xs shrink-0 ml-2 ${urgent ? "bg-red-200 text-red-800 font-medium" : "bg-red-100 text-red-700"}`}>
                          {days <= 0 ? "VENCIDO" : `${days}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(criticalBlockedTasks as any[]).length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Tareas bloqueadas +7 dias
                </h3>
                <div className="space-y-2">
                  {(criticalBlockedTasks as any[]).map((task: any) => {
                    const daysSince = Math.floor((now.getTime() - new Date(task.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={task.id} className="flex items-start justify-between text-sm gap-2">
                        <div className="flex-1 min-w-0">
                          <Link href={`/cases/${task.case.id}`} className="text-orange-800 font-medium hover:underline">
                            <span className="font-mono text-xs mr-1">{task.case.ref}</span>
                          </Link>
                          <p className="text-orange-700 text-xs truncate">{task.title}</p>
                          {task.blockReason && <p className="text-xs text-orange-500 truncate">{task.blockReason}</p>}
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded font-medium shrink-0">{daysSince}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team workload */}
      {workloadEntries.length > 0 && (
        <div className="bg-white rounded-lg border mb-8">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="font-semibold">Carga de trabajo del equipo</h2>
            <Link href="/reports" className="text-sm text-primary hover:underline">Ver informes</Link>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {workloadEntries.map((entry) => {
                const completionPct = entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0;
                return (
                  <div key={entry.name} className="flex items-center gap-4">
                    <div className="w-32 shrink-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.name}</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 gap-px">
                        {entry.blocked > 0 && (
                          <div
                            className="bg-red-400 h-full"
                            style={{ width: `${(entry.blocked / entry.total) * 100}%` }}
                            title={`${entry.blocked} bloqueadas`}
                          />
                        )}
                        {entry.active > 0 && (
                          <div
                            className="bg-blue-400 h-full"
                            style={{ width: `${(entry.active / entry.total) * 100}%` }}
                            title={`${entry.active} activas`}
                          />
                        )}
                        {entry.done > 0 && (
                          <div
                            className="bg-green-400 h-full"
                            style={{ width: `${(entry.done / entry.total) * 100}%` }}
                            title={`${entry.done} completadas`}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500 w-36 justify-end">
                      {entry.blocked > 0 && <span className="text-red-600 font-medium">{entry.blocked} bloq.</span>}
                      <span className="text-blue-600">{entry.active} activas</span>
                      <span className="text-gray-400">{completionPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Bloqueadas</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> Activas</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Completadas</span>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights widget */}
      {(aiInsights.thirtyDays.casesAnalyzed > 0 || aiInsights.thirtyDays.chatMessages > 0 || aiInsights.thirtyDays.isdCalculations > 0 || aiInsights.riskiestCases.length > 0) && (
        <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-lg border border-purple-200 mb-8">
          <div className="px-6 py-4 border-b border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="font-semibold">Insights IA del despacho</h2>
              <span className="text-xs px-2 py-0.5 bg-white border border-purple-200 rounded-full text-purple-700">ultimos 30 dias</span>
            </div>
            {aiInsights.averageScore !== null && (
              <div className="text-right">
                <span className="text-xs text-gray-500">Score medio </span>
                <span className={`font-bold ${
                  aiInsights.averageScore >= 70 ? "text-green-600" :
                  aiInsights.averageScore >= 40 ? "text-orange-600" : "text-red-600"
                }`}>
                  {aiInsights.averageScore}/100
                </span>
                <span className="text-xs text-gray-400 ml-1">({aiInsights.totalCasesAnalyzed} casos)</span>
              </div>
            )}
          </div>
          <div className="p-6 grid md:grid-cols-4 gap-4 mb-2">
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Casos analizados</p>
              <p className="text-2xl font-bold text-purple-700 mt-1">{aiInsights.thirtyDays.casesAnalyzed}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Calculos ISD</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{aiInsights.thirtyDays.isdCalculations}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Mensajes chat IA</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{aiInsights.thirtyDays.chatMessages}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Horas ahorradas (est.)</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{aiInsights.thirtyDays.estimatedHoursSaved}h</p>
            </div>
          </div>
          {aiInsights.riskiestCases.length > 0 && (
            <div className="px-6 pb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Expedientes con menor score</h3>
              <div className="space-y-2">
                {aiInsights.riskiestCases.map((c) => (
                  <Link
                    key={c.caseId}
                    href={`/cases/${c.caseId}`}
                    className="flex items-center gap-3 bg-white border border-purple-100 rounded-lg p-3 hover:border-purple-300 transition"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 ${
                      c.healthScore >= 70 ? "bg-green-500" :
                      c.healthScore >= 40 ? "bg-orange-500" : "bg-red-500"
                    }`}>
                      {c.healthScore}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-purple-700 font-medium">{c.ref}</span>
                        {c.deceasedName && <span className="text-sm text-gray-700">· {c.deceasedName}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{c.summary}</p>
                    </div>
                    <span className="text-xs text-purple-600 shrink-0">Ver →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent cases */}
      <div className="bg-white rounded-lg border mb-8">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Expedientes recientes</h2>
          <Link href="/cases" className="text-sm text-primary hover:underline">Ver todos</Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-6 py-3">Ref</th>
              <th className="px-6 py-3">Fallecido</th>
              <th className="px-6 py-3">Solicitante</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {recentCases.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-3">
                  <Link href={`/cases/${c.id}`} className="text-primary hover:underline font-medium">{c.ref}</Link>
                </td>
                <td className="px-6 py-3 text-sm">{c.deceased?.fullName || "-"}</td>
                <td className="px-6 py-3 text-sm">{c.contact?.fullName || "-"}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${CASE_STATUS_COLORS[c.status] || ""}`}>
                    {c.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString("es-ES")}
                </td>
              </tr>
            ))}
            {recentCases.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No hay expedientes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent audit */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Actividad reciente</h2>
          <Link href="/audit" className="text-sm text-primary hover:underline">Ver todo</Link>
        </div>
        <div className="divide-y">
          {recentLogs.map((log) => (
            <div key={log.id} className="px-6 py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{log.user?.name || log.user?.email || "Sistema"}</span>
                <span className="text-gray-500 ml-2">{log.action}</span>
                {log.details && <span className="text-gray-400 ml-2">- {log.details}</span>}
              </div>
              <span className="text-gray-400 text-xs">
                {new Date(log.createdAt).toLocaleString("es-ES")}
              </span>
            </div>
          ))}
          {recentLogs.length === 0 && (
            <p className="px-6 py-8 text-center text-gray-400">Sin actividad</p>
          )}
        </div>
      </div>
    </div>
  );
}
