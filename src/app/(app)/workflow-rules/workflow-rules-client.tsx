"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────

interface WorkflowLog {
  id: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  error: string | null;
  createdAt: string;
  caseId: string | null;
}

interface WorkflowRule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  trigger: string;
  conditions: Record<string, unknown>;
  action: string;
  actionConfig: Record<string, unknown>;
  execCount: number;
  lastRunAt: string | null;
  createdAt: string;
  logs: WorkflowLog[];
}

// ─── Constants ────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  CASE_STATUS_CHANGED: "Estado de expediente cambia",
  TASK_STATUS_CHANGED: "Estado de tarea cambia",
  CASE_CREATED: "Expediente creado",
  DOCUMENT_UPLOADED: "Documento subido",
};

const ACTION_LABELS: Record<string, string> = {
  SEND_EMAIL_CONTACT: "Enviar email al contacto del caso",
  SEND_EMAIL_TEAM: "Enviar email al equipo",
  ADD_CASE_COMMENT: "Añadir comentario al expediente",
  CHANGE_CASE_STATUS: "Cambiar estado del expediente",
};

const CASE_STATUS_OPTIONS = [
  { value: "OPEN", label: "Abierto" },
  { value: "PENDING_DOCS", label: "Pendiente documentación" },
  { value: "IN_PROGRESS", label: "En tramitación" },
  { value: "PENDING_SIGNATURE", label: "Pendiente firma" },
  { value: "FILED", label: "Presentado" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "ARCHIVED", label: "Archivado" },
];

const LOG_STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

// ─── Empty rule form ──────────────────────────────────────

function emptyForm() {
  return {
    name: "",
    description: "",
    trigger: "CASE_STATUS_CHANGED",
    isActive: true,
    conditions: {} as Record<string, string>,
    action: "ADD_CASE_COMMENT",
    actionConfig: {} as Record<string, string>,
  };
}

// ─── Condition and action config editors ──────────────────

