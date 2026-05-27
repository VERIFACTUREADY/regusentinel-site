import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Pipeline SLA — Heredia",
  robots: { index: false },
};

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
};

const STATUS_COLORS: Record<string, string> = {
  INTAKE: "bg-slate-400",
  VALIDATION: "bg-yellow-400",
  IN_PROGRESS: "bg-blue-500",
  PENDING_DOCS: "bg-orange-400",
  READY_TO_SEND: "bg-purple-500",
  SENT: "bg-indigo-500",
  FOLLOW_UP: "bg-cyan-500",
};

const STATUS_LIGHT: Record<string, string> = {
  INTAKE: "bg-slate-50 border-slate-200",
  VALIDATION: "bg-yellow-50 border-yellow-200",
  IN_PROGRESS: "bg-blue-50 border-blue-200",
  PENDING_DOCS: "bg-orange-50 border-orange-200",
  READY_TO_SEND: "bg-purple-50 border-purple-200",
  SENT: "bg-indigo-50 border-indigo-200",
  FOLLOW_UP: "bg-cyan-50 border-cyan-200",
};

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)];
}

function staleColor(days: number | null): string {
  if (days === null) return "text-gray-400";
  if (days > 60) return "text-red-600 font-semibold";
  if (days > 30) return "text-amber-600 font-medium";
  return "text-green-700";
}

function staleLabel(days: number | null): string {
  if (days === null) return "—";
  if (days > 60) return `${days}d ⚠`;
  if (days > 30) return `${days}d`;
  return `${days}d`;
}

