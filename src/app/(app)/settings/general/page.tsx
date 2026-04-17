"use client";

import { useState, useEffect } from "react";

const PLAN_LABELS: Record<string, string> = {
  INICIA: "Inicia",
  DESPACHO: "Despacho",
  FIRMA: "Firma",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  trialing: "Periodo de prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelado",
};

export default function GeneralSettingsPage() {
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [retentionDays, setRetentionDays] = useState(90);

  useEffect(() => {
    fetch("/api/settings/general")
      .then((r) => r.json())
      .then((data) => {
        setOrg(data);
        setName(data.name || "");
        setRetentionDays(data.retentionDays ?? 90);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/settings/general", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, retentionDays }),
    });
    if (res.ok) {
      const data = await res.json();
      setName(data.name);
      setRetentionDays(data.retentionDays);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  const sub = org?.subscription;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ajustes generales</h1>

      {/* Org info */}
      <div className="bg-white p-6 rounded-lg border mb-6">
        <h2 className="font-semibold mb-4">Informacion de la organizacion</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Slug</p>
            <p className="font-mono text-gray-700">{org?.slug}</p>
          </div>
          <div>
            <p className="text-gray-500">Creada el</p>
            <p className="text-gray-700">{org?.createdAt ? new Date(org.createdAt).toLocaleDateString("es-ES") : "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Miembros</p>
            <p className="text-gray-700">{org?._count?.members ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-500">Expedientes totales</p>
            <p className="text-gray-700">{org?._count?.cases ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Subscription summary */}
      {sub && (
        <div className="bg-white p-6 rounded-lg border mb-6">
          <h2 className="font-semibold mb-4">Suscripcion</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Plan</p>
              <p className="font-semibold text-gray-900">{PLAN_LABELS[sub.plan] ?? sub.plan}</p>
            </div>
            <div>
              <p className="text-gray-500">Estado</p>
              <p className={`font-medium ${
                sub.status === "trialing" ? "text-blue-600" :
                sub.status === "active" ? "text-green-600" :
                sub.status === "past_due" ? "text-red-600" : "text-gray-600"
              }`}>
                {STATUS_LABELS[sub.status] ?? sub.status}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Facturacion</p>
              <p className="text-gray-700">{sub.interval === "ANNUAL" ? "Anual" : "Mensual"}</p>
            </div>
          </div>
          {sub.currentPeriodEnd && (
            <p className="text-xs text-gray-400 mt-3">
              {sub.status === "trialing" ? "Trial expira" : "Proximo cobro"}:{" "}
              {new Date(sub.currentPeriodEnd).toLocaleDateString("es-ES")}
            </p>
          )}
        </div>
      )}

      {/* Editable settings */}
      <div className="bg-white p-6 rounded-lg border mb-6">
        <h2 className="font-semibold mb-4">Configuracion</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la organizacion
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full max-w-md px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retencion de expedientes cerrados (dias)
            </label>
            <input
              type="number"
              min={30}
              max={3650}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-32 px-3 py-2 border rounded-md text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Numero de dias que se conservan los expedientes tras el cierre antes de su eliminacion automatica.
              Minimo 30, maximo 3650 (10 anos).
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">Guardado correctamente</span>
          )}
        </div>
      </div>

      {/* Data export */}
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="font-semibold mb-2">Exportacion de datos</h2>
        <p className="text-sm text-gray-500 mb-4">
          Puedes solicitar una exportacion completa de todos los datos de tu organizacion
          en formato JSON. El archivo se enviara por email al propietario de la cuenta.
        </p>
        <button
          className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50"
          onClick={() => alert("Funcionalidad disponible proximamente. Contacta soporte@baritur.pro.")}
        >
          Solicitar exportacion
        </button>
      </div>
    </div>
  );
}
