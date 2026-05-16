"use client";

import { useEffect, useState } from "react";

type Urgency = "critical" | "high" | "medium" | "low" | "none";

interface NextAction {
  action: string;
  reason: string;
  urgency: Urgency;
  relatedTaskId: string | null;
}

const STYLE: Record<Urgency, { bg: string; border: string; iconBg: string; iconColor: string; label: string }> = {
  critical: { bg: "bg-rose-50", border: "border-rose-300", iconBg: "bg-rose-100", iconColor: "text-rose-600", label: "Acción crítica" },
  high: { bg: "bg-amber-50", border: "border-amber-300", iconBg: "bg-amber-100", iconColor: "text-amber-600", label: "Prioritario" },
  medium: { bg: "bg-blue-50", border: "border-blue-200", iconBg: "bg-blue-100", iconColor: "text-blue-600", label: "Siguiente paso" },
  low: { bg: "bg-gray-50", border: "border-gray-200", iconBg: "bg-gray-100", iconColor: "text-gray-500", label: "Siguiente paso" },
  none: { bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", label: "Sin acciones" },
};

export function CaseNextAction({ caseId }: { caseId: string }) {
  const [next, setNext] = useState<NextAction | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/next-action`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setNext(data?.nextAction ?? null))
      .catch(() => setNext(null));
  }, [caseId]);

  if (!next) return null;

  const s = STYLE[next.urgency];

  return (
    <div className={`md:col-span-2 rounded-lg border ${s.border} ${s.bg} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
          <svg className={`w-5 h-5 ${s.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-wider ${s.iconColor}`}>
            {s.label}
          </p>
          <p className="font-semibold text-gray-900 mt-0.5">{next.action}</p>
          <p className="text-sm text-gray-600 mt-0.5">{next.reason}</p>
        </div>
      </div>
    </div>
  );
}
