"use client";

import { useEffect, useState } from "react";

type HealthGrade = "A" | "B" | "C" | "D" | "E";

interface HealthFactor {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  hint: string | null;
}

interface CaseHealth {
  score: number;
  grade: HealthGrade;
  gradeLabel: string;
  factors: HealthFactor[];
  topIssue: string | null;
}

const GRADE_STYLE: Record<HealthGrade, { ring: string; text: string; bg: string }> = {
  A: { ring: "stroke-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50" },
  B: { ring: "stroke-lime-500", text: "text-lime-600", bg: "bg-lime-50" },
  C: { ring: "stroke-amber-500", text: "text-amber-600", bg: "bg-amber-50" },
  D: { ring: "stroke-orange-500", text: "text-orange-600", bg: "bg-orange-50" },
  E: { ring: "stroke-rose-500", text: "text-rose-600", bg: "bg-rose-50" },
};

export function CaseHealthCard({ caseId }: { caseId: string }) {
  const [health, setHealth] = useState<CaseHealth | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/health`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHealth(data?.health ?? null))
      .catch(() => setHealth(null));
  }, [caseId]);

  if (!health) return null;

  const style = GRADE_STYLE[health.grade];
  // SVG ring geometry
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - health.score / 100);

  return (
    <div className="md:col-span-2 bg-white rounded-lg border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition"
      >
        {/* Score ring */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-gray-100" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className={style.ring}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold ${style.text}`}>{health.score}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Salud del expediente</h3>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
              {health.grade} · {health.gradeLabel}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-0.5 truncate">
            {health.topIssue ?? "El expediente está al día. Sin acciones pendientes destacadas."}
          </p>
        </div>

        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t divide-y">
          {health.factors.map((f) => {
            const pct = f.maxPoints > 0 ? (f.points / f.maxPoints) * 100 : 0;
            const barColor = pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";
            return (
              <div key={f.key} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-800">{f.label}</span>
                  <span className="text-xs text-gray-500 font-mono">
                    {f.points}/{f.maxPoints}
                  </span>
                </div>
                <div className="bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                {f.hint && <p className="text-xs text-gray-500 mt-1.5">{f.hint}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
