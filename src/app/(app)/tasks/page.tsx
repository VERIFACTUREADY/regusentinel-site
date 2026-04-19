"use client";

import { useState, useEffect, useRef } from "react";
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

const ASSIGNEE_OPTIONS = [
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
  const controllerRef = useRef<AbortController>();

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
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, assignee, status, category]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tareas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} tarea{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={assignee}
          onChange={(e) => { setAssignee(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {ASSIGNEE_OPTIONS.map((o) => (
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
