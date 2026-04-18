"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AuditLog {
  id: string;
  action: string;
  details: string | null;
  ip: string | null;
  createdAt: string;
  userId: string | null;
  caseId: string | null;
  user: { name: string | null; email: string } | null;
  case: { ref: string } | null;
}

interface UserOption {
  id: string;
  label: string;
}

const ACTION_CATEGORIES: Record<string, { label: string; color: string }> = {
  "case.": { label: "Expedientes", color: "bg-blue-100 text-blue-700" },
  "task.": { label: "Tareas", color: "bg-cyan-100 text-cyan-700" },
  "document.": { label: "Documentos", color: "bg-green-100 text-green-700" },
  "user.": { label: "Usuarios", color: "bg-purple-100 text-purple-700" },
  "org.": { label: "Organizacion", color: "bg-indigo-100 text-indigo-700" },
  "subscription.": { label: "Suscripcion", color: "bg-orange-100 text-orange-700" },
  "billing.": { label: "Facturacion", color: "bg-red-100 text-red-700" },
  "autopilot.": { label: "Autopilot", color: "bg-amber-100 text-amber-700" },
  "portal.": { label: "Portal", color: "bg-teal-100 text-teal-700" },
  "retention.": { label: "Retencion", color: "bg-gray-100 text-gray-700" },
};

function getActionBadge(action: string) {
  for (const [prefix, meta] of Object.entries(ACTION_CATEGORIES)) {
    if (action.startsWith(prefix)) return meta;
  }
  return { label: "Otro", color: "bg-gray-100 text-gray-600" };
}

const PAGE_SIZE = 30;

export function AuditLogViewer({ users }: { users: UserOption[] }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (action) params.set("action", action);
    if (userId) params.set("userId", userId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (search) params.set("search", search);

    fetch(`/api/audit-logs?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !controller.signal.aborted) {
          setLogs(data.logs);
          setTotal(data.total);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, action, userId, from, to, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function resetFilters() {
    setAction("");
    setUserId("");
    setFrom("");
    setTo("");
    setSearch("");
    setSearchInput("");
    setPage(1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = "Fecha,Usuario,Accion,Detalles,Expediente,IP";
    const rows = logs.map((l) => {
      const date = new Date(l.createdAt).toLocaleString("es-ES");
      const user = l.user?.name || l.user?.email || "Sistema";
      return [date, user, l.action, l.details || "", l.case?.ref || "", l.ip || ""]
        .map(esc)
        .join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  const hasFilters = action || userId || from || to || search;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar en acciones y detalles..."
                className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90"
              >
                Buscar
              </button>
            </form>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todas</option>
              {Object.entries(ACTION_CATEGORIES).map(([prefix, meta]) => (
                <option key={prefix} value={prefix}>{meta.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Usuario</label>
            <select
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos</option>
              <option value="system">Sistema</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex gap-2">
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
              >
                Limpiar
              </button>
            )}
            <button
              onClick={exportCsv}
              disabled={logs.length === 0}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {total} registro{total !== 1 ? "s" : ""}
          {hasFilters ? " (filtrado)" : ""}
        </span>
        {totalPages > 1 && (
          <span>Pagina {page} de {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500 bg-gray-50">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Accion</th>
                <th className="px-4 py-3 font-medium">Detalles</th>
                <th className="px-4 py-3 font-medium">Expediente</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    No hay registros{hasFilters ? " con los filtros seleccionados" : ""}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.user ? (
                          <span className="font-medium">
                            {log.user.name || log.user.email}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Sistema</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {log.details || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.case ? (
                          <Link
                            href={`/cases/${log.caseId}`}
                            className="text-primary hover:underline font-mono text-xs"
                          >
                            {log.case.ref}
                          </Link>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-400">Cargando...</div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">
              No hay registros{hasFilters ? " con los filtros seleccionados" : ""}
            </div>
          ) : (
            logs.map((log) => {
              const badge = getActionBadge(log.action);
              return (
                <div key={log.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">
                      {log.user?.name || log.user?.email || "Sistema"}
                    </span>
                    {log.details && (
                      <span className="text-gray-500"> — {log.details}</span>
                    )}
                  </p>
                  {log.case && (
                    <Link
                      href={`/cases/${log.caseId}`}
                      className="text-primary text-xs hover:underline font-mono"
                    >
                      {log.case.ref}
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &laquo;
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          {generatePageNumbers(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`ellipsis-${i}`} className="px-2 text-gray-400">...</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-sm border rounded-md ${
                  p === page
                    ? "bg-primary text-white border-primary"
                    : "hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | null)[] = [1];
  if (current > 3) pages.push(null);
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push(null);
  pages.push(total);
  return pages;
}
