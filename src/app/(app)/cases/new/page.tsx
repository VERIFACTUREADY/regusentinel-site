"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const categories = [
  { id: "BANCOS", label: "Bancos" },
  { id: "SUMINISTROS", label: "Suministros" },
  { id: "TELECOM", label: "Telecomunicaciones" },
  { id: "SUSCRIPCIONES", label: "Suscripciones" },
  { id: "SEGUROS", label: "Seguros" },
  { id: "VIDA_DIGITAL", label: "Vida digital" },
  { id: "FISCAL", label: "Fiscal" },
  { id: "OTROS", label: "Otros" },
];

const relationships = ["Hijo/a", "Conyuge", "Hermano/a", "Nieto/a", "Padre/Madre", "Otro"];

export default function NewCasePage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [caseTemplates, setCaseTemplates] = useState<any[]>([]);
  const router = useRouter();

  const [form, setForm] = useState({
    deceasedName: "",
    deathDate: "",
    deceasedDni: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    relationship: "",
    province: "",
    isUrgent: false,
    hasDeceasedInsurance: false,
    categories: [] as string[],
    caseTemplateId: "",
    consentAccepted: false,
    termsAccepted: false,
  });

  useEffect(() => {
    fetch("/api/case-templates")
      .then((r) => r.ok ? r.json() : [])
      .then(setCaseTemplates)
      .catch(() => {});
  }, []);

  function update(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  function toggleCategory(cat: string) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  }

  async function handleSubmit() {
    if (!form.consentAccepted || !form.termsAccepted) {
      setError("Debes aceptar el consentimiento y los terminos");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Omitimos los opcionales vacíos: el schema del API acepta undefined
      // pero no null, y el parentesco viaja como `contactRelationship`.
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deceasedName: form.deceasedName,
          deathDate: form.deathDate || undefined,
          deceasedDni: form.deceasedDni || undefined,
          contactName: form.contactName,
          contactPhone: form.contactPhone || undefined,
          contactEmail: form.contactEmail || undefined,
          contactRelationship: form.relationship || undefined,
          province: form.province || undefined,
          isUrgent: form.isUrgent,
          hasDeceasedInsurance: form.hasDeceasedInsurance,
          categories: form.categories,
          consentAccepted: form.consentAccepted,
          caseTemplateId: form.caseTemplateId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // Con errores de validación Zod, mostrar el primer detalle es mucho
        // más útil que el genérico "Datos invalidos".
        const detail = Array.isArray(data?.details) && data.details[0]?.message;
        throw new Error(detail || data?.error || "Error al crear expediente");
      }

      const data = await res.json();
      router.push(`/cases/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuevo expediente</h1>

      {/* Step indicator */}
      <div className="flex mb-8 gap-1">
        {["Fallecido", "Solicitante", "Detalles", "Plantilla", "Consentimiento"].map((label, i) => (
          <div key={i} className="flex-1">
            <div className={`h-2 rounded ${i + 1 <= step ? "bg-primary" : "bg-gray-200"}`} />
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-lg border">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Datos del fallecido</h2>
            <div>
              <label htmlFor="deceasedName" className="block text-sm font-medium mb-1">Nombre del fallecido *</label>
              <input id="deceasedName" type="text" required value={form.deceasedName}
                onChange={(e) => update("deceasedName", e.target.value)}
                className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label htmlFor="deathDate" className="block text-sm font-medium mb-1">Fecha aproximada de fallecimiento</label>
              <input id="deathDate" type="date" value={form.deathDate}
                onChange={(e) => update("deathDate", e.target.value)}
                className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label htmlFor="deceasedDni" className="block text-sm font-medium mb-1">DNI del fallecido (opcional)</label>
              <input id="deceasedDni" type="text" value={form.deceasedDni}
                onChange={(e) => update("deceasedDni", e.target.value)}
                className="w-full px-3 py-2 border rounded-md" />
            </div>
            <button onClick={() => form.deceasedName ? setStep(2) : setError("Nombre obligatorio")}
              className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary/90">
              Siguiente
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Datos del solicitante</h2>
            <div>
              <label htmlFor="contactName" className="block text-sm font-medium mb-1">Nombre del solicitante *</label>
              <input id="contactName" type="text" required value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label htmlFor="contactPhone" className="block text-sm font-medium mb-1">Telefono de contacto *</label>
              <input id="contactPhone" type="tel" value={form.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">Email de contacto *</label>
              <input id="contactEmail" type="email" value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                aria-describedby="contactoAyuda"
                className="w-full px-3 py-2 border rounded-md" />
              <p id="contactoAyuda" className="text-xs text-gray-400 mt-1">Al menos uno de los dos: teléfono o email.</p>
            </div>
            <div>
              <label htmlFor="relationship" className="block text-sm font-medium mb-1">Relacion con el fallecido</label>
              <select id="relationship" value={form.relationship} onChange={(e) => update("relationship", e.target.value)}
                className="w-full px-3 py-2 border rounded-md">
                <option value="">Seleccionar...</option>
                {relationships.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 py-2 border rounded-md">Atras</button>
              <button onClick={() => {
                if (!form.contactName) return setError("Nombre obligatorio");
                if (!form.contactPhone && !form.contactEmail) return setError("Indica al menos un teléfono o email de contacto");
                setStep(3);
              }}
                className="flex-1 py-2 bg-primary text-white rounded-md hover:bg-primary/90">Siguiente</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Detalles del expediente</h2>
            <div>
              <label htmlFor="province" className="block text-sm font-medium mb-1">Provincia</label>
              <input id="province" type="text" value={form.province}
                onChange={(e) => update("province", e.target.value)}
                className="w-full px-3 py-2 border rounded-md" placeholder="Ej: Madrid" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isUrgent}
                  onChange={(e) => update("isUrgent", e.target.checked)}
                  className="rounded" />
                <span className="text-sm">Urgente</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.hasDeceasedInsurance}
                  onChange={(e) => update("hasDeceasedInsurance", e.target.checked)}
                  className="rounded" />
                <span className="text-sm">Seguro de decesos</span>
              </label>
            </div>
            {/*
              Este grupo etiquetaba con `<label>` un conjunto de casillas, no un
              campo: un `<label>` sin control asociado no anuncia nada. Un
              `<fieldset>` con `<legend>` sí agrupa y se lee antes de cada
              casilla.
            */}
            <fieldset>
              <legend className="block text-sm font-medium mb-2">Categorias de gestion * (elige al menos una)</legend>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <label key={cat.id} className={`flex items-center gap-2 p-3 border rounded-md cursor-pointer ${
                    form.categories.includes(cat.id) ? "border-primary bg-blue-50" : ""
                  }`}>
                    <input type="checkbox" checked={form.categories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)} className="rounded" />
                    <span className="text-sm">{cat.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 py-2 border rounded-md">Atras</button>
              <button onClick={() => form.categories.length > 0 ? setStep(4) : setError("Selecciona al menos una categoria")}
                className="flex-1 py-2 bg-primary text-white rounded-md hover:bg-primary/90">Siguiente</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Plantilla de tareas <span className="text-sm font-normal text-gray-500">(opcional)</span></h2>
            {caseTemplates.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-md text-sm text-gray-500 text-center">
                <p>No hay plantillas de tareas configuradas.</p>
                <p className="mt-1">Se generará un checklist automático según las categorías seleccionadas.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Elige una plantilla para pre-poblar las tareas del expediente. Si no seleccionas ninguna, se generará un checklist automático.
                </p>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    form.caseTemplateId === "" ? "border-primary bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}>
                    <input
                      type="radio"
                      name="templateStep"
                      checked={form.caseTemplateId === ""}
                      onChange={() => update("caseTemplateId", "")}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">Checklist automático (IA)</p>
                      <p className="text-sm text-gray-500">Genera tareas según las categorías seleccionadas</p>
                    </div>
                  </label>
                  {caseTemplates.map((tpl: any) => (
                    <label key={tpl.id} className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      form.caseTemplateId === tpl.id ? "border-primary bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        name="templateStep"
                        checked={form.caseTemplateId === tpl.id}
                        onChange={() => update("caseTemplateId", tpl.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{tpl.name}</span>
                          {tpl.isDefault && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Por defecto</span>
                          )}
                          <span className="text-xs text-gray-400">{tpl.tasks?.length ?? 0} tareas</span>
                        </div>
                        {tpl.description && <p className="text-sm text-gray-500 mt-0.5">{tpl.description}</p>}
                        {tpl.categories?.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {tpl.categories.map((c: string) => (
                              <span key={c} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="flex-1 py-2 border rounded-md">Atras</button>
              <button onClick={() => setStep(5)} className="flex-1 py-2 bg-primary text-white rounded-md hover:bg-primary/90">Siguiente</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Consentimiento y confirmacion</h2>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
              <p className="font-medium mb-2">Aviso importante:</p>
              <p>Heredia no presta asesoramiento juridico ni fiscal individual.</p>
              <p>El autopiloto prepara acciones; el envio/ejecucion requiere aprobacion profesional.</p>
            </div>

            <label className="flex items-start gap-2">
              <input type="checkbox" checked={form.consentAccepted}
                onChange={(e) => update("consentAccepted", e.target.checked)}
                className="rounded mt-1" />
              <span className="text-sm">
                Confirmo que actuo con autorizacion del familiar/heredero/representante legal del fallecido
                y que los datos proporcionados son correctos.
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input type="checkbox" checked={form.termsAccepted}
                onChange={(e) => update("termsAccepted", e.target.checked)}
                className="rounded mt-1" />
              <span className="text-sm">
                Acepto los terminos de uso y la politica de privacidad de Heredia.
              </span>
            </label>

            {/* Summary */}
            <div className="p-4 bg-gray-50 rounded-md text-sm space-y-1">
              <p><strong>Fallecido:</strong> {form.deceasedName}</p>
              <p><strong>Solicitante:</strong> {form.contactName} ({form.relationship || "Sin especificar"})</p>
              <p><strong>Categorias:</strong> {form.categories.join(", ")}</p>
              {form.caseTemplateId && (
                <p><strong>Plantilla:</strong> {caseTemplates.find((t) => t.id === form.caseTemplateId)?.name ?? form.caseTemplateId}</p>
              )}
              {form.isUrgent && <p className="text-red-600 font-medium">URGENTE</p>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(4)} className="flex-1 py-2 border rounded-md">Atras</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50">
                {loading ? "Creando..." : "Crear expediente"}
              </button>
            </div>
          </div>
        )}

        {/*
          El mensaje se anuncia (`role="alert"`): antes aparecia en silencio al
          final de la tarjeta y quien no lo viera se quedaba pulsando
          "Siguiente" sin entender por que el asistente no avanzaba.
        */}
        {error && (
          <p role="alert" data-testid="error-asistente" className="mt-3 text-red-600 text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
