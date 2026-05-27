"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HerediaMark } from "@/components/heredia-mark";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al restablecer");
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 overflow-hidden px-4 py-12">
        <div className="absolute inset-0 dot-grid-light opacity-25 pointer-events-none" />
        <div className="relative bg-white rounded-2xl p-8 shadow-2xl shadow-black/30 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Enlace inválido</h1>
          <p className="text-slate-500 mb-4 text-sm">Este enlace no contiene un token válido.</p>
          <Link href="/forgot-password" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">
            Solicitar un nuevo enlace
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 overflow-hidden px-4 py-12">
      <div className="absolute inset-0 dot-grid-light opacity-25 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-indigo-500/20 rounded-full blur-3xl animate-float-slow pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-400/15 rounded-full blur-3xl animate-float pointer-events-none" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <HerediaMark className="w-10 h-10" />
          <span className="text-xl font-semibold text-white tracking-tight">Heredia</span>
        </Link>

        <div className="bg-white p-7 sm:p-8 rounded-2xl shadow-2xl shadow-black/30 border border-white/10">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Contraseña actualizada</h2>
              <p className="text-sm text-slate-600">
                Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <Link
                href="/login"
                className="inline-block mt-2 px-6 py-2.5 bg-primary text-white font-semibold rounded-lg hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/25"
              >
                Iniciar sesión →
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Nueva contraseña</h1>
                <p className="text-sm text-slate-500 mt-1">Elige una contraseña que recuerdes — mínimo 6 caracteres.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Nueva contraseña</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="Mínimo 6 caracteres"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Confirmar contraseña</label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                {error && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    <p className="text-rose-700 text-xs">{error}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:translate-y-0"
                >
                  {loading ? "Guardando…" : "Guardar contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
