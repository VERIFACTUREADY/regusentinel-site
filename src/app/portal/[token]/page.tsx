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

function ConsentGate({
  branding,
  token,
  onAccepted,
}: {
  branding: { displayName: string; primaryColor: string | null; logoUrl: string | null; showPoweredBy: boolean };
  token: string;
  onAccepted: (authorName: string) => void;
}) {
  const primary = branding.primaryColor || "#6366f1";
  const [authorName, setAuthorName] = useState("");
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("portalAuthorName") : null;
    if (saved) setAuthorName(saved);
  }, []);

  async function handleAccept() {
    if (!checked) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/${token}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: authorName.trim() || null }),
      });
      if (!res.ok) throw new Error("consent failed");
      if (authorName.trim()) localStorage.setItem("portalAuthorName", authorName.trim());
      onAccepted(authorName.trim());
    } catch {
      setError("No se pudo registrar el consentimiento. Inténtelo de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b py-4" style={{ borderBottomColor: primary }}>
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-3">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.displayName} className="h-9 w-auto max-w-[160px] object-contain" />
          ) : (
            <div className="h-9 w-9 rounded" style={{ backgroundColor: primary }} />
          )}
          <div>
            <h1 className="text-xl font-bold" style={{ color: primary }}>{branding.displayName}</h1>
            <p className="text-sm text-gray-500">Portal de seguimiento</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-xl border shadow-sm w-full max-w-lg p-8">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primary}1a` }}>
              <svg className="w-7 h-7" fill="none" stroke={primary} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Acceso al portal familiar</h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Para acceder al seguimiento de su expediente, necesitamos su consentimiento para el tratamiento de los datos personales.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 space-y-2 mb-6 max-h-48 overflow-y-auto">
            <p className="font-semibold text-gray-700">Información sobre el tratamiento de datos (RGPD)</p>
            <p>
              <strong>Responsable:</strong> {branding.displayName}
            </p>
            <p>
              <strong>Finalidad:</strong> Gestión del expediente de herencia y comunicación con la familia/herederos.
            </p>
            <p>
              <strong>Legitimación:</strong> Consentimiento del interesado (Art. 6.1.a RGPD) y ejecución de relación contractual (Art. 6.1.b RGPD).
            </p>
            <p>
              <strong>Destinatarios:</strong> No se cederán datos a terceros salvo obligación legal.
            </p>
            <p>
              <strong>Derechos:</strong> Puede ejercer sus derechos de acceso, rectificación, supresión, portabilidad y oposición dirigiéndose al responsable del tratamiento.
            </p>
            <p>
              <strong>Conservación:</strong> Los datos se conservarán durante el tiempo necesario para la gestión del expediente y los plazos legales aplicables.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Su nombre <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Nombre del familiar o representante"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": primary } as React.CSSProperties}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    checked ? "border-transparent" : "border-gray-300 bg-white group-hover:border-gray-400"
                  }`}
                  style={checked ? { backgroundColor: primary, borderColor: primary } : undefined}
                >
                  {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-700 leading-snug">
                He leído y acepto el tratamiento de mis datos personales tal como se describe en la información anterior, y confirmo que tengo legitimación para acceder a este expediente.
              </span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-4">{error}</p>
          )}

          <button
            onClick={handleAccept}
            disabled={!checked || submitting}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: primary }}
          >
            {submitting ? "Registrando..." : "Aceptar y acceder al portal"}
          </button>

          {branding.showPoweredBy && (
            <p className="text-center text-xs text-gray-400 mt-4">Powered by BARITUR PRO</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function PortalPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [msgAuthor, setMsgAuthor] = useState("");
  const [msgContent, setMsgContent] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgError, setMsgError] = useState("");
  // consent gate: null = not yet loaded; false = needs consent; true = already consented
  const [consented, setConsented] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("portalAuthorName") : null;
    if (saved) setMsgAuthor(saved);
  }, []);

  useEffect(() => { fetchData(); }, [token]);

  async function fetchData() {
    const res = await fetch(`/api/portal/${token}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      setConsented(json.consentAccepted === true);
      // Load secondary data only after main data is confirmed
      fetchDocs();
      fetchMessages();
    } else {
      setError("Enlace no valido o expediente no encontrado.");
    }
    setLoading(false);
  }

  async function fetchDocs() {
    const res = await fetch(`/api/portal/${token}/documents`);
    if (res.ok) setDocs(await res.json());
  }

  async function fetchMessages() {
    const res = await fetch(`/api/portal/${token}/messages`);
    if (res.ok) setMessages(await res.json());
  }

  async function sendMessage() {
    if (!msgContent.trim()) return;
    setMsgSending(true);
    setMsgError("");
    if (msgAuthor.trim()) {
      localStorage.setItem("portalAuthorName", msgAuthor.trim());
    }
    const res = await fetch(`/api/portal/${token}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msgContent.trim(), authorName: msgAuthor.trim() || null }),
    });
    setMsgSending(false);
    if (res.ok) {
      setMsgContent("");
      fetchMessages();
    } else {
      const data = await res.json().catch(() => null);
      setMsgError(data?.error || "Error al enviar el mensaje");
    }
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
        <h1 className="text-xl font-bold text-gray-900 mb-2">Portal de seguimiento</h1>
        <p className="text-red-600">{error}</p>
      </div>
    </div>
  );

  const branding = data.branding || {};
  const primary = branding.primaryColor || "#6366f1";
  const displayName = branding.displayName || "Portal de seguimiento";

  // Show consent gate if not yet consented
  if (consented === false) {
    return (
      <ConsentGate
        branding={{ displayName, primaryColor: primary, logoUrl: branding.logoUrl, showPoweredBy: branding.showPoweredBy }}
        token={token}
        onAccepted={(name) => {
          setConsented(true);
          if (name) setMsgAuthor(name);
        }}
      />
    );
  }

  const statusIdx = statusOrder.indexOf(data.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b py-4" style={{ borderBottomColor: primary }}>
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-3">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={displayName}
              className="h-9 w-auto max-w-[160px] object-contain" />
          ) : (
            <div className="h-9 w-9 rounded" style={{ backgroundColor: primary }} />
          )}
          <div>
            <h1 className="text-xl font-bold" style={{ color: primary }}>{displayName}</h1>
            <p className="text-sm text-gray-500">Portal de seguimiento</p>
          </div>
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
              <div key={s}
                className={`flex-1 py-2 text-center text-xs rounded ${
                  i <= statusIdx ? "text-white" : "bg-gray-100 text-gray-400"
                }`}
                style={i <= statusIdx ? { backgroundColor: primary } : undefined}
              >
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
            uploading ? "bg-gray-200 text-gray-500" : "text-white"
          }`}
            style={!uploading ? { backgroundColor: primary } : undefined}
          >
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

        {/* Messages */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Mensajes con la gestoría
          </h3>

          {/* Thread */}
          {messages.length > 0 && (
            <div className="space-y-3 mb-6 max-h-80 overflow-y-auto pr-1">
              {messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.fromFamily ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.fromFamily
                      ? "rounded-tr-sm text-white"
                      : "rounded-tl-sm bg-gray-100 text-gray-800"
                  }`}
                  style={msg.fromFamily ? { backgroundColor: primary } : undefined}
                  >
                    <p className="text-xs opacity-70 mb-1">
                      {msg.fromFamily ? (msg.authorName || "Familia") : "Gestoría"}
                      {" · "}
                      {new Date(msg.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Send form */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Tu nombre (opcional)"
              value={msgAuthor}
              onChange={(e) => setMsgAuthor(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <textarea
              rows={3}
              placeholder="Escribe tu mensaje aquí..."
              value={msgContent}
              onChange={(e) => setMsgContent(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendMessage(); }}
              className="w-full px-3 py-2 border rounded-md text-sm resize-none"
            />
            {msgError && <p className="text-sm text-red-600">{msgError}</p>}
            <button
              onClick={sendMessage}
              disabled={msgSending || !msgContent.trim()}
              className="w-full py-2 rounded-md text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: primary }}
            >
              {msgSending ? "Enviando..." : "Enviar mensaje"}
            </button>
            <p className="text-xs text-gray-400 text-center">Cmd+Enter para enviar</p>
          </div>
        </div>

        {/* Footer: white-label aware */}
        <div className="text-center text-xs text-gray-500 space-y-1 py-4">
          {branding.footerText ? (
            <p>{branding.footerText}</p>
          ) : (
            <>
              <p>Responsable del tratamiento: {displayName}.</p>
              <p>Actuamos con autorizacion del familiar/heredero/representante.</p>
            </>
          )}
          {branding.supportEmail && (
            <p>
              Contacto:{" "}
              <a href={`mailto:${branding.supportEmail}`} className="underline" style={{ color: primary }}>
                {branding.supportEmail}
              </a>
            </p>
          )}
          {branding.showPoweredBy && (
            <p className="text-gray-400 pt-2">Powered by BARITUR PRO</p>
          )}
        </div>
      </main>
    </div>
  );
}
