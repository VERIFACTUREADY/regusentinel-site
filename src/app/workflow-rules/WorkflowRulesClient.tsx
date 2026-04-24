"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────

type WorkflowTrigger = "CASE_STATUS_CHANGED" | "TASK_STATUS_CHANGED" | "CASE_CREATED" | "DOCUMENT_UPLOADED";
type WorkflowAction = "SEND_EMAIL_CONTACT" | "SEND_EMAIL_TEAM" | "ADD_CASE_COMMENT" | "CHANGE_CASE_STATUS";
type LogStatus = "SUCCESS" | "FAILED" | "SKIPPED";

interface WorkflowLog {
  id: string;
  status: LogStatus;
  error?: string | null;
  createdAt: string;
  caseId?: string | null;
}

interface WorkflowRule {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  trigger: WorkflowTrigger;
  conditions: Record<string, string>;
  action: WorkflowAction;
  actionConfig: Record<string, string>;
  execCount: number;
  lastRunAt?: string | null;
  createdAt: string;
  logs: WorkflowLog[];
}

// ─── Label maps ──────────────────────────────────────────

const TRIGGER_LABELS: Record<WorkflowTrigger, string> = {
  CASE_STATUS_CHANGED: "Cambio de estado de expediente",
  TASK_STATUS_CHANGED: "Cambio de estado de tarea",
  CASE_CREATED: "Expediente creado",
  DOCUMENT_UPLOADED: "Documento subido",
};

const ACTION_LABELS: Record<WorkflowAction, string> = {
  SEND_EMAIL_CONTACT: "Enviar email al contacto familiar",
  SEND_EMAIL_TEAM: "Enviar email al equipo",
  ADD_CASE_COMMENT: "Añadir comentario interno",
  CHANGE_CASE_STATUS: "Cambiar estado del expediente",
};

const CASE_STATUS_OPTIONS = [
  { value: "INTAKE", label: "Recepción" },
  { value: "VALIDATION", label: "Validación" },
  { value: "IN_PROGRESS", label: "En trámite" },
  { value: "PENDING_DOCS", label: "Docs. pendientes" },
  { value: "READY_TO_SEND", label: "Listo para enviar" },
  { value: "SENT", label: "Enviado" },
  { value: "FOLLOW_UP", label: "Seguimiento" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "ARCHIVED", label: "Archivado" },
];

const TASK_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En curso" },
  { value: "BLOCKED", label: "Bloqueada" },
  { value: "READY", label: "Lista" },
  { value: "APPROVED", label: "Aprobada" },
  { value: "DONE", label: "Completada" },
  { value: "SKIPPED", label: "Omitida" },
];

const TASK_CATEGORY_OPTIONS = [
  { value: "BANCOS", label: "Bancos" },
  { value: "SUMINISTROS", label: "Suministros" },
  { value: "TELECOM", label: "Telecom" },
  { value: "SUSCRIPCIONES", label: "Suscripciones" },
  { value: "SEGUROS", label: "Seguros" },
  { value: "VIDA_DIGITAL", label: "Vida digital" },
  { value: "FISCAL", label: "Fiscal" },
  { value: "OTROS", label: "Otros" },
];

const TRIGGER_COLORS: Record<WorkflowTrigger, string> = {
  CASE_STATUS_CHANGED: "bg-blue-100 text-blue-800",
  TASK_STATUS_CHANGED: "bg-violet-100 text-violet-800",
  CASE_CREATED: "bg-green-100 text-green-800",
  DOCUMENT_UPLOADED: "bg-amber-100 text-amber-800",
};

const ACTION_COLORS: Record<WorkflowAction, string> = {
  SEND_EMAIL_CONTACT: "bg-indigo-100 text-indigo-800",
  SEND_EMAIL_TEAM: "bg-cyan-100 text-cyan-800",
  ADD_CASE_COMMENT: "bg-gray-100 text-gray-800",
  CHANGE_CASE_STATUS: "bg-orange-100 text-orange-800",
};

const LOG_STATUS_STYLES: Record<LogStatus, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

