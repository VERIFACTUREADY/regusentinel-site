"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HerediaMark } from "@/components/heredia-mark";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    orgName: "", name: "", email: "", password: "", plan: "INICIA", acceptTerms: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function update(field: string, value: string | boolean) {
    setForm({ ...form, [field]: value });
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al registrar");
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.error) {
        router.push("/login");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* Left: showcase column */}
      <aside className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-12 xl:p-16 flex-col justify-between">
        <div className="absolute inset-0 dot-grid-light opacity-25" />
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-indigo-500/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl animate-float" />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-12">
            <HerediaMark className="w-10 h-10" variant="white" />
            <span className="text-xl font-semibold text-white tracking-tight">Heredia</span>
          </Link>

          <p className="text-xs font-bold uppercase tracking-wider text-blue-300 mb-3">
            14 días gratis · sin tarjeta
          </p>
          <h1 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight mb-5">
            Tu primer expediente
            <br />
            en menos de 5 minutos
          </h1>
          <p className="text-slate-300 leading-relaxed max-w-md">
            Setup remoto, plantillas y plazos legales precargados, Radar ISD activo
            desde el minuto uno y Portal Familia listo para tus 3 primeros expedientes.
          </p>

          <ul className="mt-8 space-y-3.5 max-w-md">
            {[
              "Radar ISD vigila plazos en los 17 calendarios autonómicos",
              "Portal Familia con tu marca para que la familia vea el expediente",
              "Borradores del Modelo 650 y 651 auto-rellenados",
              "Importa tu Excel actual en la primera llamada",
              "Cancela cuando quieras — no se cobra hasta el día 15",
            ].map((x) => (
              <li key={x} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-sm text-slate-200">{x}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-12">
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur p-5">
            <svg className="w-6 h-6 text-blue-300/40 mb-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.571-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z" />
            </svg>
            <p className="text-sm text-slate-200 leading-relaxed italic">
              Pasamos de 60 herencias al año a 150 con el mismo equipo. La automatización
              del Modelo 650 y el portal familia fueron los dos ejes que cambiaron todo.
            </p>
            <p className="text-xs text-slate-400 mt-3 font-semibold">Gestoría boutique · Madrid</p>
          </div>
        </div>
      </aside>

      {/* Right: form column */}
      <main className="flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-8">
            <HerediaMark className="w-8 h-8" />
            <span className="text-base font-semibold text-slate-900 tracking-tight">Heredia</span>
          </Link>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-7">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    s < step
                      ? "bg-emerald-500 text-white"
                      : s === step
                        ? "bg-primary text-white ring-4 ring-primary/15"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {s < step ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s
                  )}
                </div>
                {s < 3 && <div className={`flex-1 h-0.5 rounded-full ${s < step ? "bg-emerald-500" : "bg-slate-200"}`} />}
              </div>
            ))}
          </div>

          <div className="bg-white p-7 sm:p-8 rounded-2xl shadow-sm border">
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Datos de la organización</h2>
                  <p className="text-sm text-slate-500 mt-1">Empezamos por el nombre que va en facturas y en el Portal Familia.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Nombre de la gestoría / funeraria</label>
                  <input
                    type="text"
                    required
                    value={form.orgName}
                    onChange={(e) => update("orgName", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="Gestoría Ejemplo S.L."
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => (form.orgName ? setStep(2) : setError("Introduce el nombre"))}
                  className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/25"
                >
                  Siguiente →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Tu cuenta de administrador</h2>
                  <p className="text-sm text-slate-500 mt-1">Vas a ser quien invite al resto del equipo.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Nombre completo</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="Andrea Martín"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Email profesional</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="andrea@gestoriaejemplo.es"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={() =>
                      form.name && form.email && form.password.length >= 6
                        ? setStep(3)
                        : setError("Completa todos los campos")
                    }
                    className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/25"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Elige tu plan</h2>
                  <p className="text-sm text-slate-500 mt-1">14 días gratis. Sin tarjeta. Cancelas con un clic.</p>
                </div>
                <div className="space-y-2.5">
                  {[
                    { id: "INICIA", name: "Inicia", price: "149€/mes", desc: "Hasta 2 usuarios · 15 exp/mes · sin setup" },
                    { id: "DESPACHO", name: "Despacho", price: "349€/mes + 299€ setup", desc: "Hasta 5 usuarios · 50 exp/mes · pack banco + white-label", recommended: true },
                    { id: "FIRMA", name: "Firma", price: "749€/mes + 990€ setup", desc: "Hasta 20 usuarios · 200 exp/mes · SSO + onboarding asistido" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => update("plan", p.id)}
                      className={`w-full p-4 border-2 rounded-xl text-left transition relative ${
                        form.plan === p.id
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {"recommended" in p && p.recommended && (
                        <span className="absolute -top-2 right-3 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Recomendado</span>
                      )}
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-slate-900">{p.name}</span>
                        <span className="text-xs text-slate-500 font-mono">{p.price}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">{p.desc}</p>
                    </button>
                  ))}
                </div>

                <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-lg cursor-pointer border border-slate-200">
                  <input
                    type="checkbox"
                    checked={form.acceptTerms}
                    onChange={(e) => update("acceptTerms", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    He leído y acepto los{" "}
                    <a href="/legal/terminos" target="_blank" className="text-primary hover:underline">Términos de servicio</a>
                    {" "}y la{" "}
                    <a href="/legal/privacidad" target="_blank" className="text-primary hover:underline">Política de privacidad</a>.
                    Consiento el tratamiento de mis datos conforme al RGPD y la LOPDGDD.
                  </span>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={() => {
                      if (!form.acceptTerms) {
                        setError("Debes aceptar los términos y la política de privacidad");
                        return;
                      }
                      handleSubmit();
                    }}
                    disabled={loading}
                    className="flex-[1.4] py-2.5 bg-primary text-white font-bold rounded-lg hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:translate-y-0"
                  >
                    {loading ? "Creando tu cuenta…" : "Empezar 14 días gratis →"}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                <p className="text-rose-700 text-xs">{error}</p>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-5">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">Iniciar sesión</Link>
            {" "}·{" "}
            <Link href="/login?demo=1" className="font-semibold text-primary hover:underline">Probar la demo sin crear cuenta</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
