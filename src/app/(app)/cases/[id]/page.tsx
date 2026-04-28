"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { generateBankPack } from "@/lib/bank-pack";
import { CASE_STATUS_COLORS, TASK_STATUS_COLORS } from "@/lib/constants";
const statuses = ["INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS", "READY_TO_SEND", "SENT", "FOLLOW_UP", "CLOSED", "ARCHIVED"];
const taskStatuses = ["PENDING", "IN_PROGRESS", "BLOCKED", "READY", "APPROVED", "DONE", "SKIPPED"];

interface CaseDetail {
  id: string; ref: string; status: string; isUrgent: boolean; hasDeceasedInsurance: boolean;
  categories: string[]; province: string | null; notes: string | null;
  portalToken: string; portalEnabled: boolean;
  consentAccepted: boolean; consentDate: string | null; legitimationNote: string | null;
  deceased: { fullName: string; deathDate: string | null; dni: string | null } | null;
  contact: { fullName: string; phone: string | null; email: string | null; relationship: string | null } | null;
  tasks: any[]; documents: any[]; approvals: any[]; auditLogs: any[];
  caseDeadlines: { certificatesAvailable: string; isdDeadline: string; isdExtensionRequestDeadline: string } | null;
  createdAt: string;
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [caseTemplates, setCaseTemplates] = useState<any[]>([]);
  const [applyTplOpen, setApplyTplOpen] = useState(false);
  const [selectedCaseTpl, setSelectedCaseTpl] = useState("");
  const [applyTplLoading, setApplyTplLoading] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [portalMessages, setPortalMessages] = useState<any[]>([]);
  const [portalReply, setPortalReply] = useState("");
  const [portalReplySending, setPortalReplySending] = useState(false);
  const [portalUnread, setPortalUnread] = useState(0);
  const [notesInput, setNotesInput] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [legitimationInput, setLegitimationInput] = useState("");
  const [legitimationSaving, setLegitimationSaving] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [taskNoteOpenId, setTaskNoteOpenId] = useState<string | null>(null);
  const [taskNotesCache, setTaskNotesCache] = useState<Record<string, { id: string; content: string; createdAt: string; user: { name: string | null; email: string } }[]>>({});
  const [taskNotesLoading, setTaskNotesLoading] = useState(false);
  const [taskNoteInput, setTaskNoteInput] = useState("");
  const [taskNoteSaving, setTaskNoteSaving] = useState(false);

