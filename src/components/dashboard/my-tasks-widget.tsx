"use client";

import { useState } from "react";
import Link from "next/link";
import { TASK_STATUS_COLORS } from "@/lib/constants";

interface TaskItem {
  id: string;
  title: string;
  status: string;
  caseId: string;
  deadline: string | null;
  case: { id: string; ref: string; isUrgent: boolean };
}

export function MyTasksWidget({ initialTasks }: { initialTasks: TaskItem[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  /**
   * Completa una tarea desde el resumen del escritorio.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Antes era `if (res.ok) { quitar de la lista }` y nada mas. Con un 403, un
   * 404 o un 500 la tarea se quedaba en la lista sin explicacion, y si la red
   * se caia `fetch` lanzaba y el error moria en la consola: el usuario pulsaba
   * y no pasaba nada. Ahora, o se completa de verdad, o se dice por que no.
   */
  async function markDone(task: TaskItem) {
    setAviso(null);
    setGuardandoId(task.id);
    try {
      const res = await fetch(`/api/cases/${task.caseId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status: "DONE" }),
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        throw new Error(cuerpo?.error ?? `El servidor ha respondido ${res.status}.`);
      }
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (e) {
      setAviso(
        `No se ha podido completar "${task.title}": ${
          e instanceof Error ? e.message : "error de red"
        }`,
      );
    } finally {
      setGuardandoId(null);
    }
  }

  if (tasks.length === 0) return null;

  const now = Date.now();

  return (
    <div data-testid="widget-mis-tareas" className="bg-white rounded-lg border mb-8">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h2 className="font-semibold">Mis tareas asignadas</h2>
        <Link href="/tasks" className="text-sm text-primary hover:underline">Ver todas</Link>
      </div>
      {aviso && (
        <p
          role="alert"
          data-testid="aviso-widget-tareas"
          className="mx-6 mt-4 text-sm rounded-md px-3 py-2 bg-red-50 text-red-700 border border-red-200"
        >
          {aviso}
        </p>
      )}
      <div className="divide-y">
        {tasks.map((task) => {
          const deadlineDays = task.deadline
            ? Math.ceil((new Date(task.deadline).getTime() - now) / (1000 * 60 * 60 * 24))
            : null;
          const expired = deadlineDays !== null && deadlineDays <= 0;
          const urgent = deadlineDays !== null && deadlineDays > 0 && deadlineDays <= 7;
          return (
            <div key={task.id} className="px-6 py-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Link href={`/cases/${task.case.id}`} className="font-mono text-xs text-primary hover:underline shrink-0">
                  {task.case.ref}
                </Link>
                {task.case.isUrgent && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full shrink-0">Urgente</span>
                )}
                <span className="truncate">{task.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {task.deadline && (
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    expired ? "bg-red-100 text-red-700 font-medium" : urgent ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {expired ? "VENCIDO" : `${deadlineDays}d`}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_STATUS_COLORS[task.status] || "bg-gray-100 text-gray-600"}`}>
                  {task.status}
                </span>
                <button
                  onClick={() => markDone(task)}
                  disabled={guardandoId === task.id}
                  title="Marcar como completada"
                  aria-label={`Marcar completada: ${task.title}`}
                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
