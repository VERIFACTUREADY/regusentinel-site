"use client";

import { useState, useEffect, useCallback } from "react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────

interface TemplateTask {
  id?: string;
  category: string;
  title: string;
  description: string;
  deadlineOffsetDays: string;
  sortOrder: number;
}

interface CaseTemplate {
  id: string;
  name: string;
  description: string | null;
  categories: string[];
  isDefault: boolean;
  tasks: TemplateTask[];
  createdAt: string;
}

const CATEGORY_OPTIONS = ALL_CATEGORIES;

const CASE_CATEGORIES = [
  { value: "BANCOS", label: "Bancos" },
  { value: "SUMINISTROS", label: "Suministros" },
  { value: "TELECOM", label: "Telecom" },
  { value: "SUSCRIPCIONES", label: "Suscripciones" },
  { value: "SEGUROS", label: "Seguros" },
  { value: "VIDA_DIGITAL", label: "Vida digital" },
  { value: "FISCAL", label: "Fiscal" },
  { value: "OTROS", label: "Otros" },
];

function emptyTask(): TemplateTask {
  return { category: "BANCOS", title: "", description: "", deadlineOffsetDays: "", sortOrder: 0 };
}

function emptyForm() {
  return {
    name: "",
    description: "",
    categories: [] as string[],
    isDefault: false,
    tasks: [emptyTask()] as TemplateTask[],
  };
}

// ─── Task Row ─────────────────────────────────────────────

