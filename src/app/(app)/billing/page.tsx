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

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function UsageSection({
  usage,
  usageHistory,
  memberCount,
  memberLimit,
  caseLimit,
}: {
  usage: { casesCreated: number } | null;
  usageHistory: { month: string; casesCreated: number }[];
  memberCount: number;
  memberLimit: number;
  caseLimit: number;
}) {
  const casesUsed = usage?.casesCreated ?? 0;
  const casesPct = caseLimit > 0 ? Math.min(Math.round((casesUsed / caseLimit) * 100), 100) : 0;
  const membersPct = memberLimit > 0 ? Math.min(Math.round((memberCount / memberLimit) * 100), 100) : 0;
  const casesNear = casesPct >= 80;
  const casesOver = casesPct >= 100;
  const membersNear = membersPct >= 80;

  // Build a 6-slot history, filling gaps with 0
  const now = new Date();
  const slots = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = d.toISOString().slice(0, 7);
    const record = usageHistory.find((r) => r.month === key);
    return { label: MONTH_NAMES[d.getMonth()], count: record?.casesCreated ?? 0, isCurrent: i === 5 };
  });
  const maxCount = Math.max(...slots.map((s) => s.count), caseLimit > 0 ? 1 : 1);

  return (
    <div className="mt-4 border-t pt-5 space-y-4">
      <h3 className="font-medium text-sm text-gray-800">Uso del plan</h3>

      {/* Cases */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs text-gray-500">Expedientes este mes</span>
          <span className={`text-sm font-semibold tabular-nums ${casesOver ? "text-red-600" : casesNear ? "text-orange-600" : "text-gray-900"}`}>
            {casesUsed} / {caseLimit}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all ${casesOver ? "bg-red-500" : casesNear ? "bg-orange-500" : "bg-indigo-500"}`}
            style={{ width: `${casesPct}%` }}
          />
        </div>
        {casesOver && (
          <p className="text-xs text-red-600 mt-1 font-medium">Límite alcanzado — los expedientes adicionales tienen coste extra.</p>
        )}
        {casesNear && !casesOver && (
          <p className="text-xs text-orange-600 mt-1">{caseLimit - casesUsed} expedientes restantes este mes.</p>
        )}
      </div>

      {/* Members */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs text-gray-500">Usuarios</span>
          <span className={`text-sm font-semibold tabular-nums ${membersNear ? "text-orange-600" : "text-gray-900"}`}>
            {memberCount} / {memberLimit}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${membersNear ? "bg-orange-400" : "bg-gray-400"}`}
            style={{ width: `${membersPct}%` }}
          />
        </div>
      </div>

      {/* 6-month chart */}
      {usageHistory.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Expedientes creados — últimos 6 meses</p>
          <div className="flex items-end gap-1.5" style={{ height: 56 }}>
            {slots.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end" style={{ height: 40 }}>
                  <div
                    className={`w-full rounded-t transition-all ${s.isCurrent ? "bg-indigo-500" : "bg-gray-200"}`}
                    style={{ height: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 8 : 0)}%` }}
                    title={`${s.label}: ${s.count} expedientes`}
                  />
                </div>
                <span className="text-xs text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [usageHistory, setUsageHistory] = useState<{ month: string; casesCreated: number }[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [billingInterval, setBillingInterval] = useState<Interval>("MONTHLY");
  const [busyPlan, setBusyPlan] = useState<PlanKey | null>(null);

  useEffect(() => {
    fetch("/api/billing")
      .then(async (r) => {
        if (r.status === 403) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        const data = await r.json();
        setSubscription(data.subscription);
        setUsage(data.usage);
        setUsageHistory(data.usageHistory ?? []);
        setMemberCount(data.memberCount ?? 0);
        if (data.subscription?.interval) setBillingInterval(data.subscription.interval);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  if (accessDenied) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Facturacion</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-amber-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold">Acceso restringido</p>
              <p className="text-sm mt-1">
                Solo el propietario de la organizacion puede gestionar la facturacion y el plan.
                Contacta con el administrador de tu cuenta si necesitas realizar cambios.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = (subscription?.plan as PlanKey) || "INICIA";
  const currentInterval = (subscription?.interval as Interval) || "MONTHLY";
  const currentDetail = planCatalog[currentPlan];
  const currentPrice = currentInterval === "ANNUAL" ? currentDetail.annual : currentDetail.monthly;
  const isTrialing = subscription?.status === "trialing";
  const trialEnd = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const trialDaysLeft = isTrialing && trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const STATUS_LABELS: Record<string, string> = {
    active: "Activo",
    trialing: "Periodo de prueba",
    past_due: "Pago pendiente",
    canceled: "Cancelado",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Facturacion</h1>

      {/* Trial alert */}
      {isTrialing && trialDaysLeft !== null && (
        <div className={`p-4 rounded-lg border-2 mb-6 ${
          trialDaysLeft <= 3
            ? "bg-red-50 border-red-300"
            : "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={`font-semibold ${trialDaysLeft <= 3 ? "text-red-800" : "text-blue-800"}`}>
                {trialDaysLeft <= 0
                  ? "Tu periodo de prueba expira hoy"
                  : trialDaysLeft === 1
                    ? "Tu periodo de prueba expira manana"
                    : `Tu periodo de prueba expira en ${trialDaysLeft} dias`}
              </h2>
              <p className={`text-sm mt-1 ${trialDaysLeft <= 3 ? "text-red-700" : "text-blue-700"}`}>
                Plan {currentDetail.label} en prueba hasta el{" "}
                {trialEnd!.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.
                Activa tu suscripcion para no perder acceso.
              </p>
            </div>
            <div className={`text-3xl font-bold tabular-nums ${trialDaysLeft <= 3 ? "text-red-600" : "text-blue-600"}`}>
              {trialDaysLeft}d
            </div>
          </div>
          <div className="mt-3 h-2 bg-white/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${trialDaysLeft <= 3 ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${Math.max(5, 100 - (trialDaysLeft / 14) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white p-6 rounded-lg border mb-8">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="text-lg font-semibold">Plan actual: {currentDetail.label}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Estado:{" "}
              <span className={`font-medium ${
                isTrialing ? "text-blue-600" : subscription?.status === "past_due" ? "text-red-600" : "text-green-600"
              }`}>
                {STATUS_LABELS[subscription?.status] || subscription?.status || "Activo"}
              </span>
            </p>
            {!isTrialing && (
              <p className="text-sm text-primary font-medium mt-1">
                {fmtEUR(currentPrice)}/{currentInterval === "ANNUAL" ? "ano" : "mes"}
              </p>
            )}
            {isTrialing && (
              <p className="text-sm text-blue-600 font-medium mt-1">
                Gratis durante el periodo de prueba
              </p>
            )}
            {subscription?.currentPeriodEnd && !isTrialing && (
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

        <UsageSection
          usage={usage}
          usageHistory={usageHistory}
          memberCount={memberCount}
          memberLimit={currentDetail.maxUsers}
          caseLimit={currentDetail.includedCases}
        />
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
        Precios sin IVA. Facturacion en EUR. Soporte: soporte@heredia.app.
      </p>
    </div>
  );
}
