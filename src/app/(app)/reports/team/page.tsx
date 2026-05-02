import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Rendimiento del equipo — BARITUR PRO",
  robots: { index: false },
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

function pct(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

function trend(current: number, previous: number): { label: string; up: boolean; neutral: boolean } {
  if (previous === 0 && current === 0) return { label: "—", up: false, neutral: true };
  if (previous === 0) return { label: `+${current}`, up: true, neutral: false };
  const diff = current - previous;
  const diffPct = Math.round((diff / previous) * 100);
  if (diff === 0) return { label: "=", up: false, neutral: true };
  return { label: diff > 0 ? `+${diffPct}%` : `${diffPct}%`, up: diff > 0, neutral: false };
}

export default async function TeamReportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "cases.read")) redirect("/dashboard");

  const orgId = session.user.orgId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [members, tasksByAssignee, recentTasksByAssignee, prevTasksByAssignee, overdueByAssignee, blockedByAssignee] = await Promise.all([
    safe(() => prisma.membership.findMany({
      where: { orgId },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }), [] as any[]),

    // All-time tasks by assignee
    safe(() => prisma.task.groupBy({
      by: ["assigneeId", "status"],
      where: { case: { orgId, deletedAt: null }, assigneeId: { not: null } },
      _count: true,
    }), [] as any[]),

    // Tasks completed last 30 days
    safe(() => prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        case: { orgId, deletedAt: null },
        assigneeId: { not: null },
        status: "DONE",
        updatedAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    }), [] as any[]),

    // Tasks completed 30-60 days ago (comparison period)
    safe(() => prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        case: { orgId, deletedAt: null },
        assigneeId: { not: null },
        status: "DONE",
        updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
      _count: true,
    }), [] as any[]),

    // Overdue tasks by assignee
    safe(() => prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        case: { orgId, deletedAt: null },
        assigneeId: { not: null },
        deadline: { lt: now },
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      _count: true,
    }), [] as any[]),

    // Blocked tasks by assignee
    safe(() => prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        case: { orgId, deletedAt: null },
        assigneeId: { not: null },
        status: "BLOCKED",
      },
      _count: true,
    }), [] as any[]),
  ]);

  // Build lookup maps
  const completedLast30: Record<string, number> = Object.fromEntries(
    (recentTasksByAssignee as any[]).map((r) => [r.assigneeId, r._count])
  );
  const completedPrev30: Record<string, number> = Object.fromEntries(
    (prevTasksByAssignee as any[]).map((r) => [r.assigneeId, r._count])
  );
  const overdueMap: Record<string, number> = Object.fromEntries(
    (overdueByAssignee as any[]).map((r) => [r.assigneeId, r._count])
  );
  const blockedMap: Record<string, number> = Object.fromEntries(
    (blockedByAssignee as any[]).map((r) => [r.assigneeId, r._count])
  );

  // All-time stats by user
  type UserStats = {
    done: number; active: number; blocked: number; total: number;
  };
  const allTimeMap: Record<string, UserStats> = {};
  for (const row of tasksByAssignee as any[]) {
    if (!row.assigneeId) continue;
    if (!allTimeMap[row.assigneeId]) {
      allTimeMap[row.assigneeId] = { done: 0, active: 0, blocked: 0, total: 0 };
    }
    const s = allTimeMap[row.assigneeId];
    s.total += row._count;
    if (row.status === "DONE" || row.status === "SKIPPED") s.done += row._count;
    else if (row.status === "BLOCKED") s.blocked += row._count;
    else s.active += row._count;
  }

  // Build per-member summary
  const memberStats = (members as any[]).map((m) => {
    const uid = m.userId;
    const allTime = allTimeMap[uid] ?? { done: 0, active: 0, blocked: 0, total: 0 };
    const done30 = completedLast30[uid] ?? 0;
    const donePrev30 = completedPrev30[uid] ?? 0;
    const overdue = overdueMap[uid] ?? 0;
    const blocked = blockedMap[uid] ?? 0;
    const completionRate = pct(allTime.done, allTime.total);
    const completionTrend = trend(done30, donePrev30);
    const blockedRate = pct(blocked, allTime.active + blocked);
    return {
      userId: uid,
      name: m.user.name || m.user.email,
      email: m.user.email,
      role: m.role,
      ...allTime,
      done30,
      donePrev30,
      overdue,
      blockedTasks: blocked,
      completionRate,
      completionTrend,
      blockedRate,
      joinedAt: m.createdAt,
    };
  }).filter((m) => m.total > 0 || m.overdue > 0).sort((a, b) => b.total - a.total);

  const orgDone30 = Object.values(completedLast30).reduce((s, v) => s + v, 0);
  const orgDonePrev30 = Object.values(completedPrev30).reduce((s, v) => s + v, 0);
  const orgOverdue = Object.values(overdueMap).reduce((s, v) => s + v, 0);
  const orgBlocked = Object.values(blockedMap).reduce((s, v) => s + v, 0);

  const ROLE_LABELS: Record<string, string> = {
    OWNER: "Propietario",
    MANAGER: "Gestor",
    OPERATOR: "Operador",
    VIEWER: "Lector",
    MANAGED_OPS: "Operaciones",
  };

  const ROLE_COLORS: Record<string, string> = {
    OWNER: "bg-purple-100 text-purple-700",
    MANAGER: "bg-blue-100 text-blue-700",
    OPERATOR: "bg-green-100 text-green-700",
    VIEWER: "bg-gray-100 text-gray-600",
    MANAGED_OPS: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/reports" className="text-sm text-gray-500 hover:text-gray-700">← Informes</Link>
          </div>
          <h1 className="text-2xl font-bold">Rendimiento del equipo</h1>
          <p className="text-sm text-gray-500 mt-1">Productividad individual y KPIs de tareas</p>
        </div>
        <Link href="/users" className="text-sm text-primary hover:underline">
          Gestionar usuarios →
        </Link>
      </div>

      {/* Org-level KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Completadas (30d)"
          value={orgDone30}
          sub={trend(orgDone30, orgDonePrev30)}
          color="green"
        />
        <KpiCard
          label="Tareas vencidas"
          value={orgOverdue}
          sub={orgOverdue > 0 ? { label: "requieren atención", up: false, neutral: false } : { label: "todo al día", up: true, neutral: false }}
          color={orgOverdue > 0 ? "red" : "green"}
        />
        <KpiCard
          label="Bloqueadas activas"
          value={orgBlocked}
          sub={orgBlocked > 0 ? { label: "pendientes de desbloqueo", up: false, neutral: false } : { label: "ninguna", up: false, neutral: true }}
          color={orgBlocked > 5 ? "red" : orgBlocked > 0 ? "orange" : "green"}
        />
        <KpiCard
          label="Miembros activos"
          value={(members as any[]).length}
          sub={{ label: "en la organización", up: false, neutral: true }}
          color="blue"
        />
      </div>

      {/* Per-member table */}
      {memberStats.length > 0 ? (
        <div className="bg-white border rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-800">Detalle por miembro</h2>
            <p className="text-xs text-gray-400 mt-0.5">Tareas completadas últimos 30 días y métricas históricas</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Miembro</th>
                  <th className="px-6 py-3 font-medium text-center">Completadas 30d</th>
                  <th className="px-6 py-3 font-medium text-center">vs. período anterior</th>
                  <th className="px-6 py-3 font-medium text-center">Activas</th>
                  <th className="px-6 py-3 font-medium text-center">Vencidas</th>
                  <th className="px-6 py-3 font-medium text-center">Bloqueadas</th>
                  <th className="px-6 py-3 font-medium text-center">Tasa cierre</th>
                  <th className="px-6 py-3 font-medium w-32">Distribución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {memberStats.map((m) => {
                  const donePct = m.total > 0 ? (m.done / m.total) * 100 : 0;
                  const activePct = m.total > 0 ? (m.active / m.total) * 100 : 0;
                  const blockedPct = m.total > 0 ? (m.blockedTasks / m.total) * 100 : 0;
                  return (
                    <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{m.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"}`}>
                              {ROLE_LABELS[m.role] ?? m.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xl font-bold text-gray-900">{m.done30}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-sm font-semibold ${
                          m.completionTrend.neutral ? "text-gray-400" :
                          m.completionTrend.up ? "text-green-600" : "text-red-600"
                        }`}>
                          {m.completionTrend.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-6 bg-blue-100 text-blue-700 rounded text-xs font-semibold px-2">
                          {m.active}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2rem] h-6 rounded text-xs font-semibold px-2 ${
                          m.overdue > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-400"
                        }`}>
                          {m.overdue}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2rem] h-6 rounded text-xs font-semibold px-2 ${
                          m.blockedTasks > 0 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-400"
                        }`}>
                          {m.blockedTasks}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-bold text-sm ${
                          m.completionRate >= 70 ? "text-green-600" :
                          m.completionRate >= 40 ? "text-orange-500" :
                          m.completionRate > 0 ? "text-red-600" : "text-gray-400"
                        }`}>
                          {m.completionRate}%
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">{m.done}/{m.total}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 gap-px">
                          {donePct > 0 && <div className="bg-green-400 transition-all" style={{ width: `${donePct}%` }} title={`Completadas: ${m.done}`} />}
                          {activePct > 0 && <div className="bg-blue-400 transition-all" style={{ width: `${activePct}%` }} title={`Activas: ${m.active}`} />}
                          {blockedPct > 0 && <div className="bg-orange-400 transition-all" style={{ width: `${blockedPct}%` }} title={`Bloqueadas: ${m.blockedTasks}`} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-400 rounded" /> Completadas</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-400 rounded" /> Activas</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-orange-400 rounded" /> Bloqueadas</span>
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400 mb-8">
          <p className="text-sm">Aún no hay tareas asignadas a miembros del equipo.</p>
          <Link href="/cases" className="text-sm text-primary hover:underline mt-2 inline-block">Ir a expedientes →</Link>
        </div>
      )}

      {/* Members without tasks */}
      {(() => {
        const inactive = (members as any[]).filter((m) => !memberStats.find((s) => s.userId === m.userId));
        if (inactive.length === 0) return null;
        return (
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold text-gray-700 mb-3 text-sm">Miembros sin tareas asignadas</h2>
            <div className="flex flex-wrap gap-2">
              {inactive.map((m: any) => (
                <div key={m.userId} className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                    {(m.user.name || m.user.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700">{m.user.name || m.user.email}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABELS[m.role] ?? m.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub: { label: string; up: boolean; neutral: boolean };
  color: "green" | "red" | "orange" | "blue" | "gray";
}) {
  const colors = {
    green: "text-green-700",
    red: "text-red-700",
    orange: "text-orange-600",
    blue: "text-blue-700",
    gray: "text-gray-700",
  };
  const subColors = {
    green: "text-green-600",
    red: "text-red-600",
    orange: "text-orange-500",
    blue: "text-blue-600",
    gray: "text-gray-500",
  };
  return (
    <div className="bg-white border rounded-xl p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      <p className={`text-xs mt-1 ${sub.neutral ? "text-gray-400" : subColors[color]}`}>{sub.label}</p>
    </div>
  );
}
