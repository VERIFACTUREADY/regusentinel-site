"use client";

import { AvisoError } from "@/components/ui/carga-remota";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { TASK_STATUS_COLORS, CATEGORY_LABELS } from "@/lib/constants";

interface TimelineTask {
  id: string;
  title: string;
  status: string;
  category: string;
  deadline: string | null;
  dueDate: string | null;
  case: { id: string; ref: string; isUrgent: boolean };
  assignee: { id: string; name: string | null; email: string } | null;
}

interface TimelineData {
  tasks: TimelineTask[];
  overdue: number;
  thisWeek: number;
  thisMonth: number;
}

export default function TimelinePage() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const [assignee, setAssignee] = useState("");
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);

  /*
   * El fallo al cargar compañeros se dice, no se traga.
   *
   * Era `.catch(() => {})` con `r.ok ? r.json() : []`: si la peticion fallaba,
   * el desplegable de responsable se quedaba con dos opciones y el usuario
   * concluia que ya no hay nadie mas en la gestoria. No sustituye a la
   * pantalla —el cronograma carga igual—, pero se avisa.
   */
  const [errorMiembros, setErrorMiembros] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/org/members")
      .then(async (r) => {
        if (!r.ok) throw new Error(`El servidor ha respondido ${r.status}.`);
        return r.json();
      })
      .then((data) => {
        setErrorMiembros(null);
        setMembers(Array.isArray(data) ? data : []);
      })
      .catch((e: unknown) => {
        setErrorMiembros(
          `No se ha podido cargar la lista de compañeros: ${
            e instanceof Error ? e.message : "error de red"
          }. El filtro por responsable queda incompleto.`,
        );
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (assignee) params.set("assignee", assignee);
    fetch(`/api/tasks/timeline?${params}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 401
              ? "Tu sesion ha caducado. Vuelve a entrar."
              : `El servidor ha respondido ${r.status}.`,
          );
        }
        return r.json();
      })
      .then((d) => {
        if (!d) throw new Error("La respuesta del servidor no tiene el formato esperado.");
        setErrorCarga(null);
        setData(d);
      })
      .catch((e: unknown) => {
        // No se conservan los datos anteriores: enseñarlos tras un fallo los
        // presenta como actuales cuando ya no se sabe si lo son.
        setData(null);
        setErrorCarga(e instanceof Error ? e.message : "Error de red. Comprueba tu conexion.");
      })
      .finally(() => setLoading(false));
  }, [assignee, reintento]);

  const grouped = useMemo(() => {
    if (!data) return {};
    const now = new Date();
    const groups: Record<string, TimelineTask[]> = {};

    for (const task of data.tasks) {
      const effectiveDate = task.deadline ?? task.dueDate;
      if (!effectiveDate) continue;
      const d = new Date(effectiveDate);
      const isPast = d < now && task.status !== "DONE";
      let key: string;

      if (isPast) {
        key = "VENCIDAS";
      } else if (task.status === "DONE") {
        key = "COMPLETADAS";
      } else {
        const weekNum = Math.ceil(
          (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        key = `${d.getFullYear()}-S${String(weekNum).padStart(2, "0")}`;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "VENCIDAS") return -1;
      if (b === "VENCIDAS") return 1;
      if (a === "COMPLETADAS") return 1;
      if (b === "COMPLETADAS") return -1;
      return a.localeCompare(b);
    });

    const sorted: Record<string, TimelineTask[]> = {};
    for (const k of sortedKeys) sorted[k] = groups[k];
    return sorted;
  }, [data]);

  function weekLabel(key: string): string {
    if (key === "VENCIDAS") return "Vencidas";
    if (key === "COMPLETADAS") return "Completadas recientemente";
    const [year, week] = key.split("-S");
    const weekNum = parseInt(week);
    const jan1 = new Date(parseInt(year), 0, 1);
    const weekStart = new Date(jan1.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return `${fmt(weekStart)} — ${fmt(weekEnd)}`;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cronograma de plazos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Plazos legales y administrativos por semana
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/tasks"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            Vista lista
          </Link>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-lg border ${data.overdue > 0 ? "bg-red-50 border-red-200" : "bg-white"}`}>
            <p className={`text-2xl font-bold ${data.overdue > 0 ? "text-red-700" : "text-gray-900"}`}>
              {data.overdue}
            </p>
            <p className="text-sm text-gray-500">Vencidas</p>
          </div>
          <div className={`p-4 rounded-lg border ${data.thisWeek > 0 ? "bg-orange-50 border-orange-200" : "bg-white"}`}>
            <p className={`text-2xl font-bold ${data.thisWeek > 0 ? "text-orange-700" : "text-gray-900"}`}>
              {data.thisWeek}
            </p>
            <p className="text-sm text-gray-500">Esta semana</p>
          </div>
          <div className="p-4 rounded-lg border bg-white">
            <p className="text-2xl font-bold text-gray-900">{data.thisMonth}</p>
            <p className="text-sm text-gray-500">Este mes</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="cronogramaResponsable" className="text-xs font-medium text-gray-500">
            Responsable
          </label>
          <select
            id="cronogramaResponsable"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Todos</option>
            <option value="me">Mis tareas</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </select>
        </div>
      </div>

      {errorMiembros && (
        <p
          role="status"
          data-testid="aviso-miembros"
          className="mb-4 text-sm rounded-md px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200"
        >
          {errorMiembros}
        </p>
      )}

      {/* Timeline */}
      {errorCarga ? (
        <AvisoError mensaje={errorCarga} que="la linea de tiempo" onReintentar={() => setReintento((n) => n + 1)} />
      ) : loading ? (
        <div className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400">
          Cargando...
        </div>
      ) : !data || data.tasks.length === 0 ? (
        <div
          data-testid="carga-vacio"
          className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400"
        >
          {assignee ? "No hay tareas con plazos para este responsable" : "No hay tareas con plazos"}
        </div>
      ) : (() => {
        const now = new Date();
        return (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, tasks]) => (
            <div key={key}>
              <div className="flex items-center gap-3 mb-3">
                {key === "VENCIDAS" && (
                  <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                )}
                {key === "COMPLETADAS" && (
                  <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                )}
                {key !== "VENCIDAS" && key !== "COMPLETADAS" && (
                  <span className="w-3 h-3 rounded-full bg-blue-400 shrink-0" />
                )}
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  {weekLabel(key)}
                </h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              </div>

              <div className="ml-1.5 border-l-2 border-gray-200 pl-5 space-y-2">
                {tasks.map((task) => {
                  const deadline = new Date((task.deadline ?? task.dueDate)!);
                  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysLeft < 0 && task.status !== "DONE";
                  const isUrgent = daysLeft >= 0 && daysLeft <= 7 && task.status !== "DONE";

                  return (
                    <div
                      key={task.id}
                      className={`bg-white p-3 rounded-lg border hover:bg-gray-50 ${
                        isOverdue ? "border-l-4 border-l-red-400" :
                        isUrgent ? "border-l-4 border-l-orange-400" :
                        task.status === "DONE" ? "border-l-4 border-l-green-400 opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
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
                          <p className="font-medium mt-1 text-sm">{task.title}</p>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {CATEGORY_LABELS[task.category] || task.category}
                            </span>
                            {task.assignee && (
                              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                                {task.assignee.name || task.assignee.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-medium ${
                            isOverdue ? "text-red-700" :
                            isUrgent ? "text-orange-700" :
                            task.status === "DONE" ? "text-green-700" :
                            "text-gray-700"
                          }`}>
                            {deadline.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                          </p>
                          {task.status !== "DONE" && (
                            <p className={`text-xs ${
                              isOverdue ? "text-red-500 font-medium" :
                              isUrgent ? "text-orange-500" :
                              "text-gray-400"
                            }`}>
                              {isOverdue ? `${Math.abs(daysLeft)}d vencido` : `${daysLeft}d`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        );
      })()}
    </div>
  );
}
