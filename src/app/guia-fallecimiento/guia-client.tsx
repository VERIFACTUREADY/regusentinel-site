"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  buildPostMortemGuide,
  summarizeGuide,
  PHASE_LABELS,
  type GuideInput,
  type GuideStep,
  type GuideUrgency,
} from "@/lib/post-mortem-guide";

const URGENCY_STYLE: Record<GuideUrgency, { label: string; dot: string; text: string; bg: string }> = {
  overdue: { label: "Plazo vencido", dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
  now: { label: "Urgente", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  soon: { label: "Próximo", dot: "bg-blue-500", text: "text-blue-700", bg: "bg-white border-gray-200" },
  later: { label: "Más adelante", dot: "bg-gray-300", text: "text-gray-500", bg: "bg-white border-gray-200" },
};

const CATEGORY_ICON: Record<GuideStep["category"], string> = {
  certificados: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  banca: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  fiscal: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  seguros: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  inmuebles: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4",
  vehiculos: "M8 7h8m-8 0a2 2 0 00-2 2v6h12V9a2 2 0 00-2-2M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M5 15h14",
  negocio: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-12h2m-2 4h2m4-4h2m-2 4h2",
  administrativo: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
};

interface Question {
  key: keyof GuideInput;
  label: string;
  help?: string;
}

const BOOLEAN_QUESTIONS: Question[] = [
  { key: "hasWill", label: "¿Sabes si la persona dejó testamento?", help: "Si no estás seguro, déjalo en 'No': la guía incluirá la declaración de herederos." },
  { key: "hasRealEstate", label: "¿Hay viviendas, locales o terrenos en la herencia?" },
  { key: "hasLifeInsurance", label: "¿Tenía seguros de vida?", help: "Si no lo sabes con certeza, márcalo: el certificado RCSV lo confirmará." },
  { key: "hasVehicles", label: "¿Hay vehículos a su nombre?" },
  { key: "hasBusiness", label: "¿Era titular de un negocio o empresa?" },
];

function formatDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function GuiaClient() {
  const [deathDate, setDeathDate] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = BOOLEAN_QUESTIONS.every((q) => answers[q.key] !== undefined);

  const input: GuideInput = useMemo(
    () => ({
      deathDate: deathDate ? new Date(deathDate) : null,
      province: null,
      hasWill: answers.hasWill ?? false,
      hasRealEstate: answers.hasRealEstate ?? false,
      hasLifeInsurance: answers.hasLifeInsurance ?? false,
      hasVehicles: answers.hasVehicles ?? false,
      hasBusiness: answers.hasBusiness ?? false,
    }),
    [deathDate, answers]
  );

  const steps = useMemo(() => (submitted ? buildPostMortemGuide(input) : []), [submitted, input]);
  const summary = useMemo(() => (submitted ? summarizeGuide(steps, input) : null), [submitted, steps, input]);

  // Group by phase
  const byPhase = useMemo(() => {
    const phases: GuideStep["phase"][] = [
      "inmediato", "primera-semana", "primer-mes", "meses-2-5", "antes-6-meses", "posterior",
    ];
    return phases
      .map((phase) => ({ phase, steps: steps.filter((s) => s.phase === phase) }))
      .filter((g) => g.steps.length > 0);
  }, [steps]);

  function setAnswer(key: string, value: boolean) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  function reset() {
    setSubmitted(false);
    setAnswers({});
    setDeathDate("");
  }

  if (submitted && summary) {
    return (
      <div className="space-y-5">
        {/* Summary */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-6 sm:p-8 text-white">
          <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">Tu plan personalizado</p>
          <p className="text-2xl sm:text-3xl font-bold mb-3">
            {summary.totalSteps} trámites organizados por fase
          </p>
          {summary.daysUntilISD !== null && (
            <p className="text-sm text-blue-100">
              {summary.daysUntilISD > 0 ? (
                <>Te quedan <strong className="text-white">{summary.daysUntilISD} días</strong> para presentar el Impuesto de Sucesiones (Modelo 650).</>
              ) : (
                <><strong className="text-rose-300">El plazo del Modelo 650 ya venció hace {Math.abs(summary.daysUntilISD)} días.</strong> Presenta cuanto antes para minimizar recargos.</>
              )}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {summary.overdue > 0 && (
              <span className="text-xs bg-rose-500/20 border border-rose-400/30 text-rose-200 rounded-full px-3 py-1">
                {summary.overdue} con plazo vencido
              </span>
            )}
            {summary.now > 0 && (
              <span className="text-xs bg-amber-500/20 border border-amber-400/30 text-amber-200 rounded-full px-3 py-1">
                {summary.now} urgentes
              </span>
            )}
            {summary.soon > 0 && (
              <span className="text-xs bg-blue-500/20 border border-blue-400/30 text-blue-200 rounded-full px-3 py-1">
                {summary.soon} próximos
              </span>
            )}
          </div>
        </div>

        {/* Timeline by phase */}
        {byPhase.map(({ phase, steps: phaseSteps }) => (
          <div key={phase} className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b">
              <h3 className="font-bold text-gray-900 text-sm">{PHASE_LABELS[phase]}</h3>
            </div>
            <div className="divide-y">
              {phaseSteps.map((step) => {
                const style = URGENCY_STYLE[step.urgency];
                return (
                  <div key={step.id} className={`p-5 ${step.urgency === "overdue" ? "bg-rose-50/40" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4.5 h-4.5 text-blue-600" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={CATEGORY_ICON[step.category]} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <h4 className="font-semibold text-gray-900 text-sm">{step.title}</h4>
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${style.text} whitespace-nowrap`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {style.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                        {step.deadlineDate && (
                          <p className="text-xs text-gray-500 mt-1.5">
                            Fecha límite orientativa: <strong>{formatDate(step.deadlineDate)}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/calculadora-isd"
            className="flex-1 px-5 py-3 bg-primary text-white font-semibold rounded-lg text-sm text-center hover:bg-primary/90 transition"
          >
            Calcular el Impuesto de Sucesiones →
          </Link>
          <button
            onClick={reset}
            className="px-5 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-200 transition"
          >
            Empezar de nuevo
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Esta guía es orientativa. Los plazos pueden variar según la comunidad autónoma.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border p-6 sm:p-8">
      <h2 className="text-base font-bold text-gray-900 mb-1">Genera tu plan de trámites</h2>
      <p className="text-sm text-gray-500 mb-6">Responde estas preguntas. No guardamos ninguna información.</p>

      {/* Death date */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          ¿Cuándo se produjo el fallecimiento?
        </label>
        <input
          type="date"
          value={deathDate}
          onChange={(e) => setDeathDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <p className="text-xs text-gray-500 mt-1">
          Opcional, pero nos permite calcular las fechas límite exactas de cada trámite.
        </p>
      </div>

      {/* Boolean questions */}
      <div className="space-y-5">
        {BOOLEAN_QUESTIONS.map((q) => (
          <div key={q.key}>
            <label className="block text-sm font-medium text-gray-900 mb-2">{q.label}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAnswer(q.key, true)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  answers[q.key] === true
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setAnswer(q.key, false)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  answers[q.key] === false
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                No
              </button>
            </div>
            {q.help && <p className="text-xs text-gray-500 mt-1">{q.help}</p>}
          </div>
        ))}
      </div>

      <button
        onClick={() => setSubmitted(true)}
        disabled={!allAnswered}
        className="mt-7 w-full px-6 py-3 bg-primary text-white font-semibold rounded-lg text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {allAnswered ? "Generar mi plan de trámites →" : "Responde todas las preguntas"}
      </button>
    </div>
  );
}
