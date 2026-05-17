"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

interface LogEntry {
  id: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  error: string | null;
  createdAt: string;
  rule: { id: string; name: string };
  case: { id: string; ref: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: "Exitoso",
  FAILED: "Error",
  SKIPPED: "Omitido",
};

export function WorkflowLogsClient({
  initialLogs,
  initialTotal,
  rules,
  statMap,
}: {
  initialLogs: LogEntry[];
  initialTotal: number;
  rules: { id: string; name: string }[];
  statMap: Record<string, number>;
}) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRule, setFilterRule] = useState("");

  const LIMIT = 30;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchLogs = useCallback(
    async (p: number, status: string, ruleId: string) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (status) params.set("status", status);
      if (ruleId) params.set("ruleId", ruleId);
      try {
        const res = await fetch(`/api/workflow-logs?${params}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs);
          setTotal(data.total);
        }
      } catch {}
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    if (page !== 1 || filterStatus || filterRule) {
      fetchLogs(page, filterStatus, filterRule);
    }
  }, [page, filterStatus, filterRule, fetchLogs]);

  function handleFilter(status: string, ruleId: string) {
    setFilterStatus(status);
    setFilterRule(ruleId);
    setPage(1);
    fetchLogs(1, status, ruleId);
  }

  const successCount = statMap["SUCCESS"] ?? 0;
  const failedCount = statMap["FAILED"] ?? 0;
  const skippedCount = statMap["SKIPPED"] ?? 0;
  const totalCount = successCount + failedCount + skippedCount;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Registro de automatizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Historial de ejecuciones de todas las reglas
          </p>
        </div>
        <Link
          href="/workflow-rules"
          className="text-sm text-primary hover:underline"
        >
          &larr; Gestionar reglas
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Total ejecuciones</p>
          <p className="text-2xl font-bold">{totalCount.toLocaleString("es-ES")}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Exitosas</p>
          <p className="text-2xl font-bold text-green-600">{successCount.toLocaleString("es-ES")}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Con error</p>
          <p className="text-2xl font-bold text-red-600">{failedCount.toLocaleString("es-ES")}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Tasa de exito</p>
          <p className="text-2xl font-bold">{successRate}%</p>
          <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {["", "SUCCESS", "FAILED", "SKIPPED"].map((s) => (
            <button
              key={s}
              onClick={() => handleFilter(s, filterRule)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                filterStatus === s
                  ? "bg-primary text-white border-primary"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "" ? "Todos" : STATUS_LABELS[s]}
              {s !== "" && (
                <span className="ml-1 text-xs opacity-75">
                  {(statMap[s] ?? 0).toLocaleString("es-ES")}
                </span>
              )}
            </button>
          ))}
        </div>
        <select
          value={filterRule}
          onChange={(e) => handleFilter(filterStatus, e.target.value)}
          className="ml-auto px-3 py-1.5 border rounded-md text-sm"
        >
          <option value="">Todas las reglas</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-lg mb-1">Sin ejecuciones</p>
            <p className="text-sm">
              {filterStatus || filterRule
                ? "No hay registros con los filtros seleccionados."
                : "Las ejecuciones aparecerán aquí cuando se disparen reglas de automatización."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-left">Regla</th>
                    <th className="px-4 py-3 text-left">Expediente</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[log.status]}`}>
                          {STATUS_LABELS[log.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href="/workflow-rules"
                          className="text-primary hover:underline font-medium"
                        >
                          {log.rule.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {log.case ? (
                          <Link
                            href={`/cases/${log.case.id}`}
                            className="text-primary hover:underline font-mono text-xs"
                          >
                            {log.case.ref}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {log.error ? (
                          <span className="text-red-600 text-xs truncate block" title={log.error}>
                            {log.error}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
                <span>
                  {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de {total.toLocaleString("es-ES")}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
