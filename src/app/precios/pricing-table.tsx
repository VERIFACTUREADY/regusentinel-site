"use client";

import { useState } from "react";
import Link from "next/link";

const plans = [
  {
    name: "Inicia",
    tagline: "Empieza a no perder plazos",
    monthly: 149,
    annual: 1490,
    setup: null,
    highlight: false,
    features: [
      "Hasta 2 usuarios",
      "15 expedientes/mes incluidos",
      "Motor de plazos ISD (Modelo 650)",
      "Checklist automático + plantillas base",
      "Portal familia básico",
      "Export PDF/ZIP del expediente",
      "Soporte 48h",
    ],
  },
  {
    name: "Despacho",
    tagline: "El plan operativo de tu asesoría",
    monthly: 349,
    annual: 3490,
    setup: 299,
    highlight: true,
    features: [
      "Hasta 5 usuarios",
      "50 expedientes/mes incluidos",
      "Pack banco unificado (BdE-ready)",
      "Plantillas versionadas con aprobación",
      "Reporting operativo (lead time, bloqueos)",
      "Portal familia white-label",
      "Notificaciones email automáticas ISD",
      "Soporte prioritario 24h",
    ],
  },
  {
    name: "Firma",
    tagline: "Para firmas con volumen y equipo",
    monthly: 749,
    annual: 7490,
    setup: 990,
    highlight: false,
    features: [
      "Hasta 20 usuarios",
      "200 expedientes/mes incluidos",
      "Roles y permisos avanzados, SSO",
      "API / webhooks + integraciones",
      "DPA extendido + auditorías",
      "Onboarding asistido + formación",
      "Soporte prioritario dedicado",
    ],
  },
] as const;

type Interval = "monthly" | "annual";

export function PricingTable() {
  const [interval, setInterval] = useState<Interval>("annual");

  const savingsLabel = (plan: (typeof plans)[number]) => {
    const saved = plan.monthly * 12 - plan.annual;
    return `Ahorras ${saved} EUR/año`;
  };

  return (
    <div>
      {/* Toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center bg-gray-100 rounded-full p-1 gap-1">
          <button
            onClick={() => setInterval("monthly")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              interval === "monthly"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setInterval("annual")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
              interval === "annual"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Anual
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
              −17%
            </span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const price = interval === "monthly" ? plan.monthly : Math.round(plan.annual / 12);
          return (
            <div
              key={plan.name}
              className={`relative p-8 rounded-xl border-2 ${
                plan.highlight
                  ? "border-primary shadow-lg"
                  : "border-gray-200"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3.5 left-6 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                  Recomendado
                </span>
              )}

              <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
              <p className="text-sm text-gray-500 mt-1 mb-6">{plan.tagline}</p>

              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">{price}</span>
                <span className="text-lg text-gray-700"> EUR</span>
                <span className="text-sm text-gray-500">/mes</span>
              </div>

              {interval === "annual" && (
                <p className="text-xs text-green-700 font-medium mb-1">
                  {savingsLabel(plan)} · {plan.annual} EUR/año
                </p>
              )}

              {plan.setup !== null ? (
                <p className="text-xs text-primary font-medium mb-6">
                  + {plan.setup} EUR setup único
                </p>
              ) : (
                <p className="text-xs text-gray-400 mb-6">Sin cuota de setup</p>
              )}

              <Link
                href="/#demo"
                className={`block w-full text-center py-3 rounded-lg font-semibold text-sm transition mb-8 ${
                  plan.highlight
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "border-2 border-primary text-primary hover:bg-primary/5"
                }`}
              >
                Solicitar demo
              </Link>

              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Managed note */}
      <div className="mt-8 border-2 border-gray-800 rounded-xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">Servicio gestionado</p>
          <h4 className="text-lg font-bold text-gray-900 mb-2">Heredia Managed</h4>
          <p className="text-sm text-gray-600 max-w-xl">
            Operación administrativa coordinada por expediente: intake, documentación, pack banco,
            plazos y comunicación con familia. Sin asesoría legal/fiscal.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold text-gray-900">
            490 EUR<span className="text-sm font-normal text-gray-500">/exp</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">330 EUR/exp con 30+/mes</p>
          <Link
            href="/#demo"
            className="inline-block mt-4 px-6 py-2 bg-gray-800 text-white text-sm font-semibold rounded-md hover:bg-gray-700"
          >
            Solicitar info
          </Link>
        </div>
      </div>
    </div>
  );
}
