"use client";

import { useState, useMemo } from "react";
import { compareDonacionCCAAs, type DonacionInputs } from "@/lib/donaciones-calculator";
import type { ParentescoGroup } from "@/lib/isd-calculator";

type Row = ReturnType<typeof compareDonacionCCAAs>[number];

const GROUPS: { key: ParentescoGroup; label: string; desc: string }[] = [
  { key: "I", label: "Grupo I", desc: "Hijos < 21" },
  { key: "II", label: "Grupo II", desc: "Cónyuge / hijos / padres" },
  { key: "III", label: "Grupo III", desc: "Hermanos / tíos / sobrinos" },
  { key: "IV", label: "Grupo IV", desc: "Sin vínculo" },
];

const BASE_PRESETS = [
  { label: "30.000 €", value: 30000 },
  { label: "100.000 €", value: 100000 },
  { label: "200.000 €", value: 200000 },
  { label: "500.000 €", value: 500000 },
];

const REDUCCIONES = [
  { value: "ninguna", label: "Sin reducción específica" },
  { value: "vivienda-habitual-hijo", label: "Vivienda habitual a descendiente (95%)" },
  { value: "dinero-para-vivienda-hijo", label: "Dinero para vivienda del donatario (80%)" },
  { value: "empresa-familiar", label: "Empresa familiar (95%)" },
] as const;

type Reduccion = (typeof REDUCCIONES)[number]["value"];

function formatEUR(n: number) {
  if (n === 0) return "0 €";
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export function ComparadorDonacionesClient({ initialRows }: { initialRows: Row[] }) {
  const [group, setGroup] = useState<ParentescoGroup>("II");
  const [base, setBase] = useState(100000);
  const [customBase, setCustomBase] = useState("");
  const [reduccion, setReduccion] = useState<Reduccion>("ninguna");

  const rows = useMemo(() => {
    const input: DonacionInputs = {
      group,
      baseImponible: base,
      preexistingPatrimony: 0,
      reduccionTipo: reduccion,
    };
    return compareDonacionCCAAs(input);
  }, [group, base, reduccion]);

  const minRow = rows[0];
  const maxRow = rows[rows.length - 1];
  const saving = maxRow.cuotaAPagar - minRow.cuotaAPagar;
  const maxCuota = Math.max(...rows.map((r) => r.cuotaAPagar), 1);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-bold text-gray-900 mb-4">Configurar la donación</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-2">Grupo de parentesco</label>
            <div className="grid grid-cols-2 gap-2">
              {GROUPS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGroup(g.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
                    group === g.key ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <div className="font-semibold">{g.label}</div>
                  <div className="opacity-80">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-2">Valor de la donación</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {BASE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setBase(p.value); setCustomBase(""); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    base === p.value && !customBase ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Importe personalizado €"
              value={customBase}
              onChange={(e) => {
                setCustomBase(e.target.value);
                const n = parseFloat(e.target.value);
                if (!isNaN(n) && n > 0) setBase(n);
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Reducción específica</label>
          <select
            value={reduccion}
            onChange={(e) => setReduccion(e.target.value as Reduccion)}
            className="w-full sm:w-auto px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {REDUCCIONES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-700 font-medium mb-1">Más barata</p>
          <p className="font-bold text-emerald-900">{minRow.label}</p>
          <p className="text-xl font-bold text-emerald-700">{formatEUR(minRow.cuotaAPagar)}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-xs text-rose-700 font-medium mb-1">Más cara</p>
          <p className="font-bold text-rose-900">{maxRow.label}</p>
          <p className="text-xl font-bold text-rose-700">{formatEUR(maxRow.cuotaAPagar)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700 font-medium mb-1">Diferencia máxima</p>
          <p className="text-xl font-bold text-amber-700">{formatEUR(saving)}</p>
          <p className="text-xs text-amber-700 mt-1">entre {minRow.label} y {maxRow.label}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Comunidad Autónoma</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Bonif.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Cuota a pagar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[160px]">Comparativa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const barPct = (row.cuotaAPagar / maxCuota) * 100;
                const isBest = i === 0;
                return (
                  <tr key={row.ccaa} className={`border-b last:border-0 hover:bg-gray-50 transition ${isBest ? "bg-emerald-50/50" : ""}`}>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900 text-sm">{row.label}</span>
                      {isBest && <span className="ml-2 text-xs text-emerald-600">✓ más baja</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
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
                    <td className={`px-4 py-3 text-right font-bold ${row.cuotaAPagar === 0 ? "text-emerald-600" : row.cuotaAPagar > 5000 ? "text-rose-600" : "text-gray-900"}`}>
                      {formatEUR(row.cuotaAPagar)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${row.cuotaAPagar === 0 ? "bg-emerald-400" : row.cuotaAPagar > 5000 ? "bg-rose-400" : "bg-blue-400"}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
          Cálculo orientativo para {GROUPS.find((g) => g.key === group)?.desc}, donación de {formatEUR(base)}, sin patrimonio preexistente. Los regímenes forales tributan según normativa propia.
        </div>
      </div>
    </div>
  );
}
