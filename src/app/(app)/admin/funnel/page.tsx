import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/admin";
import Link from "next/link";

export const metadata = { title: "Funnel de conversion" };

function lastNWeeks(n: number): { label: string; start: Date; end: Date }[] {
  const weeks: { label: string; start: Date; end: Date }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const label = `${start.getDate()}/${start.getMonth() + 1}`;
    weeks.push({ label, start, end });
  }
  return weeks;
}

export default async function FunnelPage() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin(session?.user?.email)) redirect("/dashboard");

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);

  const [
    totalLeads,
    leadsLast30d,
    leadsByStatus,
    leadsBySource,
    trialingSubs,
    activeSubs,
    recentConversions,
    weeklyCounts,
  ] = await Promise.all([
    prisma.demoRequest.count(),
    prisma.demoRequest.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.demoRequest.groupBy({ by: ["leadStatus"], _count: true }),
    prisma.demoRequest.groupBy({
      by: ["source"],
      _count: true,
      where: { createdAt: { gte: ninetyDaysAgo } },
      orderBy: { _count: { source: "desc" } },
    }),
    prisma.subscription.count({ where: { status: "trialing" } }),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.demoRequest.findMany({
      where: { leadStatus: "CUSTOMER" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { name: true, company: true, source: true, createdAt: true, updatedAt: true },
    }),
    // Leads per week over last 8 weeks
    Promise.all(
      lastNWeeks(8).map(async (w) => ({
        label: w.label,
        count: await prisma.demoRequest.count({
          where: { createdAt: { gte: w.start, lte: w.end } },
        }),
      }))
    ),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of leadsByStatus) statusMap[row.leadStatus] = row._count;

  const sourceMap: Record<string, number> = {};
  for (const row of leadsBySource) {
    const key = row.source || "directo";
    sourceMap[key] = row._count;
  }

  const funnel = [
    { stage: "Leads totales", value: totalLeads, color: "bg-gray-400" },
    { stage: "Contactados", value: statusMap["CONTACTED"] ?? 0, color: "bg-blue-400" },
    { stage: "Reunion", value: statusMap["MEETING"] ?? 0, color: "bg-yellow-400" },
    { stage: "Piloto/Trial", value: (statusMap["PILOT"] ?? 0) + trialingSubs, color: "bg-purple-400" },
    { stage: "Clientes", value: (statusMap["CUSTOMER"] ?? 0), color: "bg-green-500" },
  ];
  const maxFunnel = Math.max(...funnel.map((f) => f.value), 1);

  const conversionRate = totalLeads > 0
    ? ((statusMap["CUSTOMER"] ?? 0) / totalLeads * 100).toFixed(1)
    : "0";

  const maxWeekly = Math.max(...weeklyCounts.map((w) => w.count), 1);

  const SOURCE_LABELS: Record<string, string> = {
    landing_hero: "Landing (organico)",
    demo_banner: "Demo banner",
    demo_dashboard: "Demo dashboard",
    pricing: "Pagina precios",
    directo: "Directo / sin atribucion",
  };

  const STATUS_LABELS: Record<string, string> = {
    NEW: "Nuevo", CONTACTED: "Contactado", MEETING: "Reunion",
    PILOT: "Piloto", CUSTOMER: "Cliente", LOST: "Perdido",
  };
  const STATUS_COLORS: Record<string, string> = {
    NEW: "bg-gray-200", CONTACTED: "bg-blue-200", MEETING: "bg-yellow-200",
    PILOT: "bg-purple-200", CUSTOMER: "bg-green-200", LOST: "bg-red-200",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Funnel de conversion</h1>
        <Link href="/admin/demo-requests" className="text-sm text-primary hover:underline">
          Ver pipeline completo →
        </Link>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-xs text-gray-500">Leads totales</p>
          <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-xs text-gray-500">Ultimos 30d</p>
          <p className="text-2xl font-bold text-blue-600">{leadsLast30d}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-xs text-gray-500">Trials activos</p>
          <p className="text-2xl font-bold text-purple-600">{trialingSubs}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-xs text-gray-500">Clientes</p>
          <p className="text-2xl font-bold text-green-600">{statusMap["CUSTOMER"] ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-xs text-gray-500">Conversion %</p>
          <p className="text-2xl font-bold text-primary">{conversionRate}%</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Funnel visualization */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="font-semibold mb-4">Funnel</h2>
          <div className="space-y-3">
            {funnel.map((step) => {
              const pct = maxFunnel > 0 ? (step.value / maxFunnel) * 100 : 0;
              return (
                <div key={step.stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{step.stage}</span>
                    <span className="font-semibold">{step.value}</span>
                  </div>
                  <div className="h-6 bg-gray-100 rounded overflow-hidden">
                    <div
                      className={`h-full ${step.color} rounded transition-all flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max(pct, step.value > 0 ? 8 : 0)}%` }}
                    >
                      {pct > 20 && (
                        <span className="text-xs text-white font-medium">{Math.round(pct)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Perdidos: <span className="font-semibold text-red-500">{statusMap["LOST"] ?? 0}</span>
          </p>
        </div>

        {/* Weekly trend */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="font-semibold mb-4">Leads por semana (ultimas 8)</h2>
          <div className="flex items-end gap-2 h-32">
            {weeklyCounts.map((w) => {
              const pct = maxWeekly > 0 ? (w.count / maxWeekly) * 100 : 0;
              return (
                <div key={w.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <span className="text-xs text-gray-500 font-medium">{w.count || ""}</span>
                  <div className="w-full flex flex-col justify-end" style={{ height: "90px" }}>
                    <div
                      className="w-full bg-primary rounded-t transition-all"
                      style={{ height: `${Math.max(pct, w.count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 truncate w-full text-center">{w.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Source attribution */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="font-semibold mb-4">Atribucion por fuente (90d)</h2>
          {Object.keys(sourceMap).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(sourceMap)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => {
                  const totalSource = Object.values(sourceMap).reduce((a, b) => a + b, 0);
                  const pct = totalSource > 0 ? Math.round((count / totalSource) * 100) : 0;
                  return (
                    <div key={source} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{SOURCE_LABELS[source] ?? source}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-gray-500 w-16 text-right">{count} ({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin datos de atribucion todavia</p>
          )}
        </div>

        {/* Pipeline snapshot */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="font-semibold mb-4">Pipeline actual</h2>
          <div className="grid grid-cols-3 gap-2">
            {(["NEW", "CONTACTED", "MEETING", "PILOT", "CUSTOMER", "LOST"] as const).map((status) => (
              <div key={status} className={`p-3 rounded-lg text-center ${STATUS_COLORS[status]}`}>
                <p className="text-lg font-bold">{statusMap[status] ?? 0}</p>
                <p className="text-xs font-medium">{STATUS_LABELS[status]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent conversions */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Ultimas conversiones</h2>
        </div>
        <div className="divide-y">
          {recentConversions.map((lead, i) => {
            const daysTaken = Math.ceil(
              (new Date(lead.updatedAt).getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            );
            return (
              <div key={i} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{lead.name}</span>
                  {lead.company && <span className="text-gray-500 text-sm ml-2">· {lead.company}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">{SOURCE_LABELS[lead.source ?? ""] ?? lead.source ?? "—"}</span>
                  <span className="text-green-600 font-medium">{daysTaken}d lead→cliente</span>
                  <span className="text-gray-400">{new Date(lead.updatedAt).toLocaleDateString("es-ES")}</span>
                </div>
              </div>
            );
          })}
          {recentConversions.length === 0 && (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">Sin conversiones todavia</p>
          )}
        </div>
      </div>
    </div>
  );
}
