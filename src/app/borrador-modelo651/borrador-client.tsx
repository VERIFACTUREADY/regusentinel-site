"use client";

import { useState } from "react";
import { CCAA_LABELS, type CCAAKey, type ParentescoGroup } from "@/lib/isd-calculator";

const CCAA_LIST = Object.keys(CCAA_LABELS) as CCAAKey[];

interface FormState {
  donanteName: string;
  donanteDni: string;
  donatarioName: string;
  donatarioDni: string;
  relationship: string;
  province: string;
  donationDate: string;
  ccaa: CCAAKey | "";
  group: ParentescoGroup | "";
  tipoBien: "dinero" | "inmueble" | "valores" | "vehiculo" | "otros";
  baseImponible: string;
  reduccion: "ninguna" | "vivienda-habitual-hijo" | "dinero-para-vivienda-hijo" | "empresa-familiar";
}

const EMPTY: FormState = {
  donanteName: "",
  donanteDni: "",
  donatarioName: "",
  donatarioDni: "",
  relationship: "",
  province: "",
  donationDate: "",
  ccaa: "",
  group: "",
  tipoBien: "dinero",
  baseImponible: "",
  reduccion: "ninguna",
};

export function BorradorM651Client() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.donanteName.trim() || !form.donatarioName.trim()) {
      setError("Indica el nombre del donante y del donatario");
      return;
    }

    setGenerating(true);
    try {
      const payload = {
        donanteName: form.donanteName.trim(),
        donanteDni: form.donanteDni.trim() || undefined,
        donatarioName: form.donatarioName.trim(),
        donatarioDni: form.donatarioDni.trim() || undefined,
        relationship: form.relationship.trim() || undefined,
        province: form.province.trim() || undefined,
        donationDate: form.donationDate || undefined,
        ccaa: form.ccaa || undefined,
        group: form.group || undefined,
        tipoBien: form.tipoBien,
        baseImponible: form.baseImponible ? Number(form.baseImponible) : undefined,
        reduccion: form.reduccion,
      };

      const res = await fetch("/api/public/modelo651-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      a.download = `borrador-modelo651-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setGenerated(true);
    } catch {
      setError("Error de red, intentalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border p-6 sm:p-8">
      <form onSubmit={handleGenerate} className="space-y-6">
        {/* 1. Donante */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Donante
          </legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nombre completo *"
              value={form.donanteName}
              onChange={(e) => update("donanteName", e.target.value)}
              maxLength={200}
              required
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <input
              type="text"
              placeholder="DNI/NIE (opcional)"
              value={form.donanteDni}
              onChange={(e) => update("donanteDni", e.target.value)}
              maxLength={20}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </fieldset>

        <hr />

        {/* 2. Donatario */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Donatario (sujeto pasivo)
          </legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nombre completo *"
              value={form.donatarioName}
              onChange={(e) => update("donatarioName", e.target.value)}
              maxLength={200}
              required
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <input
              type="text"
              placeholder="DNI/NIE (opcional)"
              value={form.donatarioDni}
              onChange={(e) => update("donatarioDni", e.target.value)}
              maxLength={20}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <select
              value={form.relationship}
              onChange={(e) => update("relationship", e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Parentesco</option>
              <option value="Hijo/a">Hijo/a</option>
              <option value="Conyuge">Cónyuge</option>
              <option value="Padre/Madre">Padre/Madre</option>
              <option value="Hermano/a">Hermano/a</option>
              <option value="Sobrino/a">Sobrino/a</option>
              <option value="Sin parentesco">Sin parentesco</option>
            </select>
            <select
              value={form.group}
              onChange={(e) => update("group", e.target.value as FormState["group"])}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Grupo parentesco</option>
              <option value="I">I (hijos &lt;21)</option>
              <option value="II">II (cónyuge / hijos / padres)</option>
              <option value="III">III (hermanos / tíos / sobrinos)</option>
              <option value="IV">IV (sin parentesco)</option>
            </select>
            <input
              type="text"
              placeholder="Provincia"
              value={form.province}
              onChange={(e) => update("province", e.target.value)}
              maxLength={80}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </fieldset>

        <hr />

        {/* 3. Donacion */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Detalles de la donación
          </legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              type="date"
              value={form.donationDate}
              onChange={(e) => update("donationDate", e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <select
              value={form.ccaa}
              onChange={(e) => update("ccaa", e.target.value as FormState["ccaa"])}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">CCAA competente</option>
              {CCAA_LIST.map((c) => (
                <option key={c} value={c}>{CCAA_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <select
              value={form.tipoBien}
              onChange={(e) => update("tipoBien", e.target.value as FormState["tipoBien"])}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="dinero">Dinero / efectivo</option>
              <option value="inmueble">Inmueble</option>
              <option value="valores">Valores mobiliarios</option>
              <option value="vehiculo">Vehículo</option>
              <option value="otros">Otros bienes</option>
            </select>
            <input
              type="number"
              placeholder="Valor declarado (€)"
              value={form.baseImponible}
              onChange={(e) => update("baseImponible", e.target.value)}
              min="0"
              max="100000000"
              step="1000"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <select
            value={form.reduccion}
            onChange={(e) => update("reduccion", e.target.value as FormState["reduccion"])}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="ninguna">Sin reducción específica</option>
            <option value="vivienda-habitual-hijo">Donación vivienda habitual a descendiente (95%)</option>
            <option value="dinero-para-vivienda-hijo">Dinero para vivienda habitual del donatario (80%)</option>
            <option value="empresa-familiar">Empresa familiar / participaciones (95%)</option>
          </select>
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
            {generating ? "Generando PDF..." : "Generar borrador en PDF (gratis)"}
          </button>
          {generated && (
            <button
              type="button"
              onClick={() => { setForm(EMPTY); setGenerated(false); }}
              className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-200 transition"
            >
              Generar otro
            </button>
          )}
        </div>

        {generated && !error && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm">
            <p className="font-medium text-emerald-900">PDF descargado correctamente</p>
            <p className="text-xs text-emerald-700 mt-1">
              ¿Tramitas donaciones para clientes? Prueba la versión Pro 14 días gratis.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
