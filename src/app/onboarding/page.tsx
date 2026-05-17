"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">BARITUR PRO</h1>
          <p className="text-gray-500 mt-2">Configura tu cuenta en 3 pasos</p>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center mb-8 gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s <= step ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
            }`}>{s}</div>
          ))}
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm border">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Datos de la organizacion</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la gestoria/funeraria</label>
                <input type="text" required value={form.orgName}
                  onChange={(e) => update("orgName", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md" placeholder="Gestoria Ejemplo S.L." />
              </div>
              <button onClick={() => form.orgName ? setStep(2) : setError("Introduce el nombre")}
                className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                Siguiente
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Tu cuenta de administrador</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" required value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
                <input type="password" required value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md" placeholder="Minimo 6 caracteres" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 py-2 border rounded-md hover:bg-gray-50">Atras</button>
                <button onClick={() => form.name && form.email && form.password.length >= 6 ? setStep(3) : setError("Completa todos los campos")}
                  className="flex-1 py-2 bg-primary text-white rounded-md hover:bg-primary/90">Siguiente</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Selecciona tu plan</h2>
              <p className="text-sm text-gray-500">Todos los planes incluyen 14 dias de prueba gratuita. Sin tarjeta.</p>
              <div className="space-y-3">
                {[
                  { id: "INICIA", name: "Inicia", price: "149EUR/mes", desc: "Hasta 2 usuarios, 15 exp/mes, sin setup" },
                  { id: "DESPACHO", name: "Despacho", price: "349EUR/mes + 299EUR setup", desc: "Hasta 5 usuarios, 50 exp/mes, pack banco + white-label", recommended: true },
                  { id: "FIRMA", name: "Firma", price: "749EUR/mes + 990EUR setup", desc: "Hasta 20 usuarios, 200 exp/mes, SSO + onboarding asistido" },
                ].map((p) => (
                  <button key={p.id} onClick={() => update("plan", p.id)}
                    className={`w-full p-4 border-2 rounded-lg text-left transition relative ${
                      form.plan === p.id ? "border-primary bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}>
                    {"recommended" in p && p.recommended && (
                      <span className="absolute -top-2 right-3 bg-primary text-white text-[10px] px-2 py-0.5 rounded">Recomendado</span>
                    )}
                    <div className="flex justify-between">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-sm text-gray-500">{p.price}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{p.desc}</p>
                  </button>
                ))}
              </div>

              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acceptTerms}
                  onChange={(e) => update("acceptTerms", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  He leido y acepto los{" "}
                  <a href="/legal/terminos" target="_blank" className="text-primary underline">Terminos de servicio</a>
                  {" "}y la{" "}
                  <a href="/legal/privacidad" target="_blank" className="text-primary underline">Politica de privacidad</a>.
                  Consiento el tratamiento de mis datos conforme al RGPD y la LOPDGDD.
                </span>
              </label>

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 py-2 border rounded-md hover:bg-gray-50">Atras</button>
                <button
                  onClick={() => {
                    if (!form.acceptTerms) {
                      setError("Debes aceptar los terminos y la politica de privacidad");
                      return;
                    }
                    handleSubmit();
                  }}
                  disabled={loading}
                  className="flex-1 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50">
                  {loading ? "Creando..." : "Empezar trial gratuito"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
        </div>
      </div>
    </div>
  );
}
