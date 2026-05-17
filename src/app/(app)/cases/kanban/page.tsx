"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CASE_STATUS_COLORS } from "@/lib/constants";

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Recepcion",
  VALIDATION: "Validacion",
  IN_PROGRESS: "En curso",
  PENDING_DOCS: "Docs pendientes",
  READY_TO_SEND: "Listo para enviar",
  SENT: "Enviado",
  FOLLOW_UP: "Seguimiento",
};

const STATUSES = Object.keys(STATUS_LABELS);

interface KanbanCase {
  id: string;
  ref: string;
  status: string;
  isUrgent: boolean;
  updatedAt: string;
  createdAt: string;
  deceased: { fullName: string } | null;
  _count: { tasks: number; documents: number };
}

export default function KanbanPage() {
  const [columns, setColumns] = useState<Record<string, KanbanCase[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cases/kanban")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setColumns(data.columns);
          setTotal(data.total);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function moveCase(caseId: string, newStatus: string) {
    const res = await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setColumns((prev) => {
        const next = { ...prev };
        let movedCase: KanbanCase | undefined;
        for (const status of STATUSES) {
          const idx = (next[status] || []).findIndex((c) => c.id === caseId);
          if (idx >= 0) {
            movedCase = next[status][idx];
            next[status] = [...next[status]];
            next[status].splice(idx, 1);
            break;
          }
        }
        if (movedCase) {
          movedCase = { ...movedCase, status: newStatus };
          next[newStatus] = [movedCase, ...(next[newStatus] || [])];
        }
        return next;
      });
    }
  }

  function handleDragStart(caseId: string) {
    setDragging(caseId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, targetStatus: string) {
    e.preventDefault();
    if (dragging) {
      moveCase(dragging, targetStatus);
      setDragging(null);
    }
  }

  function agingDays(updatedAt: string): number {
    return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Cargando tablero...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tablero Kanban</h1>
          <p className="text-sm text-gray-500 mt-1">{total} expedientes activos</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/cases"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            Vista lista
          </Link>
          <Link
            href="/cases/new"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm font-medium"
          >
            Nuevo expediente
          </Link>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "70vh" }}>
        {STATUSES.map((status) => {
          const items = columns[status] || [];
          return (
            <div
              key={status}
              className={`flex-shrink-0 w-64 bg-gray-50 rounded-lg border ${
                dragging ? "border-dashed border-2 border-gray-300" : ""
              }`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="px-3 py-2.5 border-b bg-white rounded-t-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${CASE_STATUS_COLORS[status]?.split(" ")[0] || "bg-gray-300"}`} />
                  <span className="text-sm font-semibold text-gray-700">{STATUS_LABELS[status]}</span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>

              <div className="p-2 space-y-2 min-h-[100px]">
                {items.map((c) => {
                  const days = agingDays(c.updatedAt);
                  const stale = days > 7;
                  const veryStale = days > 14;
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => handleDragStart(c.id)}
                      className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow ${
                        veryStale ? "border-l-4 border-l-red-400" : stale ? "border-l-4 border-l-orange-300" : ""
                      } ${dragging === c.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Link
                          href={`/cases/${c.id}`}
                          className="font-mono text-xs text-primary hover:underline font-medium"
                        >
                          {c.ref}
                        </Link>
                        {c.isUrgent && (
                          <span className="text-[10px] px-1 py-0.5 bg-red-100 text-red-700 rounded">
                            Urgente
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 font-medium truncate">
                        {c.deceased?.fullName || "—"}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          {c._count.tasks > 0 && (
                            <span>{c._count.tasks} tareas</span>
                          )}
                          {c._count.documents > 0 && (
                            <span>{c._count.documents} docs</span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            veryStale ? "bg-red-100 text-red-700 font-medium" :
                            stale ? "bg-orange-100 text-orange-700" :
                            "bg-gray-100 text-gray-500"
                          }`}
                          title="Dias en este estado"
                        >
                          {days}d
                        </span>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-xs text-gray-300 text-center py-4">Sin expedientes</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
        <span>Arrastra expedientes entre columnas para cambiar su estado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1 bg-orange-300 rounded" /> +7 dias sin cambio</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1 bg-red-400 rounded" /> +14 dias sin cambio</span>
      </div>
    </div>
  );
}
