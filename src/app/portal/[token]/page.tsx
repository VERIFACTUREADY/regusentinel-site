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

        {/* Tasks overview */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="font-semibold mb-3">Gestiones en curso</h3>
          <div className="space-y-2">
            {data.tasks?.map((task: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <span>{task.title}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  task.status === "DONE" ? "bg-green-100 text-green-700" :
                  task.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{task.status === "DONE" ? "Completado" : task.status === "IN_PROGRESS" ? "En proceso" : "Pendiente"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Document upload */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="font-semibold mb-3">Documentos</h3>
          <p className="text-sm text-gray-500 mb-4">
            Suba aqui la documentacion solicitada (certificado de defuncion, testamento, DNIs, etc.)
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
