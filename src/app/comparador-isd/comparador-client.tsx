"use client";

import { useState, useMemo } from "react";
import {
  getCCAABonification,
  calculateISDForCCAA,
  CCAA_LABELS,
  type CCAAKey,
  type ParentescoGroup,
} from "@/lib/isd-calculator";

interface TableRow {
  ccaa: CCAAKey;
  label: string;
  bonifPct: number;
  note: string;
  foralRegime: boolean;
  cuotaAPagar: number;
  cuotaIntegra: number;
}

const GROUPS: { key: ParentescoGroup; label: string; desc: string }[] = [
  { key: "I", label: "Grupo I", desc: "Hijos < 21 años" },
  { key: "II", label: "Grupo II", desc: "Cónyuge / hijos / padres" },
  { key: "III", label: "Grupo III", desc: "Hermanos / tíos / sobrinos" },
  { key: "IV", label: "Grupo IV", desc: "Sin vínculo" },
];

const BASE_PRESETS = [
  { label: "50.000 €", value: 50000 },
  { label: "100.000 €", value: 100000 },
  { label: "200.000 €", value: 200000 },
  { label: "500.000 €", value: 500000 },
];

function formatEUR(n: number) {
  if (n === 0) return "0 €";
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

function buildRows(group: ParentescoGroup, base: number): TableRow[] {
  const all = Object.keys(CCAA_LABELS) as CCAAKey[];
  return all
    .map((ccaa) => {
      const bonif = getCCAABonification(ccaa, group, base);
      const result = calculateISDForCCAA(ccaa, {
        baseImponible: base,
        group,
        preexistingPatrimony: 0,
      });
      return {
        ccaa,
        label: CCAA_LABELS[ccaa],
        bonifPct: bonif.pct,
        note: bonif.note,
        foralRegime: bonif.foralRegime,
        cuotaAPagar: result.cuotaAPagar,
        cuotaIntegra: result.cuotaIntegra,
      };
    })
    .sort((a, b) => a.cuotaAPagar - b.cuotaAPagar);
}

function BonifBadge({ pct, foral }: { pct: number; foral: boolean }) {
  if (foral) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Foral</span>;
  if (pct >= 99) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{pct}%</span>;
  if (pct >= 80) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{pct}%</span>;
  if (pct >= 50) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{pct}%</span>;
  if (pct > 0) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{pct}%</span>;
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">0%</span>;
}

export function ComparadorClient({
  initialData,
  initialGroup,
  initialBase,
}: {
  initialData: TableRow[];
  initialGroup: ParentescoGroup;
  initialBase: number;
}) {
  const [group, setGroup] = useState<ParentescoGroup>(initialGroup);
  const [base, setBase] = useState(initialBase);
  const [customBase, setCustomBase] = useState("");

  const rows = useMemo(() => buildRows(group, base), [group, base]);

  const minRow = rows[0];
  const maxRow = rows[rows.length - 1];
  const saving = maxRow.cuotaAPagar - minRow.cuotaAPagar;
  const maxCuota = Math.max(...rows.map((r) => r.cuotaAPagar));

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-bold text-gray-900 mb-4">Configurar comparación</h2>
        <div className="flex flex-wrap gap-4">
          {/* Group selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-2">Grupo de parentesco</label>
            <div className="grid grid-cols-2 gap-2">
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

          {/* Base selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Base imponible (valor herencia)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {BASE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setBase(p.value); setCustomBase(""); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    base === p.value && !customBase
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
      </div>

      {/* Summary callout */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-700 font-medium mb-1">Más barata</p>
          <p className="font-bold text-green-900">{minRow.label}</p>
          <p className="text-xl font-bold text-green-700">{formatEUR(minRow.cuotaAPagar)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-700 font-medium mb-1">Más cara</p>
          <p className="font-bold text-red-900">{maxRow.label}</p>
          <p className="text-xl font-bold text-red-700">{formatEUR(maxRow.cuotaAPagar)}</p>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Comunidad Autónoma</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Bonif.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Cuota íntegra</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Cuota a pagar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">Barra</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const barPct = maxCuota > 0 ? (row.cuotaAPagar / maxCuota) * 100 : 0;
                const isBest = i === 0;
                const isWorst = i === rows.length - 1;
                return (
                  <tr
                    key={row.ccaa}
                    className={`border-b last:border-0 transition hover:bg-gray-50 ${
                      isBest ? "bg-green-50/50" : isWorst ? "bg-red-50/30" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 text-sm">
                        {row.label}
                        {isBest && <span className="ml-2 text-xs text-green-600">✓ más baja</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{row.note}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BonifBadge pct={row.bonifPct} foral={row.foralRegime} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {formatEUR(row.cuotaIntegra)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold text-sm ${row.cuotaAPagar === 0 ? "text-green-600" : row.cuotaAPagar > 10000 ? "text-red-600" : "text-gray-900"}`}>
                        {formatEUR(row.cuotaAPagar)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${row.cuotaAPagar === 0 ? "bg-green-400" : row.cuotaAPagar > 10000 ? "bg-red-400" : "bg-blue-400"}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
          Cálculo orientativo para {GROUPS.find((g) => g.key === group)?.desc}, base imponible {formatEUR(base)}, sin patrimonio preexistente, sin reducciones adicionales. Los regímenes forales pueden diferir de los importes mostrados.
        </div>
      </div>
    </div>
  );
}
