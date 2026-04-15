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
        setError("Email o contrasena incorrectos");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Error de conexion");
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
      setError("Error de conexion");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">BARITUR PRO</h1>
          <p className="text-gray-500 mt-2">Accede a tu cuenta</p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm border">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="tu@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••" />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
            )}

            <button type="submit" disabled={loading || demoLoading}
              className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary/90 font-medium disabled:opacity-50">
              {loading ? "Accediendo..." : "Iniciar sesion"}
            </button>
          </form>

          {demoEnabled && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-gray-400">o</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDemo}
                disabled={loading || demoLoading}
                className="w-full py-2 border border-primary text-primary rounded-md hover:bg-primary/5 font-medium disabled:opacity-50"
              >
                {demoLoading ? "Entrando..." : "Probar demo sin registro"}
              </button>
              <p className="mt-2 text-xs text-gray-400 text-center">
                Datos ficticios. Se reinician cada dia.
              </p>
            </>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            <Link href="/onboarding" className="text-primary hover:underline">
              Crear nueva cuenta
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          BARITUR no presta asesoramiento juridico ni fiscal individual.
        </p>
      </div>
    </div>
  );
}
