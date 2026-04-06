"use client";

import { useState, useEffect } from "react";

const planFeatures: Record<string, string[]> = {
  STARTER: ["1-3 usuarios", "10 expedientes/mes", "Checklist + plantillas base", "Portal familia", "Export basico"],
  PRO: ["Hasta 10 usuarios", "Expedientes ilimitados", "Templates personalizados", "IA Autopilot completo", "Reporting avanzado"],
  ENTERPRISE: ["Usuarios ilimitados", "SLA personalizado", "Integraciones custom", "Soporte prioritario", "BARITUR Managed"],
};

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing").then((r) => r.json()).then((data) => {
      setSubscription(data.subscription);
      setUsage(data.usage);
      setLoading(false);
    });
  }, []);

  async function changePlan(plan: string) {
    if (plan === "ENTERPRISE") {
      alert("Contacta con ventas para el plan Enterprise: sales@baritur.com");
      return;
    }
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    }
  }

  async function openPortal() {
    const res = await fetch("/api/billing/portal", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Facturacion</h1>

      {/* Current plan */}
      <div className="bg-white p-6 rounded-lg border mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">Plan actual: {subscription?.plan || "STARTER"}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Estado: <span className="font-medium">{subscription?.status || "active"}</span>
            </p>
            {subscription?.currentPeriodEnd && (
              <p className="text-sm text-gray-500">
                Renovacion: {new Date(subscription.currentPeriodEnd).toLocaleDateString("es-ES")}
              </p>
            )}
          </div>
          {subscription?.stripeCustomerId && (
            <button onClick={openPortal}
              className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">
              Gestionar facturacion
            </button>
          )}
        </div>

        {usage && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <p className="text-sm">
              <strong>Uso este mes:</strong> {usage.casesCreated} expedientes creados
              {subscription?.plan === "STARTER" && " / 10 incluidos"}
            </p>
          </div>
        )}
      </div>

      {/* Plans */}
      <h2 className="text-lg font-semibold mb-4">Comparar planes</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {(["STARTER", "PRO", "ENTERPRISE"] as const).map((plan) => (
          <div key={plan} className={`bg-white p-6 rounded-lg border-2 ${
            subscription?.plan === plan ? "border-primary" : "border-gray-200"
          }`}>
            <h3 className="text-lg font-bold">{plan}</h3>
            <p className="text-2xl font-bold my-3">
              {plan === "STARTER" ? "49EUR" : plan === "PRO" ? "149EUR" : "A medida"}
              {plan !== "ENTERPRISE" && <span className="text-sm font-normal">/mes</span>}
            </p>
            <ul className="space-y-2 text-sm text-gray-600 mb-6">
              {planFeatures[plan].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-green-500">&#10003;</span> {f}
                </li>
              ))}
            </ul>
            {subscription?.plan === plan ? (
              <div className="w-full py-2 text-center text-sm font-medium text-primary bg-primary/10 rounded-md">
                Plan actual
              </div>
            ) : (
              <button onClick={() => changePlan(plan)}
                className="w-full py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90">
                {plan === "ENTERPRISE" ? "Contactar" : "Cambiar a " + plan}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