export default async function PipelinePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "cases.read")) redirect("/dashboard");

  const orgId = session.user.orgId;
  const now = Date.now();
  const since18m = new Date(now - 18 * 30 * 24 * 60 * 60 * 1000);
  const since12m = new Date(now - 12 * 30 * 24 * 60 * 60 * 1000);

  async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try { return await fn(); } catch { return fallback; }
  }

  const [activeCases, closedCases, allRecentCases] = await Promise.all([
    safe(() => prisma.case.findMany({
      where: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
      select: { status: true, createdAt: true, updatedAt: true },
    }), [] as any[]),
    safe(() => prisma.case.findMany({
      where: { orgId, deletedAt: null, status: { in: ["CLOSED", "ARCHIVED"] }, closedAt: { gte: since18m } },
      select: { createdAt: true, closedAt: true },
    }), [] as any[]),
    safe(() => prisma.case.findMany({
      where: {
        orgId, deletedAt: null,
        OR: [{ createdAt: { gte: since12m } }, { closedAt: { gte: since12m } }],
      },
      select: { createdAt: true, closedAt: true },
    }), [] as any[]),
  ]);

  // ── Stage breakdown ──────────────────────────────────────
  const stageMap: Record<string, { count: number; daysInStage: number[]; totalAge: number[] }> = {};
  for (const s of ACTIVE_STATUSES) stageMap[s] = { count: 0, daysInStage: [], totalAge: [] };

  for (const c of activeCases as any[]) {
    const entry = stageMap[c.status];
    if (!entry) continue;
    entry.count++;
    entry.daysInStage.push(Math.floor((now - new Date(c.updatedAt).getTime()) / 86400000));
    entry.totalAge.push(Math.floor((now - new Date(c.createdAt).getTime()) / 86400000));
  }

  const stages = ACTIVE_STATUSES.map((s) => {
    const e = stageMap[s];
    const sortedInStage = [...e.daysInStage].sort((a, b) => a - b);
    return {
      status: s,
      label: STATUS_LABELS[s],
      count: e.count,
      avgDays: e.daysInStage.length ? Math.round(e.daysInStage.reduce((a, b) => a + b, 0) / e.daysInStage.length) : null,
      medianDays: sortedInStage.length ? median(sortedInStage) : null,
      p90Days: sortedInStage.length ? pct(sortedInStage, 90) : null,
      stale30: e.daysInStage.filter((d) => d > 30).length,
      stale60: e.daysInStage.filter((d) => d > 60).length,
    };
  });

  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const totalActive = stages.reduce((a, s) => a + s.count, 0);
  const totalStale30 = stages.reduce((a, s) => a + s.stale30, 0);

  // ── Resolution time ──────────────────────────────────────
  const resolutionDays = (closedCases as any[])
    .filter((c: any) => c.closedAt)
    .map((c: any) => Math.floor((new Date(c.closedAt).getTime() - new Date(c.createdAt).getTime()) / 86400000))
    .filter((d: number) => d >= 0)
    .sort((a: number, b: number) => a - b);

  const avgRes = resolutionDays.length ? Math.round(resolutionDays.reduce((a: number, b: number) => a + b, 0) / resolutionDays.length) : null;
  const medRes = resolutionDays.length ? median(resolutionDays) : null;
  const p90Res = resolutionDays.length ? pct(resolutionDays, 90) : null;

  const buckets = [
    { label: "0–30d", count: resolutionDays.filter((d: number) => d <= 30).length, color: "bg-green-500" },
    { label: "31–60d", count: resolutionDays.filter((d: number) => d > 30 && d <= 60).length, color: "bg-blue-500" },
    { label: "61–90d", count: resolutionDays.filter((d: number) => d > 60 && d <= 90).length, color: "bg-indigo-500" },
    { label: "91–120d", count: resolutionDays.filter((d: number) => d > 90 && d <= 120).length, color: "bg-amber-500" },
    { label: "121–180d", count: resolutionDays.filter((d: number) => d > 120 && d <= 180).length, color: "bg-orange-500" },
    { label: ">180d", count: resolutionDays.filter((d: number) => d > 180).length, color: "bg-red-500" },
  ];
  const maxBucket = Math.max(...buckets.map((b) => b.count), 1);

  // ── Monthly throughput ───────────────────────────────────
  const throughput: { month: string; created: number; closed: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const label = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
    const created = (allRecentCases as any[]).filter((c: any) => {
      const t = new Date(c.createdAt).getTime();
      return t >= mStart && t < mEnd;
    }).length;
    const closed = (allRecentCases as any[]).filter((c: any) => {
      if (!c.closedAt) return false;
      const t = new Date(c.closedAt).getTime();
      return t >= mStart && t < mEnd;
    }).length;
    throughput.push({ month: label, created, closed });
  }
  const maxThroughput = Math.max(...throughput.flatMap((t) => [t.created, t.closed]), 1);

  // ISD compliance fraction
  const withinISD = resolutionDays.filter((d: number) => d <= 180).length;
  const isdCompliance = resolutionDays.length ? Math.round((withinISD / resolutionDays.length) * 100) : null;

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/reports" className="hover:text-gray-700">Informes</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Pipeline SLA</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Análisis de pipeline y SLA</h1>
          <p className="text-sm text-gray-500 mt-1">
            Velocidad por etapa, tiempo de resolución y cuellos de botella
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className={`px-3 py-1 rounded-full font-medium ${totalStale30 > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
            {totalStale30 > 0 ? `${totalStale30} estancado${totalStale30 !== 1 ? "s" : ""} >30d` : "Sin estancamientos"}
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Expedientes activos</p>
          <p className="text-2xl font-bold text-gray-900">{totalActive}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Tiempo resolución (mediana)</p>
          <p className="text-2xl font-bold text-gray-900">{medRes !== null ? `${medRes}d` : "—"}</p>
          {avgRes !== null && <p className="text-xs text-gray-400 mt-0.5">media {avgRes}d</p>}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">P90 resolución</p>
          <p className="text-2xl font-bold text-gray-900">{p90Res !== null ? `${p90Res}d` : "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">últimos 18 meses</p>
        </div>
        <div className={`border rounded-lg p-4 ${isdCompliance !== null && isdCompliance < 85 ? "bg-amber-50 border-amber-200" : "bg-white"}`}>
          <p className="text-xs text-gray-500 mb-1">Cumplimiento ISD ≤180d</p>
          <p className={`text-2xl font-bold ${isdCompliance !== null && isdCompliance < 85 ? "text-amber-600" : "text-green-700"}`}>
            {isdCompliance !== null ? `${isdCompliance}%` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{resolutionDays.length} casos cerrados</p>
        </div>
      </div>

      {/* Pipeline funnel */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-1">Pipeline actual — casos por etapa</h2>
        <p className="text-xs text-gray-400 mb-5">
          Tiempo en etapa = días desde última actualización (proxy para tiempo en estado actual)
        </p>

        {totalActive === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Sin expedientes activos</p>
        ) : (
          <div className="space-y-3">
            {stages.map((s) => {
              const barPct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
              const barColor = STATUS_COLORS[s.status] ?? "bg-gray-400";
              const cardColor = STATUS_LIGHT[s.status] ?? "bg-gray-50 border-gray-200";
              return (
                <div key={s.status} className={`rounded-lg border p-3 ${cardColor}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-32 shrink-0">
                      <p className="text-xs font-semibold text-gray-700 leading-tight">{s.label}</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white/60 rounded-full h-4 overflow-hidden border border-white/40">
                          <div
                            className={`h-4 rounded-full transition-all ${barColor}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-800 w-6 text-right">{s.count}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 ml-32 pl-3 text-xs text-gray-500">
                    <span>Mediana: <strong className={staleColor(s.medianDays)}>{staleLabel(s.medianDays)}</strong></span>
                    <span>Media: <strong className={staleColor(s.avgDays)}>{staleLabel(s.avgDays)}</strong></span>
                    <span>P90: <strong className={staleColor(s.p90Days)}>{staleLabel(s.p90Days)}</strong></span>
                    {s.stale60 > 0 && (
                      <span className="text-red-600 font-semibold">{s.stale60} sin mover en +60d</span>
                    )}
                    {s.stale60 === 0 && s.stale30 > 0 && (
                      <span className="text-amber-600">{s.stale30} sin mover en +30d</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Resolution time distribution */}
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold mb-1">Distribución del tiempo de resolución</h2>
          <p className="text-xs text-gray-400 mb-4">Desde creación hasta cierre (últimos 18 meses)</p>

          {resolutionDays.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">Sin casos cerrados en el período</p>
          ) : (
            <div className="space-y-2.5">
              {buckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{b.label}</span>
                  <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                    <div
                      className={`h-5 rounded transition-all ${b.color}`}
                      style={{ width: `${(b.count / maxBucket) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-6 text-right">{b.count}</span>
                  <span className="text-xs text-gray-400 w-10 text-right">
                    {resolutionDays.length ? `${Math.round((b.count / resolutionDays.length) * 100)}%` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {resolutionDays.length > 0 && (
            <div className="mt-4 pt-3 border-t flex gap-6 text-xs text-gray-500">
              <span>Mediana <strong className="text-gray-800">{medRes}d</strong></span>
              <span>Media <strong className="text-gray-800">{avgRes}d</strong></span>
              <span>P90 <strong className="text-gray-800">{p90Res}d</strong></span>
            </div>
          )}
        </div>

        {/* Monthly throughput */}
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold mb-1">Flujo mensual (12 meses)</h2>
          <p className="text-xs text-gray-400 mb-4">Expedientes abiertos vs cerrados</p>

          <div className="flex items-end gap-1.5 h-32">
            {throughput.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                <div className="w-full flex gap-0.5 items-end justify-center h-full">
                  <div
                    className="flex-1 bg-indigo-400 rounded-sm"
                    style={{ height: `${(m.created / maxThroughput) * 100}%`, minHeight: m.created ? 2 : 0 }}
                    title={`Abiertos: ${m.created}`}
                  />
                  <div
                    className="flex-1 bg-green-400 rounded-sm"
                    style={{ height: `${(m.closed / maxThroughput) * 100}%`, minHeight: m.closed ? 2 : 0 }}
                    title={`Cerrados: ${m.closed}`}
                  />
                </div>
                <span className="text-[9px] text-gray-400 truncate w-full text-center">{m.month}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 inline-block" /> Abiertos</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Cerrados</span>
          </div>
        </div>
      </div>

      {/* Bottleneck table */}
      {stages.some((s) => s.stale30 > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-amber-900 mb-3">Cuellos de botella detectados</h2>
          <p className="text-xs text-amber-700 mb-4">Etapas con expedientes sin movimiento durante más de 30 días</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-amber-600 uppercase">
                <th className="text-left pb-2">Etapa</th>
                <th className="text-right pb-2">Estancados +30d</th>
                <th className="text-right pb-2">Estancados +60d</th>
                <th className="text-right pb-2">% del total en etapa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {stages.filter((s) => s.stale30 > 0).map((s) => (
                <tr key={s.status}>
                  <td className="py-2 font-medium text-gray-800">{s.label}</td>
                  <td className="py-2 text-right text-amber-700 font-semibold">{s.stale30}</td>
                  <td className={`py-2 text-right font-semibold ${s.stale60 > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {s.stale60 > 0 ? s.stale60 : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-600">
                    {s.count > 0 ? `${Math.round((s.stale30 / s.count) * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-amber-600 mt-3">
            Accede a la vista Kanban o filtra por expediente para revisar estos casos directamente.{" "}
            <Link href="/cases/kanban" className="underline font-medium">Ver Kanban →</Link>
          </p>
        </div>
      )}

      {/* Methodology note */}
      <div className="p-4 bg-gray-50 border rounded-lg text-xs text-gray-500">
        <strong>Nota metodológica:</strong> "Tiempo en etapa" usa la fecha de última actualización del expediente como aproximación. Si un expediente fue editado sin cambiar de estado, el contador se reinicia. Para métricas precisas de transición entre estados, consulte el Audit Trail.
      </div>
    </div>
  );
}
