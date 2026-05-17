"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface UsageData {
  plan: string;
  planLabel: string;
  status: string;
  casesUsed: number;
  casesLimit: number;
  membersUsed: number;
  membersLimit: number;
  month: string;
}

export function UsageWidget() {
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const casesPct = data.casesLimit > 0 ? Math.round((data.casesUsed / data.casesLimit) * 100) : 0;
  const membersPct = data.membersLimit > 0 ? Math.round((data.membersUsed / data.membersLimit) * 100) : 0;
  const casesNearLimit = casesPct >= 80;
  const casesAtLimit = casesPct >= 100;
  const membersNearLimit = membersPct >= 80;

  return (
    <div className="bg-white p-5 rounded-xl border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-gray-900">Uso del plan</h3>
        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
          {data.planLabel}
        </span>
      </div>

      <div className="space-y-4">
        {/* Cases usage */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-gray-500">Expedientes este mes</span>
            <span className={`text-sm font-semibold ${casesAtLimit ? "text-red-600" : casesNearLimit ? "text-orange-600" : "text-gray-900"}`}>
              {data.casesUsed}/{data.casesLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${casesAtLimit ? "bg-red-500" : casesNearLimit ? "bg-orange-500" : "bg-primary"}`}
              style={{ width: `${Math.min(casesPct, 100)}%` }}
            />
          </div>
          {casesAtLimit && (
            <p className="text-xs text-red-600 mt-1 font-medium">
              Limite alcanzado.{" "}
              <Link href="/billing" className="underline">Ampliar plan</Link>
            </p>
          )}
          {casesNearLimit && !casesAtLimit && (
            <p className="text-xs text-orange-600 mt-1">
              {data.casesLimit - data.casesUsed} expedientes restantes
            </p>
          )}
        </div>

        {/* Members usage */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-gray-500">Usuarios</span>
            <span className={`text-sm font-semibold ${membersNearLimit ? "text-orange-600" : "text-gray-900"}`}>
              {data.membersUsed}/{data.membersLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${membersNearLimit ? "bg-orange-500" : "bg-gray-400"}`}
              style={{ width: `${Math.min(membersPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t text-center">
        <Link href="/billing" className="text-xs text-primary hover:underline font-medium">
          Gestionar suscripcion
        </Link>
      </div>
    </div>
  );
}
