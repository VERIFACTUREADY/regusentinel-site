"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { CATEGORY_LABELS, TASK_STATUS_COLORS } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────

interface CalendarTask {
  id: string;
  title: string;
  status: string;
  category: string;
  deadline: string | null;
  dueDate: string | null;
  case: { id: string; ref: string; isUrgent: boolean };
  assignee: { id: string; name: string | null; email: string } | null;
}

interface CalendarData {
  byDate: Record<string, CalendarTask[]>;
  stats: { overdue: number; thisWeek: number; thisMonth: number };
}

// ─── Helpers ─────────────────────────────────────────────

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  // Monday-based: getDay() returns 0=Sun, need Mon=0
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  // Pad to complete rows of 7
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dayClass(date: Date, today: Date, hasOverdue: boolean, hasSoon: boolean, hasFuture: boolean): string {
  const isToday = toYMD(date) === toYMD(today);
  if (isToday) return "ring-2 ring-primary";
  if (hasOverdue) return "bg-red-50";
  if (hasSoon) return "bg-amber-50";
  if (hasFuture) return "bg-blue-50";
  return "";
}

// ─── DayDetail side panel ────────────────────────────────

function DayDetail({
  date,
  tasks,
  onClose,
}: {
  date: string;
  tasks: CalendarTask[];
  onClose: () => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  const isOverdue = d < today;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm shadow-xl flex flex-col h-full">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">{MONTH_NAMES[d.getMonth()]} {d.getFullYear()}</p>
            <h3 className="text-lg font-bold text-gray-900">
              {d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin plazos este día</p>
          ) : (
            tasks.map((task) => {
              const statusColor = TASK_STATUS_COLORS[task.status] ?? "bg-gray-100 text-gray-600";
              return (
                <Link
                  key={task.id}
                  href={`/cases/${task.case.id}`}
                  className="block bg-white border rounded-lg p-3 hover:border-primary hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-mono">{task.case.ref}</span>
                        {task.case.isUrgent && (
                          <span className="ml-1.5 text-red-600 font-medium">URGENTE</span>
                        )}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}>
                      {task.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{CATEGORY_LABELS[task.category] ?? task.category}</span>
                    {task.assignee && (
                      <span>· {task.assignee.name ?? task.assignee.email}</span>
                    )}
                  </div>
                  {isOverdue && (
                    <p className="text-xs text-red-600 font-medium mt-1.5">Plazo vencido</p>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main calendar component ─────────────────────────────

export function CalendarClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const fetchData = useCallback(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ month: monthKey });
    if (filterAssignee) params.set("assignee", filterAssignee);
    if (filterCategory) params.set("category", filterCategory);

    fetch(`/api/tasks/calendar?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: CalendarData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [monthKey, filterAssignee, filterCategory]);

  useEffect(() => {
    const cleanup = fetchData();
    return cleanup;
  }, [fetchData]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  }

  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDay(null);
  }

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);

  const byDate = data?.byDate ?? {};
  const stats = data?.stats ?? { overdue: 0, thisWeek: 0, thisMonth: 0 };

  const selectedTasks = selectedDay ? (byDate[selectedDay] ?? []) : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario de plazos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Deadlines y fechas límite de todas las tareas activas</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/tasks/ical?scope=me"
            download="plazos-heredia.ics"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Exportar .ics
          </a>
          <Link href="/tasks/timeline" className="text-sm text-primary hover:underline">
            Ver línea de tiempo →
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-700">{stats.overdue}</div>
          <div className="text-xs text-red-600 mt-0.5">Vencidos</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-amber-700">{stats.thisWeek}</div>
          <div className="text-xs text-amber-600 mt-0.5">Esta semana</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700">{stats.thisMonth}</div>
          <div className="text-xs text-blue-600 mt-0.5">Este mes</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Todos los asignados</option>
          <option value="me">Solo mis tareas</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {(filterAssignee || filterCategory) && (
          <button
            onClick={() => { setFilterAssignee(""); setFilterCategory(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Calendar card */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">
              {MONTH_NAMES[month]} {year}
            </h2>
            {(year !== now.getFullYear() || month !== now.getMonth()) && (
              <button
                onClick={goToday}
                className="text-xs text-primary border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/5"
              >
                Hoy
              </button>
            )}
          </div>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            Cargando...
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {grid.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="border-r border-b min-h-[80px] bg-gray-50/50" />;
              }

              const key = toYMD(date);
              const tasks = byDate[key] ?? [];
              const isToday = key === toYMD(today);
              const isSelected = key === selectedDay;

              const d = new Date(key);
              d.setHours(12);
              const hasOverdue = tasks.some(() => d < today);
              const hasSoon = !hasOverdue && tasks.some(() => d <= weekEnd);
              const hasFuture = !hasOverdue && !hasSoon && tasks.length > 0;

              const overdueCount = d < today ? tasks.length : 0;
              const soonCount = d >= today && d <= weekEnd ? tasks.length : 0;
              const futureCount = d > weekEnd ? tasks.length : 0;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  className={`border-r border-b min-h-[80px] p-1.5 text-left transition hover:bg-gray-50 ${
                    isSelected ? "ring-2 ring-inset ring-primary" : ""
                  } ${dayClass(date, today, hasOverdue, hasSoon, hasFuture)}`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                      isToday
                        ? "bg-primary text-white"
                        : "text-gray-700"
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  <div className="mt-1 space-y-0.5">
                    {overdueCount > 0 && (
                      <div className="text-xs bg-red-200 text-red-800 rounded px-1 truncate">
                        {overdueCount} vencid{overdueCount === 1 ? "o" : "os"}
                      </div>
                    )}
                    {soonCount > 0 && (
                      <div className="text-xs bg-amber-200 text-amber-800 rounded px-1 truncate">
                        {soonCount} próxim{soonCount === 1 ? "o" : "os"}
                      </div>
                    )}
                    {futureCount > 0 && (
                      <div className="text-xs bg-blue-100 text-blue-800 rounded px-1 truncate">
                        {futureCount} tarea{futureCount !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="px-5 py-3 border-t bg-gray-50 flex items-center gap-5 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-200 inline-block" /> Vencido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-200 inline-block" /> Esta semana
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-100 inline-block" /> Próximo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary inline-block" /> Hoy
          </span>
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <DayDetail
          date={selectedDay}
          tasks={selectedTasks}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
