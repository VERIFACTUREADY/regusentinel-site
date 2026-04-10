"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const statusLabels: Record<string, string> = {
  INTAKE: "Recibido",
  VALIDATION: "En validacion",
  IN_PROGRESS: "En proceso",
  PENDING_DOCS: "Pendiente de documentos",
  READY_TO_SEND: "Listo para enviar",
  SENT: "Enviado",
  FOLLOW_UP: "En seguimiento",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

const statusOrder = ["INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS", "READY_TO_SEND", "SENT", "FOLLOW_UP", "CLOSED"];

export default function PortalPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchData(); fetchDocs(); }, [token]);

  async function fetchData() {
    const res = await fetch(`/api/portal/${token}`);
    if (res.ok) setData(await res.json());
    else setError("Enlace no valido o expediente no encontrado.");
    setLoading(false);
  }

  async function fetchDocs() {
    const res = await fetch(`/api/portal/${token}/documents`);
    if (res.ok) setDocs(await res.json());
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/portal/${token}/documents`, { method: "POST", body: formData });
    if (res.ok) {
      fetchDocs();
      fetchData();
    }
    setUploading(false);
    e.target.value = "";
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">Cargando...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg border text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">BARITUR PRO</h1>
        <p className="text-red-600">{error}</p>
      </div>
    </div>
  );

  const statusIdx = statusOrder.indexOf(data.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b py-4">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-xl font-bold text-primary">BARITUR PRO</h1>
          <p className="text-sm text-gray-500">Portal de seguimiento</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Case info */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-1">Expediente {data.ref}</h2>
          <p className="text-gray-600">Gestion para: {data.deceasedName}</p>
        </div>

        {/* Status progress */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="font-semibold mb-4">Estado del expediente</h3>
          <div className="flex gap-1">
            {statusOrder.map((s, i) => (
              <div key={s} className={`flex-1 py-2 text-center text-xs rounded ${
                i <= statusIdx ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {statusLabels[s] || s}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-600">
            Estado actual: <strong>{statusLabels[data.status] || data.status}</strong>
          </p>
          <p className="text-sm text-gray-500">
            {data.tasksPending} de {data.tasksTotal} gestiones pendientes
          </p>
        </div>

        {/* Progress summary */}
        {data.tasksDone !== undefined && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-3">Progreso</h3>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${data.tasksTotal > 0 ? Math.round((data.tasksDone / data.tasksTotal) * 100) : 0}%` }} />
            </div>
            <p className="text-sm text-gray-600">
              {data.tasksDone} de {data.tasksTotal} gestiones completadas ({data.tasksTotal > 0 ? Math.round((data.tasksDone / data.tasksTotal) * 100) : 0}%)
            </p>
          </div>
        )}

        {/* Key deadlines */}
        {data.caseDeadlines && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Plazos importantes
            </h3>
            <div className="space-y-3">
              {[
                { label: "Certificados oficiales disponibles", date: data.caseDeadlines.certificatesAvailable, desc: "Ultimas voluntades y seguros" },
                { label: "Plazo Impuesto Sucesiones", date: data.caseDeadlines.isdDeadline, desc: "Modelo 650 - 6 meses desde fallecimiento" },
              ].map((d) => {
                const days = Math.ceil((new Date(d.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const expired = days <= 0;
                const urgent = days > 0 && days <= 30;
                return (
                  <div key={d.label} className={`p-3 rounded-lg ${expired ? "bg-red-50" : urgent ? "bg-orange-50" : "bg-gray-50"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{d.label}</p>
                        <p className="text-xs text-gray-500">{d.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{new Date(d.date).toLocaleDateString("es-ES")}</p>
                        <p className={`text-xs ${expired ? "text-red-600 font-medium" : urgent ? "text-orange-600" : "text-gray-500"}`}>
                          {expired ? "Vencido" : `${days} dias`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* What's missing - docs needed */}
        {data.pendingDocs && data.pendingDocs.length > 0 && (
          <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Documentos pendientes
            </h3>
            <p className="text-sm text-amber-700 mb-3">
              Estos documentos son necesarios para avanzar con el expediente. Puede subirlos en la seccion de abajo.
            </p>
            <div className="space-y-2">
              {data.pendingDocs.map((doc: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm bg-white p-3 rounded border border-amber-100">
                  <div>
                    <p className="font-medium text-gray-800">{doc.title}</p>
                    <p className="text-xs text-gray-500">{doc.category}</p>
                  </div>
                  {doc.deadline && (() => {
                    const days = Math.ceil((new Date(doc.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return days > 0 ? (
                      <span className={`text-xs px-2 py-1 rounded ${days <= 30 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                        Plazo: {days}d
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium">Urgente</span>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks overview */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="font-semibold mb-3">Gestiones en curso</h3>
          <div className="space-y-2">
            {data.tasks?.map((task: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <span>{task.title}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  task.status === "DONE" ? "bg-green-100 text-green-700" :
                  task.status === "READY" ? "bg-yellow-100 text-yellow-700" :
                  task.status === "BLOCKED" ? "bg-red-100 text-red-700" :
                  task.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{
                  task.status === "DONE" ? "Completado" :
                  task.status === "READY" ? "Listo" :
                  task.status === "BLOCKED" ? "En espera" :
                  task.status === "IN_PROGRESS" ? "En proceso" : "Pendiente"
                }</span>
              </div>
            ))}
          </div>
        </div>

        {/* Document upload */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="font-semibold mb-3">Subir documentos</h3>
          <p className="text-sm text-gray-500 mb-4">
            Suba aqui la documentacion solicitada. Nombre el archivo segun la gestion correspondiente para vincularlo automaticamente (ej: &quot;certificado_defuncion.pdf&quot;).
          </p>
          <label className={`inline-block px-4 py-2 rounded-md text-sm cursor-pointer font-medium ${
            uploading ? "bg-gray-200 text-gray-500" : "bg-primary text-white hover:bg-primary/90"
          }`}>
            {uploading ? "Subiendo..." : "Subir documento"}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>

          {docs.length > 0 && (
            <div className="mt-4 divide-y">
              {docs.map((doc: any) => (
                <div key={doc.id} className="py-2 flex justify-between text-sm">
                  <span>{doc.fileName}</span>
                  <span className="text-gray-400">{new Date(doc.createdAt).toLocaleDateString("es-ES")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="text-center text-xs text-gray-400 space-y-1 py-4">
          <p>BARITUR no presta asesoramiento juridico ni fiscal individual.</p>
          <p>Actuamos con autorizacion del familiar/heredero/representante.</p>
        </div>
      </main>
    </div>
  );
}
