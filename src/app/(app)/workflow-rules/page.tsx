"use client";

import { useState, useEffect } from "react";

const TRIGGERS = [
  { value: "CASE_CREATED", label: "Expediente creado" },
  { value: "CASE_STATUS_CHANGED", label: "Estado del expediente cambiado" },
  { value: "TASK_STATUS_CHANGED", label: "Estado de tarea cambiado" },
  { value: "DOCUMENT_UPLOADED", label: "Documento subido" },
];

const ACTIONS = [
  { value: "SEND_EMAIL_CONTACT", label: "Enviar email al contacto familiar" },
  { value: "SEND_EMAIL_TEAM", label: "Enviar email al equipo (Owner/Manager)" },
  { value: "ADD_CASE_COMMENT", label: "Añadir comentario al expediente" },
  { value: "CHANGE_CASE_STATUS", label: "Cambiar estado del expediente" },
];

const CASE_STATUSES = [
  "INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS",
  "READY_TO_SEND", "SENT", "FOLLOW_UP", "CLOSED", "ARCHIVED",
];

const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "BLOCKED", "READY", "APPROVED", "DONE", "SKIPPED"];

const TASK_CATEGORIES = [
  "BANCOS", "SUMINISTROS", "TELECOM", "SUSCRIPCIONES", "SEGUROS", "VIDA_DIGITAL", "FISCAL", "OTROS",
];

const TRIGGER_COLORS: Record<string, string> = {
  CASE_CREATED: "bg-green-100 text-green-700",
  CASE_STATUS_CHANGED: "bg-blue-100 text-blue-700",
  TASK_STATUS_CHANGED: "bg-purple-100 text-purple-700",
  DOCUMENT_UPLOADED: "bg-orange-100 text-orange-700",
};

const ACTION_COLORS: Record<string, string> = {
  SEND_EMAIL_CONTACT: "bg-pink-100 text-pink-700",
  SEND_EMAIL_TEAM: "bg-indigo-100 text-indigo-700",
  ADD_CASE_COMMENT: "bg-amber-100 text-amber-700",
  CHANGE_CASE_STATUS: "bg-teal-100 text-teal-700",
};

const TEMPLATE_VARS = [
  "{{deceased.fullName}}", "{{contact.fullName}}", "{{case.ref}}", "{{case.status}}", "{{org.name}}",
];

interface WorkflowLog {
  id: string;
  status: string;
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
  conditions: Record<string, string>;
  action: string;
  actionConfig: Record<string, string>;
  execCount: number;
  lastRunAt: string | null;
  createdAt: string;
  logs: WorkflowLog[];
}

type FormMode = "create" | "edit";

const emptyForm = () => ({
  name: "",
  description: "",
  trigger: "CASE_STATUS_CHANGED",
  conditions: { toStatus: "", fromStatus: "", taskStatus: "", taskCategory: "" },
  action: "SEND_EMAIL_CONTACT",
  actionConfig: { subject: "", body: "", comment: "", newStatus: "" },
  isActive: true,
});

