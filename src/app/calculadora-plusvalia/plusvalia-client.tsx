"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { calculatePlusvalia, type PlusvaliaInput } from "@/lib/plusvalia-calculator";

function formatEUR(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export function PlusvaliaClient() {
  const [valorCatastralTotal, setValorCatastralTotal] = useState(120000);
  const [valorCatastralSuelo, setValorCatastralSuelo] = useState("");
  const [anyosTenencia, setAnyosTenencia] = useState(15);
  const [tipoGravamen, setTipoGravamen] = useState(30);
  const [valorAdquisicion, setValorAdquisicion] = useState("");
  const [valorTransmision, setValorTransmision] = useState("");

  const input: PlusvaliaInput = useMemo(
    () => ({
      valorCatastralTotal,
      valorCatastralSuelo: valorCatastralSuelo ? Number(valorCatastralSuelo) : null,
      anyosTenencia,
      tipoGravamen: tipoGravamen / 100,
      valorAdquisicion: valorAdquisicion ? Number(valorAdquisicion) : null,
      valorTransmision: valorTransmision ? Number(valorTransmision) : null,
    }),
    [valorCatastralTotal, valorCatastralSuelo, anyosTenencia, tipoGravamen, valorAdquisicion, valorTransmision]
  );

  const result = useMemo(() => calculatePlusvalia(input), [input]);

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="bg-white rounded-2xl shadow-lg border p-6 sm:p-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">Datos del inmueble heredado</h2>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Valor catastral total (€)</label>
            <input
              type="number"
              value={valorCatastralTotal}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (isFinite(n) && n >= 0) setValorCatastralTotal(n);
              }}
              min={0}
              step={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-xs text-gray-500 mt-1">Aparece en el recibo del IBI.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Valor catastral del suelo (€)</label>
            <input
              type="number"
              value={valorCatastralSuelo}
              onChange={(e) => setValorCatastralSuelo(e.target.value)}
              placeholder="Si lo dejas vacío, estimamos 50%"
              min={0}
              step={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-xs text-gray-500 mt-1">También en el recibo del IBI, desglosado.</p>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Años de tenencia del causante: <strong>{anyosTenencia}</strong>
          </label>
          <input
            type="range"
            value={anyosTenencia}
            onChange={(e) => setAnyosTenencia(Number(e.target.value))}
            min={1}
            max={30}
            step={1}
            className="w-full accent-primary"
          />
          <p className="text-xs text-gray-500 mt-1">
            Años completos desde que el causante adquirió el inmueble hasta el fallecimiento.
          </p>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Tipo de gravamen municipal: <strong>{tipoGravamen}%</strong>
          </label>
          <input
            type="range"
            value={tipoGravamen}
            onChange={(e) => setTipoGravamen(Number(e.target.value))}
            min={0}
            max={30}
            step={1}
            className="w-full accent-primary"
          />
          <p className="text-xs text-gray-500 mt-1">
            Máximo legal 30%. Lo fija cada ayuntamiento — consúltalo en su ordenanza fiscal.
          </p>
        </div>

        <div className="mt-6 pt-5 border-t">
          <p className="text-sm font-semibold text-gray-900 mb-1">Para el método real (opcional)</p>
          <p className="text-xs text-gray-500 mb-4">
            Si los indicas, comparamos también el método real y te decimos cuál te conviene.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valor de adquisición (€)</label>
              <input
                type="number"
                value={valorAdquisicion}
                onChange={(e) => setValorAdquisicion(e.target.value)}
                placeholder="Lo que costó al causante"
                min={0}
                step={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valor de transmisión (€)</label>
              <input
                type="number"
                value={valorTransmision}
                onChange={(e) => setValorTransmision(e.target.value)}
                placeholder="Valor declarado en la herencia"
                min={0}
                step={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-6 sm:p-8 text-white">
        <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">Cuota recomendada</p>
        {result.metodoRecomendado === "no-sujeto" ? (
          <>
            <p className="text-4xl sm:text-5xl font-bold mb-2 text-emerald-300">No sujeto</p>
            <p className="text-sm text-blue-100">
              No hay incremento de valor: la transmisión no tributa. Conserva las escrituras de
              adquisición y de la herencia como prueba ante el ayuntamiento.
            </p>
          </>
        ) : (
          <>
            <p className="text-4xl sm:text-5xl font-bold mb-2">{formatEUR(result.cuotaRecomendada)}</p>
            <p className="text-sm text-blue-100">
              Método recomendado:{" "}
              <strong className="text-white">
                {result.metodoRecomendado === "objetivo" ? "objetivo" : "real (estimación directa)"}
              </strong>{" "}
              — el de menor cuota.
            </p>
          </>
        )}
      </div>

      {/* Both methods */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className={`bg-white rounded-xl border p-5 ${result.metodoRecomendado === "objetivo" ? "ring-2 ring-emerald-400" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900 text-sm">Método objetivo</h3>
            {result.metodoRecomendado === "objetivo" && (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">RECOMENDADO</span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{formatEUR(result.objetivo.cuota)}</p>
          <p className="text-xs text-gray-500 mb-2">Coeficiente aplicado: {result.coeficienteObjetivo}</p>
          <p className="text-xs text-gray-600">{result.objetivo.nota}</p>
        </div>

        <div className={`bg-white rounded-xl border p-5 ${result.metodoRecomendado === "real" ? "ring-2 ring-emerald-400" : ""} ${!result.real.aplicable ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900 text-sm">Método real</h3>
            {result.metodoRecomendado === "real" && (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">RECOMENDADO</span>
            )}
          </div>
          {result.real.aplicable ? (
            <>
              <p className="text-2xl font-bold text-gray-900 mb-1">{formatEUR(result.real.cuota)}</p>
              <p className="text-xs text-gray-500 mb-2">Proporción del suelo: {(result.porcentajeSuelo * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-600">{result.real.nota}</p>
            </>
          ) : (
            <p className="text-xs text-gray-500 mt-2">{result.real.nota}</p>
          )}
        </div>
      </div>

      <div className="text-center pt-2">
        <Link href="/calculadora-isd" className="text-sm text-primary hover:underline">
          ¿También necesitas el Impuesto de Sucesiones? → Calculadora del Modelo 650
        </Link>
      </div>
    </div>
  );
}
