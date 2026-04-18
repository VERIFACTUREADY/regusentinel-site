"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TemplateItem {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  category: string | null;
  categoryLabel: string | null;
  latestVersion: number;
  isApproved: boolean;
  updatedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-700",
  carta: "bg-amber-100 text-amber-700",
  solicitud: "bg-purple-100 text-purple-700",
};

const CATEGORIES = [
  { value: "BANCOS", label: "Bancos" },
  { value: "SUMINISTROS", label: "Suministros" },
  { value: "TELECOM", label: "Telecomunicaciones" },
  { value: "SUSCRIPCIONES", label: "Suscripciones" },
  { value: "SEGUROS", label: "Seguros" },
  { value: "VIDA_DIGITAL", label: "Vida digital" },
  { value: "FISCAL", label: "Fiscal" },
  { value: "OTROS", label: "Otros" },
];

const TYPES = [
  { value: "email", label: "Email" },
  { value: "carta", label: "Carta" },
  { value: "solicitud", label: "Solicitud" },
];

export function TemplateList({
  templates,
  canCreate,
}: {
  templates: TemplateItem[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "email",
    category: "",
    subject: "",
    body: "",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        category: form.category || null,
        subject: form.subject || null,
        body: form.body,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ name: "", type: "email", category: "", subject: "", body: "" });
      router.refresh();
    }
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div>
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva plantilla
            </button>
          ) : (
            <form onSubmit={handleCreate} className="bg-white rounded-lg border p-6 space-y-4">
              <h3 className="font-semibold">Nueva plantilla</h3>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Notificacion de fallecimiento al banco"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Sin categoria</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.type === "email" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Asunto del email..."
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenido
                  <span className="text-gray-400 font-normal ml-2">
                    Usa {"{{variable}}"} para campos dinamicos
                  </span>
                </label>
                <textarea
                  required
                  rows={8}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder={"Estimado/a {{contact.fullName}},\n\nLe comunicamos el fallecimiento de {{deceased.fullName}}..."}
                  className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-gray-600 border rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? "Creando..." : "Crear plantilla"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Templates list */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Todas las plantillas</h2>
        </div>

        {templates.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p>No hay plantillas creadas</p>
            {canCreate && (
              <p className="text-sm mt-1">Crea tu primera plantilla para agilizar las comunicaciones</p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500 bg-gray-50">
                    <th className="px-6 py-3 font-medium">Nombre</th>
                    <th className="px-6 py-3 font-medium">Tipo</th>
                    <th className="px-6 py-3 font-medium">Categoria</th>
                    <th className="px-6 py-3 font-medium">Version</th>
                    <th className="px-6 py-3 font-medium">Estado</th>
                    <th className="px-6 py-3 font-medium">Actualizada</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {templates.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/templates/${t.id}`)}
                    >
                      <td className="px-6 py-3">
                        <span className="font-medium text-sm text-primary hover:underline">{t.name}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[t.type] || "bg-gray-100 text-gray-600"}`}>
                          {t.typeLabel}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {t.categoryLabel || "—"}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 font-mono">
                        v{t.latestVersion}
                      </td>
                      <td className="px-6 py-3">
                        {t.isApproved ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Aprobada</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Borrador</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{t.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/templates/${t.id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-primary">{t.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[t.type] || "bg-gray-100 text-gray-600"}`}>
                      {t.typeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {t.categoryLabel && <span>{t.categoryLabel}</span>}
                    <span className="font-mono">v{t.latestVersion}</span>
                    <span>{t.isApproved ? "Aprobada" : "Borrador"}</span>
                    <span>{t.updatedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
