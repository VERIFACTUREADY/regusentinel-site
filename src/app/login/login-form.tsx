"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Props {
  demoEnabled: boolean;
}

export function LoginForm({ demoEnabled }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoAutoTriggered = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Email o contraseña incorrectos");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  // Deep-link from landing: /login?demo=1 auto-signs in as operator.
  useEffect(() => {
    if (!demoEnabled) return;
    if (demoAutoTriggered.current) return;
    if (searchParams?.get("demo") !== "1") return;
    demoAutoTriggered.current = true;
    void handleDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoEnabled, searchParams]);

  async function handleDemo() {
    setError("");
    setDemoLoading(true);
    try {
      const result = await signIn("credentials", {
        email: "operador@baritur.com",
        password: "admin123",
        redirect: false,
      });
      if (result?.error) {
        setError("No se pudo iniciar la demo");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 overflow-hidden px-4 py-12">
      <div className="absolute inset-0 dot-grid-light opacity-25 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-indigo-500/20 rounded-full blur-3xl animate-float-slow pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-400/15 rounded-full blur-3xl animate-float pointer-events-none" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center shadow-lg shadow-primary/40">
            <span className="text-white font-bold text-lg">B</span>
          </span>
          <span className="text-xl font-bold text-white tracking-tight">BARITUR PRO</span>
        </Link>

        <div className="bg-white p-7 sm:p-8 rounded-2xl shadow-2xl shadow-black/30 border border-white/10">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bienvenido de vuelta</h1>
            <p className="text-sm text-slate-500 mt-1">Accede a tus expedientes y al Radar ISD.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="tu@email.com"
                autoFocus
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">Contraseña</label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  ¿Olvidada?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="••••••"
              />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                <p className="text-rose-700 text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || demoLoading}
              className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:translate-y-0"
            >
              {loading ? "Accediendo…" : "Iniciar sesión"}
            </button>
          </form>

          {demoEnabled && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400 uppercase tracking-wider font-semibold">o explora</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDemo}
                disabled={loading || demoLoading}
                className="w-full py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:border-primary hover:text-primary transition disabled:opacity-50"
              >
                {demoLoading ? "Entrando…" : "Probar la demo sin registro"}
              </button>
              <p className="mt-2 text-[11px] text-slate-400 text-center">
                Datos ficticios · se reinician cada día
              </p>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-300 mt-6">
          ¿Sin cuenta?{" "}
          <Link href="/onboarding" className="font-semibold text-white hover:underline">
            Crear cuenta nueva
          </Link>
        </p>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          BARITUR no presta asesoramiento jurídico ni fiscal individual.
        </p>
      </div>
    </div>
  );
}
