"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingStep } from "@/lib/onboarding";

interface Props {
  steps: OnboardingStep[];
  completed: number;
  total: number;
}

export function OnboardingPanel({ steps, completed, total }: Props) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const nextStep = steps.find((s) => !s.done);
  const progressPct = Math.round((completed / total) * 100);

  async function dismiss() {
    setDismissing(true);
    await fetch("/api/onboarding/dismiss", { method: "POST" });
    router.refresh();
  }

  async function seedSampleCase() {
    setSeeding(true);
    setSeedError(null);
    try {
      const res = await fetch("/api/onboarding/seed-sample-case", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSeedError(data?.error ?? "No se pudo crear el expediente de ejemplo");
        setSeeding(false);
        return;
      }
      const data = await res.json();
      if (data.caseId) {
        router.push(`/cases/${data.caseId}`);
      } else {
        router.refresh();
      }
    } catch {
      setSeedError("Error de red, intentalo de nuevo");
      setSeeding(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20 rounded-lg p-6 mb-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            Primeros pasos
          </p>
          <h2 className="text-lg font-bold text-gray-900">
            Configura BARITUR en 5 minutos
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {completed === total
              ? "Todo listo. Puedes cerrar este panel."
              : nextStep
                ? `Siguiente: ${nextStep.title.toLowerCase()}`
                : "Cuatro pasos cortos para dejar tu despacho operativo."}
          </p>
        </div>
        <button
          onClick={dismiss}
          disabled={dismissing}
          className="text-xs text-gray-500 hover:text-gray-900 whitespace-nowrap"
          title="Ocultar panel"
        >
          {dismissing ? "..." : "No mostrar mas"}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{completed} de {total} completados</span>
          <span className="font-semibold">{progressPct}%</span>
        </div>
        <div className="w-full bg-white rounded-full h-2 border border-primary/10">
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="grid gap-2">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition ${
              step.done
                ? "bg-white/60 border-green-200"
                : "bg-white border-gray-200 hover:border-primary/40"
            }`}
          >
            <div
              className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                step.done
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {step.done ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? "text-gray-500 line-through" : "text-gray-900"}`}>
                {step.title}
              </p>
              {!step.done && (
                <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
              )}
            </div>
            {!step.done && (
              <Link
                href={step.ctaHref}
                className="text-xs font-medium text-primary hover:underline whitespace-nowrap shrink-0"
              >
                {step.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Sample case shortcut */}
      <div className="mt-5 pt-5 border-t border-primary/15">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              ¿Quieres ver cómo es un expediente real?
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Cargamos un caso de ejemplo con causante, heredero, 10 tareas con plazos, Radar ISD activo y todo listo para explorar.
            </p>
          </div>
          <button
            onClick={seedSampleCase}
            disabled={seeding}
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition whitespace-nowrap"
          >
            {seeding ? "Creando..." : "Cargar expediente de ejemplo →"}
          </button>
        </div>
        {seedError && (
          <p className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
            {seedError}
          </p>
        )}
      </div>
    </div>
  );
}
