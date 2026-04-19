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

  async function markDone(task: TaskItem) {
    const res = await fetch(`/api/cases/${task.caseId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, status: "DONE" }),
    });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    }
  }

  if (tasks.length === 0) return null;

  const now = Date.now();

  return (
    <div className="bg-white rounded-lg border mb-8">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h2 className="font-semibold">Mis tareas asignadas</h2>
        <Link href="/tasks" className="text-sm text-primary hover:underline">Ver todas</Link>
      </div>
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
                  title="Marcar como completada"
                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition"
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
