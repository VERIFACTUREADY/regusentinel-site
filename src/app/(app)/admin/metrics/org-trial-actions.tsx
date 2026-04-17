"use client";

import { useState } from "react";

const PLANS = ["INICIA", "DESPACHO", "FIRMA"] as const;
const DAYS_OPTIONS = [7, 14, 30] as const;

export function OrgTrialActions({
  orgId,
  currentStatus,
  currentPlan,
}: {
  orgId: string;
  currentStatus?: string | null;
  currentPlan?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<string>(currentPlan || "DESPACHO");
  const [days, setDays] = useState<number>(14);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const isTrialing = currentStatus === "trialing";

  async function activate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, days }),
      });
      if (!res.ok) {
        const data = await res.json();
        setResult(data.error || "Error");
        return;
      }
      setResult(isTrialing ? `Trial extendido ${days}d` : `Trial activado ${days}d`);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <span className="text-xs text-green-600 font-medium">{result}</span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-primary hover:underline font-medium"
      >
        {isTrialing ? "Extender" : "Activar trial"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        className="text-xs border rounded px-1.5 py-1"
      >
        {PLANS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        className="text-xs border rounded px-1.5 py-1"
      >
        {DAYS_OPTIONS.map((d) => (
          <option key={d} value={d}>{d}d</option>
        ))}
      </select>
      <button
        onClick={activate}
        disabled={loading}
        className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "..." : "OK"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        X
      </button>
    </div>
  );
}
