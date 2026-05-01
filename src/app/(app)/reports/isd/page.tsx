import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Análisis ISD — BARITUR PRO",
  robots: { index: false },
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

function isdDeadline(deathDate: Date): Date {
  const d = new Date(deathDate);
  d.setMonth(d.getMonth() + 6);
  return d;
}

function daysFromNow(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type RiskBucket = "expired" | "critical" | "warning" | "watch" | "safe";

function riskBucket(daysLeft: number): RiskBucket {
  if (daysLeft < 0) return "expired";
  if (daysLeft < 30) return "critical";
  if (daysLeft < 60) return "warning";
  if (daysLeft < 90) return "watch";
  return "safe";
}

const BUCKET_CONFIG: Record<RiskBucket, { label: string; color: string; bg: string; border: string; dot: string }> = {
  expired:  { label: "Vencido",         color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-600" },
  critical: { label: "Crítico (<30d)",  color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" },
  warning:  { label: "Urgente (30-60d)", color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  dot: "bg-amber-400" },
  watch:    { label: "Atención (60-90d)", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-400" },
  safe:     { label: "OK (>90d)",        color: "text-green-700",   bg: "bg-green-50",  border: "border-green-200",  dot: "bg-green-500" },
};

const BUCKET_ORDER: RiskBucket[] = ["expired", "critical", "warning", "watch", "safe"];

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Recepcion",
  VALIDATION: "Validacion",
  IN_PROGRESS: "En curso",
  PENDING_DOCS: "Docs. pendientes",
  READY_TO_SEND: "Listo para enviar",
  SENT: "Enviado",
  FOLLOW_UP: "Seguimiento",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

export default async function IsdReportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "cases.read")) redirect("/dashboard");

  const orgId = session.user.orgId;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // ── Active cases with death date ──────────────────────────────────────────
  const [activeCasesRaw, closedCasesRaw] = await Promise.all([
    safe(() => prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "ARCHIVED"] },
        deceased: { deathDate: { not: null } },
      },
      select: {
        id: true,
        ref: true,
        status: true,
        province: true,
        isUrgent: true,
        createdAt: true,
        deceased: { select: { fullName: true, deathDate: true } },
        contact: { select: { fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    }), [] as any[]),

    // Closed cases with ISD context for historical compliance
    safe(() => prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { in: ["CLOSED", "ARCHIVED"] },
        closedAt: { gte: twelveMonthsAgo },
        deceased: { deathDate: { not: null } },
      },
      select: {
        closedAt: true,
        province: true,
        deceased: { select: { deathDate: true } },
      },
      take: 2000,
    }), [] as any[]),
  ]);

  // ── Process active cases → risk buckets ───────────────────────────────────
  type CaseRow = {
    id: string;
    ref: string;
    status: string;
    province: string | null;
    isUrgent: boolean;
    deathDate: Date;
    isdDeadlineDate: Date;
    daysLeft: number;
    bucket: RiskBucket;
    deceasedName: string;
    contactName: string | null;
  };

  const caseRows: CaseRow[] = activeCasesRaw.map((c: any) => {
    const deathDate = new Date(c.deceased.deathDate);
    const deadline = isdDeadline(deathDate);
    const daysLeft = daysFromNow(deadline, now);
    return {
      id: c.id,
      ref: c.ref,
      status: c.status,
      province: c.province ?? null,
      isUrgent: c.isUrgent,
      deathDate,
      isdDeadlineDate: deadline,
      daysLeft,
      bucket: riskBucket(daysLeft),
      deceasedName: c.deceased.fullName,
      contactName: c.contact?.fullName ?? null,
    };
  });

  const byBucket: Record<RiskBucket, CaseRow[]> = {
    expired: [], critical: [], warning: [], watch: [], safe: [],
  };
  for (const row of caseRows) byBucket[row.bucket].push(row);
  for (const k of BUCKET_ORDER) byBucket[k as RiskBucket].sort((a, b) => a.daysLeft - b.daysLeft);

  const actionable = [...byBucket.expired, ...byBucket.critical, ...byBucket.warning];
  const totalActive = caseRows.length;
  const atRisk = byBucket.expired.length + byBucket.critical.length;
  const atRiskOrWarning = atRisk + byBucket.warning.length;

  // ── Historical compliance by month ────────────────────────────────────────
  const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthBuckets: {
    label: string;
    start: number;
    end: number;
    onTime: number;
    late: number;
  }[] = [];

  for (let i = 11; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    monthBuckets.push({
      label: `${MONTH_NAMES[mStart.getMonth()]} ${String(mStart.getFullYear()).slice(2)}`,
      start: mStart.getTime(),
      end: mEnd.getTime(),
      onTime: 0,
      late: 0,
    });
  }

  for (const c of closedCasesRaw) {
    if (!c.closedAt || !c.deceased?.deathDate) continue;
    const closedAt = new Date(c.closedAt).getTime();
    const bucket = monthBuckets.find((b) => closedAt >= b.start && closedAt < b.end);
    if (!bucket) continue;
    const daysToClose = Math.floor(
      (closedAt - new Date(c.deceased.deathDate).getTime()) / 86400000
    );
    const deadline = isdDeadline(new Date(c.deceased.deathDate));
    if (new Date(c.closedAt) <= deadline) bucket.onTime++;
    else bucket.late++;
  }

  const maxMonthCount = Math.max(...monthBuckets.map((b) => b.onTime + b.late), 1);
  const totalClosed = closedCasesRaw.length;
  const totalOnTime = monthBuckets.reduce((s, b) => s + b.onTime, 0);
  const complianceRate = totalClosed > 0 ? Math.round((totalOnTime / totalClosed) * 100) : null;

  // ── Province compliance breakdown ─────────────────────────────────────────
  const provinceMap: Record<string, { onTime: number; late: number; active: number }> = {};
  for (const c of closedCasesRaw) {
    const province = c.province || "Sin provincia";
    if (!provinceMap[province]) provinceMap[province] = { onTime: 0, late: 0, active: 0 };
    if (!c.closedAt || !c.deceased?.deathDate) continue;
    const deadline = isdDeadline(new Date(c.deceased.deathDate));
    if (new Date(c.closedAt) <= deadline) provinceMap[province].onTime++;
    else provinceMap[province].late++;
  }
  for (const row of caseRows) {
    const province = row.province || "Sin provincia";
    if (!provinceMap[province]) provinceMap[province] = { onTime: 0, late: 0, active: 0 };
    provinceMap[province].active++;
  }

  const provinceEntries = Object.entries(provinceMap)
    .map(([name, stats]) => ({
      name,
      ...stats,
      total: stats.onTime + stats.late,
      rate: stats.onTime + stats.late > 0 ? Math.round((stats.onTime / (stats.onTime + stats.late)) * 100) : null,
    }))
    .sort((a, b) => b.active + b.total - a.active - a.total);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/reports" className="text-sm text-gray-400 hover:text-gray-600">Informes</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-700">Análisis ISD</span>
          </div>
          <h1 className="text-2xl font-bold">Análisis de plazos ISD</h1>
          <p className="text-sm text-gray-500 mt-1">
            Control del plazo Modelo 650 — 6 meses desde la fecha de fallecimiento
          </p>
        </div>
        <Link
          href="/cases?isdExpiring=30"
          className="shrink-0 flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Ver casos urgentes
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Activos con ISD</p>
          <p className="text-3xl font-bold text-gray-900">{totalActive}</p>
        </div>
        <div className={`border rounded-lg p-4 ${atRisk > 0 ? "bg-red-50 border-red-200" : "bg-white"}`}>
          <p className={`text-xs mb-1 ${atRisk > 0 ? "text-red-600" : "text-gray-500"}`}>En riesgo (&lt;30d o vencido)</p>
          <p className={`text-3xl font-bold ${atRisk > 0 ? "text-red-700" : "text-gray-900"}`}>{atRisk}</p>
        </div>
        <div className={`border rounded-lg p-4 ${atRiskOrWarning > atRisk ? "bg-amber-50 border-amber-200" : "bg-white"}`}>
          <p className="text-xs text-gray-500 mb-1">Con alerta (30-90d)</p>
          <p className={`text-3xl font-bold ${atRiskOrWarning > atRisk ? "text-amber-700" : "text-gray-900"}`}>
            {atRiskOrWarning - atRisk}
          </p>
        </div>
        <div className={`border rounded-lg p-4 ${complianceRate !== null && complianceRate < 80 ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
          <p className="text-xs text-gray-500 mb-1">Cumplimiento histórico</p>
          <p className={`text-3xl font-bold ${complianceRate !== null && complianceRate < 80 ? "text-orange-700" : "text-green-700"}`}>
            {complianceRate !== null ? `${complianceRate}%` : "—"}
          </p>
        </div>
      </div>

      {/* Risk distribution cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {BUCKET_ORDER.map((b) => {
          const cfg = BUCKET_CONFIG[b];
          const count = byBucket[b].length;
          return (
            <div key={b} className={`${cfg.bg} border ${cfg.border} rounded-lg p-4 text-center`}>
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${cfg.dot} mb-2`}>
                <span className="text-white text-sm font-bold">{count}</span>
              </div>
              <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Actionable cases table */}
      {actionable.length > 0 && (
        <div className="bg-white border rounded-lg mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">
              Expedientes que requieren atención
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({actionable.length} caso{actionable.length !== 1 ? "s" : ""} vencido{actionable.length !== 1 ? "s" : ""} o &lt;60d)
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 bg-gray-50">
                  <th className="px-4 py-3 font-medium">Expediente</th>
                  <th className="px-4 py-3 font-medium">Fallecido</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Provincia</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Fallecimiento</th>
                  <th className="px-4 py-3 font-medium">Límite ISD</th>
                  <th className="px-4 py-3 font-medium">Días</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {actionable.map((row) => {
                  const cfg = BUCKET_CONFIG[row.bucket];
                  const isExpired = row.bucket === "expired";
                  return (
                    <tr key={row.id} className={`border-b last:border-0 hover:bg-gray-50 ${isExpired ? "bg-red-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <Link href={`/cases/${row.id}`} className="font-mono text-xs text-primary hover:underline">
                            {row.ref}
                          </Link>
                          {row.isUrgent && (
                            <span className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded hidden sm:inline">U</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">{row.deceasedName}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{row.province ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">
                        {row.deathDate.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-700">
                        {row.isdDeadlineDate.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${cfg.color}`}>
                          {isExpired ? `+${Math.abs(row.daysLeft)}d` : `${row.daysLeft}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">
                        {STATUS_LABELS[row.status] ?? row.status}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/cases/${row.id}`}
                          className="text-xs px-2.5 py-1.5 border border-primary/30 text-primary rounded-md hover:bg-primary/5 whitespace-nowrap"
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {byBucket.watch.length > 0 && (
            <div className="px-6 py-3 border-t bg-gray-50 text-xs text-gray-500">
              + {byBucket.watch.length} expediente{byBucket.watch.length !== 1 ? "s" : ""} en seguimiento (60-90d) y {byBucket.safe.length} sin urgencia.{" "}
              <Link href="/cases" className="text-primary hover:underline">Ver todos →</Link>
            </div>
          )}
        </div>
      )}

      {/* No active cases at risk */}
      {totalActive === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 mb-8 text-center">
          <svg className="w-10 h-10 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-green-700 font-medium">No hay expedientes activos con fecha de fallecimiento registrada.</p>
          <p className="text-sm text-green-600 mt-1">Registra la fecha de fallecimiento en cada expediente para activar el seguimiento ISD.</p>
        </div>
      )}

      {actionable.length === 0 && totalActive > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8 flex items-center gap-3">
          <svg className="w-8 h-8 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium text-green-800">Sin expedientes urgentes ahora mismo</p>
            <p className="text-sm text-green-700 mt-0.5">
              {byBucket.watch.length > 0
                ? `${byBucket.watch.length} expediente${byBucket.watch.length !== 1 ? "s" : ""} con plazo entre 60 y 90 días. Mantenlos monitorizados.`
                : "Todos los expedientes activos tienen más de 90 días de margen."}
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Historical compliance chart */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold">Cumplimiento mensual (12m)</h2>
              <p className="text-xs text-gray-400 mt-0.5">Expedientes cerrados dentro del plazo ISD</p>
            </div>
            {complianceRate !== null && (
              <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                complianceRate >= 90 ? "bg-green-100 text-green-700" :
                complianceRate >= 70 ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              }`}>
                {complianceRate}% total
              </span>
            )}
          </div>
          {totalClosed === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin expedientes cerrados con ISD en los últimos 12 meses.</p>
          ) : (
            <>
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {monthBuckets.map((mb) => {
                  const total = mb.onTime + mb.late;
                  const rate = total > 0 ? mb.onTime / total : 0;
                  const barH = total > 0 ? Math.max((total / maxMonthCount) * 100, 4) : 0;
                  return (
                    <div key={mb.label} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full flex flex-col items-center justify-end" style={{ height: 100 }}>
                        {total > 0 ? (
                          <div
                            className="w-full rounded-t overflow-hidden"
                            style={{ height: `${barH}%` }}
                            title={`${mb.label}: ${mb.onTime} a tiempo, ${mb.late} tarde`}
                          >
                            <div
                              className="bg-green-500 w-full"
                              style={{ height: `${rate * 100}%` }}
                            />
                            <div
                              className="bg-red-400 w-full"
                              style={{ height: `${(1 - rate) * 100}%` }}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-1 bg-gray-100 rounded-t" />
                        )}
                      </div>
                      <span className="text-xs text-gray-400 truncate w-full text-center" style={{ fontSize: "0.6rem" }}>
                        {mb.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-500 inline-block" /> En plazo
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-400 inline-block" /> Fuera de plazo
                </span>
              </div>
            </>
          )}
        </div>

        {/* Province breakdown */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="font-semibold mb-5">Por provincia</h2>
          {provinceEntries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos de provincia disponibles.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-400">
                    <th className="pb-2 font-medium">Provincia</th>
                    <th className="pb-2 font-medium text-right">Activos</th>
                    <th className="pb-2 font-medium text-right hidden sm:table-cell">A tiempo</th>
                    <th className="pb-2 font-medium text-right hidden sm:table-cell">Tarde</th>
                    <th className="pb-2 font-medium text-right">Cumpl.</th>
                    <th className="pb-2 font-medium w-20">Tasa</th>
                  </tr>
                </thead>
                <tbody>
                  {provinceEntries.slice(0, 12).map((p) => (
                    <tr key={p.name} className="border-b last:border-0">
                      <td className="py-2 font-medium text-gray-700 truncate max-w-[100px]">{p.name}</td>
                      <td className="py-2 text-right text-gray-500">{p.active}</td>
                      <td className="py-2 text-right text-green-600 hidden sm:table-cell">{p.onTime}</td>
                      <td className="py-2 text-right text-red-500 hidden sm:table-cell">{p.late}</td>
                      <td className="py-2 text-right font-semibold">
                        {p.rate !== null ? (
                          <span className={
                            p.rate >= 90 ? "text-green-700" :
                            p.rate >= 70 ? "text-amber-600" :
                            "text-red-600"
                          }>
                            {p.rate}%
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        {p.total > 0 && (
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                            <div className="bg-green-500 h-full" style={{ width: `${(p.onTime / p.total) * 100}%` }} />
                            <div className="bg-red-400 h-full" style={{ width: `${(p.late / p.total) * 100}%` }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Watch list (60-90d) — condensed */}
      {byBucket.watch.length > 0 && (
        <div className="bg-white border rounded-lg mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-yellow-700">
              En seguimiento — 60 a 90 días
              <span className="ml-2 text-sm font-normal text-gray-400">({byBucket.watch.length} expediente{byBucket.watch.length !== 1 ? "s" : ""})</span>
            </h2>
          </div>
          <div className="divide-y">
            {byBucket.watch.map((row) => (
              <div key={row.id} className="px-6 py-3 flex items-center gap-3 hover:bg-yellow-50/40">
                <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                <Link href={`/cases/${row.id}`} className="font-mono text-xs text-primary hover:underline w-24 shrink-0">
                  {row.ref}
                </Link>
                <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{row.deceasedName}</span>
                <span className="text-xs text-gray-400 hidden sm:block">{row.province ?? "—"}</span>
                <span className="text-sm font-semibold text-yellow-700 shrink-0">{row.daysLeft}d</span>
                <Link href={`/cases/${row.id}`} className="text-xs text-gray-400 hover:text-primary shrink-0">→</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Methodology note */}
      <div className="p-4 bg-gray-50 border rounded-lg text-xs text-gray-500">
        <strong>Metodología:</strong> El plazo ISD se calcula como 6 meses exactos desde la fecha de fallecimiento registrada en el expediente (Modelo 650, art. 67 LISD). Solo se incluyen expedientes activos con fecha de fallecimiento registrada. El cumplimiento histórico compara la fecha de cierre del expediente con el plazo calculado; no refleja posibles prórrogas presentadas.
      </div>
    </div>
  );
}
