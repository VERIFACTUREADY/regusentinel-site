"use client";

import { useState, useEffect } from "react";

type PlanKey = "INICIA" | "DESPACHO" | "FIRMA";
type Interval = "MONTHLY" | "ANNUAL";

const planCatalog: Record<PlanKey, {
  label: string;
  tagline: string;
  monthly: number;
  annual: number;
  setupFee: number;
  includedCases: number;
  maxUsers: number;
  features: string[];
  recommended?: boolean;
}> = {
  INICIA: {
    label: "Inicia",
    tagline: "Empieza a no perder plazos",
    monthly: 149,
    annual: 1490,
    setupFee: 0,
    includedCases: 15,
    maxUsers: 2,
    features: [
      "Hasta 2 usuarios",
      "15 expedientes/mes incluidos",
      "Motor de plazos ISD (Modelo 650)",
      "Checklist automatico + plantillas base",
      "Portal familia basico",
      "Export PDF/ZIP",
    ],
  },
  DESPACHO: {
    label: "Despacho",
    tagline: "El plan operativo de tu asesoria",
    monthly: 349,
    annual: 3490,
    setupFee: 299,
    includedCases: 50,
    maxUsers: 5,
    features: [
      "Hasta 5 usuarios",
      "50 expedientes/mes incluidos",
      "Pack banco unificado (BdE-ready)",
      "Plantillas versionadas + aprobacion",
      "Reporting operativo (lead time, bloqueos)",
      "Portal familia white-label",
      "Notificaciones email automaticas",
      "SLA soporte 24h",
    ],
    recommended: true,
  },
  FIRMA: {
    label: "Firma",
    tagline: "Para firmas con volumen y equipo",
    monthly: 749,
    annual: 7490,
    setupFee: 990,
    includedCases: 200,
    maxUsers: 20,
    features: [
      "Hasta 20 usuarios",
      "200 expedientes/mes incluidos",
      "Roles/permisos avanzados, SSO",
      "API/webhooks + integraciones",
      "DPA extendido + auditorias",
      "Onboarding asistido + formacion",
      "Soporte prioritario",
    ],
  },
};

const fmtEUR = (n: number) => new Intl.NumberFormat("es-ES", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
}).format(n);

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<Interval>("MONTHLY");
  const [busyPlan, setBusyPlan] = useState<PlanKey | null>(null);

  useEffect(() => {
    fetch("/api/billing").then((r) => r.json()).then((data) => {
      setSubscription(data.subscription);
      setUsage(data.usage);
      if (data.subscription?.interval) setBillingInterval(data.subscription.interval);
      setLoading(false);
    });
  }, []);

  async function startCheckout(plan: PlanKey) {
    setBusyPlan(plan);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: billingInterval }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Error al crear sesion de pago");
      }
    } finally {
      setBusyPlan(null);
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

  const currentPlan = (subscription?.plan as PlanKey) || "INICIA";
  const currentInterval = (subscription?.interval as Interval) || "MONTHLY";
  const currentDetail = planCatalog[currentPlan];
  const currentPrice = currentInterval === "ANNUAL" ? currentDetail.annual : currentDetail.monthly;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Facturacion</h1>

      {/* Current plan */}
      <div className="bg-white p-6 rounded-lg border mb-8">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="text-lg font-semibold">Plan actual: {currentDetail.label}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Estado: <span className="font-medium">{subscription?.status || "active"}</span>
            </p>
            <p className="text-sm text-primary font-medium mt-1">
              {fmtEUR(currentPrice)}/{currentInterval === "ANNUAL" ? "ano" : "mes"}
            </p>
            {subscription?.currentPeriodEnd && (
              <p className="text-sm text-gray-500">
                Renovacion: {new Date(subscription.currentPeriodEnd).toLocaleDateString("es-ES")}
              </p>
            )}
            {subscription?.setupFeePaid && (
              <p className="text-xs text-gray-500 mt-1">Setup fee abonado</p>
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
              {" "}/ {currentDetail.includedCases} incluidos
            </p>
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Comparar planes</h2>

        {/* Billing interval toggle */}
        <div className="inline-flex rounded-md border bg-white p-1 text-sm">
          <button
            onClick={() => setBillingInterval("MONTHLY")}
            className={`px-3 py-1 rounded ${billingInterval === "MONTHLY" ? "bg-primary text-white" : "text-gray-600"}`}
          >
            Mensual
          </button>
          <button
            onClick={() => setBillingInterval("ANNUAL")}
            className={`px-3 py-1 rounded ${billingInterval === "ANNUAL" ? "bg-primary text-white" : "text-gray-600"}`}
          >
            Anual <span className={`ml-1 text-xs ${billingInterval === "ANNUAL" ? "text-white/90" : "text-green-600"}`}>-17%</span>
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        El prepago anual equivale a 2 meses gratis. Despacho y Firma incluyen cuota unica de setup (onboarding, configuracion, migracion de plantillas).
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {(Object.keys(planCatalog) as PlanKey[]).map((key) => {
          const plan = planCatalog[key];
          const price = billingInterval === "ANNUAL" ? plan.annual : plan.monthly;
          const isCurrent = currentPlan === key && currentInterval === billingInterval;
          const unit = billingInterval === "ANNUAL" ? "/ano" : "/mes";

          return (
            <div key={key} className={`bg-white p-6 rounded-lg border-2 relative ${
              isCurrent ? "border-primary" : plan.recommended ? "border-gray-900" : "border-gray-200"
            }`}>
              {plan.recommended && !isCurrent && (
                <span className="absolute -top-3 left-4 bg-gray-900 text-white text-xs px-2 py-1 rounded">
                  Recomendado
                </span>
              )}
              <h3 className="text-lg font-bold">{plan.label}</h3>
              <p className="text-xs text-gray-500 mb-3">{plan.tagline}</p>
              <p className="text-3xl font-bold">
                {fmtEUR(price)}
                <span className="text-sm font-normal text-gray-500">{unit}</span>
              </p>
              {billingInterval === "ANNUAL" && plan.monthly > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  Equivale a {fmtEUR(Math.round(plan.annual / 12))}/mes (ahorras {fmtEUR(plan.monthly * 12 - plan.annual)})
                </p>
              )}
              {plan.setupFee > 0 ? (
                <p className="text-xs text-gray-600 mt-2">
                  + {fmtEUR(plan.setupFee)} <span className="text-gray-500">cuota unica de setup</span>
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-2">Sin cuota de setup</p>
              )}

              <ul className="space-y-2 text-sm text-gray-600 mt-4 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">&#10003;</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full py-2 text-center text-sm font-medium text-primary bg-primary/10 rounded-md">
                  Plan actual
                </div>
              ) : (
                <button
                  onClick={() => startCheckout(key)}
                  disabled={busyPlan !== null}
                  className="w-full py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {busyPlan === key ? "Redirigiendo..." : `Elegir ${plan.label}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-6">
        Precios sin IVA. Facturacion en EUR. Soporte: soporte@baritur.com.
      </p>
    </div>
  );
}
