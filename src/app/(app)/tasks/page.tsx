"use client";

import { AvisoError } from "@/components/ui/carga-remota";
import { useRolConocido } from "@/components/layout/rol-context";
import { hasPermission } from "@/lib/rbac";
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

interface TaskNote {
  id: string;
  content: string;
  createdAt: string;
  user: { name: string | null; email: string };
}

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string;
  deadline: string | null;
  dueDate: string | null;
  blockedUntil: string | null;
  blockReason: string | null;
  caseId: string;
  case: { id: string; ref: string; isUrgent: boolean };
  assignee: { id: string; name: string | null; email: string } | null;
  _count: { notes: number };
  dependsOnId: string | null;
  dependsOn: { id: string; title: string; status: string } | null;
}

const PAGE_SIZE = 50;

export default function TasksPage() {
  /*
   * Cortesia con el usuario, no control de acceso: el servidor sigue siendo
   * quien decide. Un VIEWER es de solo lectura y no debe encontrarse botones
   * de completar, iniciar, reasignar ni el cuadro de escribir notas, que solo
   * le llevarian a un 403.
   */
  const rol = useRolConocido();
  const puedeEditar = Boolean(rol && hasPermission(rol, "tasks.update"));
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [assignee, setAssignee] = useState("me");
  const [status, setStatus] = useState("PENDING,IN_PROGRESS,BLOCKED,READY");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openNotesId, setOpenNotesId] = useState<string | null>(null);
  const [notesCache, setNotesCache] = useState<Record<string, TaskNote[]>>({});
  const [notesLoading, setNotesLoading] = useState(false);
  const [errorNotas, setErrorNotas] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  /*
   * Resultado de la ultima accion que escribe (completar, iniciar, lote, nota).
   *
   * Antes no existia: las cuatro hacian `if (res.ok) { ... }` y nada mas. Un
   * rechazo del servidor dejaba la pantalla igual que si hubiera funcionado, y
   * un fallo de red ni siquiera llegaba al `if`: la promesa se rechazaba sin
   * capturar y el indicador de "guardando" se quedaba encendido para siempre.
   */
  const [avisoAccion, setAvisoAccion] = useState<
    { tipo: "ok" | "err"; texto: string } | null
  >(null);

  /*
   * El fallo al cargar la lista de miembros va aparte del de las tareas.
   *
   * Compartian estado: si `/api/org/members` fallaba, la pantalla sustituia la
   * lista de tareas —que habia cargado perfectamente— por "No se han podido
   * cargar las tareas". Un fallo en un dato secundario no puede borrar el
   * principal ni mentir sobre cual ha fallado.
   */
  const [errorMiembros, setErrorMiembros] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/org/members")
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
      .then((data) => {
        setErrorMiembros(null);
        setMembers(Array.isArray(data) ? data : []);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErrorMiembros(
          `No se ha podido cargar la lista de compañeros: ${
            e instanceof Error ? e.message : "error de red"
          }. El filtro por responsable queda incompleto.`,
        );
      });
  }, []);

  const assigneeOptions = useMemo(() => [
    ...DEFAULT_ASSIGNEE_OPTIONS,
    ...members.map((m) => ({ value: m.id, label: m.name || m.email })),
  ], [members]);

  /** Mensaje del servidor si lo hay; si no, el codigo; si no, la red. */
  async function motivo(res: Response): Promise<string> {
    const cuerpo = await res.json().catch(() => null);
    return cuerpo?.error ?? `El servidor ha respondido ${res.status}.`;
  }

  async function updateTaskStatus(task: TaskItem, newStatus: string, queEs: string) {
    setAvisoAccion(null);
    setUpdatingId(task.id);
    try {
      const res = await fetch(`/api/cases/${task.caseId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status: newStatus }),
      });
      if (!res.ok) throw new Error(await motivo(res));
      // La lista se recarga del servidor: si se cambiara aqui, la pantalla
      // mostraria un estado que quiza no se ha guardado.
      setRefreshKey((k) => k + 1);
      setAvisoAccion({ tipo: "ok", texto: `${queEs}: "${task.title}".` });
    } catch (e) {
      setAvisoAccion({
        tipo: "err",
        texto: `No se ha podido actualizar "${task.title}": ${
          e instanceof Error ? e.message : "error de red"
        }`,
      });
    } finally {
      setUpdatingId(null);
    }
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

  async function toggleNotes(taskId: string) {
    if (openNotesId === taskId) { setOpenNotesId(null); return; }
    setOpenNotesId(taskId);
    setErrorNotas(null);
    if (!notesCache[taskId]) {
      setNotesLoading(true);
      try {
        const res = await fetch(`/api/tasks/${taskId}/notes`);
        if (!res.ok) throw new Error(await motivo(res));
        const data = await res.json();
        setNotesCache((c) => ({ ...c, [taskId]: Array.isArray(data) ? data : [] }));
      } catch (e) {
        /*
         * Sin esto, un fallo al pedir las notas se pintaba como "Sin notas
         * aun": el mismo defecto que esta fase persigue en toda la aplicacion,
         * y aqui especialmente grave porque las notas son el registro de lo
         * que se ha hablado con la familia.
         */
        setErrorNotas(
          `No se han podido cargar las notas: ${e instanceof Error ? e.message : "error de red"}`,
        );
      } finally {
        // En `finally`: si no, un fallo de red deja "Cargando notas..." fijo.
        setNotesLoading(false);
      }
    }
  }

  async function saveNote(taskId: string) {
    if (!noteInput.trim()) return;
    setNoteSaving(true);
    setErrorNotas(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteInput.trim() }),
      });
      if (!res.ok) throw new Error(await motivo(res));
      const note = await res.json();
      setNotesCache((c) => ({ ...c, [taskId]: [...(c[taskId] ?? []), note] }));
      setNoteInput("");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      // El texto NO se borra: es lo unico que el usuario no puede recuperar.
      setErrorNotas(
        `No se ha podido guardar la nota: ${e instanceof Error ? e.message : "error de red"}`,
      );
    } finally {
      setNoteSaving(false);
    }
  }

  async function batchAction(action: { status?: string; assigneeId?: string }, queEs: string) {
    setBatchLoading(true);
    setAvisoAccion(null);
    const cuantas = selected.size;
    try {
      const res = await fetch("/api/tasks/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: Array.from(selected), ...action }),
      });
      if (!res.ok) throw new Error(await motivo(res));
      setSelected(new Set());
      setRefreshKey((k) => k + 1);
      setAvisoAccion({ tipo: "ok", texto: `${cuantas} tarea(s) ${queEs}.` });
    } catch (e) {
      setAvisoAccion({
        tipo: "err",
        texto: `No se han podido actualizar las tareas: ${
          e instanceof Error ? e.message : "error de red"
        }`,
      });
    } finally {
      // Antes estaba fuera del camino de fallo: con la red caida el boton se
      // quedaba deshabilitado y la barra de acciones inservible.
      setBatchLoading(false);
    }
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
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "Tu sesion ha caducado. Vuelve a entrar."
              : `El servidor ha respondido ${res.status}.`,
          );
        }
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (!data || !Array.isArray(data.tasks)) {
          throw new Error("La respuesta del servidor no tiene el formato esperado.");
        }
        setErrorCarga(null);
        setTasks(data.tasks);
        setTotal(data.total);
        setSelected(new Set());
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setTasks([]);
        setTotal(0);
        setErrorCarga(e instanceof Error ? e.message : "No se han podido cargar las tareas.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, assignee, status, category, refreshKey]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  /** Hay algo filtrando de verdad, no solo los desplegables abiertos del todo. */
  const hayFiltros = Boolean(assignee || status || category);

  const overdueCount = useMemo(
    () => tasks.filter((t) => { const d = t.deadline ?? t.dueDate; return d && t.status !== "DONE" && t.status !== "SKIPPED" && new Date(d) < new Date(); }).length,
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

      {/*
        Filtros con etiqueta asociada (`htmlFor`/`id`).
        Eran tres `<select>` sueltos: un lector de pantalla anunciaba tres
        listas desplegables sin decir de que, y quien navega con teclado no
        sabia cual estaba tocando.
      */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtroResponsable" className="text-xs font-medium text-gray-500">
            Responsable
          </label>
          <select
            id="filtroResponsable"
            value={assignee}
            onChange={(e) => { setAssignee(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {assigneeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtroEstado" className="text-xs font-medium text-gray-500">
            Estado
          </label>
          <select
            id="filtroEstado"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtroCategoria" className="text-xs font-medium text-gray-500">
            Categoria
          </label>
          <select
            id="filtroCategoria"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
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

      {avisoAccion && (
        <p
          role="status"
          data-testid="aviso-accion"
          className={`mb-4 text-sm rounded-md px-3 py-2 ${
            avisoAccion.tipo === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {avisoAccion.texto}
        </p>
      )}

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
            onClick={() => batchAction({ status: "DONE" }, "completadas")}
            disabled={batchLoading}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Completar
          </button>
          <button
            onClick={() => batchAction({ status: "IN_PROGRESS" }, "iniciadas")}
            disabled={batchLoading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Iniciar
          </button>
          <select
            aria-label="Reasignar las tareas seleccionadas"
            onChange={(e) => { if (e.target.value !== "") batchAction({ assigneeId: e.target.value }, "reasignadas"); e.target.value = ""; }}
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
        {errorCarga ? (
          <AvisoError
            mensaje={errorCarga}
            que="las tareas"
            onReintentar={() => setRefreshKey((k) => k + 1)}
          />
        ) : loading ? (
          <div className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400">
            Cargando...
          </div>
        ) : tasks.length === 0 ? (
          /*
           * Vacio por filtros y vacio de verdad no son lo mismo.
           *
           * La pantalla decia siempre "No hay tareas con estos filtros",
           * incluso con los filtros abiertos del todo: quien todavia no tiene
           * ninguna tarea creida buscaba un filtro que quitar y no habia
           * ninguno.
           */
          <div
            data-testid="carga-vacio"
            className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400"
          >
            {hayFiltros ? "No hay tareas con estos filtros" : "Aun no hay ninguna tarea"}
          </div>
        ) : (
          tasks.map((task) => {
            const effectiveDate = task.deadline ?? task.dueDate;
            const deadlineDays = effectiveDate
              ? Math.ceil((new Date(effectiveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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
                  {puedeEditar && (
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${task.title}`}
                      checked={selected.has(task.id)}
                      onChange={() => toggleSelect(task.id)}
                      className="mt-1 rounded border-gray-300 shrink-0"
                    />
                  )}
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
                      <span
                        data-testid="estado-tarea"
                        className={`text-xs px-2 py-0.5 rounded-full ${TASK_STATUS_COLORS[task.status] || ""}`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <p data-testid="titulo-tarea" className="font-medium mt-1">{task.title}</p>
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
                      {effectiveDate && task.status !== "DONE" && task.status !== "SKIPPED" && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          expired ? "bg-red-100 text-red-700 font-medium" :
                          urgent ? "bg-orange-100 text-orange-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {expired ? "VENCIDO" : `${deadlineDays}d`} — {new Date(effectiveDate).toLocaleDateString("es-ES")}
                        </span>
                      )}
                      {task.dependsOn && task.dependsOn.status !== "DONE" && task.dependsOn.status !== "SKIPPED" && (
                        <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded" title={`Espera: ${task.dependsOn.title}`}>
                          ⛓ {task.dependsOn.title.length > 25 ? task.dependsOn.title.slice(0, 25) + "…" : task.dependsOn.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => { toggleNotes(task.id); setNoteInput(""); }}
                      aria-label={`Notas de gestion de ${task.title}`}
                      aria-expanded={openNotesId === task.id}
                      title="Notas de gestión"
                      className={`p-1.5 rounded transition relative ${openNotesId === task.id ? "text-amber-600 bg-amber-50" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      {task._count.notes > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 text-[9px] bg-amber-500 text-white rounded-full flex items-center justify-center font-bold">{task._count.notes > 9 ? "9+" : task._count.notes}</span>
                      )}
                    </button>
                    {puedeEditar && task.status !== "DONE" && task.status !== "SKIPPED" && task.status !== "BLOCKED" && (
                      <button
                        onClick={() => updateTaskStatus(task, "DONE", "Tarea completada")}
                        disabled={updatingId === task.id}
                        aria-label={`Marcar completada: ${task.title}`}
                        title="Marcar completada"
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition disabled:opacity-40"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    {puedeEditar && task.status === "PENDING" && (
                      <button
                        onClick={() => updateTaskStatus(task, "IN_PROGRESS", "Tarea iniciada")}
                        disabled={updatingId === task.id}
                        aria-label={`Iniciar: ${task.title}`}
                        title="Iniciar"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition disabled:opacity-40"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline notes panel */}
                {openNotesId === task.id && (
                  <div className="mt-3 pt-3 border-t border-amber-100">
                    {notesLoading && !notesCache[task.id] ? (
                      <p className="text-xs text-gray-400 py-2">Cargando notas...</p>
                    ) : (
                      <>
                        {(notesCache[task.id] ?? []).length === 0 ? (
                          // Solo se dice "sin notas" cuando de verdad se ha
                          // podido preguntar: si la peticion fallo, no se sabe.
                          !errorNotas && (
                            <p className="text-xs text-gray-400 mb-2">Sin notas aún. Anota llamadas, respuestas, documentos pendientes...</p>
                          )
                        ) : (
                          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                            {(notesCache[task.id] ?? []).map((note) => (
                              <div key={note.id} className="flex gap-2 text-sm">
                                <span className="text-xs text-gray-400 shrink-0 pt-0.5 w-24">
                                  {new Date(note.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <div>
                                  <span className="text-xs font-medium text-gray-500">{note.user.name || note.user.email}: </span>
                                  <span className="text-gray-700 whitespace-pre-wrap">{note.content}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {errorNotas && (
                          <p
                            role="alert"
                            data-testid="error-notas"
                            className="mb-2 text-xs rounded px-2 py-1 bg-red-50 text-red-700 border border-red-200"
                          >
                            {errorNotas}
                          </p>
                        )}
                        {puedeEditar && (
                        <div className="flex gap-2">
                          <label htmlFor={`nota-${task.id}`} className="sr-only">
                            Nueva nota para {task.title}
                          </label>
                          <input
                            id={`nota-${task.id}`}
                            type="text"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(task.id); } }}
                            placeholder="Escribe una nota y pulsa Enter..."
                            className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <button
                            onClick={() => saveNote(task.id)}
                            disabled={noteSaving || !noteInput.trim()}
                            className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                          >
                            Guardar
                          </button>
                        </div>
                        )}
                      </>
                    )}
                  </div>
                )}
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
