"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const statusColors: Record<string, string> = {
  INTAKE: "bg-gray-100 text-gray-700", VALIDATION: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700", PENDING_DOCS: "bg-orange-100 text-orange-700",
  READY_TO_SEND: "bg-purple-100 text-purple-700", SENT: "bg-indigo-100 text-indigo-700",
  FOLLOW_UP: "bg-cyan-100 text-cyan-700", CLOSED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};
const taskStatusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700", IN_PROGRESS: "bg-blue-100 text-blue-700",
  BLOCKED: "bg-red-100 text-red-700", READY: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700", DONE: "bg-green-200 text-green-800",
  SKIPPED: "bg-gray-100 text-gray-400",
};
const statuses = ["INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS", "READY_TO_SEND", "SENT", "FOLLOW_UP", "CLOSED", "ARCHIVED"];
const taskStatuses = ["PENDING", "IN_PROGRESS", "BLOCKED", "READY", "APPROVED", "DONE", "SKIPPED"];

interface CaseDetail {
  id: string; ref: string; status: string; isUrgent: boolean; hasDeceasedInsurance: boolean;
  categories: string[]; province: string | null; notes: string | null;
  portalToken: string; portalEnabled: boolean;
  deceased: { fullName: string; deathDate: string | null; dni: string | null } | null;
  contact: { fullName: string; phone: string | null; email: string | null; relationship: string | null } | null;
  tasks: any[]; documents: any[]; approvals: any[]; auditLogs: any[];
  createdAt: string;
}

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => { fetchCase(); fetchTemplates(); }, [caseId]);

  async function fetchCase() {
    setLoading(true);
    const res = await fetch(`/api/cases/${caseId}`);
    if (res.ok) setCaseData(await res.json());
    setLoading(false);
  }
  async function fetchTemplates() {
    const res = await fetch("/api/templates");
    if (res.ok) setTemplates(await res.json());
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: formData });
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

  const tabs = ["overview", "tasks", "documents", "templates", "activity", "export"];
  const tabLabels: Record<string, string> = {
    overview: "Resumen", tasks: "Tareas", documents: "Documentos",
    templates: "Plantillas", activity: "Actividad", export: "Exportar",
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
            {t === "tasks" && ` (${caseData.tasks.length})`}
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

          {/* Pipeline visualization */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-4">Pipeline</h3>
            <div className="flex gap-1">
              {statuses.map((s) => (
                <div key={s} className={`flex-1 py-2 text-center text-xs rounded ${
                  s === caseData.status ? statusColors[s] + " font-bold ring-2 ring-primary" : "bg-gray-50 text-gray-400"
                }`}>{s.replace(/_/g, " ")}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={generateChecklist}
              className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700">
              Generar checklist IA
            </button>
          </div>
          {Object.entries(
            caseData.tasks.reduce((acc: Record<string, any[]>, t: any) => {
              (acc[t.category] = acc[t.category] || []).push(t);
              return acc;
            }, {})
          ).map(([cat, tasks]) => (
            <div key={cat} className="mb-6">
              <h3 className="font-semibold text-sm text-gray-500 mb-2">{cat}</h3>
              <div className="space-y-2">
                {(tasks as any[]).map((task: any) => (
                  <div key={task.id} className="bg-white p-4 rounded-lg border flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{task.title}</p>
                      {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <select value={task.status} onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        className="text-xs px-2 py-1 border rounded">
                        {taskStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className={`text-xs px-2 py-1 rounded-full ${taskStatusColors[task.status] || ""}`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {caseData.tasks.length === 0 && (
            <p className="text-center text-gray-400 py-8">No hay tareas. Usa el boton para generar checklist.</p>
          )}
        </div>
      )}

      {tab === "documents" && (
        <div>
          <div className="mb-4">
            <label className="inline-block px-4 py-2 bg-primary text-white rounded-md text-sm cursor-pointer hover:bg-primary/90">
              Subir documento
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          <div className="bg-white rounded-lg border divide-y">
            {caseData.documents.map((doc: any) => (
              <div key={doc.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{doc.fileName}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(doc.createdAt).toLocaleString("es-ES")}
                    {doc.isPortalUpload && " (portal familia)"}
                  </p>
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
        <div className="bg-white rounded-lg border divide-y">
          {caseData.auditLogs.map((log: any) => (
            <div key={log.id} className="px-6 py-3 flex justify-between text-sm">
              <div>
                <span className="font-medium">{log.action}</span>
                {log.details && <span className="text-gray-500 ml-2">{log.details}</span>}
              </div>
              <span className="text-gray-400 text-xs">{new Date(log.createdAt).toLocaleString("es-ES")}</span>
            </div>
          ))}
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
