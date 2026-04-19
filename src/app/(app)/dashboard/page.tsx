import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOnboardingState } from "@/lib/onboarding";
import { OnboardingPanel } from "@/components/dashboard/onboarding-panel";
import { DemoHighlights } from "@/components/dashboard/demo-highlights";
import { DEMO_ORG_SLUG } from "@/lib/demo-data";
import { CASE_STATUS_COLORS } from "@/lib/constants";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const orgId = session?.user?.orgId;
  if (!orgId) return <p>No org</p>;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const userId = session.user.id;

  const [activeCases, pendingTasks, blockedTasks, readyTasks, closedThisMonth, pendingApprovals, recentCases, recentLogs, upcomingDeadlines, onboarding, org, myTasks] = await Promise.all([
    prisma.case.count({
      where: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
    }),
    prisma.task.count({
      where: { case: { orgId, deletedAt: null }, status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    prisma.task.count({
      where: { case: { orgId, deletedAt: null }, status: "BLOCKED" },
    }),
    prisma.task.count({
      where: { case: { orgId, deletedAt: null }, status: "READY" },
    }),
    prisma.case.count({
      where: { orgId, deletedAt: null, status: "CLOSED", closedAt: { gte: startOfMonth } },
    }),
    prisma.approval.count({
      where: { case: { orgId }, status: "PENDING" },
    }),
    prisma.case.findMany({
      where: { orgId, deletedAt: null },
      include: {
        deceased: { select: { fullName: true } },
        contact: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      where: { orgId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null },
        deadline: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), gte: now },
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      include: { case: { select: { ref: true } } },
      orderBy: { deadline: "asc" },
      take: 8,
    }),
    getOnboardingState(orgId),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        case: { orgId, deletedAt: null },
        status: { in: ["PENDING", "IN_PROGRESS", "READY"] },
      },
      include: { case: { select: { id: true, ref: true, isUrgent: true } } },
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
      take: 8,
    }),
  ]);

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
      prisma.case.findFirst({
        where: { orgId, ref: "EXP-DEMO-0004" },
        select: { id: true, ref: true },
      }),
      prisma.case.findFirst({
        where: { orgId, ref: "EXP-DEMO-0003" },
        select: { portalToken: true, ref: true },
      }),
      prisma.case.findFirst({
        where: { orgId, ref: "EXP-DEMO-0002" },
        select: { id: true, ref: true },
      }),
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

  function daysUntil(date: Date): number {
    return Math.ceil((new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

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

      {/* My tasks */}
      {myTasks.length > 0 && (
        <div className="bg-white rounded-lg border mb-8">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="font-semibold">Mis tareas asignadas</h2>
            <Link href="/tasks" className="text-sm text-primary hover:underline">Ver todas</Link>
          </div>
          <div className="divide-y">
            {myTasks.map((task) => {
              const deadlineDays = task.deadline ? daysUntil(task.deadline) : null;
              const expired = deadlineDays !== null && deadlineDays <= 0;
              const urgent = deadlineDays !== null && deadlineDays > 0 && deadlineDays <= 7;
              return (
                <div key={task.id} className="px-6 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link href={`/cases/${task.case.id}`} className="font-mono text-xs text-primary hover:underline shrink-0">
                      {task.case.ref}
                    </Link>
                    {task.case.isUrgent && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full shrink-0">Urgente</span>
                    )}
                    <span className="truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {task.deadline && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        expired ? "bg-red-100 text-red-700 font-medium" : urgent ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {expired ? "VENCIDO" : `${deadlineDays}d`}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      task.status === "READY" ? "bg-yellow-100 text-yellow-700" :
                      task.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deadline alerts */}
      {upcomingDeadlines.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <h2 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Plazos proximos (30 dias)
          </h2>
          <div className="space-y-2">
            {upcomingDeadlines.map((task) => {
              const days = daysUntil(task.deadline!);
              const urgent = days <= 7;
              return (
                <div key={task.id} className={`flex items-center justify-between text-sm ${urgent ? "text-red-800 font-medium" : "text-red-700"}`}>
                  <div>
                    <Link href={`/cases/${task.caseId}`} className="hover:underline">
                      <span className="font-mono text-xs mr-2">{task.case.ref}</span>
                      {task.title}
                    </Link>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${urgent ? "bg-red-200" : "bg-red-100"}`}>
                    {days <= 0 ? "VENCIDO" : `${days} dias`}
                  </span>
                </div>
              );
            })}
          </div>
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
