"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface NotifLog {
  id: string;
  kind: string;
  channel: string;
  recipient: string;
  status: string;
  error: string | null;
  createdAt: string;
  caseId: string;
  case: { ref: string; deceased: { fullName: string } | null } | null;
}

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  ISD_60D: { label: "ISD 60 dias", color: "bg-blue-100 text-blue-700" },
  ISD_30D: { label: "ISD 30 dias", color: "bg-yellow-100 text-yellow-700" },
  ISD_7D: { label: "ISD 7 dias", color: "bg-orange-100 text-orange-700" },
  ISD_1D: { label: "ISD manana", color: "bg-red-100 text-red-700" },
  ISD_PASSED: { label: "ISD vencido", color: "bg-red-200 text-red-800" },
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL_INTERNAL: "Email interno",
  EMAIL_FAMILY: "Email familia",
};

const PAGE_SIZE = 30;

export function NotificationLogViewer() {
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (kind) params.set("kind", kind);
    if (channel) params.set("channel", channel);
    if (status) params.set("status", status);

    const res = await fetch(`/api/notifications?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, kind, channel, status]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = kind || channel || status;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <select
              value={kind}
              onChange={(e) => { setKind(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos</option>
              {Object.entries(KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Canal</label>
            <select
              value={channel}
              onChange={(e) => { setChannel(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos</option>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos</option>
              <option value="sent">Enviado</option>
              <option value="failed">Fallido</option>
            </select>
          </div>

          {hasFilters && (
            <button
              onClick={() => { setKind(""); setChannel(""); setStatus(""); setPage(1); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{total} notificacion{total !== 1 ? "es" : ""}{hasFilters ? " (filtrado)" : ""}</span>
        {totalPages > 1 && <span>Pagina {page} de {totalPages}</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500 bg-gray-50">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Canal</th>
                <th className="px-4 py-3 font-medium">Destinatario</th>
                <th className="px-4 py-3 font-medium">Expediente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Cargando...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No hay notificaciones{hasFilters ? " con los filtros seleccionados" : ""}
                </td></tr>
              ) : logs.map((log) => {
                const kindMeta = KIND_LABELS[log.kind] ?? { label: log.kind, color: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("es-ES", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kindMeta.color}`}>
                        {kindMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {CHANNEL_LABELS[log.channel] ?? log.channel}
                    </td>
                    <td className="px-4 py-3 text-sm">{log.recipient}</td>
                    <td className="px-4 py-3 text-sm">
                      {log.case ? (
                        <Link href={`/cases/${log.caseId}`} className="text-primary hover:underline">
                          <span className="font-mono text-xs">{log.case.ref}</span>
                          {log.case.deceased && (
                            <span className="text-gray-500 ml-1">— {log.case.deceased.fullName}</span>
                          )}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {log.status === "sent" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Enviado</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700" title={log.error ?? ""}>
                          Fallido
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-400">Cargando...</div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">
              No hay notificaciones{hasFilters ? " con los filtros seleccionados" : ""}
            </div>
          ) : logs.map((log) => {
            const kindMeta = KIND_LABELS[log.kind] ?? { label: log.kind, color: "bg-gray-100 text-gray-600" };
            return (
              <div key={log.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kindMeta.color}`}>
                    {kindMeta.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {log.status === "sent" ? (
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString("es-ES", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <p className="text-sm">
                  <span className="text-gray-500">{CHANNEL_LABELS[log.channel] ?? log.channel}</span>
                  <span className="mx-1">→</span>
                  <span>{log.recipient}</span>
                </p>
                {log.case && (
                  <Link href={`/cases/${log.caseId}`} className="text-primary text-xs hover:underline font-mono">
                    {log.case.ref}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
