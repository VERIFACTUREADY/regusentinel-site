"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  calculateDonacion,
  compareDonacionCCAAs,
} from "@/lib/donaciones-calculator";
import { CCAA_LABELS, type CCAAKey, type ParentescoGroup } from "@/lib/isd-calculator";

const GROUPS: { key: ParentescoGroup; label: string; desc: string }[] = [
  { key: "I", label: "Grupo I", desc: "Hijos < 21 años" },
  { key: "II", label: "Grupo II", desc: "Cónyuge / hijos / padres" },
  { key: "III", label: "Grupo III", desc: "Hermanos / tíos / sobrinos" },
  { key: "IV", label: "Grupo IV", desc: "Sin vínculo" },
];

const REDUCCIONES = [
  { value: "ninguna", label: "Sin reducción específica" },
  { value: "vivienda-habitual-hijo", label: "Donación de vivienda habitual a hijo (95%)" },
  { value: "dinero-para-vivienda-hijo", label: "Donación dineraria a hijo para adquisición vivienda (80%)" },
  { value: "empresa-familiar", label: "Empresa familiar / participaciones (95%)" },
] as const;

type Reduccion = (typeof REDUCCIONES)[number]["value"];

function formatEUR(n: number) {
  if (n === 0) return "0 €";
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export function CalculadoraDonacionesClient() {
  const [group, setGroup] = useState<ParentescoGroup>("II");
  const [base, setBase] = useState(100000);
  const [ccaa, setCcaa] = useState<CCAAKey>("MADRID");
  const [reduccion, setReduccion] = useState<Reduccion>("ninguna");
  const [patrimonio, setPatrimonio] = useState(0);

  const result = useMemo(
    () =>
      calculateDonacion(
        { group, baseImponible: base, preexistingPatrimony: patrimonio, reduccionTipo: reduccion },
        ccaa
      ),
    [group, base, ccaa, reduccion, patrimonio]
  );

  const comparison = useMemo(
    () => compareDonacionCCAAs({ group, baseImponible: base, preexistingPatrimony: patrimonio, reduccionTipo: reduccion }),
    [group, base, reduccion, patrimonio]
  );

  const cheaper = comparison[0];
  const expensiver = comparison[comparison.length - 1];
  const savings = expensiver.cuotaAPagar - cheaper.cuotaAPagar;
  const ccaaList = Object.keys(CCAA_LABELS) as CCAAKey[];

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="bg-white rounded-2xl shadow-lg border p-6 sm:p-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">Datos de la donación</h2>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">CCAA del donatario / inmueble</label>
            <select
              value={ccaa}
              onChange={(e) => setCcaa(e.target.value as CCAAKey)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {ccaaList.map((k) => (
                <option key={k} value={k}>{CCAA_LABELS[k]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Valor de la donación (€)</label>
            <input
              type="number"
              value={base}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (isFinite(n) && n >= 0) setBase(n);
              }}
              min={0}
              max={10_000_000}
              step={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-gray-700 mb-2">Grupo de parentesco con el donante</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGroup(g.key)}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
                  group === g.key
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className="font-semibold">{g.label}</div>
                <div className="opacity-80">{g.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de reducción aplicable</label>
          <select
            value={reduccion}
            onChange={(e) => setReduccion(e.target.value as Reduccion)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            {REDUCCIONES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Si aplica una reducción específica, indícalo aquí. Algunas tienen requisitos adicionales (edad del donatario, importe máximo, escritura pública).
          </p>
        </div>

        <details className="mt-5">
          <summary className="text-xs font-medium text-gray-700 cursor-pointer hover:text-primary">Opciones avanzadas</summary>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Patrimonio preexistente del donatario (€)</label>
            <input
              type="number"
              value={patrimonio}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (isFinite(n) && n >= 0) setPatrimonio(n);
              }}
              min={0}
              max={10_000_000}
              step={10000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-xs text-gray-500 mt-1">Afecta al coeficiente multiplicador (1,0 a 2,4 según patrimonio).</p>
          </div>
        </details>
      </div>

      {/* Results */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-6 sm:p-8 text-white">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-xs uppercase tracking-wider text-blue-300">Cuota a pagar en {CCAA_LABELS[ccaa]}</p>
          <p className="text-xs text-blue-300">Plazo: 30 días hábiles</p>
        </div>
        <p className="text-5xl sm:text-6xl font-bold mb-3 break-words">
          {formatEUR(result.cuotaAPagar)}
        </p>
        <p className="text-sm text-blue-200">
          Sobre una donación de {formatEUR(result.baseImponible)} a {GROUPS.find((g) => g.key === group)?.desc}.
        </p>

        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <p className="text-xs text-blue-300">Reducción aplicada</p>
            <p className="text-xl font-bold mt-1">{formatEUR(result.reduccionAplicada)}</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <p className="text-xs text-blue-300">Cuota tributaria</p>
            <p className="text-xl font-bold mt-1">{formatEUR(result.cuotaTributaria)}</p>
            <p className="text-xs text-blue-300 mt-1">Coef. {result.coeficienteMultiplicador}</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <p className="text-xs text-blue-300">Bonificación CCAA</p>
            <p className="text-xl font-bold mt-1">– {formatEUR(result.bonificacionCcaa)}</p>
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div className="bg-white rounded-2xl border p-6 sm:p-8">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-base font-bold text-gray-900">Comparativa entre las 17 CCAA</h2>
          {savings > 0 && (
            <p className="text-xs text-amber-600">
              Diferencia: <strong>{formatEUR(savings)}</strong> entre {cheaper.label} y {expensiver.label}
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">CCAA</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Bonif.</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Cuota</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr
                  key={row.ccaa}
                  onClick={() => setCcaa(row.ccaa)}
                  className={`border-b last:border-0 hover:bg-gray-50 cursor-pointer ${
                    row.ccaa === ccaa ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-gray-900 text-sm">
                    {row.label}
                    {i === 0 && <span className="ml-2 text-xs text-emerald-600">✓ más baja</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {row.foralRegime ? (
                      <span className="bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">Foral</span>
                    ) : row.bonificacionPct >= 99 ? (
                      <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">{row.bonificacionPct}%</span>
                    ) : row.bonificacionPct > 0 ? (
                      <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{row.bonificacionPct}%</span>
                    ) : (
                      <span className="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">0%</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${
                    row.cuotaAPagar === 0 ? "text-emerald-600" : row.cuotaAPagar > 5000 ? "text-rose-600" : "text-gray-900"
                  }`}>
                    {formatEUR(row.cuotaAPagar)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">Click en una fila para recalcular.</p>
      </div>

      {/* Cross-link */}
      <div className="text-center pt-2">
        <Link href="/calculadora-isd" className="text-sm text-primary hover:underline">
          ¿Era una herencia y no donación? → Calculadora del Modelo 650
        </Link>
      </div>
    </div>
  );
}
