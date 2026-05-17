import Link from "next/link";
import type { ActionQueueResult } from "@/lib/action-queue";

type Urgency = "critical" | "high" | "medium" | "low";

const URGENCY_STYLE: Record<Urgency, { dot: string; text: string; label: string }> = {
  critical: { dot: "bg-rose-500", text: "text-rose-700", label: "Crítico" },
  high: { dot: "bg-amber-500", text: "text-amber-700", label: "Prioritario" },
  medium: { dot: "bg-blue-500", text: "text-blue-700", label: "Siguiente" },
  low: { dot: "bg-gray-300", text: "text-gray-500", label: "Cuando puedas" },
};

export function ActionQueueWidget({ queue }: { queue: ActionQueueResult }) {
  if (queue.items.length === 0) {
    return (
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="font-semibold text-gray-900">Plan de acciones</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-sm font-medium text-emerald-700">Nada pendiente de acción inmediata</p>
          <p className="text-xs text-gray-500 mt-1">
            {queue.totalCases === 0
              ? "Aún no hay expedientes activos"
              : `${queue.totalCases} expediente${queue.totalCases === 1 ? "" : "s"} activo${queue.totalCases === 1 ? "" : "s"}, todos al día`}
          </p>
        </div>
      </div>
    );
  }

  const { critical, high, medium, low } = queue.countsByUrgency;

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h2 className="font-semibold text-sm">Plan de acciones</h2>
        </div>
        <span className="text-xs text-slate-400">
          {[
            critical > 0 ? `${critical} crítico${critical === 1 ? "" : "s"}` : null,
            high > 0 ? `${high} prioritario${high === 1 ? "" : "s"}` : null,
            medium + low > 0 ? `${medium + low} más` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <div className="divide-y">
        {queue.items.map((item) => {
          const style = URGENCY_STYLE[item.action.urgency as Urgency] ?? URGENCY_STYLE.low;
          return (
            <Link
              key={item.caseId}
              href={`/cases/${item.caseId}`}
              className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition group"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-xs text-gray-500">{item.caseRef}</span>
                  {item.deceasedName && (
                    <span className="text-xs text-gray-400 truncate">{item.deceasedName}</span>
                  )}
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${style.text}`}>
                    {style.label}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{item.action.action}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{item.action.reason}</p>
              </div>
              <svg
                className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition flex-shrink-0 mt-1"
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