function TaskRow({
  task,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  task: TemplateTask;
  index: number;
  total: number;
  onChange: (t: TemplateTask) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_120px_80px_auto] gap-2 items-start p-3 bg-white border rounded-lg">
      <div className="flex flex-col gap-1 pt-1">
        <button
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
          title="Subir"
        >▲</button>
        <button
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
          title="Bajar"
        >▼</button>
      </div>

      <div>
        <select
          value={task.category}
          onChange={(e) => onChange({ ...task, category: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <input
          type="text"
          placeholder="Título de la tarea *"
          value={task.title}
          onChange={(e) => onChange({ ...task, title: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder="Descripción (opcional)"
          value={task.description}
          onChange={(e) => onChange({ ...task, description: e.target.value })}
          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary mt-1"
        />
      </div>

      <div>
        <input
          type="number"
          placeholder="días"
          min={1}
          value={task.deadlineOffsetDays}
          onChange={(e) => onChange({ ...task, deadlineOffsetDays: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          title="Días desde fallecimiento para calcular el plazo"
        />
        <p className="text-[10px] text-gray-400 mt-0.5">días desde fallec.</p>
      </div>

      <div className="text-center pt-1.5">
        <span className="text-xs text-gray-400">#{index + 1}</span>
      </div>

      <button
        onClick={onRemove}
        disabled={total === 1}
        className="text-gray-300 hover:text-red-500 disabled:opacity-20 pt-1"
        title="Eliminar tarea"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Template Modal ───────────────────────────────────────

function TemplateModal({
  tpl,
  onClose,
  onSave,
}: {
  tpl: CaseTemplate | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState(
    tpl
      ? {
          name: tpl.name,
          description: tpl.description ?? "",
          categories: [...tpl.categories],
          isDefault: tpl.isDefault,
          tasks: tpl.tasks.map((t) => ({
            ...t,
            description: t.description ?? "",
            deadlineOffsetDays: t.deadlineOffsetDays?.toString() ?? "",
          })),
        }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateTask(i: number, t: TemplateTask) {
    setForm((f) => {
      const tasks = [...f.tasks];
      tasks[i] = t;
      return { ...f, tasks };
    });
  }

  function removeTask(i: number) {
    setForm((f) => ({ ...f, tasks: f.tasks.filter((_, idx) => idx !== i) }));
  }

  function addTask() {
    setForm((f) => ({ ...f, tasks: [...f.tasks, emptyTask()] }));
  }

  function moveTask(i: number, dir: -1 | 1) {
    setForm((f) => {
      const tasks = [...f.tasks];
      const j = i + dir;
      if (j < 0 || j >= tasks.length) return f;
      [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
      return { ...f, tasks };
    });
  }

  function toggleCategory(val: string) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(val)
        ? f.categories.filter((c) => c !== val)
        : [...f.categories, val],
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) return setError("El nombre es obligatorio");
    const invalid = form.tasks.some((t) => !t.title.trim());
    if (invalid) return setError("Todas las tareas deben tener título");

    setSaving(true);
    setError(null);
    try {
      const url = tpl ? `/api/case-templates/${tpl.id}` : "/api/case-templates";
      const method = tpl ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        return setError(d.error ?? "Error al guardar");
      }
      onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {tpl ? "Editar plantilla" : "Nueva plantilla de expediente"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Expediente completo con seguros"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descripción opcional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categorías de expediente — ¿para qué tipos aplica?
            </label>
            <div className="flex flex-wrap gap-2">
              {CASE_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => toggleCategory(c.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    form.categories.includes(c.value)
                      ? "bg-primary text-white border-primary"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Sin selección = aplica a cualquier tipo de expediente
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.isDefault ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.isDefault ? "translate-x-4.5" : "translate-x-0.5"}`} />
            </button>
            <span className="text-sm text-gray-700">
              Plantilla por defecto
              <span className="text-gray-400 ml-1 text-xs">(se sugerirá al crear nuevos expedientes)</span>
            </span>
          </div>

          <hr />

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Tareas de la plantilla
                <span className="text-gray-400 ml-2 font-normal">({form.tasks.length})</span>
              </label>
              <div className="text-xs text-gray-400 hidden md:block">
                Categoría · Título · Plazo (días desde fallecimiento)
              </div>
            </div>

            <div className="space-y-2">
              {form.tasks.map((task, i) => (
                <TaskRow
                  key={i}
                  task={task}
                  index={i}
                  total={form.tasks.length}
                  onChange={(t) => updateTask(i, t)}
                  onRemove={() => removeTask(i)}
                  onMove={(dir) => moveTask(i, dir)}
                />
              ))}
            </div>

            <button
              onClick={addTask}
              className="mt-3 w-full border-2 border-dashed border-gray-200 rounded-lg py-2.5 text-sm text-gray-500 hover:border-primary hover:text-primary transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Añadir tarea
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-between items-center bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-400">{form.tasks.length} tarea{form.tasks.length !== 1 ? "s" : ""}</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Guardando..." : tpl ? "Guardar cambios" : "Crear plantilla"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────

function TemplateCard({
  tpl,
  canManage,
  onEdit,
  onDelete,
}: {
  tpl: CaseTemplate;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`¿Eliminar la plantilla "${tpl.name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/case-templates/${tpl.id}`, { method: "DELETE" });
    onDelete();
  }

  const categoryGroups = tpl.tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-white border rounded-xl shadow-sm p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
            {tpl.isDefault && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                Por defecto
              </span>
            )}
          </div>
          {tpl.description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{tpl.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
              title="Editar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded"
              title="Eliminar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(categoryGroups).map(([cat, count]) => (
          <span key={cat} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
            {CATEGORY_LABELS[cat] ?? cat} ({count})
          </span>
        ))}
      </div>

      {tpl.categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tpl.categories.map((c) => (
            <span key={c} className="text-xs border border-primary/30 text-primary px-2 py-0.5 rounded-full">
              {CATEGORY_LABELS[c] ?? c}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>{tpl.tasks.length} tarea{tpl.tasks.length !== 1 ? "s" : ""}</span>
        <span>Creada {new Date(tpl.createdAt).toLocaleDateString("es-ES")}</span>
      </div>

      <details className="mt-3">
        <summary className="text-xs text-primary cursor-pointer hover:underline">
          Ver tareas
        </summary>
        <ol className="mt-2 space-y-1">
          {tpl.tasks.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="text-gray-400 flex-shrink-0 w-4">{i + 1}.</span>
              <span className="flex-1">
                <span className="font-medium">{t.title}</span>
                {t.deadlineOffsetDays && (
                  <span className="text-gray-400 ml-1">({t.deadlineOffsetDays}d)</span>
                )}
              </span>
              <span className="text-gray-400 flex-shrink-0">{CATEGORY_LABELS[t.category] ?? t.category}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────

export function CaseTemplatesClient({ canManage }: { canManage: boolean }) {
  const [templates, setTemplates] = useState<CaseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CaseTemplate | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch("/api/case-templates", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setTemplates(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [refreshKey]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(tpl: CaseTemplate) {
    setEditing(tpl);
    setModalOpen(true);
  }

  const defaultCount = templates.filter((t) => t.isDefault).length;
  const totalTasks = templates.reduce((s, t) => s + t.tasks.length, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de expediente</h1>
          <p className="text-sm text-gray-500 mt-1">
            Checklists reutilizables que puedes aplicar a cualquier expediente con un clic
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva plantilla
          </button>
        )}
      </div>

      {templates.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{templates.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Plantillas</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-primary">{defaultCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Por defecto</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{totalTasks}</div>
            <div className="text-xs text-gray-500 mt-0.5">Tareas totales</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="bg-white border rounded-xl h-40 animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">Sin plantillas</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
            Crea plantillas con conjuntos de tareas predefinidas para aplicarlas a tus expedientes en segundos.
          </p>
          {canManage && (
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={async () => {
                  const r = await fetch("/api/case-templates/seed", { method: "POST" });
                  if (r.ok) refresh();
                }}
                className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90"
              >
                Cargar 3 plantillas predefinidas
              </button>
              <button
                onClick={openCreate}
                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Crear desde cero
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              canManage={canManage}
              onEdit={() => openEdit(tpl)}
              onDelete={refresh}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <TemplateModal
          tpl={editing}
          onClose={() => setModalOpen(false)}
          onSave={refresh}
        />
      )}
    </div>
  );
}
