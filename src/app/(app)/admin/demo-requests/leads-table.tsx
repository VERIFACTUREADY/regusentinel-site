"use client";

import { useState, useTransition } from "react";

const STATUS_OPTIONS = [
  { value: "NEW", label: "Nuevo", color: "bg-gray-100 text-gray-700" },
  { value: "CONTACTED", label: "Contactado", color: "bg-blue-100 text-blue-700" },
  { value: "MEETING", label: "Reunión", color: "bg-yellow-100 text-yellow-800" },
  { value: "PILOT", label: "Piloto", color: "bg-purple-100 text-purple-700" },
  { value: "CUSTOMER", label: "Cliente", color: "bg-green-100 text-green-700" },
  { value: "LOST", label: "Perdido", color: "bg-red-100 text-red-700" },
] as const;

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  landing_hero: { label: "Landing", color: "bg-gray-100 text-gray-600" },
  demo_banner: { label: "Demo→Banner 🔥", color: "bg-amber-100 text-amber-800" },
  demo_dashboard: { label: "Demo→Dashboard", color: "bg-indigo-100 text-indigo-700" },
  pricing: { label: "Precios", color: "bg-purple-100 text-purple-700" },
};

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string | null;
  source: string | null;
  leadStatus: string;
  internalNotes: string | null;
  createdAt: Date;
}

export function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [, startTransition] = useTransition();

  async function updateLead(id: string, patch: { leadStatus?: string; internalNotes?: string }) {
    const res = await fetch(`/api/admin/demo-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updated } : l)));
  }

  function statusOption(val: string) {
    return STATUS_OPTIONS.find((s) => s.value === val) ?? STATUS_OPTIONS[0];
  }

  function sourceInfo(src: string | null) {
    if (!src) return { label: "—", color: "bg-gray-100 text-gray-400" };
    return SOURCE_LABELS[src] ?? { label: src, color: "bg-gray-100 text-gray-600" };
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white border rounded-lg px-6 py-16 text-center text-gray-400">
        Ninguna solicitud todavía
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
            <th className="px-5 py-3">Contacto</th>
            <th className="px-5 py-3">Empresa</th>
            <th className="px-5 py-3">Mensaje</th>
            <th className="px-5 py-3">Source</th>
            <th className="px-5 py-3">Estado</th>
            <th className="px-5 py-3">Notas internas</th>
            <th className="px-5 py-3">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {leads.map((lead) => {
            const status = statusOption(lead.leadStatus);
            const src = sourceInfo(lead.source);
            const isEditingNotes = editingNotes === lead.id;

            return (
              <tr key={lead.id} className="hover:bg-gray-50 align-top">
                {/* Contact */}
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{lead.name}</p>
                  <a
                    href={`mailto:${lead.email}?subject=Re: Demo Heredia`}
                    className="text-primary hover:underline text-xs"
                  >
                    {lead.email}
                  </a>
                  {lead.phone && (
                    <p className="text-xs text-gray-500 mt-0.5">{lead.phone}</p>
                  )}
                </td>

                {/* Company */}
                <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                  {lead.company || "—"}
                </td>

                {/* Message */}
                <td className="px-5 py-3 text-gray-600 max-w-[200px]">
                  <p
                    className="text-xs leading-relaxed line-clamp-3"
                    title={lead.message ?? ""}
                  >
                    {lead.message || "—"}
                  </p>
                </td>

                {/* Source */}
                <td className="px-5 py-3 whitespace-nowrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${src.color}`}>
                    {src.label}
                  </span>
                </td>

                {/* Status dropdown */}
                <td className="px-5 py-3 whitespace-nowrap">
                  <select
                    value={lead.leadStatus}
                    onChange={(e) => {
                      startTransition(() => {
                        updateLead(lead.id, { leadStatus: e.target.value });
                      });
                    }}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer appearance-none pr-5 ${status.color}`}
                    style={{ backgroundImage: "none" }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Internal notes */}
                <td className="px-5 py-3 max-w-[200px]">
                  {isEditingNotes ? (
                    <div className="flex flex-col gap-1">
                      <textarea
                        autoFocus
                        rows={3}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        className="w-full text-xs border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            updateLead(lead.id, { internalNotes: notesDraft });
                            setEditingNotes(null);
                          }}
                          className="text-xs text-white bg-primary px-2 py-0.5 rounded hover:bg-primary/90"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingNotes(null)}
                          className="text-xs text-gray-500 hover:text-gray-900"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setNotesDraft(lead.internalNotes ?? "");
                        setEditingNotes(lead.id);
                      }}
                      className="text-left w-full group"
                    >
                      {lead.internalNotes ? (
                        <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">
                          {lead.internalNotes}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-300 group-hover:text-gray-500 italic">
                          Añadir nota…
                        </p>
                      )}
                    </button>
                  )}
                </td>

                {/* Date */}
                <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {new Date(lead.createdAt).toLocaleDateString("es-ES")}
                  <br />
                  <span className="text-gray-400">
                    {new Date(lead.createdAt).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
