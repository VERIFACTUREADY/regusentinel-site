"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { TASK_STATUS_COLORS, ALL_CATEGORIES } from "@/lib/constants";

const STATUS_OPTIONS = [
  { value: "PENDING,IN_PROGRESS,BLOCKED,READY", label: "Activas" },
  { value: "", label: "Todas" },
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En curso" },
  { value: "BLOCKED", label: "Bloqueada" },
  { value: "READY", label: "Lista" },
  { value: "APPROVED", label: "Aprobada" },
  { value: "DONE", label: "Completada" },
  { value: "SKIPPED", label: "Omitida" },
];

const DEFAULT_ASSIGNEE_OPTIONS = [
  { value: "me", label: "Mis tareas" },
  { value: "", label: "Todas" },
  { value: "unassigned", label: "Sin asignar" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "Todas las categorias" },
  ...ALL_CATEGORIES,
];

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string;
  deadline: string | null;
  blockedUntil: string | null;
  blockReason: string | null;
  caseId: string;
  case: { id: string; ref: string; isUrgent: boolean };
  assignee: { id: string; name: string | null; email: string } | null;
}

const PAGE_SIZE = 50;

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [assignee, setAssignee] = useState("me");
  const [status, setStatus] = useState("PENDING,IN_PROGRESS,BLOCKED,READY");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    fetch("/api/org/members")
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .catch(() => {});
  }, []);

  const assigneeOptions = useMemo(() => [
    ...DEFAULT_ASSIGNEE_OPTIONS,
    ...members.map((m) => ({ value: m.id, label: m.name || m.email })),
  ], [members]);

  async function updateTaskStatus(task: TaskItem, newStatus: string) {
    const res = await fetch(`/api/cases/${task.caseId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, status: newStatus }),
    });
    if (res.ok) setRefreshKey((k) => k + 1);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === tasks.length) setSelected(new Set());
    else setSelected(new Set(tasks.map((t) => t.id)));
  }

  async function batchAction(action: { status?: string; assigneeId?: string }) {
    setBatchLoading(true);
    const res = await fetch("/api/tasks/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: Array.from(selected), ...action }),
    });
    if (res.ok) {
      setSelected(new Set());
      setRefreshKey((k) => k + 1);
    }
    setBatchLoading(false);
  }

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (assignee) params.set("assignee", assignee);
    if (status) params.set("status", status);
    if (category) params.set("category", category);

    fetch(`/api/tasks?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !controller.signal.aborted) {
          setTasks(data.tasks);
          setTotal(data.total);
          setSelected(new Set());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, assignee, status, category, refreshKey]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.deadline && t.status !== "DONE" && t.status !== "SKIPPED" && new Date(t.deadline) < new Date()).length,
    [tasks]
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tareas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} tarea{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (assignee) params.set("assignee", assignee);
              if (status) params.set("status", status);
              if (category) params.set("category", category);
              window.open(`/api/tasks/export-csv?${params}`, "_blank");
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            Exportar CSV
          </button>
          <Link
            href="/tasks/timeline"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            Cronograma
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={assignee}
          onChange={(e) => { setAssignee(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {assigneeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <input
            type="checkbox"
            checked={selected.size === tasks.length}
            onChange={toggleSelectAll}
            className="rounded border-gray-300"
          />
          <span className="text-sm font-medium text-blue-700">
            {selected.size} seleccionada{selected.size !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => batchAction({ status: "DONE" })}
            disabled={batchLoading}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Completar
          </button>
          <button
            onClick={() => batchAction({ status: "IN_PROGRESS" })}
            disabled={batchLoading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Iniciar
          </button>
          <select
            onChange={(e) => { if (e.target.value !== "") batchAction({ assigneeId: e.target.value }); e.target.value = ""; }}
            disabled={batchLoading}
            className="px-2 py-1 border rounded text-sm"
            defaultValue=""
          >
            <option value="" disabled>Reasignar a...</option>
            <option value="">Sin asignar</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </select>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* Overdue alert */}
      {!loading && overdueCount > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm font-medium text-red-800">
            {overdueCount} tarea{overdueCount !== 1 ? "s" : ""} con plazo vencido
          </span>
        </div>
      )}

      {/* Tasks list */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400">
            Cargando...
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400">
            No hay tareas con estos filtros
          </div>
        ) : (
          tasks.map((task) => {
            const deadlineDays = task.deadline
              ? Math.ceil((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const expired = deadlineDays !== null && deadlineDays <= 0;
            const urgent = deadlineDays !== null && deadlineDays > 0 && deadlineDays <= 14;

            return (
              <div
                key={task.id}
                className={`bg-white p-4 rounded-lg border hover:bg-gray-50 ${
                  task.status === "BLOCKED" ? "border-l-4 border-l-red-400" :
                  task.status === "READY" ? "border-l-4 border-l-yellow-400" :
                  task.status === "DONE" ? "border-l-4 border-l-green-400" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <input
                    type="checkbox"
                    checked={selected.has(task.id)}
                    onChange={() => toggleSelect(task.id)}
                    className="mt-1 rounded border-gray-300 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/cases/${task.case.id}`}
                        className="font-mono text-xs text-primary hover:underline shrink-0"
                      >
                        {task.case.ref}
                      </Link>
                      {task.case.isUrgent && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                          Urgente
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_STATUS_COLORS[task.status] || ""}`}>
                        {task.status}
                      </span>
                    </div>
                    <p className="font-medium mt-1">{task.title}</p>
                    {task.description && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{task.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {CATEGORY_OPTIONS.find((c) => c.value === task.category)?.label || task.category}
                      </span>
                      {task.assignee && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                          {task.assignee.name || task.assignee.email}
                        </span>
                      )}
                      {task.status === "BLOCKED" && task.blockReason && (
                        <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded">
                          {task.blockReason}
                        </span>
                      )}
                      {task.deadline && task.status !== "DONE" && task.status !== "SKIPPED" && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          expired ? "bg-red-100 text-red-700 font-medium" :
                          urgent ? "bg-orange-100 text-orange-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {expired ? "VENCIDO" : `${deadlineDays}d`} — {new Date(task.deadline).toLocaleDateString("es-ES")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 ml-2">
                    {task.status !== "DONE" && task.status !== "SKIPPED" && task.status !== "BLOCKED" && (
                      <button
                        onClick={() => updateTaskStatus(task, "DONE")}
                        title="Marcar completada"
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    {task.status === "PENDING" && (
                      <button
                        onClick={() => updateTaskStatus(task, "IN_PROGRESS")}
                        title="Iniciar"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
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