  const uniqueTasks = useMemo(() => {
    if (!caseData) return [];
    const seen = new Set<string>();
    return caseData.tasks.filter((t: any) => {
      const key = `${t.category}::${t.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [caseData]);

  const taskStats = useMemo(() => {
    const total = uniqueTasks.length;
    const done = uniqueTasks.filter((t: any) => t.status === "DONE" || t.status === "SKIPPED").length;
    const blocked = uniqueTasks.filter((t: any) => t.status === "BLOCKED").length;
    const inProgress = uniqueTasks.filter((t: any) => t.status === "IN_PROGRESS").length;
    const overdue = uniqueTasks.filter((t: any) =>
      t.deadline && t.status !== "DONE" && t.status !== "SKIPPED" && new Date(t.deadline) < new Date()
    ).length;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, blocked, inProgress, overdue, progressPct };
  }, [uniqueTasks]);

  const handleDuplicate = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/duplicate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      router.push(`/cases/${data.id}`);
    } else {
      const err = await res.json().catch(() => null);
      alert(err?.error || "Error al duplicar");
    }
  }, [caseId, router]);

  useEffect(() => { fetchCase(); fetchTemplates(); fetchMembers(); fetchCaseTemplates(); fetchPortalMessages(); }, [caseId]);

  async function fetchCase() {
    setLoading(true);
    const res = await fetch(`/api/cases/${caseId}`);
    if (res.ok) {
      const data = await res.json();
      setCaseData(data);
      setNotesInput(data.notes || "");
      setLegitimationInput(data.legitimationNote || "");
    }
    setLoading(false);
  }
  async function fetchTemplates() {
    const res = await fetch("/api/templates");
    if (res.ok) setTemplates(await res.json());
  }
  async function fetchMembers() {
    const res = await fetch("/api/org/members");
    if (res.ok) setMembers(await res.json());
  }

  async function fetchCaseTemplates() {
    const res = await fetch("/api/case-templates");
    if (res.ok) setCaseTemplates(await res.json());
  }

  async function fetchPortalMessages() {
    const res = await fetch(`/api/cases/${caseId}/portal-messages`);
    if (res.ok) {
      const data = await res.json();
      setPortalMessages(data);
      setPortalUnread(data.filter((m: any) => m.fromFamily && !m.readAt).length);
    }
  }

  async function sendPortalReply() {
    if (!portalReply.trim()) return;
    setPortalReplySending(true);
    const res = await fetch(`/api/cases/${caseId}/portal-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: portalReply.trim() }),
    });
    setPortalReplySending(false);
    if (res.ok) {
      setPortalReply("");
      fetchPortalMessages();
    } else {
      const err = await res.json().catch(() => null);
      alert(err?.error || "Error al enviar mensaje");
    }
  }

  async function applyTemplate() {
    if (!selectedCaseTpl) return;
    setApplyTplLoading(true);
    const res = await fetch(`/api/cases/${caseId}/apply-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: selectedCaseTpl }),
    });
    setApplyTplLoading(false);
    if (res.ok) {
      const data = await res.json();
      setApplyTplOpen(false);
      setSelectedCaseTpl("");
      fetchCase();
      alert(`Plantilla aplicada: ${data.added} tarea(s) añadida(s)`);
    } else {
      const err = await res.json().catch(() => null);
      alert(err?.error || "Error al aplicar plantilla");
    }
  }

  async function updateStatus(status: string) {
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchCase();
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await fetch(`/api/cases/${caseId}/tasks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
    });
    fetchCase();
  }

  async function assignTask(taskId: string, assigneeId: string | null) {
    await fetch(`/api/cases/${caseId}/tasks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, assigneeId }),
    });
    fetchCase();
  }

  async function saveNotes() {
    setNotesSaving(true);
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesInput }),
    });
    setNotesSaving(false);
  }

  async function saveLegitimation() {
    setLegitimationSaving(true);
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legitimationNote: legitimationInput }),
    });
    setLegitimationSaving(false);
    fetchCase();
  }

  async function toggleConsent() {
    const newValue = !caseData?.consentAccepted;
    await fetch(`/api/cases/${caseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentAccepted: newValue }),
    });
    fetchCase();
  }

  async function postComment() {
    if (!commentInput.trim()) return;
    setCommentSaving(true);
    const res = await fetch(`/api/cases/${caseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentInput.trim() }),
    });
    if (res.ok) {
      setCommentInput("");
      fetchCase();
    }
    setCommentSaving(false);
  }

  async function toggleTaskNotes(taskId: string) {
    if (taskNoteOpenId === taskId) { setTaskNoteOpenId(null); return; }
    setTaskNoteOpenId(taskId);
    if (!taskNotesCache[taskId]) {
      setTaskNotesLoading(true);
      const res = await fetch(`/api/tasks/${taskId}/notes`);
      const data = res.ok ? await res.json() : [];
      setTaskNotesCache((c) => ({ ...c, [taskId]: data }));
      setTaskNotesLoading(false);
    }
  }

  async function saveTaskNote(taskId: string) {
    if (!taskNoteInput.trim()) return;
    setTaskNoteSaving(true);
    const res = await fetch(`/api/tasks/${taskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: taskNoteInput.trim() }),
    });
    if (res.ok) {
      const note = await res.json();
      setTaskNotesCache((c) => ({ ...c, [taskId]: [...(c[taskId] ?? []), note] }));
      setTaskNoteInput("");
      fetchCase();
    }
    setTaskNoteSaving(false);
  }

  async function generateChecklist() {
    const res = await fetch("/api/autopilot/checklist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId }),
    });
    if (res.ok) fetchCase();
    else alert("Error generando checklist");
  }

  async function generateDraft(templateId: string) {
    const res = await fetch("/api/autopilot/draft", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, templateId }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Borrador generado (requiere aprobacion):\n\n${data.draft.substring(0, 500)}...`);
      fetchCase();
    }
  }

  const [uploadHint, setUploadHint] = useState<{ fileName: string; suggestions: string[] } | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      if (!data.taskId && data.suggestions) {
        setUploadHint({ fileName: file.name, suggestions: data.suggestions });
      } else {
        setUploadHint(null);
      }
    }
    fetchCase();
    e.target.value = "";
  }

  async function handleApproval(approvalId: string, status: string) {
    await fetch(`/api/approvals/${approvalId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchCase();
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  if (!caseData) return <div className="text-center py-12 text-gray-400">Expediente no encontrado</div>;

  const tabs = ["overview", "tasks", "documents", "bankpack", "templates", "portal", "activity", "export"];
  const tabLabels: Record<string, string> = {
    overview: "Resumen", tasks: "Tareas", documents: "Documentos",
    bankpack: "Paquete banco", templates: "Plantillas", portal: "Portal", activity: "Actividad", export: "Exportar",
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{caseData.ref}</h1>
            <p className="text-gray-500">{caseData.deceased?.fullName}</p>
          </div>
          <div className="flex items-center gap-3">
            {caseData.isUrgent && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Urgente</span>}
            <button
              onClick={handleDuplicate}
              className="px-3 py-1 border rounded-md text-sm text-gray-600 hover:bg-gray-50"
              title="Duplicar expediente"
            >
              Duplicar
            </button>
            <select value={caseData.status} onChange={(e) => updateStatus(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm">
              {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>
        {taskStats.total > 0 && (
          <div className="mt-3 flex items-center gap-4">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${taskStats.progressPct === 100 ? "bg-green-500" : "bg-primary"}`}
                style={{ width: `${taskStats.progressPct}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
              <span className="font-medium text-gray-900">{taskStats.progressPct}%</span>
              <span>{taskStats.done}/{taskStats.total} tareas</span>
              {taskStats.inProgress > 0 && <span className="text-blue-600">{taskStats.inProgress} en curso</span>}
              {taskStats.blocked > 0 && <span className="text-red-600">{taskStats.blocked} bloqueadas</span>}
              {taskStats.overdue > 0 && <span className="text-red-700 font-medium">{taskStats.overdue} vencidas</span>}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6 gap-1">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tabLabels[t]}
            {t === "tasks" && ` (${uniqueTasks.length})`}
            {t === "documents" && ` (${caseData.documents.length})`}
            {t === "portal" && portalUnread > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs bg-red-500 text-white rounded-full">{portalUnread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Stats cards */}
          {(() => {
            const daysSinceDeath = caseData.deceased?.deathDate
              ? Math.floor((Date.now() - new Date(caseData.deceased.deathDate).getTime()) / (1000 * 60 * 60 * 24))
              : null;
            const linkedDocs = caseData.documents.filter((d: any) => d.task).length;
            const nextDeadline = caseData.caseDeadlines
              ? [caseData.caseDeadlines.certificatesAvailable, caseData.caseDeadlines.isdExtensionRequestDeadline, caseData.caseDeadlines.isdDeadline]
                  .map((d) => new Date(d))
                  .filter((d) => d.getTime() > Date.now())
                  .sort((a, b) => a.getTime() - b.getTime())[0]
              : null;
            const daysToNextDeadline = nextDeadline ? Math.ceil((nextDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

            return (
              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border text-center">
                  <p className="text-2xl font-bold text-gray-900">{taskStats.total > 0 ? `${taskStats.done}/${taskStats.total}` : "—"}</p>
                  <p className="text-xs text-gray-500 mt-1">Tareas completadas</p>
                  {taskStats.total > 0 && (
                    <div className="mt-2 bg-gray-200 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${taskStats.done === taskStats.total ? "bg-green-500" : "bg-primary"}`} style={{ width: `${taskStats.progressPct}%` }} />
                    </div>
                  )}
                </div>
                <div className="bg-white p-4 rounded-lg border text-center">
                  <p className="text-2xl font-bold text-gray-900">{caseData.documents.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Documentos</p>
                  {caseData.documents.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">{linkedDocs} vinculados</p>
                  )}
                </div>
                <div className="bg-white p-4 rounded-lg border text-center">
                  <p className={`text-2xl font-bold ${daysSinceDeath !== null && daysSinceDeath > 150 ? "text-red-600" : "text-gray-900"}`}>
                    {daysSinceDeath !== null ? daysSinceDeath : "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Dias desde fallecimiento</p>
                  {daysSinceDeath !== null && daysSinceDeath > 150 && (
                    <p className="text-xs text-red-500 mt-1">Plazo ISD proximo</p>
                  )}
                </div>
                <div className="bg-white p-4 rounded-lg border text-center">
                  {daysToNextDeadline !== null ? (
                    <>
                      <p className={`text-2xl font-bold ${daysToNextDeadline <= 14 ? "text-red-600" : daysToNextDeadline <= 30 ? "text-orange-600" : "text-gray-900"}`}>
                        {daysToNextDeadline}d
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Proximo plazo</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-green-600">OK</p>
                      <p className="text-xs text-gray-500 mt-1">Sin plazos urgentes</p>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="bg-white p-6 rounded-lg border space-y-3">
            <h3 className="font-semibold">Fallecido</h3>
            <p><strong>Nombre:</strong> {caseData.deceased?.fullName}</p>
            {caseData.deceased?.deathDate && <p><strong>Fecha:</strong> {new Date(caseData.deceased.deathDate).toLocaleDateString("es-ES")}</p>}
            {caseData.deceased?.dni && <p><strong>DNI:</strong> {caseData.deceased.dni}</p>}
          </div>
          <div className="bg-white p-6 rounded-lg border space-y-3">
            <h3 className="font-semibold">Solicitante</h3>
            <p><strong>Nombre:</strong> {caseData.contact?.fullName}</p>
            {caseData.contact?.phone && <p><strong>Telefono:</strong> {caseData.contact.phone}</p>}
            {caseData.contact?.email && <p><strong>Email:</strong> {caseData.contact.email}</p>}
            {caseData.contact?.relationship && <p><strong>Relacion:</strong> {caseData.contact.relationship}</p>}
          </div>
          <div className="bg-white p-6 rounded-lg border space-y-3">
            <h3 className="font-semibold">Detalles</h3>
            <p><strong>Provincia:</strong> {caseData.province || "No especificada"}</p>
            <p><strong>Categorias:</strong> {caseData.categories.join(", ")}</p>
            <p><strong>Seguro decesos:</strong> {caseData.hasDeceasedInsurance ? "Si" : "No"}</p>
            <p><strong>Creado:</strong> {new Date(caseData.createdAt).toLocaleDateString("es-ES")}</p>
          </div>
          <div className="bg-white p-6 rounded-lg border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Portal familia</h3>
              {portalUnread > 0 && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">{portalUnread} mensaje{portalUnread !== 1 ? "s" : ""} nuevo{portalUnread !== 1 ? "s" : ""}</span>
              )}
            </div>
            <div className="flex gap-2">
              <input type="text" readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${caseData.portalToken}`}
                className="flex-1 px-3 py-2 border rounded-md text-sm bg-gray-50" />
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portal/${caseData.portalToken}`)}
                className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50">Copiar</button>
            </div>
            <button onClick={() => setTab("portal")} className="text-sm text-primary hover:underline">
              {portalUnread > 0 ? `Ver mensajes (${portalUnread} nuevo${portalUnread !== 1 ? "s" : ""}) →` : "Ver portal y mensajes →"}
            </button>
          </div>

          {/* Case-level deadlines */}
          {caseData.caseDeadlines && (
            <div className="md:col-span-2 bg-white p-6 rounded-lg border">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Plazos legales clave
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Certificados disponibles", date: caseData.caseDeadlines.certificatesAvailable, desc: "Ultimas voluntades + seguros (15 dias habiles)" },
                  { label: "Solicitud prorroga ISD", date: caseData.caseDeadlines.isdExtensionRequestDeadline, desc: "Limite para solicitar prorroga del Modelo 650" },
                  { label: "Plazo ISD (Modelo 650)", date: caseData.caseDeadlines.isdDeadline, desc: "6 meses desde fallecimiento" },
                ].map((d) => {
                  const days = Math.ceil((new Date(d.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const expired = days <= 0;
                  const urgent = days > 0 && days <= 14;
                  return (
                    <div key={d.label} className={`p-3 rounded-lg border ${expired ? "bg-red-50 border-red-200" : urgent ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}`}>
                      <p className="text-xs text-gray-500">{d.label}</p>
                      <p className={`text-lg font-bold ${expired ? "text-red-600" : urgent ? "text-orange-600" : "text-gray-900"}`}>
                        {new Date(d.date).toLocaleDateString("es-ES")}
                      </p>
                      <p className={`text-xs mt-1 ${expired ? "text-red-500 font-medium" : urgent ? "text-orange-500" : "text-gray-400"}`}>
                        {expired ? "VENCIDO" : `${days} dias restantes`}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{d.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-3">Notas internas</h3>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              rows={4}
              placeholder="Anota observaciones, instrucciones internas o recordatorios sobre este expediente..."
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={saveNotes}
                disabled={notesSaving || notesInput === (caseData?.notes || "")}
                className="px-4 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {notesSaving ? "Guardando..." : "Guardar notas"}
              </button>
              {notesInput !== (caseData?.notes || "") && (
                <span className="text-xs text-gray-400">Sin guardar</span>
              )}
            </div>
          </div>

          {/* Pipeline visualization */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-4">Pipeline</h3>
            <div className="flex gap-1">
              {statuses.map((s) => (
                <div key={s} className={`flex-1 py-2 text-center text-xs rounded ${
                  s === caseData.status ? CASE_STATUS_COLORS[s] + " font-bold ring-2 ring-primary" : "bg-gray-50 text-gray-400"
                }`}>{s.replace(/_/g, " ")}</div>
              ))}
            </div>
          </div>

          {/* Consentimiento y legitimación */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Consentimiento y legitimacion RGPD
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Consent toggle */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Estado del consentimiento informado</p>
                <button
                  onClick={toggleConsent}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    caseData.consentAccepted
                      ? "border-green-400 bg-green-50 hover:bg-green-100"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors shrink-0 ${
                    caseData.consentAccepted ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"
                  }`}>
                    <div className="w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${caseData.consentAccepted ? "text-green-800" : "text-gray-600"}`}>
                      {caseData.consentAccepted ? "Consentimiento aceptado" : "Sin consentimiento registrado"}
                    </p>
                    {caseData.consentAccepted && caseData.consentDate && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Registrado el {new Date(caseData.consentDate).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                      </p>
                    )}
                    {!caseData.consentAccepted && (
                      <p className="text-xs text-gray-400 mt-0.5">Haz clic para marcar como aceptado</p>
                    )}
                  </div>
                </button>
                {caseData.consentAccepted && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Cumple con el art. 13 del RGPD y la LOPDGDD
                  </div>
                )}
              </div>

              {/* Legitimation note */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Nota de legitimacion y base juridica</p>
                <textarea
                  value={legitimationInput}
                  onChange={(e) => setLegitimationInput(e.target.value)}
                  rows={4}
                  placeholder="Documenta la base juridica del tratamiento: relacion contractual, interes legitimo, obligacion legal... Indica tambien la fuente de los datos si no fue directamente del interesado."
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={saveLegitimation}
                    disabled={legitimationSaving || legitimationInput === (caseData.legitimationNote || "")}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {legitimationSaving ? "Guardando..." : "Guardar nota"}
                  </button>
                  {legitimationInput !== (caseData.legitimationNote || "") && (
                    <span className="text-xs text-gray-400">Sin guardar</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div>
          {caseData.tasks.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                Checklist generado por IA
              </span>
              {caseTemplates.length > 0 && (
                <button
                  onClick={() => setApplyTplOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  Aplicar plantilla
                </button>
              )}
            </div>
          )}
          {(() => {
            return Object.entries(
              uniqueTasks.reduce((acc: Record<string, any[]>, t: any) => {
                (acc[t.category] = acc[t.category] || []).push(t);
                return acc;
              }, {})
            ).map(([cat, tasks]) => (
            <div key={cat} className="mb-6">
              <h3 className="font-semibold text-sm text-gray-500 mb-2">{cat}</h3>
              <div className="space-y-2">
                {(tasks as any[]).map((task: any) => (
                  <div key={task.id} className={`bg-white p-4 rounded-lg border ${
                    task.status === "BLOCKED" ? "border-l-4 border-l-red-400" :
                    task.status === "READY" ? "border-l-4 border-l-yellow-400" :
                    task.status === "DONE" ? "border-l-4 border-l-green-400" : ""
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{task.title}</p>
                          {task.documents && task.documents.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded" title={`${task.documents.length} doc(s) vinculado(s)`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                              {task.documents.length}
                            </span>
                          )}
                        </div>
                        {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                        {task.assignee && (
                          <p className="text-xs text-blue-600 mt-1">
                            Asignado a: {task.assignee.name || task.assignee.email}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {task.status === "BLOCKED" && task.blockReason && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              {task.blockReason}
                            </span>
                          )}
                          {task.blockedUntil && task.status === "BLOCKED" && (
                            <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded">
                              Disponible: {new Date(task.blockedUntil).toLocaleDateString("es-ES")}
                            </span>
                          )}
                          {task.deadline && task.status !== "DONE" && task.status !== "SKIPPED" && (() => {
                            const days = Math.ceil((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const expired = days <= 0;
                            const urgent = days > 0 && days <= 14;
                            return (
                              <span className={`text-xs px-2 py-0.5 rounded ${expired ? "bg-red-100 text-red-700 font-medium" : urgent ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                                {expired ? "VENCIDO" : `Plazo: ${days}d`} - {new Date(task.deadline).toLocaleDateString("es-ES")}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <button
                          onClick={() => { toggleTaskNotes(task.id); setTaskNoteInput(""); }}
                          title="Notas de gestión"
                          className={`p-1.5 rounded transition relative ${taskNoteOpenId === task.id ? "text-amber-600 bg-amber-50" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          {task._count?.notes > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 text-[9px] bg-amber-500 text-white rounded-full flex items-center justify-center font-bold">{task._count.notes > 9 ? "9+" : task._count.notes}</span>
                          )}
                        </button>
                        <select
                          value={task.assigneeId || ""}
                          onChange={(e) => assignTask(task.id, e.target.value || null)}
                          className="text-xs px-2 py-1 border rounded max-w-[120px]"
                          title="Asignar a"
                        >
                          <option value="">Sin asignar</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>{m.name || m.email}</option>
                          ))}
                        </select>
                        <select value={task.status} onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                          className="text-xs px-2 py-1 border rounded">
                          {taskStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span className={`text-xs px-2 py-1 rounded-full ${TASK_STATUS_COLORS[task.status] || ""}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                    {/* Inline task notes panel */}
                    {taskNoteOpenId === task.id && (
                      <div className="mt-3 pt-3 border-t border-amber-100">
                        {taskNotesLoading && !taskNotesCache[task.id] ? (
                          <p className="text-xs text-gray-400 py-2">Cargando notas...</p>
                        ) : (
                          <>
                            {(taskNotesCache[task.id] ?? []).length === 0 ? (
                              <p className="text-xs text-gray-400 mb-2">Sin notas aún. Anota llamadas, respuestas, documentos pendientes...</p>
                            ) : (
                              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                                {(taskNotesCache[task.id] ?? []).map((note) => (
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
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={taskNoteInput}
                                onChange={(e) => setTaskNoteInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTaskNote(task.id); } }}
                                placeholder="Escribe una nota y pulsa Enter..."
                                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                              <button
                                onClick={() => saveTaskNote(task.id)}
                                disabled={taskNoteSaving || !taskNoteInput.trim()}
                                className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                              >
                                Guardar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ));
          })()}
          {caseData.tasks.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-gray-400 mb-4">No hay tareas asignadas a este expediente.</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={generateChecklist}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Generar checklist con IA
                </button>
                {caseTemplates.length > 0 && (
                  <button
                    onClick={() => setApplyTplOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    Aplicar plantilla
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "documents" && (
        <div>
          <div className="mb-4 flex items-center gap-4">
            <label className="inline-block px-4 py-2 bg-primary text-white rounded-md text-sm cursor-pointer hover:bg-primary/90">
              Subir documento
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
            <p className="text-xs text-gray-500">
              Los documentos se vinculan automaticamente a tareas por nombre de archivo
            </p>
          </div>
          {uploadHint && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    No se pudo vincular &quot;{uploadHint.fileName}&quot; a ninguna tarea
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Renombra el archivo incluyendo alguna de estas palabras clave y vuelve a subirlo:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {uploadHint.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">{s}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setUploadHint(null)} className="text-xs text-amber-600 underline mt-2">Cerrar</button>
                </div>
              </div>
            </div>
          )}
          <div className="bg-white rounded-lg border divide-y">
            {caseData.documents.map((doc: any) => (
              <div key={doc.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-400">
                      {new Date(doc.createdAt).toLocaleString("es-ES")}
                      {doc.isPortalUpload && " (portal familia)"}
                    </p>
                    {doc.task && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
                        {doc.task.title}
                      </span>
                    )}
                    {!doc.task && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                        Sin vincular
                      </span>
                    )}
                  </div>
                </div>
                {doc.downloadUrl && (
                  <a href={doc.downloadUrl} target="_blank" rel="noreferrer"
                    className="text-sm text-primary hover:underline">Descargar</a>
                )}
              </div>
            ))}
            {caseData.documents.length === 0 && (
              <p className="px-6 py-8 text-center text-gray-400">No hay documentos</p>
            )}
          </div>
        </div>
      )}

      {tab === "bankpack" && (() => {
        // Build set of available docTags from linked documents and DONE tasks
        const availableTags = new Set<string>();
        caseData.documents.forEach((d: any) => {
          if (d.task?.category) {
            const linkedTask = caseData.tasks.find((t: any) => t.id === d.task.id);
            if (linkedTask?.docTag) availableTags.add(linkedTask.docTag);
          }
        });
        caseData.tasks.forEach((t: any) => {
          if (t.status === "DONE" && t.docTag) availableTags.add(t.docTag);
        });

        const { requirements: bankDocs, ready, total: totalRequired } = generateBankPack(availableTags);

        return (
          <div>
            <div className="bg-white p-6 rounded-lg border mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Paquete documental para banco</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Checklist estandar para procesar la sucesion en entidades bancarias espanolas
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{ready}/{totalRequired}</p>
                  <p className="text-xs text-gray-500">documentos listos</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <a
                  href={`/api/cases/${caseData.id}/bank-pack?format=pdf`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90"
                >
                  Descargar PDF unificado
                </a>
                <a
                  href={`/api/cases/${caseData.id}/bank-pack?format=zip`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 text-sm rounded-md hover:bg-gray-50"
                >
                  Descargar ZIP (con originales)
                </a>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${totalRequired > 0 ? (ready / totalRequired) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="bg-white rounded-lg border divide-y">
              {bankDocs.map((doc, i) => {
                const isReady = doc.docTags.length > 0 && doc.docTags.some((t) => availableTags.has(t));
                return (
                  <div key={i} className="px-6 py-4 flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      isReady ? "bg-green-500 text-white" : doc.required ? "bg-gray-200 text-gray-400" : "bg-gray-100 text-gray-300"
                    }`}>
                      {isReady ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <span className="text-xs">{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{doc.name}</p>
                        {doc.required && <span className="text-xs text-red-600">*</span>}
                        {!doc.required && <span className="text-xs text-gray-400">(opcional)</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                      isReady ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {isReady ? "Listo" : "Pendiente"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              * Documentos obligatorios segun BdE y normativa sucesoria. Algunos bancos pueden solicitar documentacion adicional especifica.
            </p>
          </div>
        );
      })()}

      {tab === "templates" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            El autopiloto prepara acciones; el envio/ejecucion requiere aprobacion profesional.
          </p>
          {templates.map((tpl: any) => (
            <div key={tpl.id} className="bg-white p-4 rounded-lg border flex items-center justify-between">
              <div>
                <p className="font-medium">{tpl.name}</p>
                <p className="text-xs text-gray-400">{tpl.type} {tpl.category ? `- ${tpl.category}` : ""}</p>
              </div>
              <button onClick={() => generateDraft(tpl.id)}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200">
                Generar borrador
              </button>
            </div>
          ))}
          {/* Pending approvals */}
          {caseData.approvals.filter((a: any) => a.status === "PENDING").length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Aprobaciones pendientes</h3>
              {caseData.approvals.filter((a: any) => a.status === "PENDING").map((a: any) => (
                <div key={a.id} className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-2">
                  <p className="text-sm font-medium">{a.action}</p>
                  {a.details && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.details.substring(0, 300)}...</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleApproval(a.id, "APPROVED")}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm">Aprobar</button>
                    <button onClick={() => handleApproval(a.id, "REJECTED")}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm">Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "portal" && (
        <div className="space-y-6">
          {/* Portal link */}
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-3">Portal de la familia</h3>
            <p className="text-sm text-gray-500 mb-3">
              Comparte este enlace con la familia. Pueden ver el estado, subir documentos y enviarte mensajes.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/portal/${caseData.portalToken}`}
                className="flex-1 px-3 py-2 border rounded-md text-sm bg-gray-50"
              />
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portal/${caseData.portalToken}`)}
                className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
              >
                Copiar
              </button>
              <a
                href={`/portal/${caseData.portalToken}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50 inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                Ver
              </a>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-white rounded-lg border">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Mensajes con la familia</h3>
              {portalUnread > 0 && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                  {portalUnread} sin leer
                </span>
              )}
            </div>

            <div className="divide-y max-h-[28rem] overflow-y-auto">
              {portalMessages.length === 0 ? (
                <p className="px-6 py-10 text-center text-gray-400">
                  Sin mensajes aún. La familia puede escribirte desde el portal.
                </p>
              ) : (
                portalMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex p-4 ${msg.fromFamily ? "bg-blue-50/40" : ""}`}
                  >
                    <div className={`flex-1 ${msg.fromFamily ? "" : "pl-8"}`}>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`text-xs font-semibold ${msg.fromFamily ? "text-blue-700" : "text-gray-700"}`}>
                          {msg.fromFamily ? (msg.authorName || "Familia") : "Tú (gestoría)"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.fromFamily && !msg.readAt && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">Nuevo</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t space-y-2">
              <textarea
                value={portalReply}
                onChange={(e) => setPortalReply(e.target.value)}
                rows={3}
                placeholder="Escribe un mensaje a la familia..."
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendPortalReply(); }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Cmd+Enter para enviar</span>
                <button
                  onClick={sendPortalReply}
                  disabled={portalReplySending || !portalReply.trim()}
                  className="px-4 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {portalReplySending ? "Enviando..." : "Enviar a familia"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div>
          {/* Comment input */}
          <div className="bg-white rounded-lg border p-4 mb-6">
            <textarea
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              rows={2}
              placeholder="Escribe un comentario interno..."
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment(); }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">Cmd+Enter para enviar</span>
              <button
                onClick={postComment}
                disabled={commentSaving || !commentInput.trim()}
                className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {commentSaving ? "Enviando..." : "Comentar"}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
            {caseData.auditLogs.map((log: any) => {
              const isComment = log.action === "case.comment";
              const isCreate = log.action.includes("created");
              const isStatus = log.action.includes("status");
              const isTask = log.action.includes("task");
              const isDelete = log.action.includes("delete");
              const isAssign = log.action.includes("assign");
              const iconColor = isComment ? "bg-primary" : isCreate ? "bg-green-500" : isDelete ? "bg-red-500" : isStatus ? "bg-blue-500" : isTask ? "bg-purple-500" : isAssign ? "bg-cyan-500" : "bg-gray-400";
              const now = Date.now();
              const logTime = new Date(log.createdAt).getTime();
              const diffMin = Math.floor((now - logTime) / 60000);
              const relativeTime = diffMin < 1 ? "ahora" : diffMin < 60 ? `hace ${diffMin}m` : diffMin < 1440 ? `hace ${Math.floor(diffMin / 60)}h` : new Date(log.createdAt).toLocaleString("es-ES");
              const userName = log.user?.name || log.user?.email || "Sistema";

              if (isComment) {
                return (
                  <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                    <div className={`relative z-10 w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ml-[14px] ${iconColor}`} />
                    <div className="flex-1 min-w-0 bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">{userName}</span>
                        <span className="text-xs text-gray-400 shrink-0">{relativeTime}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{log.details}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className={`relative z-10 w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ml-[14px] ${iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm">
                        <span className="text-gray-500">{userName}</span>
                        <span className="mx-1.5 text-gray-300">·</span>
                        <span className="font-medium text-gray-900">{log.action.replace(/\./g, " · ")}</span>
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">{relativeTime}</span>
                    </div>
                    {log.details && (
                      <p className="text-sm text-gray-500 mt-0.5">{log.details}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {caseData.auditLogs.length === 0 && (
            <p className="px-6 py-8 text-center text-gray-400">Sin actividad registrada</p>
          )}
        </div>
      )}

      {tab === "export" && (
        <div className="bg-white p-6 rounded-lg border space-y-4">
          <h3 className="font-semibold">Exportar dossier</h3>
          <p className="text-sm text-gray-500">Descarga un resumen completo del expediente con toda la documentacion.</p>
          <div className="flex gap-4">
            <a href={`/api/cases/${caseId}/export`} target="_blank" rel="noreferrer"
              className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90">
              Descargar dossier PDF
            </a>
            <a href={`/cases/${caseId}/print`} target="_blank" rel="noreferrer"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50">
              Vista para imprimir
            </a>
          </div>
        </div>
      )}

      {/* Apply Template Modal */}
      {applyTplOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Aplicar plantilla de tareas</h2>
              <button onClick={() => { setApplyTplOpen(false); setSelectedCaseTpl(""); }}
                className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-500 mb-4">Las tareas ya existentes en el expediente no se duplicarán.</p>
              {caseTemplates.map((tpl: any) => (
                <label key={tpl.id} className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedCaseTpl === tpl.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}>
                  <input
                    type="radio"
                    name="caseTemplate"
                    value={tpl.id}
                    checked={selectedCaseTpl === tpl.id}
                    onChange={() => setSelectedCaseTpl(tpl.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{tpl.name}</span>
                      {tpl.isDefault && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Por defecto</span>
                      )}
                      <span className="text-xs text-gray-400">{tpl.tasks?.length ?? 0} tareas</span>
                    </div>
                    {tpl.description && <p className="text-sm text-gray-500 mt-0.5">{tpl.description}</p>}
                    {tpl.categories?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {tpl.categories.map((c: string) => (
                          <span key={c} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => { setApplyTplOpen(false); setSelectedCaseTpl(""); }}
                className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={applyTemplate}
                disabled={!selectedCaseTpl || applyTplLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {applyTplLoading ? "Aplicando..." : "Aplicar plantilla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
