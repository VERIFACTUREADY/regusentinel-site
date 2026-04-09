"use client";

import { useState, useEffect } from "react";

const planDetails: Record<string, { label: string; price: string; variable: string; features: string[] }> = {
  STARTER: {
    label: "PRO Starter",
    price: "149EUR/mes",
    variable: "+ 12EUR/expediente",
    features: ["2 usuarios", "15 expedientes/mes incluidos", "Motor de checklist + plazos", "Plantillas base", "Portal familia basico", "Export PDF/ZIP", "Audit trail basico"],
  },
  PRO: {
    label: "PRO Growth",
    price: "399EUR/mes",
    variable: "+ 9EUR/expediente",
    features: ["5 usuarios", "50 expedientes/mes incluidos", "Reglas avanzadas (bloqueos/dependencias)", "Plantillas versionadas + aprobacion", "Reporting (lead time, bloqueos)", "Roles/permisos completos", "API/webhooks", "SLA soporte 24h"],
  },
  ENTERPRISE: {
    label: "PRO Enterprise",
    price: "A medida",
    variable: "Contactar",
    features: ["Usuarios ilimitados", "SSO, SCIM, entornos segregados", "DPA extendido + auditorias", "SLAs enterprise", "Integraciones custom (ERP, firma-e)", "Data residency a medida", "BARITUR Managed disponible"],
  },
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

  const currentPlan = subscription?.plan || "STARTER";
  const currentDetail = planDetails[currentPlan];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Facturacion</h1>

      {/* Current plan */}
      <div className="bg-white p-6 rounded-lg border mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">Plan actual: {currentDetail.label}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Estado: <span className="font-medium">{subscription?.status || "active"}</span>
            </p>
            <p className="text-sm text-primary font-medium mt-1">
              {currentDetail.price} {currentDetail.variable}
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
              {currentPlan === "STARTER" && " / 15 incluidos"}
              {currentPlan === "PRO" && " / 50 incluidos"}
            </p>
          </div>
        )}
      </div>

      {/* Plans */}
      <h2 className="text-lg font-semibold mb-4">Comparar planes</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {(["STARTER", "PRO", "ENTERPRISE"] as const).map((plan) => {
          const detail = planDetails[plan];
          return (
            <div key={plan} className={`bg-white p-6 rounded-lg border-2 ${
              currentPlan === plan ? "border-primary" : "border-gray-200"
            }`}>
              <h3 className="text-lg font-bold">{detail.label}</h3>
              <p className="text-2xl font-bold my-2">{detail.price}</p>
              <p className="text-sm text-primary font-medium mb-4">{detail.variable}</p>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                {detail.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-green-500">&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              {currentPlan === plan ? (
                <div className="w-full py-2 text-center text-sm font-medium text-primary bg-primary/10 rounded-md">
                  Plan actual
                </div>
              ) : (
                <button onClick={() => changePlan(plan)}
                  className="w-full py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90">
                  {plan === "ENTERPRISE" ? "Contactar" : `Cambiar a ${detail.label}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
