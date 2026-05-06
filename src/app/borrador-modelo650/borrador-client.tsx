"use client";

import { useState } from "react";
import { CCAA_LABELS, type CCAAKey } from "@/lib/isd-calculator";

const PROVINCE_OPTIONS = Object.keys(CCAA_LABELS) as CCAAKey[];

interface FormState {
  deceasedName: string;
  deceasedDni: string;
  deathDate: string;
  province: string;
  contactName: string;
  contactRelationship: string;
  estimatedValue: string;
  hasInsurance: boolean;
}

const EMPTY_FORM: FormState = {
  deceasedName: "",
  deceasedDni: "",
  deathDate: "",
  province: "",
  contactName: "",
  contactRelationship: "",
  estimatedValue: "",
  hasInsurance: false,
};

export function BorradorClient() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.deceasedName.trim() || form.deceasedName.trim().length < 2) {
      setError("Indica al menos el nombre del causante");
      return;
    }

    setGenerating(true);
    try {
      const payload = {
        deceasedName: form.deceasedName.trim(),
        deceasedDni: form.deceasedDni.trim() || undefined,
        deathDate: form.deathDate || undefined,
        province: form.province.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        contactRelationship: form.contactRelationship.trim() || undefined,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        hasInsurance: form.hasInsurance,
      };

      const res = await fetch("/api/public/modelo650-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 429) {
          setError("Demasiadas peticiones. Espera un minuto e inténtalo de nuevo.");
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
      a.download = `borrador-modelo650-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setGenerated(true);
    } catch (err) {
      setError("Error de red, inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border p-6 sm:p-8">
      <form onSubmit={handleGenerate} className="space-y-6">
        {/* Section 1: Causante */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Datos del causante (fallecido)
          </legend>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nombre y apellidos <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.deceasedName}
              onChange={(e) => update("deceasedName", e.target.value)}
              placeholder="Ej. Juan Pérez García"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              required
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">DNI/NIE (opcional)</label>
              <input
                type="text"
                value={form.deceasedDni}
                onChange={(e) => update("deceasedDni", e.target.value)}
                placeholder="12345678A"
                maxLength={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de fallecimiento</label>
              <input
                type="date"
                value={form.deathDate}
                onChange={(e) => update("deathDate", e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">CCAA de residencia fiscal</label>
            <select
              value={form.province}
              onChange={(e) => update("province", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              <option value="">— Selecciona CCAA —</option>
              {PROVINCE_OPTIONS.map((p) => (
                <option key={p} value={p.toLowerCase().replace(/_/g, "-")}>
                  {CCAA_LABELS[p]}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Determina la bonificación autonómica que se aplicará al cálculo
            </p>
          </div>
        </fieldset>

        <hr />

        {/* Section 2: Heredero */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Heredero principal (opcional)
          </legend>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del heredero</label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                placeholder="Nombre del declarante"
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Parentesco con el causante</label>
              <select
                value={form.contactRelationship}
                onChange={(e) => update("contactRelationship", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              >
                <option value="">—</option>
                <option value="Cónyuge">Cónyuge</option>
                <option value="Hijo/a">Hijo/a</option>
                <option value="Padre/Madre">Padre/Madre</option>
                <option value="Hermano/a">Hermano/a</option>
                <option value="Sobrino/a">Sobrino/a</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
        </fieldset>

        <hr />

        {/* Section 3: Patrimonio */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Patrimonio aproximado (opcional)
          </legend>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Valor estimado del caudal hereditario (€)
            </label>
            <input
              type="number"
              value={form.estimatedValue}
              onChange={(e) => update("estimatedValue", e.target.value)}
              placeholder="200000"
              min="0"
              max="100000000"
              step="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si lo indicas, calcularemos la cuota estimada a pagar en tu CCAA
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasInsurance}
              onChange={(e) => update("hasInsurance", e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700">
              <strong>El causante tenía seguros de vida.</strong>
              <span className="block text-xs text-gray-500 mt-0.5">
                Activa esta opción para que el PDF incluya el bloque específico de seguros y el RCSV en el checklist.
              </span>
            </span>
          </label>
        </fieldset>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={generating}
            className="flex-1 px-6 py-3 bg-primary text-white font-semibold rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generando PDF…
              </span>
            ) : (
              "Generar borrador en PDF (gratis)"
            )}
          </button>
          {generated && (
            <button
              type="button"
              onClick={() => { setForm(EMPTY_FORM); setGenerated(false); }}
              className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-200 transition"
            >
              Generar otro
            </button>
          )}
        </div>

        {generated && !error && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-medium text-emerald-900">PDF descargado</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Si gestionas varios expedientes, prueba la versión Pro: 14 días gratis sin tarjeta.
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
