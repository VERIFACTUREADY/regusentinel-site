import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Informes — BARITUR PRO",
  robots: { index: false },
};

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Recepcion",
  VALIDATION: "Validacion",
  IN_PROGRESS: "En curso",
  PENDING_DOCS: "Docs pendientes",
  READY_TO_SEND: "Listo para enviar",
  SENT: "Enviado",
  FOLLOW_UP: "Seguimiento",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

const STATUS_COLORS: Record<string, string> = {
  INTAKE: "bg-gray-200",
  VALIDATION: "bg-yellow-300",
  IN_PROGRESS: "bg-blue-400",
  PENDING_DOCS: "bg-orange-300",
  READY_TO_SEND: "bg-purple-400",
  SENT: "bg-indigo-400",
  FOLLOW_UP: "bg-cyan-400",
  CLOSED: "bg-green-400",
  ARCHIVED: "bg-gray-300",
};

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "cases.read")) redirect("/dashboard");

  const orgId = session.user.orgId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalCases,
    activeCases,
    closedThisMonth,
    closedLastMonth,
    createdThisMonth,
    createdLastMonth,
    urgentCases,
    casesByStatus,
    recentClosed,
    taskStats,
    docCount,
    notifsSent,
    notifsThisMonth,
    teamWorkload,
    members,
  ] = await Promise.all([
    prisma.case.count({ where: { orgId, deletedAt: null } }),
    prisma.case.count({ where: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } } }),
    prisma.case.count({ where: { orgId, deletedAt: null, status: "CLOSED", closedAt: { gte: startOfMonth } } }),
    prisma.case.count({ where: { orgId, deletedAt: null, status: "CLOSED", closedAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
    prisma.case.count({ where: { orgId, deletedAt: null, createdAt: { gte: startOfMonth } } }),
    prisma.case.count({ where: { orgId, deletedAt: null, createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
    prisma.case.count({ where: { orgId, deletedAt: null, isUrgent: true, status: { notIn: ["CLOSED", "ARCHIVED"] } } }),
    prisma.case.groupBy({
      by: ["status"],
      where: { orgId, deletedAt: null },
      _count: true,
    }),
    prisma.case.findMany({
      where: { orgId, deletedAt: null, status: "CLOSED", closedAt: { gte: startOfYear } },
      select: { createdAt: true, closedAt: true },
      take: 500,
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { case: { orgId, deletedAt: null } },
      _count: true,
    }),
    prisma.document.count({ where: { case: { orgId, deletedAt: null } } }),
    prisma.notificationLog.count({ where: { orgId } }),
    prisma.notificationLog.count({ where: { orgId, createdAt: { gte: startOfMonth } } }),
    prisma.task.groupBy({
      by: ["assigneeId", "status"],
      where: { case: { orgId, deletedAt: null }, assigneeId: { not: null } },
      _count: true,
    }),
    prisma.membership.findMany({
      where: { orgId },
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
  ]);
  const memberMap = Object.fromEntries(
    members.map((m) => [m.userId, m.user.name || m.user.email])
  );

  const workloadByUser: Record<string, { active: number; done: number; blocked: number; total: number }> = {};
  for (const row of teamWorkload) {
    if (!row.assigneeId) continue;
    if (!workloadByUser[row.assigneeId]) {
      workloadByUser[row.assigneeId] = { active: 0, done: 0, blocked: 0, total: 0 };
    }
    const entry = workloadByUser[row.assigneeId];
    entry.total += row._count;
    if (row.status === "DONE" || row.status === "SKIPPED") entry.done += row._count;
    else if (row.status === "BLOCKED") entry.blocked += row._count;
    else entry.active += row._count;
  }
  const workloadEntries = Object.entries(workloadByUser)
    .map(([userId, stats]) => ({ userId, name: memberMap[userId] || userId, ...stats }))
    .sort((a, b) => b.active - a.active);

  const avgResolutionDays = recentClosed.length > 0
    ? Math.round(
        recentClosed.reduce((sum, c) => {
          const created = new Date(c.createdAt).getTime();
          const closed = new Date(c.closedAt!).getTime();
          return sum + (closed - created) / (1000 * 60 * 60 * 24);
        }, 0) / recentClosed.length
      )
    : null;

  const statusMap = Object.fromEntries(casesByStatus.map((s) => [s.status, s._count]));
  const totalForBar = Object.values(statusMap).reduce((a, b) => a + b, 0) || 1;

  const taskMap = Object.fromEntries(taskStats.map((t) => [t.status, t._count]));
  const totalTasks = Object.values(taskMap).reduce((a, b) => a + b, 0);

  function delta(current: number, previous: number) {
    if (previous === 0) return current > 0 ? "+100%" : "—";
    const pct = Math.round(((current - previous) / previous) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  }

  const kpis = [
    { label: "Total expedientes", value: totalCases, sub: null },
    { label: "Activos ahora", value: activeCases, sub: `${urgentCases} urgente${urgentCases !== 1 ? "s" : ""}` },
    { label: "Creados este mes", value: createdThisMonth, sub: delta(createdThisMonth, createdLastMonth) + " vs. mes anterior" },
    { label: "Cerrados este mes", value: closedThisMonth, sub: delta(closedThisMonth, closedLastMonth) + " vs. mes anterior" },
    { label: "Tiempo medio resolucion", value: avgResolutionDays !== null ? `${avgResolutionDays}d` : "—", sub: "ultimos 12 meses" },
    { label: "Documentos", value: docCount, sub: null },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Informes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Metricas operativas de la organizacion
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white p-4 rounded-lg border">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            {kpi.sub && <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Cases by status */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Expedientes por estado</h2>
          <div className="flex h-6 rounded-full overflow-hidden mb-4">
            {Object.entries(statusMap).map(([status, count]) => (
              <div
                key={status}
                className={STATUS_COLORS[status] ?? "bg-gray-300"}
                style={{ width: `${(count / totalForBar) * 100}%` }}
                title={`${STATUS_LABELS[status] ?? status}: ${count}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(statusMap).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2 text-sm">
                <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[status] ?? "bg-gray-300"}`} />
                <span className="text-gray-600">{STATUS_LABELS[status] ?? status}</span>
                <span className="font-medium ml-auto">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Task breakdown */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Tareas</h2>
          {totalTasks === 0 ? (
            <p className="text-gray-400 text-sm">Sin tareas</p>
          ) : (
            <div className="space-y-3">
              {[
                { key: "PENDING", label: "Pendientes", color: "bg-yellow-400" },
                { key: "IN_PROGRESS", label: "En curso", color: "bg-blue-400" },
                { key: "READY", label: "Listas", color: "bg-green-400" },
                { key: "BLOCKED", label: "Bloqueadas", color: "bg-red-400" },
                { key: "DONE", label: "Completadas", color: "bg-green-600" },
                { key: "SKIPPED", label: "Omitidas", color: "bg-gray-300" },
              ].map(({ key, label, color }) => {
                const count = taskMap[key] ?? 0;
                const pct = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-medium">{count} <span className="text-gray-400">({Math.round(pct)}%)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Team workload */}
      {workloadEntries.length > 0 && (
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="font-semibold mb-4">Carga de trabajo por miembro</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Miembro</th>
                  <th className="pb-3 font-medium text-center">Activas</th>
                  <th className="pb-3 font-medium text-center">Bloqueadas</th>
                  <th className="pb-3 font-medium text-center">Completadas</th>
                  <th className="pb-3 font-medium text-center">Total</th>
                  <th className="pb-3 font-medium text-center">Tasa cierre</th>
                  <th className="pb-3 font-medium w-48">Distribucion</th>
                </tr>
              </thead>
              <tbody>
                {workloadEntries.map((entry) => {
                  const completionRate = entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0;
                  const activePct = entry.total > 0 ? (entry.active / entry.total) * 100 : 0;
                  const blockedPct = entry.total > 0 ? (entry.blocked / entry.total) * 100 : 0;
                  const donePct = entry.total > 0 ? (entry.done / entry.total) * 100 : 0;
                  return (
                    <tr key={entry.userId} className="border-b last:border-0">
                      <td className="py-3 font-medium text-gray-900">{entry.name}</td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-6 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                          {entry.active}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold ${entry.blocked > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-400"}`}>
                          {entry.blocked}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-6 bg-green-100 text-green-700 rounded text-xs font-semibold">
                          {entry.done}
                        </span>
                      </td>
                      <td className="py-3 text-center font-medium">{entry.total}</td>
                      <td className="py-3 text-center">
                        <span className={`font-semibold ${completionRate >= 70 ? "text-green-600" : completionRate >= 40 ? "text-orange-600" : "text-gray-500"}`}>
                          {completionRate}%
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex h-4 rounded-full overflow-hidden">
                          {donePct > 0 && <div className="bg-green-400" style={{ width: `${donePct}%` }} title={`Completadas: ${entry.done}`} />}
                          {activePct > 0 && <div className="bg-blue-400" style={{ width: `${activePct}%` }} title={`Activas: ${entry.active}`} />}
                          {blockedPct > 0 && <div className="bg-red-400" style={{ width: `${blockedPct}%` }} title={`Bloqueadas: ${entry.blocked}`} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded" /> Completadas</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" /> Activas</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" /> Bloqueadas</span>
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Notifications summary */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Notificaciones</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total enviadas</span>
              <span className="font-medium">{notifsSent}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Este mes</span>
              <span className="font-medium">{notifsThisMonth}</span>
            </div>
          </div>
          <Link href="/notifications" className="block mt-4 text-sm text-primary hover:underline">
            Ver historial completo →
          </Link>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Accesos rapidos</h2>
          <div className="space-y-2">
            <Link href="/audit" className="block text-sm text-primary hover:underline">Audit Trail →</Link>
            <Link href="/templates" className="block text-sm text-primary hover:underline">Plantillas →</Link>
            <Link href="/cases" className="block text-sm text-primary hover:underline">Todos los expedientes →</Link>
            <Link href="/users" className="block text-sm text-primary hover:underline">Gestion de equipo →</Link>
          </div>
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Tendencia mensual</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Creados</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold">{createdThisMonth}</span>
                <span className={`text-xs ${createdThisMonth >= createdLastMonth ? "text-green-600" : "text-red-600"}`}>
                  {delta(createdThisMonth, createdLastMonth)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cerrados</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold">{closedThisMonth}</span>
                <span className={`text-xs ${closedThisMonth >= closedLastMonth ? "text-green-600" : "text-red-600"}`}>
                  {delta(closedThisMonth, closedLastMonth)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Ratio cierre</p>
              <span className="text-xl font-bold">
                {createdThisMonth > 0 ? Math.round((closedThisMonth / createdThisMonth) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