const VARIABLE_HINTS = "Variables: {{deceased.fullName}}, {{contact.fullName}}, {{case.ref}}, {{org.name}}";

// ─── Empty form ──────────────────────────────────────────

function emptyForm() {
  return {
    name: "",
    description: "",
    trigger: "CASE_STATUS_CHANGED" as WorkflowTrigger,
    conditions: {} as Record<string, string>,
    action: "ADD_CASE_COMMENT" as WorkflowAction,
    actionConfig: {} as Record<string, string>,
    isActive: true,
  };
}

// ─── Condition summary ───────────────────────────────────

function conditionSummary(trigger: WorkflowTrigger, conditions: Record<string, string>): string {
  if (trigger === "CASE_STATUS_CHANGED") {
    const parts: string[] = [];
    if (conditions.fromStatus) {
      const l = CASE_STATUS_OPTIONS.find((o) => o.value === conditions.fromStatus)?.label;
      parts.push(`desde "${l}"`);
    }
    if (conditions.toStatus) {
      const l = CASE_STATUS_OPTIONS.find((o) => o.value === conditions.toStatus)?.label;
      parts.push(`hasta "${l}"`);
    }
    return parts.length ? parts.join(" ") : "Cualquier cambio de estado";
  }
  if (trigger === "TASK_STATUS_CHANGED") {
    const parts: string[] = [];
    if (conditions.taskStatus) {
      const l = TASK_STATUS_OPTIONS.find((o) => o.value === conditions.taskStatus)?.label;
      parts.push(`estado "${l}"`);
    }
    if (conditions.taskCategory) {
      const l = TASK_CATEGORY_OPTIONS.find((o) => o.value === conditions.taskCategory)?.label;
      parts.push(`categoría "${l}"`);
    }
    return parts.length ? parts.join(", ") : "Cualquier tarea";
  }
  return "—";
}

// ─── Rule Modal ──────────────────────────────────────────