function ConditionsEditor({
  trigger,
  conditions,
  onChange,
}: {
  trigger: string;
  conditions: Record<string, string>;
  onChange: (c: Record<string, string>) => void;
}) {
  if (trigger === "CASE_STATUS_CHANGED") {
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde estado (opcional)</label>
          <select
            value={conditions.fromStatus ?? ""}
            onChange={(e) => onChange({ ...conditions, fromStatus: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">Cualquier estado</option>
            {CASE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hacia estado (opcional)</label>
          <select
            value={conditions.toStatus ?? ""}
            onChange={(e) => onChange({ ...conditions, toStatus: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">Cualquier estado</option>
            {CASE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    );
  }
  if (trigger === "TASK_STATUS_CHANGED") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Hacia estado de tarea (opcional)</label>
        <select
          value={conditions.toStatus ?? ""}
          onChange={(e) => onChange({ ...conditions, toStatus: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Cualquier estado</option>
          {["PENDING", "IN_PROGRESS", "BLOCKED", "READY", "DONE", "SKIPPED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    );
  }
  return <p className="text-xs text-gray-400">Sin condiciones adicionales disponibles para este disparador.</p>;
}

function ActionConfigEditor({
  action,
  config,
  onChange,
}: {
  action: string;
  config: Record<string, string>;
  onChange: (c: Record<string, string>) => void;
}) {
  if (action === "SEND_EMAIL_CONTACT" || action === "SEND_EMAIL_TEAM") {
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Asunto del email</label>
          <input
            type="text"
            value={config.subject ?? ""}
            onChange={(e) => onChange({ ...config, subject: e.target.value })}
            placeholder="Actualización de su expediente"
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cuerpo del mensaje</label>
          <textarea
            value={config.body ?? ""}
            onChange={(e) => onChange({ ...config, body: e.target.value })}
            rows={3}
            placeholder="Estimado/a, le informamos que su expediente ha sido actualizado..."
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-gray-400 mt-1">Puedes usar: {"{{case.ref}}"}, {"{{case.status}}"}, {"{{deceased.name}}"}</p>
        </div>
      </div>
    );
  }
  if (action === "ADD_CASE_COMMENT") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Texto del comentario</label>
        <textarea
          value={config.comment ?? ""}
          onChange={(e) => onChange({ ...config, comment: e.target.value })}
          rows={2}
          placeholder="El expediente ha cambiado de estado automáticamente."
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <p className="text-xs text-gray-400 mt-1">Puedes usar: {"{{case.ref}}"}, {"{{case.status}}"}</p>
      </div>
    );
  }
  if (action === "CHANGE_CASE_STATUS") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nuevo estado del expediente</label>
        <select
          value={config.newStatus ?? ""}
          onChange={(e) => onChange({ ...config, newStatus: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Seleccionar estado…</option>
          {CASE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  return null;
}

// ─── Rule form modal ──────────────────────────────────────

function RuleModal({
  initial,
  onSave,
  onClose,
  saving,
  error,
}: {
  initial: ReturnType<typeof emptyForm>;
  onSave: (form: ReturnType<typeof emptyForm>) => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState(initial);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-5">{initial.name ? "Editar regla" : "Nueva regla"}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={120}
              placeholder="Ej: Notificar familia al cerrar expediente"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={240}
              placeholder="Descripción opcional"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700">Regla activa</span>
            </label>
          </div>

          <hr />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Disparador (cuando…)</label>
            <select
              value={form.trigger}
              onChange={(e) => {
                set("trigger", e.target.value);
                set("conditions", {});
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condiciones</label>
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
              <ConditionsEditor
                trigger={form.trigger}
                conditions={form.conditions as Record<string, string>}
                onChange={(c) => set("conditions", c)}
              />
            </div>
          </div>

          <hr />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acción (entonces…)</label>
            <select
              value={form.action}
              onChange={(e) => {
                set("action", e.target.value);
                set("actionConfig", {});
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {Object.entries(ACTION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Configuración de acción</label>
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
              <ActionConfigEditor
                action={form.action}
                config={form.actionConfig as Record<string, string>}
                onChange={(c) => set("actionConfig", c)}
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar regla"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Test rule modal ───────────────────────────────────────

function TestRuleModal({ rule, onClose }: { rule: WorkflowRule; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCase, setSelectedCase] = useState<{ id: string; title: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults((data.results ?? []).filter((r: any) => r.type === "case").map((r: any) => ({ id: r.id, title: r.title })));
      } catch {}
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function handleRun() {
    if (!selectedCase) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/workflow-rules/${rule.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: selectedCase.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al ejecutar");
      setResult({ success: true, message: data.message || "Regla ejecutada correctamente." });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-1">Probar regla</h2>
        <p className="text-sm text-gray-500 mb-4">
          Ejecuta <strong>{rule.name}</strong> contra un expediente real. La acción se ejecutará de verdad.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Buscar expediente</label>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedCase(null); setResult(null); }}
              placeholder="Ref. o nombre del fallecido…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
            {searching && <p className="text-xs text-gray-400 mt-1">Buscando…</p>}
            {results.length > 0 && !selectedCase && (
              <div className="mt-1 border rounded-md divide-y max-h-40 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setSelectedCase(r); setQuery(r.title); setResults([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedCase && (
            <div className="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-100 rounded-md">
              <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-indigo-800 font-medium truncate">{selectedCase.title}</span>
              <button type="button" onClick={() => { setSelectedCase(null); setQuery(""); }} className="ml-auto text-indigo-400 hover:text-indigo-700 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {result && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-md">
              <p className="text-sm text-green-800 font-medium">Ejecutado correctamente</p>
              <p className="text-xs text-green-700 mt-0.5">{result.message}</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={!selectedCase || running}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? "Ejecutando…" : "Ejecutar regla"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule card ─────────────────────────────────────────────

function RuleCard({
  rule,
  canManage,
  onEdit,
  onDelete,
  onToggle,
  onTest,
}: {
  rule: WorkflowRule;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onTest: () => void;
}) {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className={`bg-white border rounded-xl p-5 ${!rule.isActive ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full shrink-0 ${rule.isActive ? "bg-green-500" : "bg-gray-300"}`} />
            <h3 className="font-semibold text-gray-900 truncate">{rule.name}</h3>
          </div>
          {rule.description && (
            <p className="text-sm text-gray-500 mb-2 line-clamp-2">{rule.description}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-0.5">
              {TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
            </span>
            <span className="text-gray-400">→</span>
            <span className="bg-purple-50 text-purple-700 border border-purple-100 rounded px-2 py-0.5">
              {ACTION_LABELS[rule.action] ?? rule.action}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <>
              <button
                onClick={onToggle}
                title={rule.isActive ? "Desactivar" : "Activar"}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
              >
                {rule.isActive ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>
              <button onClick={onTest} title="Probar regla" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-gray-500">
        <span>{rule.execCount} ejecuciones</span>
        {rule.lastRunAt && (
          <span>Última vez: {new Date(rule.lastRunAt).toLocaleDateString("es-ES")}</span>
        )}
        {rule.logs.length > 0 && (
          <button onClick={() => setShowLogs((v) => !v)} className="text-indigo-600 hover:underline">
            {showLogs ? "Ocultar" : "Ver"} registro
          </button>
        )}
      </div>

      {showLogs && rule.logs.length > 0 && (
        <div className="mt-3 space-y-1">
          {rule.logs.map((log) => (
            <div key={log.id} className="flex items-center gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded font-medium ${LOG_STATUS_COLORS[log.status]}`}>
                {log.status}
              </span>
              <span className="text-gray-500">{new Date(log.createdAt).toLocaleString("es-ES")}</span>
              {log.error && <span className="text-red-500 truncate max-w-xs">{log.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────

export function WorkflowRulesClient({ canManage }: { canManage: boolean }) {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [testRule, setTestRule] = useState<WorkflowRule | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workflow-rules");
      if (res.ok) setRules(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditingRule(null);
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(rule: WorkflowRule) {
    setEditingRule(rule);
    setSaveError(null);
    setShowModal(true);
  }

  async function handleSave(form: ReturnType<typeof emptyForm>) {
    setSaving(true);
    setSaveError(null);
    try {
      const url = editingRule ? `/api/workflow-rules/${editingRule.id}` : "/api/workflow-rules";
      const method = editingRule ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          isActive: form.isActive,
          trigger: form.trigger,
          conditions: form.conditions,
          action: form.action,
          actionConfig: form.actionConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setShowModal(false);
      await load();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: WorkflowRule) {
    await fetch(`/api/workflow-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/workflow-rules/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    await load();
  }

  const initialForm = editingRule
    ? {
        name: editingRule.name,
        description: editingRule.description ?? "",
        isActive: editingRule.isActive,
        trigger: editingRule.trigger,
        conditions: editingRule.conditions as Record<string, string>,
        action: editingRule.action,
        actionConfig: editingRule.actionConfig as Record<string, string>,
      }
    : emptyForm();

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <Link href="/workflow-logs" className="text-sm text-gray-500 hover:text-primary flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Ver registro de ejecuciones
        </Link>
        {canManage && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva regla
          </button>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="font-medium">Sin reglas de automatización</p>
          <p className="text-sm mt-1">
            {canManage
              ? "Crea tu primera regla para automatizar acciones del sistema."
              : "No hay reglas configuradas en esta organización."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              canManage={canManage}
              onEdit={() => openEdit(rule)}
              onDelete={() => setDeleteConfirm(rule.id)}
              onToggle={() => handleToggle(rule)}
              onTest={() => setTestRule(rule)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <RuleModal
          initial={initialForm}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
          error={saveError}
        />
      )}

      {testRule && (
        <TestRuleModal rule={testRule} onClose={() => setTestRule(null)} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold mb-2">¿Eliminar esta regla?</h3>
            <p className="text-sm text-gray-600 mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
