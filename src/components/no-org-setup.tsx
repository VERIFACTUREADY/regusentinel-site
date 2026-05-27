"use client";

import { useState } from "react";

/**
 * Pantalla que ve un usuario autenticado cuya cuenta todavía no tiene una
 * organización. Le permite crearla en un paso. No es un callejón sin salida.
 */
export function NoOrgSetup({ userName }: { userName?: string | null }) {
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (orgName.trim().length < 2) {
      setError("Escribe el nombre de tu despacho u organización.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/create-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: orgName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo crear la organización.");
        setLoading(false);
        return;
      }
      // Recarga completa: el callback de sesión vuelve a leer la membresía
      // y el panel se carga ya con la organización activa.
      window.location.assign("/dashboard");
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-4a1 1 0 011-1h2a1 1 0 011 1v4m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {userName ? `Bienvenido/a, ${userName}` : "Bienvenido/a a Heredia"}
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Solo falta un paso: crea tu organización para empezar a gestionar expedientes.
          </p>
        </div>

        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nombre de tu despacho u organización
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Ej. Gestoría Pérez & Asociados"
              maxLength={200}
              autoFocus
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 transition-all"
          >
            {loading ? "Creando tu organización..." : "Crear organización y empezar"}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Incluye 14 días de prueba y plantillas de expediente precargadas.
          </p>
        </form>
      </div>
    </div>
  );
}
