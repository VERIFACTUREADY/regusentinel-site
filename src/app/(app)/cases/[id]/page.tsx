"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { generateBankPack } from "@/lib/bank-pack";
import { CASE_STATUS_COLORS, TASK_STATUS_COLORS } from "@/lib/constants";
const statuses = ["INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS", "READY_TO_SEND", "SENT", "FOLLOW_UP", "CLOSED", "ARCHIVED"];
const taskStatuses = ["PENDING", "IN_PROGRESS", "BLOCKED", "READY", "APPROVED", "DONE", "SKIPPED"];

interface CaseDetail {
  id: string; ref: string; status: string; isUrgent: boolean; hasDeceasedInsurance: boolean;
  categories: string[]; province: string | null; notes: string | null;
  portalToken: string; portalEnabled: boolean;
  deceased: { fullName: string; deathDate: string | null; dni: string | null } | null;
  contact: { fullName: string; phone: string | null; email: string | null; relationship: string | null } | null;
  tasks: any[]; documents: any[]; approvals: any[]; auditLogs: any[];
  caseDeadlines: { certificatesAvailable: string; isdDeadline: string; isdExtensionRequestDeadline: string } | null;
  createdAt: string;
}

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [notesInput, setNotesInput] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  useEffect(() => { fetchCase(); fetchTemplates(); fetchMembers(); }, [caseId]);

  async function fetchCase() {
    setLoading(true);
    const res = await fetch(`/api/cases/${caseId}`);
    if (res.ok) {
      const data = await res.json();
      setCaseData(data);
      setNotesInput(data.notes || "");
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

  const tabs = ["overview", "tasks", "documents", "bankpack", "templates", "activity", "export"];
  const tabLabels: Record<string, string> = {
    overview: "Resumen", tasks: "Tareas", documents: "Documentos",
    bankpack: "Paquete banco", templates: "Plantillas", activity: "Actividad", export: "Exportar",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{caseData.ref}</h1>
          <p className="text-gray-500">{caseData.deceased?.fullName}</p>
        </div>
        <div className="flex items-center gap-3">
          {caseData.isUrgent && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Urgente</span>}
          <select value={caseData.status} onChange={(e) => updateStatus(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm">
            {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6 gap-1">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tabLabels[t]}
            {t === "tasks" && ` (${new Set(caseData.tasks.map((tk: any) => `${tk.category}::${tk.title}`)).size})`}
            {t === "documents" && ` (${caseData.documents.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
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
            <h3 className="font-semibold">Portal familia</h3>
            <p className="text-sm text-gray-600">Comparte este enlace con la familia para que suban documentos:</p>
            <div className="flex gap-2">
              <input type="text" readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${caseData.portalToken}`}
                className="flex-1 px-3 py-2 border rounded-md text-sm bg-gray-50" />
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portal/${caseData.portalToken}`)}
                className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50">Copiar</button>
            </div>
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
        </div>
      )}

      {tab === "tasks" && (
        <div>
          {caseData.tasks.length > 0 && (
            <div className="flex justify-end mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                Checklist generado por IA
              </span>
            </div>
          )}
          {(() => {
            // Deduplicate tasks by category+title (keep first occurrence)
            const seen = new Set<string>();
            const uniqueTasks = caseData.tasks.filter((t: any) => {
              const key = `${t.category}::${t.title}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
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
                  <div key={task.id} className={`bg-white p-4 rounded-lg border flex items-start justify-between ${
                    task.status === "BLOCKED" ? "border-l-4 border-l-red-400" :
                    task.status === "READY" ? "border-l-4 border-l-yellow-400" :
                    task.status === "DONE" ? "border-l-4 border-l-green-400" : ""
                  }`}>
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
                      {/* Deadline and blocked info */}
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
              <button
                onClick={generateChecklist}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Generar checklist con IA
              </button>
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

      {tab === "activity" && (
        <div className="space-y-0">
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
            {caseData.auditLogs.map((log: any, i: number) => {
              const isCreate = log.action.includes("created");
              const isStatus = log.action.includes("status");
              const isTask = log.action.includes("task");
              const isDelete = log.action.includes("delete");
              const isAssign = log.action.includes("assign");
              const iconColor = isCreate ? "bg-green-500" : isDelete ? "bg-red-500" : isStatus ? "bg-blue-500" : isTask ? "bg-purple-500" : isAssign ? "bg-cyan-500" : "bg-gray-400";
              const now = Date.now();
              const logTime = new Date(log.createdAt).getTime();
              const diffMin = Math.floor((now - logTime) / 60000);
              const relativeTime = diffMin < 1 ? "ahora" : diffMin < 60 ? `hace ${diffMin}m` : diffMin < 1440 ? `hace ${Math.floor(diffMin / 60)}h` : new Date(log.createdAt).toLocaleString("es-ES");

              return (
                <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className={`relative z-10 w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ml-[14px] ${iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm">
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
          </div>
        </div>
      )}
    </div>
  );
}
