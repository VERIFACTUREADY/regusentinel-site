import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Métricas de uso" };

// Build last N month buckets for trend charts.
function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

// Simple inline bar chart — no chart library dependency.
function BarChart({
  data,
  maxValue,
  color = "bg-primary",
}: {
  data: { label: string; value: number }[];
  maxValue: number;
  color?: string;
}) {
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((d) => {
        const pct = maxValue > 0 ? Math.round((d.value / maxValue) * 100) : 0;
        return (
          <div key={d.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <span className="text-xs text-gray-500">{d.value || ""}</span>
            <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
              <div
                className={`w-full rounded-t ${color} transition-all`}
                style={{ height: `${Math.max(pct, d.value > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 truncate w-full text-center">
              {d.label.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  color = "text-gray-900",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default async function MetricsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "OWNER") redirect("/dashboard");

  const months = lastNMonths(6);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [
    totalOrgs,
    activeOrgs,
    totalCases,
    openCases,
    totalTasks,
    doneTasks,
    portalUploads,
    newLeads,
    casesRaw,
    orgsWithActivity,
    subscriptions,
    recentLeads,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({
      where: { cases: { some: { deletedAt: null, createdAt: { gte: sixMonthsAgo } } } },
    }),
    prisma.case.count({ where: { deletedAt: null } }),
    prisma.case.count({ where: { deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } } }),
    prisma.task.count({ where: { case: { deletedAt: null } } }),
    prisma.task.count({ where: { case: { deletedAt: null }, status: "DONE" } }),
    prisma.document.count({ where: { isPortalUpload: true } }),
    prisma.demoRequest.count({ where: { leadStatus: "NEW" } }),
    // Cases created per month in the last 6 months
    prisma.case.groupBy({
      by: ["createdAt"],
      where: { deletedAt: null, createdAt: { gte: sixMonthsAgo } },
      _count: true,
    }),
    // Top orgs by case count
    prisma.organization.findMany({
      include: {
        _count: { select: { cases: true, members: true } },
        subscription: { select: { plan: true, status: true, interval: true } },
        cases: {
          where: { deletedAt: null },
          select: { status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subscription.findMany({
      select: { plan: true, status: true, interval: true },
    }),
    prisma.demoRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { name: true, company: true, source: true, leadStatus: true, createdAt: true },
    }),
  ]);

  // Bucket case counts per month
  const casesPerMonth: Record<string, number> = {};
  for (const m of months) casesPerMonth[m] = 0;
  for (const row of casesRaw) {
    const d = new Date(row.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in casesPerMonth) casesPerMonth[key] += row._count;
  }
  const caseChartData = months.map((m) => ({ label: m, value: casesPerMonth[m] }));
  const maxCases = Math.max(...caseChartData.map((d) => d.value), 1);

  const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Plan breakdown
  const planCounts: Record<string, number> = {};
  for (const s of subscriptions) {
    planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1;
  }

  const LEAD_STATUS_COLORS: Record<string, string> = {
    NEW: "bg-gray-100 text-gray-700",
    CONTACTED: "bg-blue-100 text-blue-700",
    MEETING: "bg-yellow-100 text-yellow-800",
    PILOT: "bg-purple-100 text-purple-700",
    CUSTOMER: "bg-green-100 text-green-700",
    LOST: "bg-red-100 text-red-700",
  };
  const LEAD_STATUS_LABELS: Record<string, string> = {
    NEW: "Nuevo", CONTACTED: "Contactado", MEETING: "Reunión",
    PILOT: "Piloto", CUSTOMER: "Cliente", LOST: "Perdido",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Métricas de uso</h1>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat label="Organizaciones" value={totalOrgs} sub={`${activeOrgs} activas últimos 6m`} color="text-blue-600" />
        <Stat label="Expedientes abiertos" value={openCases} sub={`${totalCases} en total`} color="text-indigo-600" />
        <Stat label="Tasa de tareas completadas" value={`${taskCompletionRate}%`} sub={`${doneTasks}/${totalTasks} tareas`} color={taskCompletionRate >= 60 ? "text-green-600" : "text-orange-600"} />
        <Stat label="Docs subidos por familias" value={portalUploads} sub="via portal" color="text-purple-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Cases trend */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Expedientes creados (últimos 6 meses)</h2>
          <BarChart data={caseChartData} maxValue={maxCases} />
        </div>

        {/* Plan breakdown */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Distribución de planes</h2>
          <div className="space-y-3 mt-2">
            {(["INICIA", "DESPACHO", "FIRMA"] as const).map((plan) => {
              const count = planCounts[plan] ?? 0;
              const pct = subscriptions.length > 0
                ? Math.round((count / subscriptions.length) * 100)
                : 0;
              const colors: Record<string, string> = {
                INICIA: "bg-gray-400",
                DESPACHO: "bg-primary",
                FIRMA: "bg-indigo-700",
              };
              return (
                <div key={plan}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{plan}</span>
                    <span className="text-gray-500">{count} org{count !== 1 ? "s" : ""} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className={`h-full rounded-full ${colors[plan]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Leads sin contactar: <span className="font-semibold text-red-600">{newLeads}</span>
          </p>
        </div>
      </div>

      {/* Org activity table */}
      <div className="bg-white border rounded-lg mb-8">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Organizaciones</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Organización</th>
              <th className="px-6 py-3">Plan</th>
              <th className="px-6 py-3">Expedientes</th>
              <th className="px-6 py-3">Miembros</th>
              <th className="px-6 py-3">Último expediente</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orgsWithActivity.map((org) => {
              const lastCase = org.cases[0];
              const planColors: Record<string, string> = {
                INICIA: "bg-gray-100 text-gray-700",
                DESPACHO: "bg-blue-100 text-blue-700",
                FIRMA: "bg-indigo-100 text-indigo-800",
              };
              const plan = org.subscription?.plan ?? "—";
              return (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium">{org.name}</p>
                    <p className="text-xs text-gray-400">{org.slug}</p>
                  </td>
                  <td className="px-6 py-3">
                    {org.subscription ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[plan] ?? "bg-gray-100 text-gray-700"}`}>
                        {plan}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Sin suscripción</span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-medium">{org._count.cases}</td>
                  <td className="px-6 py-3">{org._count.members}</td>
                  <td className="px-6 py-3 text-gray-500 text-xs">
                    {lastCase
                      ? new Date(lastCase.createdAt).toLocaleDateString("es-ES")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recent leads */}
      <div className="bg-white border rounded-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Últimos leads</h2>
          <a href="/admin/demo-requests" className="text-xs text-primary hover:underline">
            Ver pipeline completo →
          </a>
        </div>
        <div className="divide-y">
          {recentLeads.map((lead, i) => (
            <div key={i} className="px-6 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-sm">{lead.name}</span>
                {lead.company && (
                  <span className="text-gray-500 text-sm ml-2">· {lead.company}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAD_STATUS_COLORS[lead.leadStatus] ?? "bg-gray-100"}`}>
                  {LEAD_STATUS_LABELS[lead.leadStatus] ?? lead.leadStatus}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(lead.createdAt).toLocaleDateString("es-ES")}
                </span>
              </div>
            </div>
          ))}
          {recentLeads.length === 0 && (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">Sin leads todavía</p>
          )}
        </div>
      </div>
    </div>
  );
}
