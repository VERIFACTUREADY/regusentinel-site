"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { calculateHerenciaCost, type HerenciaCostInput } from "@/lib/herencia-cost";
import { CCAA_LABELS, type CCAAKey, type ParentescoGroup } from "@/lib/isd-calculator";

const CCAA_LIST = Object.keys(CCAA_LABELS) as CCAAKey[];

const GROUPS: { key: ParentescoGroup; label: string }[] = [
  { key: "I", label: "Hijos < 21" },
  { key: "II", label: "Cónyuge / hijos / padres" },
  { key: "III", label: "Hermanos / tíos / sobrinos" },
  { key: "IV", label: "Sin parentesco" },
];

function formatEUR(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export function CosteHerenciaClient() {
  const [valorHerencia, setValorHerencia] = useState(200000);
  const [ccaa, setCcaa] = useState<CCAAKey>("MADRID");
  const [group, setGroup] = useState<ParentescoGroup>("II");
  const [hasProperty, setHasProperty] = useState(true);
  const [includeGestoria, setIncludeGestoria] = useState(true);

  // Property fields
  const [valorCatastral, setValorCatastral] = useState(120000);
  const [anyosTenencia, setAnyosTenencia] = useState(20);
  const [valorAdquisicion, setValorAdquisicion] = useState("");
  const [valorTransmision, setValorTransmision] = useState("");

  const input: HerenciaCostInput = useMemo(
    () => ({
      valorHerencia,
      ccaa,
      group,
      preexistingPatrimony: 0,
      hasProperty,
      property: hasProperty
        ? {
            valorCatastralTotal: valorCatastral,
            valorCatastralSuelo: null,
            anyosTenencia,
            tipoGravamenMunicipal: 0.3,
            valorAdquisicion: valorAdquisicion ? Number(valorAdquisicion) : null,
            valorTransmision: valorTransmision ? Number(valorTransmision) : null,
          }
        : null,
      includeGestoria,
    }),
    [valorHerencia, ccaa, group, hasProperty, valorCatastral, anyosTenencia, valorAdquisicion, valorTransmision, includeGestoria]
  );

  const result = useMemo(() => calculateHerenciaCost(input), [input]);

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="bg-white rounded-2xl shadow-lg border p-6 sm:p-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">Datos de la herencia</h2>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Valor total de la herencia (€)</label>
            <input
              type="number"
              value={valorHerencia}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (isFinite(n) && n >= 0) setValorHerencia(n);
              }}
              min={0}
              step={10000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">CCAA del causante</label>
            <select
              value={ccaa}
              onChange={(e) => setCcaa(e.target.value as CCAAKey)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {CCAA_LIST.map((k) => (
                <option key={k} value={k}>{CCAA_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-gray-700 mb-2">Parentesco con el causante</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGroup(g.key)}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
                  group === g.key ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className="font-semibold">Grupo {g.key}</div>
                <div className="opacity-80">{g.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Property toggle */}
        <div className="mt-6 pt-5 border-t">
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={hasProperty}
              onChange={(e) => setHasProperty(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-gray-900">La herencia incluye un inmueble</span>
          </label>

          {hasProperty && (
            <div className="space-y-4 pl-7">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor catastral del inmueble (€)</label>
                  <input
                    type="number"
                    value={valorCatastral}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (isFinite(n) && n >= 0) setValorCatastral(n);
                    }}
                    min={0}
                    step={5000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Años de tenencia del causante: <strong>{anyosTenencia}</strong>
                  </label>
                  <input
                    type="range"
                    value={anyosTenencia}
                    onChange={(e) => setAnyosTenencia(Number(e.target.value))}
                    min={1}
                    max={40}
                    step={1}
                    className="w-full mt-2 accent-primary"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor de compra original (€) — opcional</label>
                  <input
                    type="number"
                    value={valorAdquisicion}
                    onChange={(e) => setValorAdquisicion(e.target.value)}
                    placeholder="Lo que costó al causante"
                    min={0}
                    step={5000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor actual del inmueble (€) — opcional</label>
                  <input
                    type="number"
                    value={valorTransmision}
                    onChange={(e) => setValorTransmision(e.target.value)}
                    placeholder="Valor en la herencia"
                    min={0}
                    step={5000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={includeGestoria}
              onChange={(e) => setIncludeGestoria(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-gray-900">Incluir estimación de honorarios de gestoría</span>
          </label>
        </div>
      </div>

      {/* Result */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-6 sm:p-8 text-white">
        <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">Coste total estimado de heredar</p>
        <p className="text-4xl sm:text-5xl font-bold mb-2">{formatEUR(result.total)}</p>
        <p className="text-sm text-blue-100">
          {result.pctOfHerencia}% del valor de la herencia ({formatEUR(valorHerencia)}).
        </p>
      </div>

      {/* Breakdown */}
      <div className="bg-white rounded-2xl border p-6 sm:p-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">Desglose del coste</h2>
        <div className="space-y-3">
          {result.lines.map((line) => (
            <div key={line.key} className="pb-3 border-b last:border-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-gray-900">{line.label}</span>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{formatEUR(line.amount)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{line.note}</p>
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-2">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-primary text-lg">{formatEUR(result.total)}</span>
          </div>
        </div>
      </div>

      <div className="text-center pt-2">
        <Link href="/calculadora-isd" className="text-sm text-primary hover:underline">
          Ver el detalle del Impuesto de Sucesiones → Calculadora del Modelo 650
        </Link>
      </div>
    </div>
  );
}