export default function WorkflowRulesPage() {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testRuleId, setTestRuleId] = useState<string | null>(null);
  const [testCaseId, setTestCaseId] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);

  useEffect(() => { fetchRules(); }, []);

  async function fetchRules() {
    setLoading(true);
    const res = await fetch("/api/workflow-rules");
    if (res.ok) setRules(await res.json());
    setLoading(false);
  }

  function openCreate() {
    setForm(emptyForm());
    setFormMode("create");
    setEditId(null);
    setError("");
    setFormOpen(true);
  }

  function openEdit(rule: WorkflowRule) {
    setForm({
      name: rule.name,
      description: rule.description || "",
      trigger: rule.trigger,
      conditions: {
        toStatus: rule.conditions.toStatus || "",
        fromStatus: rule.conditions.fromStatus || "",
        taskStatus: rule.conditions.taskStatus || "",
        taskCategory: rule.conditions.taskCategory || "",
      },
      action: rule.action,
      actionConfig: {
        subject: rule.actionConfig.subject || "",
        body: rule.actionConfig.body || "",
        comment: rule.actionConfig.comment || "",
        newStatus: rule.actionConfig.newStatus || "",
      },
      isActive: rule.isActive,
    });
    setFormMode("edit");
    setEditId(rule.id);
    setError("");
    setFormOpen(true);
  }

  async function saveForm() {
    if (!form.name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      description: form.description || null,
      trigger: form.trigger,
      conditions: Object.fromEntries(Object.entries(form.conditions).filter(([, v]) => v !== "")),
      action: form.action,
      actionConfig: Object.fromEntries(Object.entries(form.actionConfig).filter(([, v]) => v !== "")),
      isActive: form.isActive,
    };

    const url = formMode === "create" ? "/api/workflow-rules" : `/api/workflow-rules/${editId}`;
    const method = formMode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      setFormOpen(false);
      fetchRules();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Error al guardar la regla");
    }
  }

  async function toggleActive(rule: WorkflowRule) {
    await fetch(`/api/workflow-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    fetchRules();
  }

  async function deleteRule(id: string) {
    setDeletingId(id);
    await fetch(`/api/workflow-rules/${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchRules();
  }

  async function testRule() {
    if (!testRuleId || !testCaseId.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    const res = await fetch(`/api/workflow-rules/${testRuleId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: testCaseId.trim() }),
    });
    const data = await res.json().catch(() => null);
    setTestResult({ ok: res.ok, msg: data?.message || data?.error || (res.ok ? "Ejecutado" : "Error") });
    setTestLoading(false);
    if (res.ok) fetchRules();
  }

  function conditionLabel() {
    const t = form.trigger;
    if (t === "CASE_STATUS_CHANGED") return "Condiciones (opcional)";
    if (t === "TASK_STATUS_CHANGED") return "Condiciones (opcional)";
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Automatizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Reglas que se disparan automáticamente según eventos del sistema
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva regla
        </button>
      </div>

      {/* How it works info */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">¿Cómo funcionan las automatizaciones?</p>
          <p>Cuando ocurre un <strong>evento</strong> (p.ej. expediente cerrado), el sistema evalúa todas las reglas activas. Si las condiciones se cumplen, ejecuta la <strong>acción</strong> (p.ej. enviar email a la familia). Las variables disponibles son: {TEMPLATE_VARS.join(", ")}.</p>
        </div>
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-gray-400 mb-2">No hay reglas de automatización</p>
          <p className="text-sm text-gray-400 mb-4">Crea tu primera regla para automatizar tareas repetitivas</p>
          <button onClick={openCreate} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90">
            Crear primera regla
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className={`bg-white rounded-lg border p-5 ${!rule.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold">{rule.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIGGER_COLORS[rule.trigger] || "bg-gray-100 text-gray-600"}`}>
                      {TRIGGERS.find((t) => t.value === rule.trigger)?.label || rule.trigger}
                    </span>
                    <span className="text-xs text-gray-400">→</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[rule.action] || "bg-gray-100 text-gray-600"}`}>
                      {ACTIONS.find((a) => a.value === rule.action)?.label || rule.action}
                    </span>
                    {!rule.isActive && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Inactiva</span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                  )}

                  {/* Conditions summary */}
                  {Object.keys(rule.conditions).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(rule.conditions).map(([k, v]) => (
                        <span key={k} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {k}: <strong>{String(v)}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>{rule.execCount} ejecucion{rule.execCount !== 1 ? "es" : ""}</span>
                    {rule.lastRunAt && (
                      <span>Última: {new Date(rule.lastRunAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                    {/* Recent log dots */}
                    {rule.logs.length > 0 && (
                      <button
                        onClick={() => setExpandedLogs(expandedLogs === rule.id ? null : rule.id)}
                        className="flex items-center gap-1 hover:text-gray-700"
                        title="Ver historial reciente"
                      >
                        {rule.logs.slice(0, 5).map((log) => (
                          <span
                            key={log.id}
                            className={`w-2 h-2 rounded-full ${log.status === "SUCCESS" ? "bg-green-500" : log.status === "FAILED" ? "bg-red-500" : "bg-gray-300"}`}
                            title={log.status}
                          />
                        ))}
                        <span className="ml-1">historial</span>
                      </button>
                    )}
                  </div>

                  {/* Expanded logs */}
                  {expandedLogs === rule.id && rule.logs.length > 0 && (
                    <div className="mt-3 border-t pt-3 space-y-1">
                      {rule.logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${log.status === "SUCCESS" ? "bg-green-500" : "bg-red-500"}`} />
                          <span className="text-gray-400 shrink-0">{new Date(log.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                          <span className={log.status === "FAILED" ? "text-red-600" : "text-gray-600"}>
                            {log.status === "FAILED" && log.error ? log.error : log.status}
                          </span>
                          {log.caseId && <span className="text-gray-400">exp: {log.caseId.slice(-6)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle active */}
                  <button
                    onClick={() => toggleActive(rule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.isActive ? "bg-primary" : "bg-gray-300"}`}
                    title={rule.isActive ? "Desactivar" : "Activar"}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  <button
                    onClick={() => { setTestRuleId(rule.id); setTestCaseId(""); setTestResult(null); }}
                    title="Probar regla"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => openEdit(rule)}
                    title="Editar"
                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { if (confirm(`¿Eliminar la regla "${rule.name}"?`)) deleteRule(rule.id); }}
                    disabled={deletingId === rule.id}
                    title="Eliminar"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test modal */}
      {testRuleId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Probar regla</h2>
            <p className="text-sm text-gray-600 mb-4">
              Introduce el ID de un expediente real para ejecutar la regla sobre él. Esta acción es real (enviará emails si procede).
            </p>
            <input
              type="text"
              value={testCaseId}
              onChange={(e) => setTestCaseId(e.target.value)}
              placeholder="ID del expediente..."
              className="w-full px-3 py-2 border rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {testResult && (
              <p className={`text-sm mb-3 ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
                {testResult.msg}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setTestRuleId(null); setTestResult(null); }}
                className="px-4 py-2 border text-sm rounded-md hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                onClick={testRule}
                disabled={testLoading || !testCaseId.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {testLoading ? "Ejecutando..." : "Ejecutar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/edit modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-50">
          <div className="bg-white h-full w-full max-w-lg shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {formMode === "create" ? "Nueva regla" : "Editar regla"}
              </h2>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Nombre <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Notificar familia al cerrar expediente"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Descripción breve (opcional)"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Trigger */}
              <div>
                <label className="block text-sm font-medium mb-1">Disparador</label>
                <select
                  value={form.trigger}
                  onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Conditions */}
              {conditionLabel() && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-medium">{conditionLabel()}</h3>
                  {(form.trigger === "CASE_STATUS_CHANGED") && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Estado anterior</label>
                          <select
                            value={form.conditions.fromStatus}
                            onChange={(e) => setForm((f) => ({ ...f, conditions: { ...f.conditions, fromStatus: e.target.value } }))}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          >
                            <option value="">Cualquiera</option>
                            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Estado nuevo</label>
                          <select
                            value={form.conditions.toStatus}
                            onChange={(e) => setForm((f) => ({ ...f, conditions: { ...f.conditions, toStatus: e.target.value } }))}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          >
                            <option value="">Cualquiera</option>
                            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                  {form.trigger === "TASK_STATUS_CHANGED" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Estado tarea</label>
                        <select
                          value={form.conditions.taskStatus}
                          onChange={(e) => setForm((f) => ({ ...f, conditions: { ...f.conditions, taskStatus: e.target.value } }))}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        >
                          <option value="">Cualquiera</option>
                          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Categoría tarea</label>
                        <select
                          value={form.conditions.taskCategory}
                          onChange={(e) => setForm((f) => ({ ...f, conditions: { ...f.conditions, taskCategory: e.target.value } }))}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        >
                          <option value="">Cualquiera</option>
                          {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action */}
              <div>
                <label className="block text-sm font-medium mb-1">Acción</label>
                <select
                  value={form.action}
                  onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>

              {/* Action config */}
              {(form.action === "SEND_EMAIL_CONTACT" || form.action === "SEND_EMAIL_TEAM") && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-medium">Configuración del email</h3>
                  <p className="text-xs text-gray-500">Variables disponibles: {TEMPLATE_VARS.join(", ")}</p>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Asunto</label>
                    <input
                      type="text"
                      value={form.actionConfig.subject}
                      onChange={(e) => setForm((f) => ({ ...f, actionConfig: { ...f.actionConfig, subject: e.target.value } }))}
                      placeholder="Ej: Actualización de su expediente {{case.ref}}"
                      className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Cuerpo del mensaje</label>
                    <textarea
                      value={form.actionConfig.body}
                      onChange={(e) => setForm((f) => ({ ...f, actionConfig: { ...f.actionConfig, body: e.target.value } }))}
                      rows={5}
                      placeholder={`Estimado/a {{contact.fullName}},\n\nLe informamos que su expediente {{case.ref}} ha sido actualizado.\n\nAtentamente,\n{{org.name}}`}
                      className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                    />
                  </div>
                </div>
              )}

              {form.action === "ADD_CASE_COMMENT" && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="text-sm font-medium mb-2 block">Texto del comentario</label>
                  <input
                    type="text"
                    value={form.actionConfig.comment}
                    onChange={(e) => setForm((f) => ({ ...f, actionConfig: { ...f.actionConfig, comment: e.target.value } }))}
                    placeholder="Ej: Expediente cerrado automáticamente"
                    className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              )}

              {form.action === "CHANGE_CASE_STATUS" && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="text-sm font-medium mb-2 block">Nuevo estado</label>
                  <select
                    value={form.actionConfig.newStatus}
                    onChange={(e) => setForm((f) => ({ ...f, actionConfig: { ...f.actionConfig, newStatus: e.target.value } }))}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  >
                    <option value="">Selecciona estado</option>
                    {CASE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
              )}

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className="text-sm">{form.isActive ? "Regla activa" : "Regla inactiva"}</span>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setFormOpen(false)}
                  className="flex-1 px-4 py-2 border text-sm rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveForm}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : formMode === "create" ? "Crear regla" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
