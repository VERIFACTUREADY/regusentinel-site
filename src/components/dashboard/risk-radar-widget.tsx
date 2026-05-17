import Link from "next/link";
import type { OrgRiskOverview } from "@/lib/isd-risk-aggregator";

const SEV_STYLE = {
  critical: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
};

export function RiskRadarWidget({ overview }: { overview: OrgRiskOverview }) {
  if (overview.totalActiveAlerts === 0) {
    return (
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="font-semibold text-gray-900">Radar ISD</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-sm font-medium text-green-700">Todos los expedientes en orden</p>
          <p className="text-xs text-gray-500 mt-1">
            {overview.totalCasesAnalyzed === 0
              ? "Aún no hay expedientes activos"
              : `${overview.totalCasesAnalyzed} expediente${overview.totalCasesAnalyzed === 1 ? "" : "s"} sin alertas`}
          </p>
        </div>
      </div>
    );
  }

  const { critical, warning, info } = overview.countsBySeverity;

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="font-semibold text-sm">Radar ISD</h2>
          <span className="text-xs text-slate-400">· {overview.totalActiveAlerts} alertas</span>
        </div>
        <span className="text-xs text-slate-400">
          {overview.totalCasesAnalyzed} expediente{overview.totalCasesAnalyzed === 1 ? "" : "s"} analizado{overview.totalCasesAnalyzed === 1 ? "" : "s"}
        </span>
      </div>

      {/* Severity counts */}
      <div className="grid grid-cols-3 divide-x">
        <div className="px-5 py-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-rose-600">{critical}</span>
            <span className="text-xs text-gray-500">críticas</span>
          </div>
        </div>
        <div className="px-5 py-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-amber-600">{warning}</span>
            <span className="text-xs text-gray-500">avisos</span>
          </div>
        </div>
        <div className="px-5 py-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-blue-600">{info}</span>
            <span className="text-xs text-gray-500">info</span>
          </div>
        </div>
      </div>

      {/* Top cases */}
      <div className="border-t divide-y">
        {overview.topCases.map((c) => {
          const style = SEV_STYLE[c.topRiskSeverity];
          return (
            <Link
              key={c.caseId}
              href={`/cases/${c.caseId}`}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition group"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-xs text-gray-500">{c.caseRef}</span>
                  {c.deceasedName && (
                    <span className="text-sm font-medium text-gray-900 truncate">{c.deceasedName}</span>
                  )}
                  {c.riskCount > 1 && (
                    <span className="text-[10px] uppercase tracking-wider text-gray-400">
                      +{c.riskCount - 1}
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 truncate ${style.text}`}>{c.topRiskTitle}</p>
              </div>
              <svg
                className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
