"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HerediaMark } from "@/components/heredia-mark";

interface Props {
  demoEnabled: boolean;
  ssoEnabled?: boolean;
}

export function LoginForm({ demoEnabled, ssoEnabled = false }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
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
        email: "operador@heredia.app",
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
          <HerediaMark className="w-10 h-10" />
          <span className="text-xl font-semibold text-white tracking-tight">Heredia</span>
        </Link>

        <div className="bg-white p-7 sm:p-8 rounded-2xl shadow-2xl shadow-black/30 border border-white/10">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bienvenido de vuelta</h1>
            <p className="text-sm text-slate-500 mt-1">Accede a tus expedientes y al Radar ISD.</p>
          </div>

          {ssoEnabled && (
            <>
              <button
                type="button"
                onClick={async () => {
                  setSsoLoading(true);
                  const { signIn: ssoSignIn } = await import("next-auth/react");
                  await ssoSignIn("google", { callbackUrl: "/dashboard" });
                }}
                disabled={loading || demoLoading || ssoLoading}
                className="w-full mb-5 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition disabled:opacity-50 inline-flex items-center justify-center gap-2.5"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.96h5.49c-.24 1.4-1.74 4.1-5.49 4.1-3.3 0-6-2.73-6-6.1s2.7-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.84 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.54 0 9.21-3.9 9.21-9.38 0-.63-.07-1.11-.16-1.59H12z" />
                  <path fill="#4285F4" d="M21.4 12.22c0-.63-.07-1.11-.16-1.59H12v3.96h5.49c-.21 1.27-.95 2.34-2.02 3.07l3.27 2.54c1.92-1.78 3.03-4.4 3.03-7.51-.07-.16-.16-.32-.21-.47z" />
                </svg>
                {ssoLoading ? "Redirigiendo…" : "Continuar con Google"}
              </button>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400 uppercase tracking-wider font-semibold">o con email</span>
                </div>
              </div>
            </>
          )}

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
              disabled={loading || demoLoading || ssoLoading}
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
                disabled={loading || demoLoading || ssoLoading}
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
          Heredia no presta asesoramiento jurídico ni fiscal individual.
        </p>
      </div>
    </div>
  );
}
