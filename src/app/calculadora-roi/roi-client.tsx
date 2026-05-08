"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { calculateROI, recommendPlan, type ROIInputs } from "@/lib/roi-calculator";

const PLAN_LABELS: Record<ROIInputs["plan"], string> = {
  INICIA: "Inicia",
  DESPACHO: "Despacho",
  FIRMA: "Firma",
};

function formatEUR(n: number) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

function formatHours(h: number) {
  return h.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " h";
}

export function ROICalculatorClient() {
  const [expedientes, setExpedientes] = useState(50);
  const [horas, setHoras] = useState(8);
  const [coste, setCoste] = useState(30);
  const [planManual, setPlanManual] = useState<ROIInputs["plan"] | null>(null);

  const recomendado = useMemo(() => recommendPlan(expedientes), [expedientes]);
  const plan = planManual ?? recomendado;
  const result = useMemo(
    () => calculateROI({ expedientesPorMes: expedientes, horasPorExpediente: horas, costeHora: coste, plan }),
    [expedientes, horas, coste, plan]
  );

  return (
    <div className="space-y-5">
      {/* Inputs card */}
      <div className="bg-white rounded-2xl shadow-lg border p-6 sm:p-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">Datos de tu despacho</h2>

        <div className="grid sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Expedientes al mes
            </label>
            <input
              type="number"
              value={expedientes}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (isFinite(v) && v >= 0) setExpedientes(v);
              }}
              min={0}
              max={2000}
              step={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <input
              type="range"
              value={expedientes}
              onChange={(e) => setExpedientes(Number(e.target.value))}
              min={5}
              max={500}
              step={5}
              className="w-full mt-2 accent-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Horas/expediente
            </label>
            <input
              type="number"
              value={horas}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (isFinite(v) && v >= 0) setHoras(v);
              }}
              min={0}
              max={50}
              step={0.5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <input
              type="range"
              value={horas}
              onChange={(e) => setHoras(Number(e.target.value))}
              min={1}
              max={20}
              step={0.5}
              className="w-full mt-2 accent-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Coste/hora del equipo (€)
            </label>
            <input
              type="number"
              value={coste}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (isFinite(v) && v >= 0) setCoste(v);
              }}
              min={0}
              max={200}
              step={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <input
              type="range"
              value={coste}
              onChange={(e) => setCoste(Number(e.target.value))}
              min={10}
              max={80}
              step={1}
              className="w-full mt-2 accent-primary"
            />
          </div>
        </div>

        {/* Plan picker */}
        <div className="mt-6">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Plan
            <span className="ml-2 text-gray-400 font-normal">
              · Recomendado para tu volumen: <strong className="text-primary">{PLAN_LABELS[recomendado]}</strong>
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["INICIA", "DESPACHO", "FIRMA"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlanManual(p === recomendado ? null : p)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  plan === p
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {PLAN_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-6 sm:p-8 text-white">
        <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">Estimación de ahorro neto anual</p>
        <p className="text-5xl sm:text-6xl font-bold mb-2 break-words">
          {result.ahorroNetoAnual > 0 ? `+ ${formatEUR(result.ahorroNetoAnual)}` : "—"}
        </p>
        <p className="text-sm text-blue-200">
          Después de pagar el plan {PLAN_LABELS[plan]} ({formatEUR(result.costePlanMensual)}/mes).
        </p>

        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <p className="text-xs text-blue-300">Horas ahorradas/mes</p>
            <p className="text-xl font-bold mt-1">{formatHours(result.horasAhorradasMes)}</p>
            <p className="text-xs text-blue-300 mt-1">
              {result.horasAhorradasPorExpediente} h × {expedientes} expedientes
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <p className="text-xs text-blue-300">Errores evitados/mes</p>
            <p className="text-xl font-bold mt-1">{formatEUR(result.ahorroErroresMensual)}</p>
            <p className="text-xs text-blue-300 mt-1">Recargos y pérdidas evitadas</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <p className="text-xs text-blue-300">Payback</p>
            <p className="text-xl font-bold mt-1">
              {isFinite(result.paybackMeses)
                ? result.paybackMeses < 1
                  ? "< 1 mes"
                  : `${result.paybackMeses} meses`
                : "—"}
            </p>
            <p className="text-xs text-blue-300 mt-1">Tiempo en recuperar el plan</p>
          </div>
        </div>
      </div>

      {/* Detail */}
      <div className="bg-white rounded-2xl border p-6 sm:p-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">Desglose mensual</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-baseline pb-2 border-b">
            <span className="text-gray-700">Ahorro por horas administrativas</span>
            <span className="font-semibold text-gray-900">+ {formatEUR(result.ahorroHorasMensual)}</span>
          </div>
          <div className="flex justify-between items-baseline pb-2 border-b">
            <span className="text-gray-700">Ahorro por errores evitados</span>
            <span className="font-semibold text-gray-900">+ {formatEUR(result.ahorroErroresMensual)}</span>
          </div>
          <div className="flex justify-between items-baseline pb-2 border-b">
            <span className="text-gray-700">Coste plan {PLAN_LABELS[plan]}</span>
            <span className="font-semibold text-rose-600">– {formatEUR(result.costePlanMensual)}</span>
          </div>
          <div className="flex justify-between items-baseline pt-2">
            <span className="font-bold text-gray-900">Ahorro neto mensual</span>
            <span className="font-bold text-emerald-600 text-lg">{formatEUR(result.ahorroNetoMensual)}</span>
          </div>
        </div>

        {result.expedientesExtraEquivalentes > 0 && (
          <div className="mt-5 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            <strong>Bonus de capacidad:</strong> con las horas liberadas, tu equipo podría
            atender hasta <strong>{result.expedientesExtraEquivalentes} expedientes adicionales/mes</strong> sin
            ampliar plantilla. Si los facturas a 600-1.500 € cada uno, el ROI real es muy superior al estimado.
          </div>
        )}
      </div>

      <div className="text-center pt-2">
        <Link
          href="/#demo"
          className="inline-block px-8 py-3 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary/90 transition"
        >
          Empezar con 14 días gratis →
        </Link>
        <p className="text-xs text-gray-500 mt-2">Sin tarjeta. Sin permanencia.</p>
      </div>
    </div>
  );
}
