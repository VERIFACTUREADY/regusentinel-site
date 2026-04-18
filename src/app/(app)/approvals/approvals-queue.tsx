"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Approval {
  id: string;
  action: string;
  status: string;
  details: string | null;
  createdAt: string;
  reviewedAt: string | null;
  caseId: string;
  case: { ref: string; deceased: { fullName: string } | null } | null;
  task: { title: string } | null;
  reviewer: { name: string | null; email: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  send_draft: "Enviar borrador",
  send_email: "Enviar email",
  mark_sent: "Marcar como enviado",
  generate_checklist: "Generar checklist",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Aprobada", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rechazada", color: "bg-red-100 text-red-700" },
};

const PAGE_SIZE = 30;

export function ApprovalsQueue() {
  const router = useRouter();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [acting, setActing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/approvals?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !controller.signal.aborted) {
          setApprovals(data.approvals);
          setTotal(data.total);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function handleAction(id: string, status: "APPROVED" | "REJECTED") {
    setActing(id);
    const res = await fetch(`/api/approvals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status, reviewedAt: new Date().toISOString() } : a
        )
      );
      router.refresh();
    }
    setActing(null);
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { value: "PENDING", label: "Pendientes" },
          { value: "APPROVED", label: "Aprobadas" },
          { value: "REJECTED", label: "Rechazadas" },
          { value: "", label: "Todas" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-1.5 text-sm rounded-md transition ${
              statusFilter === tab.value
                ? "bg-white shadow font-medium"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <div className="text-sm text-gray-500">
        {total} aprobacion{total !== 1 ? "es" : ""}
      </div>

      {/* Queue */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg border px-6 py-12 text-center text-gray-400">
            Cargando...
          </div>
        ) : approvals.length === 0 ? (
          <div className="bg-white rounded-lg border px-6 py-12 text-center text-gray-400">
            {statusFilter === "PENDING"
              ? "No hay acciones pendientes de aprobacion"
              : "No hay aprobaciones con este filtro"}
          </div>
        ) : (
          approvals.map((a) => {
            const config = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PENDING;
            const isExpanded = expandedId === a.id;
            return (
              <div key={a.id} className="bg-white rounded-lg border overflow-hidden">
                <div className="px-4 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-sm font-medium">
                          {ACTION_LABELS[a.action] ?? a.action}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        {a.case && (
                          <Link href={`/cases/${a.caseId}`} className="text-primary hover:underline font-mono text-xs">
                            {a.case.ref}
                          </Link>
                        )}
                        {a.case?.deceased && (
                          <span>{a.case.deceased.fullName}</span>
                        )}
                        {a.task && (
                          <span className="truncate">{a.task.title}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(a.createdAt).toLocaleString("es-ES")}
                        {a.reviewer && a.reviewedAt && (
                          <span>
                            {" "}— revisada por {a.reviewer.name || a.reviewer.email}
                            {" el "}
                            {new Date(a.reviewedAt).toLocaleString("es-ES")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {a.details && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : a.id)}
                          className="px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50"
                        >
                          {isExpanded ? "Ocultar" : "Ver detalle"}
                        </button>
                      )}
                      {a.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleAction(a.id, "APPROVED")}
                            disabled={acting === a.id}
                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            {acting === a.id ? "..." : "Aprobar"}
                          </button>
                          <button
                            onClick={() => handleAction(a.id, "REJECTED")}
                            disabled={acting === a.id}
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && a.details && (
                  <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t">
                    <pre className="whitespace-pre-wrap text-sm font-mono text-gray-700 leading-relaxed max-h-96 overflow-y-auto">
                      {a.details}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
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