function RuleModal({
  rule,
  onClose,
  onSave,
}: {
  rule: WorkflowRule | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState(
    rule
      ? {
          name: rule.name,
          description: rule.description ?? "",
          trigger: rule.trigger,
          conditions: { ...rule.conditions },
          action: rule.action,
          actionConfig: { ...rule.actionConfig },
          isActive: rule.isActive,
        }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setCondition(key: string, value: string) {
    setForm((f) => ({ ...f, conditions: { ...f.conditions, [key]: value || undefined! } }));
  }

  function setActionConfig(key: string, value: string) {
    setForm((f) => ({ ...f, actionConfig: { ...f.actionConfig, [key]: value } }));
  }

  // Reset conditions when trigger changes
  function changeTrigger(t: WorkflowTrigger) {
    setForm((f) => ({ ...f, trigger: t, conditions: {} }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = rule ? `/api/workflow-rules/${rule.id}` : "/api/workflow-rules";
      const method = rule ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al guardar");
        return;
      }
      onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {rule ? "Editar regla" : "Nueva regla de automatización"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Name + description */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Ej: Notificar familia al enviar documentación"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Descripción opcional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <hr />

          {/* Trigger */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Disparador — ¿cuándo se ejecuta?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TRIGGER_LABELS) as WorkflowTrigger[]).map((t) => (
                <button
                  key={t}
                  onClick={() => changeTrigger(t)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                    form.trigger === t
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  {TRIGGER_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Conditions */}
          {(form.trigger === "CASE_STATUS_CHANGED" || form.trigger === "TASK_STATUS_CHANGED") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Condiciones — filtrar cuándo aplica
              </label>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {form.trigger === "CASE_STATUS_CHANGED" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Estado anterior (opcional)</label>
                        <select
                          value={form.conditions.fromStatus ?? ""}
                          onChange={(e) => setCondition("fromStatus", e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Cualquiera</option>
                          {CASE_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Estado nuevo</label>
                        <select
                          value={form.conditions.toStatus ?? ""}
                          onChange={(e) => setCondition("toStatus", e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Cualquiera</option>
                          {CASE_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
                {form.trigger === "TASK_STATUS_CHANGED" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Estado de tarea</label>
                      <select
                        value={form.conditions.taskStatus ?? ""}
                        onChange={(e) => setCondition("taskStatus", e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Cualquiera</option>
                        {TASK_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Categoría (opcional)</label>
                      <select
                        value={form.conditions.taskCategory ?? ""}
                        onChange={(e) => setCondition("taskCategory", e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Cualquiera</option>
                        {TASK_CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <hr />

          {/* Action */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Acción — ¿qué hace?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ACTION_LABELS) as WorkflowAction[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setField("action", a)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                    form.action === a
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  {ACTION_LABELS[a]}
                </button>
              ))}
            </div>
          </div>

          {/* Action config */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Configuración de la acción
            </label>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {(form.action === "SEND_EMAIL_CONTACT" || form.action === "SEND_EMAIL_TEAM") && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Asunto</label>
                    <input
                      type="text"
                      value={form.actionConfig.subject ?? ""}
                      onChange={(e) => setActionConfig("subject", e.target.value)}
                      placeholder="Ej: Actualización de su expediente {{case.ref}}"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cuerpo del mensaje</label>
                    <textarea
                      rows={4}
                      value={form.actionConfig.body ?? ""}
                      onChange={(e) => setActionConfig("body", e.target.value)}
                      placeholder={`Estimado/a {{contact.fullName}},\n\nLe comunicamos que el estado de su expediente ha sido actualizado.\n\nAtentamente,\n{{org.name}}`}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{VARIABLE_HINTS}</p>
                  </div>
                </>
              )}

              {form.action === "ADD_CASE_COMMENT" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Texto del comentario</label>
                  <input
                    type="text"
                    value={form.actionConfig.comment ?? ""}
                    onChange={(e) => setActionConfig("comment", e.target.value)}
                    placeholder="Ej: Documentación enviada a {{contact.fullName}}"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-xs text-gray-400 mt-1">{VARIABLE_HINTS}</p>
                </div>
              )}

              {form.action === "CHANGE_CASE_STATUS" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nuevo estado</label>
                  <select
                    value={form.actionConfig.newStatus ?? ""}
                    onChange={(e) => setActionConfig("newStatus", e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Seleccionar...</option>
                    {CASE_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <hr />

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setField("isActive", !form.isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.isActive ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  form.isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">
              {form.isActive ? "Regla activa" : "Regla inactiva"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 flex-shrink-0 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Guardando..." : rule ? "Guardar cambios" : "Crear regla"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule Card ───────────────────────────────────────────

function RuleCard({
  rule,
  canManage,
  sampleCaseId,
  onEdit,
  onDelete,
  onToggle,
  onRefresh,
}: {
  rule: WorkflowRule;
  canManage: boolean;
  sampleCaseId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleTest() {
    if (!sampleCaseId) {
      setTestMsg("No hay expedientes de prueba disponibles");
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch(`/api/workflow-rules/${rule.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: sampleCaseId }),
      });
      const data = await res.json();
      setTestMsg(data.message ?? (res.ok ? "Ejecutado" : data.error));
      if (res.ok) onRefresh();
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar la regla "${rule.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/workflow-rules/${rule.id}`, { method: "DELETE" });
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const lastLog = rule.logs[0];
  const successCount = useMemo(() => rule.logs.filter((l) => l.status === "SUCCESS").length, [rule.logs]);

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${!rule.isActive ? "opacity-70" : ""}`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">{rule.name}</h3>
              {!rule.isActive && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactiva</span>
              )}
            </div>
            {rule.description && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">{rule.description}</p>
            )}
          </div>
          {canManage && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onToggle}
                title={rule.isActive ? "Desactivar" : "Activar"}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  rule.isActive ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    rule.isActive ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
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

        {/* Trigger → Action pills */}
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
          <span className={`px-2.5 py-1 rounded-full font-medium ${TRIGGER_COLORS[rule.trigger]}`}>
            {TRIGGER_LABELS[rule.trigger]}
          </span>
          {Object.keys(rule.conditions).some((k) => rule.conditions[k]) && (
            <span className="text-gray-400">
              si {conditionSummary(rule.trigger, rule.conditions)}
            </span>
          )}
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={`px-2.5 py-1 rounded-full font-medium ${ACTION_COLORS[rule.action]}`}>
            {ACTION_LABELS[rule.action]}
          </span>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span>{rule.execCount} ejecución{rule.execCount !== 1 ? "es" : ""}</span>
          {rule.lastRunAt && (
            <span>
              Última: {new Date(rule.lastRunAt).toLocaleDateString("es-ES", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          )}
          {lastLog && (
            <span className={`px-2 py-0.5 rounded-full ${LOG_STATUS_STYLES[lastLog.status]}`}>
              {lastLog.status === "SUCCESS" ? "OK" : lastLog.status === "FAILED" ? "Error" : "Omitida"}
            </span>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="px-5 pb-4 flex items-center gap-2">
        {canManage && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            {testing ? "Probando..." : "Probar ahora"}
          </button>
        )}
        {rule.logs.length > 0 && (
          <button
            onClick={() => setLogsOpen((v) => !v)}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            {logsOpen ? "Ocultar historial" : `Ver historial (${rule.logs.length})`}
          </button>
        )}
        {testMsg && (
          <span className="text-xs text-gray-500 ml-1">{testMsg}</span>
        )}
      </div>

      {/* Logs accordion */}
      {logsOpen && (
        <div className="border-t bg-gray-50 px-5 py-3 space-y-1.5">
          <p className="text-xs font-medium text-gray-500 mb-2">Historial reciente ({successCount} OK de {rule.logs.length})</p>
          {rule.logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${LOG_STATUS_STYLES[log.status]}`}>
                {log.status === "SUCCESS" ? "OK" : log.status === "FAILED" ? "Error" : "Omitida"}
              </span>
              <span className="text-gray-500 flex-shrink-0">
                {new Date(log.createdAt).toLocaleDateString("es-ES", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
              {log.error && <span className="text-red-600 truncate">{log.error}</span>}
              {log.caseId && !log.error && (
                <a
                  href={`/cases/${log.caseId}`}
                  className="text-primary hover:underline"
                >
                  Ver expediente
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────

export function WorkflowRulesClient({
  canManage,
  sampleCaseId,
}: {
  canManage: boolean;
  sampleCaseId: string | null;
}) {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch("/api/workflow-rules", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRules(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [refreshKey]);

  async function handleToggle(rule: WorkflowRule) {
    await fetch(`/api/workflow-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    refresh();
  }

  function openCreate() {
    setEditingRule(null);
    setModalOpen(true);
  }

  function openEdit(rule: WorkflowRule) {
    setEditingRule(rule);
    setModalOpen(true);
  }

  const activeCount = useMemo(() => rules.filter((r) => r.isActive).length, [rules]);
  const totalExecs = useMemo(() => rules.reduce((s, r) => s + r.execCount, 0), [rules]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automatizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Reglas que se ejecutan automáticamente cuando ocurren eventos en tus expedientes
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
            Nueva regla
          </button>
        )}
      </div>

      {/* Stats */}
      {rules.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{rules.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Reglas totales</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Activas</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-primary">{totalExecs}</div>
            <div className="text-xs text-gray-500 mt-0.5">Ejecuciones totales</div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">Sin automatizaciones</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
            Crea tu primera regla para automatizar acciones como enviar emails o añadir comentarios cuando cambia el estado de un expediente.
          </p>
          {canManage && (
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90"
            >
              Crear primera regla
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              canManage={canManage}
              sampleCaseId={sampleCaseId}
              onEdit={() => openEdit(rule)}
              onDelete={refresh}
              onToggle={() => handleToggle(rule)}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      {/* Example rules hint */}
      {!loading && rules.length === 0 && !canManage && (
        <p className="text-center text-sm text-gray-400 mt-4">
          Contacta con un administrador para crear reglas de automatización.
        </p>
      )}

      {/* Modal */}
      {modalOpen && (
        <RuleModal
          rule={editingRule}
          onClose={() => setModalOpen(false)}
          onSave={refresh}
        />
      )}
    </div>
  );
}
