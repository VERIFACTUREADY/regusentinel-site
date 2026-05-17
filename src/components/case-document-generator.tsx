"use client";

import { useEffect, useState } from "react";

interface TemplateField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select";
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: string[];
}

interface CaseTemplate {
  slug: string;
  title: string;
  description: string;
  destinatario: string;
  category: string;
  fields: TemplateField[];
  prefilled: Record<string, string>;
}

const CATEGORY_COLORS: Record<string, string> = {
  banco: "bg-blue-100 text-blue-700",
  aseguradora: "bg-purple-100 text-purple-700",
  fiscal: "bg-amber-100 text-amber-700",
  comunidad: "bg-emerald-100 text-emerald-700",
  otros: "bg-gray-100 text-gray-700",
};

export function CaseDocumentGenerator({ caseId }: { caseId: string }) {
  const [templates, setTemplates] = useState<CaseTemplate[] | null>(null);
  const [active, setActive] = useState<CaseTemplate | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/documento`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTemplates(data?.templates ?? []))
      .catch(() => setTemplates([]));
  }, [caseId]);

  if (!templates) {
    return (
      <div className="bg-white p-6 rounded-lg border">
        <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border">
      <h3 className="font-semibold mb-1">Generar documento</h3>
      <p className="text-sm text-gray-500 mb-4">
        Cartas y solicitudes pre-rellenadas con los datos del expediente. Revisa, completa lo que falte y descarga el PDF.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {templates.map((t) => {
          const filledCount = Object.values(t.prefilled).filter((v) => v && v.trim()).length;
          return (
            <button
              key={t.slug}
              onClick={() => setActive(t)}
              className="text-left border rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.otros}`}>
                  {t.category}
                </span>
                {filledCount > 0 && (
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {filledCount} campos auto-rellenos
                  </span>
                )}
              </div>
              <p className="font-medium text-gray-900 text-sm leading-snug">{t.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">Para: {t.destinatario}</p>
            </button>
          );
        })}
      </div>

      {active && (
        <DocumentModal caseId={caseId} template={active} onClose={() => setActive(null)} />
      )}
    </div>
  );
}

function DocumentModal({
  caseId,
  template,
  onClose,
}: {
  caseId: string;
  template: CaseTemplate;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({ ...template.prefilled });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function update(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/documento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: template.slug, values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se ha podido generar el documento");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError("Error de red, inténtalo de nuevo");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[92vh] flex flex-col">
        <div className="px-5 sm:px-6 py-4 border-b flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900 leading-snug">{template.title}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Campos en verde: auto-rellenos del expediente. Revisa y completa el resto.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 -mt-1" aria-label="Cerrar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={generate} className="overflow-y-auto px-5 sm:px-6 py-5 space-y-4 flex-1">
          {template.fields.map((f) => {
            const isPrefilled = Boolean(template.prefilled[f.key]);
            return (
              <div key={f.key}>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
                  {f.label}
                  {f.required && <span className="text-rose-500">*</span>}
                  {isPrefilled && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      del expediente
                    </span>
                  )}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    value={values[f.key] ?? ""}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    maxLength={1000}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${isPrefilled ? "border-emerald-300 bg-emerald-50/40" : "border-gray-300"}`}
                  />
                ) : f.type === "select" ? (
                  <select
                    value={values[f.key] ?? ""}
                    onChange={(e) => update(f.key, e.target.value)}
                    required={f.required}
                    className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${isPrefilled ? "border-emerald-300" : "border-gray-300"}`}
                  >
                    <option value="">Selecciona...</option>
                    {f.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                    value={values[f.key] ?? ""}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    maxLength={500}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${isPrefilled ? "border-emerald-300 bg-emerald-50/40" : "border-gray-300"}`}
                  />
                )}
                {f.helpText && <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>}
              </div>
            );
          })}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>
          )}
          {done && !error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              Documento descargado. Revísalo, fírmalo y entrégalo.
            </div>
          )}
        </form>

        <div className="px-5 sm:px-6 py-4 border-t flex items-center justify-end gap-2 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition"
          >
            Cerrar
          </button>
          <button
            type="submit"
            onClick={generate}
            disabled={generating}
            className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {generating ? "Generando..." : "Generar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
