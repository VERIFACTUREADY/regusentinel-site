"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Version {
  id: string;
  version: number;
  subject: string | null;
  body: string;
  variables: string[];
  isApproved: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  email: "Email",
  carta: "Carta",
  solicitud: "Solicitud",
};

const CATEGORY_LABELS: Record<string, string> = {
  BANCOS: "Bancos",
  SUMINISTROS: "Suministros",
  TELECOM: "Telecomunicaciones",
  SUSCRIPCIONES: "Suscripciones",
  SEGUROS: "Seguros",
  VIDA_DIGITAL: "Vida digital",
  FISCAL: "Fiscal",
  OTROS: "Otros",
};

export function TemplateEditor({
  templateId,
  name,
  type,
  category,
  versions,
  canEdit,
}: {
  templateId: string;
  name: string;
  type: string;
  category: string | null;
  versions: Version[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const latest = versions[0];
  const [selectedVersion, setSelectedVersion] = useState(latest?.version ?? 1);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState(latest?.subject ?? "");
  const [body, setBody] = useState(latest?.body ?? "");

  const current = versions.find((v) => v.version === selectedVersion) ?? latest;

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject || null, body }),
    });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/templates" className="text-sm text-primary hover:underline mb-2 inline-block">
          &larr; Volver a plantillas
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span>{TYPE_LABELS[type] ?? type}</span>
              {category && <span>{CATEGORY_LABELS[category] ?? category}</span>}
              <span>{versions.length} version{versions.length !== 1 ? "es" : ""}</span>
            </div>
          </div>
          {canEdit && !editing && (
            <button
              onClick={() => {
                setSubject(latest?.subject ?? "");
                setBody(latest?.body ?? "");
                setEditing(true);
              }}
              className="px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90"
            >
              Editar plantilla
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {editing ? (
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h3 className="font-semibold">Nueva version (v{(latest?.version ?? 0) + 1})</h3>

              {type === "email" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenido</label>
                <textarea
                  rows={16}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-sm text-gray-600 border rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !body.trim()}
                  className="px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar nueva version"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold">Version {current?.version}</h2>
                  {current?.isApproved ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Aprobada</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Borrador</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{current?.createdAt}</span>
              </div>

              {current?.subject && (
                <div className="px-6 py-3 border-b bg-gray-50">
                  <span className="text-xs text-gray-500">Asunto: </span>
                  <span className="text-sm font-medium">{current.subject}</span>
                </div>
              )}

              <div className="px-6 py-4">
                <pre className="whitespace-pre-wrap text-sm font-mono text-gray-700 leading-relaxed">
                  {current?.body}
                </pre>
              </div>

              {current?.variables && current.variables.length > 0 && (
                <div className="px-6 py-3 border-t bg-gray-50">
                  <span className="text-xs text-gray-500">Variables: </span>
                  {current.variables.map((v) => (
                    <span key={v} className="text-xs px-1.5 py-0.5 bg-gray-200 rounded font-mono mr-1">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Version sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">Historial de versiones</h3>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setSelectedVersion(v.version); setEditing(false); }}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${
                    v.version === selectedVersion && !editing ? "bg-primary/5 border-l-2 border-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">v{v.version}</span>
                    {v.isApproved ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Aprobada</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Borrador</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{v.createdAt}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
            <p className="font-semibold mb-1">Variables disponibles</p>
            <ul className="space-y-0.5 font-mono">
              <li>{"{{deceased.fullName}}"}</li>
              <li>{"{{deceased.dni}}"}</li>
              <li>{"{{contact.fullName}}"}</li>
              <li>{"{{contact.email}}"}</li>
              <li>{"{{case.ref}}"}</li>
              <li>{"{{org.name}}"}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
