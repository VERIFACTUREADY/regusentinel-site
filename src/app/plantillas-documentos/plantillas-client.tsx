"use client";

import { useState } from "react";
import type { DocumentField } from "@/lib/document-templates";

interface TemplateSummary {
  slug: string;
  title: string;
  description: string;
  destinatario: string;
  category: string;
  categoryLabel: string;
  fields: DocumentField[];
}

interface Props {
  templates: TemplateSummary[];
  categoryColors: Record<string, string>;
}

export function PlantillasClient({ templates, categoryColors }: Props) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const active = templates.find((t) => t.slug === activeSlug);

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        {templates.map((t) => (
          <button
            key={t.slug}
            onClick={() => setActiveSlug(t.slug)}
            className="text-left bg-white rounded-xl border p-5 hover:shadow-md hover:border-primary/30 transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${categoryColors[t.category]}`}>
                {t.categoryLabel}
              </span>
              <span className="text-xs text-gray-400">{t.fields.length} campos</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-1 group-hover:text-primary transition">{t.title}</h3>
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{t.description}</p>
            <p className="text-xs text-gray-500">Destinatario: {t.destinatario}</p>
            <p className="mt-3 text-sm font-medium text-primary group-hover:underline">
              Rellenar y descargar →
            </p>
          </button>
        ))}
      </div>

      {active && <PlantillaModal template={active} onClose={() => setActiveSlug(null)} />}
    </>
  );
}

function PlantillaModal({ template, onClose }: { template: TemplateSummary; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  function update(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/public/plantilla-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: template.slug, values }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setError("Demasiadas peticiones. Espera un minuto e intentalo de nuevo.");
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "No se ha podido generar el PDF");
        }
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.slug}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch {
      setError("Error de red, intentalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900 leading-snug">{template.title}</h2>
            <p className="text-xs text-gray-500 mt-1">Destinatario: {template.destinatario}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 -mt-1"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body (scrollable) */}
        <form onSubmit={handleGenerate} className="overflow-y-auto px-5 sm:px-6 py-5 space-y-4 flex-1">
          {template.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {f.label}
                {f.required && <span className="text-rose-500 ml-1">*</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  required={f.required}
                  maxLength={1000}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              ) : f.type === "select" ? (
                <select
                  value={values[f.key] ?? ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  required={f.required}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Selecciona...</option>
                  {f.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : f.type === "date" ? (
                <input
                  type="date"
                  value={values[f.key] ?? ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  required={f.required}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  required={f.required}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              )}
              {f.helpText && (
                <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>
              )}
            </div>
          ))}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {downloaded && !error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-emerald-900">PDF descargado correctamente</p>
              <p className="text-xs text-emerald-700 mt-1">Revisa el documento, firma y entrega.</p>
            </div>
          )}
        </form>

        {/* Footer actions */}
        <div className="px-5 sm:px-6 py-4 border-t flex items-center justify-end gap-2 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {generating ? "Generando..." : "Generar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
