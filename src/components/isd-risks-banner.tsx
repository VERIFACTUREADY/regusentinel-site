"use client";

import { useEffect, useState } from "react";

type Severity = "info" | "warning" | "critical";

interface Risk {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  action?: string;
}

const STYLES: Record<Severity, { bg: string; border: string; icon: string; label: string; iconColor: string }> = {
  critical: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    icon: "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    label: "Critico",
    iconColor: "text-rose-600",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z",
    label: "Atencion",
    iconColor: "text-amber-600",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    label: "Info",
    iconColor: "text-blue-600",
  },
};

export function IsdRisksBanner({ caseId }: { caseId: string }) {
  const [risks, setRisks] = useState<Risk[] | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/isd-risks`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRisks(data?.risks ?? []))
      .catch(() => setRisks([]));
  }, [caseId]);

  if (!risks || risks.length === 0) return null;

  // Ordenar por severidad: critical → warning → info
  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  const sorted = [...risks].sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <div className="md:col-span-2 space-y-2 mb-2">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Radar ISD ({sorted.length} {sorted.length === 1 ? "alerta" : "alertas"})
      </div>
      {sorted.map((r) => {
        const s = STYLES[r.severity];
        return (
          <div key={r.id} className={`rounded-lg border ${s.border} ${s.bg} p-4`}>
            <div className="flex items-start gap-3">
              <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${s.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h4 className="font-semibold text-gray-900">{r.title}</h4>
                  <span className={`text-[10px] uppercase tracking-wider ${s.iconColor}`}>{s.label}</span>
                </div>
                <p className="mt-1 text-sm text-gray-700">{r.description}</p>
                {r.action && (
                  <p className="mt-2 text-sm text-gray-900">
                    <span className="font-medium">→ </span>{r.action}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
