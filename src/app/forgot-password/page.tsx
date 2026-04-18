"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar");
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary">BARITUR PRO</Link>
          <p className="text-gray-500 mt-2">Recuperar contrasena</p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm border">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold">Revisa tu email</h2>
              <p className="text-sm text-gray-600">
                Si existe una cuenta con <strong>{email}</strong>, recibiras un enlace para restablecer tu contrasena. El enlace expira en 1 hora.
              </p>
              <Link href="/login" className="inline-block mt-4 text-sm text-primary hover:underline">
                Volver a iniciar sesion
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-6">
                Introduce tu email y te enviaremos un enlace para restablecer tu contrasena.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="tu@email.com"
                  />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>
              </form>
              <p className="mt-4 text-center text-sm text-gray-500">
                <Link href="/login" className="text-primary hover:underline">Volver a iniciar sesion</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
