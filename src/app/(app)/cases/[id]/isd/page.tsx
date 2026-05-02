"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Group = "I" | "II" | "III" | "IV";
type Disability = "none" | "33-65" | "65+";

interface ISDResult {
  baseImponible: number;
  totalReducciones: number;
  baseLiquidable: number;
  cuotaIntegra: number;
  coeficienteMultiplicador: number;
  cuotaTributaria: number;
  bonificacionCcaa: number;
  cuotaAPagar: number;
  desglose: {
    reduccionParentesco: number;
    reduccionVivienda: number;
    reduccionDiscapacidad: number;
    reduccionSeguroVida: number;
  };
}

const GROUP_LABELS: Record<Group, string> = {
  I: "Grupo I — Descendientes y adoptados < 21 años",
  II: "Grupo II — Descendientes/adoptados ≥ 21, cónyuge, ascendientes/adoptantes",
  III: "Grupo III — Colaterales 2º/3º grado, ascendientes/descendientes por afinidad",
  IV: "Grupo IV — Colaterales 4º grado, parientes lejanos, extraños",
};

function fmt(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

export default function CaseISDPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<ISDResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [group, setGroup] = useState<Group>("II");
  const [ageIfMinor, setAgeIfMinor] = useState<string>("");
  const [baseImponible, setBaseImponible] = useState<string>("");
  const [preexistingPatrimony, setPreexistingPatrimony] = useState<string>("0");
  const [dwellingReduction, setDwellingReduction] = useState(false);
  const [dwellingValue, setDwellingValue] = useState<string>("");
  const [disability, setDisability] = useState<Disability>("none");
  const [lifeInsurance, setLifeInsurance] = useState<string>("");
  const [ccaaBonificationPct, setCcaaBonificationPct] = useState<string>("0");
  const [referenceBonification, setReferenceBonification] = useState<number>(0);

  useEffect(() => {
    fetch(`/api/cases/${caseId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setCaseData(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  // Fetch reference bonification for this province + group
  useEffect(() => {
    if (caseData?.province) {
      fetch(`/api/cases/isd-reference?province=${encodeURIComponent(caseData.province)}&group=${group}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.referencePct !== undefined) {
            setReferenceBonification(data.referencePct);
          }
        })
        .catch(() => {});
    }
  }, [caseData?.province, group]);

  function applyReference() {
    setCcaaBonificationPct(String(referenceBonification));
  }

  async function calculate() {
    setError(null);
    setCalculating(true);
    setResult(null);

    const numericBase = parseFloat(baseImponible.replace(",", "."));
    if (!isFinite(numericBase) || numericBase <= 0) {
      setError("La base imponible debe ser un número positivo.");
      setCalculating(false);
      return;
    }

    const payload = {
      group,
      ageIfMinor: ageIfMinor ? parseInt(ageIfMinor, 10) : null,
      baseImponible: numericBase,
      preexistingPatrimony: parseFloat(preexistingPatrimony.replace(",", ".")) || 0,
      dwellingReduction,
      dwellingValue: dwellingValue ? parseFloat(dwellingValue.replace(",", ".")) : 0,
      disability,
      lifeInsuranceAmount: lifeInsurance ? parseFloat(lifeInsurance.replace(",", ".")) : 0,
      ccaaBonificationPct: parseFloat(ccaaBonificationPct.replace(",", ".")) || 0,
    };

    try {
      const res = await fetch(`/api/cases/${caseId}/isd-calc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.error || "Error al calcular");
        setCalculating(false);
        return;
      }
      const data = await res.json();
      setResult(data.result);
    } catch (e: any) {
      setError(e.message || "Error inesperado");
    } finally {
      setCalculating(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  if (!caseData) return <div className="text-center py-12 text-gray-400">Expediente no encontrado</div>;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/cases/${caseId}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver al expediente
        </Link>
        <h1 className="text-2xl font-bold mt-2">Calculadora ISD — Modelo 650</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cálculo orientativo del Impuesto sobre Sucesiones para <span className="font-mono">{caseData.ref}</span>
          {caseData.province && <> · Provincia: {caseData.province}</>}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-lg border p-6 space-y-5">
          <h2 className="font-semibold">Datos del heredero</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grupo de parentesco</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as Group)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              {(["I", "II", "III", "IV"] as Group[]).map((g) => (
                <option key={g} value={g}>{GROUP_LABELS[g]}</option>
              ))}
            </select>
          </div>

          {group === "I" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Edad del heredero (años)</label>
              <input
                type="number"
                value={ageIfMinor}
                onChange={(e) => setAgeIfMinor(e.target.value)}
                placeholder="Ej: 16"
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Si es menor de 21, se suma 3.990,72€ por cada año (máx 47.858,59€)</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base imponible (€) *</label>
            <input
              type="text"
              inputMode="decimal"
              value={baseImponible}
              onChange={(e) => setBaseImponible(e.target.value)}
              placeholder="Ej: 250000"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Cuota hereditaria neta (caudal × cuota - deudas - gastos)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patrimonio preexistente del heredero (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={preexistingPatrimony}
              onChange={(e) => setPreexistingPatrimony(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Determina el coeficiente multiplicador (art. 22 LISD)</p>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Reducciones aplicables</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dwellingReduction}
                  onChange={(e) => setDwellingReduction(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Vivienda habitual</span>
                  <span className="text-gray-500 text-xs block">Reducción 95% (máx 122.606,47€) para grupos I-III</span>
                </span>
              </label>
              {dwellingReduction && (
                <input
                  type="text"
                  inputMode="decimal"
                  value={dwellingValue}
                  onChange={(e) => setDwellingValue(e.target.value)}
                  placeholder="Valor de la vivienda (€)"
                  className="w-full ml-6 px-3 py-2 border rounded-md text-sm"
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discapacidad</label>
                <select
                  value={disability}
                  onChange={(e) => setDisability(e.target.value as Disability)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="none">Sin discapacidad</option>
                  <option value="33-65">33% — 65% (47.858,59€)</option>
                  <option value="65+">≥ 65% (150.253,03€)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seguro de vida (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={lifeInsurance}
                  onChange={(e) => setLifeInsurance(e.target.value)}
                  placeholder="Importe percibido"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Reducción 100% hasta 9.195,49€ (grupos I-II)</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Bonificación CCAA (%)</label>
              {referenceBonification > 0 && (
                <button
                  onClick={applyReference}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  Usar referencia ({referenceBonification}%)
                </button>
              )}
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={ccaaBonificationPct}
              onChange={(e) => setCcaaBonificationPct(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <p className="text-xs text-amber-600 mt-1">
              Las CCAA modifican sus bonificaciones cada año. Verifica con la normativa vigente.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={calculate}
            disabled={calculating || !baseImponible}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {calculating ? "Calculando..." : "Calcular ISD"}
          </button>
        </div>

        {/* Result */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
                <p className="text-sm text-gray-500">Cuota a pagar (estimación)</p>
                <p className="text-4xl font-bold text-gray-900 mt-1">{fmt(result.cuotaAPagar)}</p>
                {result.bonificacionCcaa > 0 && (
                  <p className="text-sm text-green-700 mt-1">
                    Tras bonificación CCAA: {fmt(result.bonificacionCcaa)} ({Math.round((result.bonificacionCcaa / result.cuotaTributaria) * 100)}%)
                  </p>
                )}
              </div>

              <div className="bg-white rounded-lg border p-5 space-y-2 text-sm">
                <h3 className="font-semibold mb-2">Desglose del cálculo</h3>
                <div className="flex justify-between">
                  <span className="text-gray-600">Base imponible</span>
                  <span className="font-medium">{fmt(result.baseImponible)}</span>
                </div>
                <div className="pl-3 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>− Reducción parentesco</span>
                    <span>{fmt(result.desglose.reduccionParentesco)}</span>
                  </div>
                  {result.desglose.reduccionVivienda > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>− Reducción vivienda habitual</span>
                      <span>{fmt(result.desglose.reduccionVivienda)}</span>
                    </div>
                  )}
                  {result.desglose.reduccionDiscapacidad > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>− Reducción discapacidad</span>
                      <span>{fmt(result.desglose.reduccionDiscapacidad)}</span>
                    </div>
                  )}
                  {result.desglose.reduccionSeguroVida > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>− Reducción seguro de vida</span>
                      <span>{fmt(result.desglose.reduccionSeguroVida)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-700 font-medium pt-1 border-t">
                    <span>Total reducciones</span>
                    <span>{fmt(result.totalReducciones)}</span>
                  </div>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Base liquidable</span>
                  <span className="font-medium">{fmt(result.baseLiquidable)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cuota íntegra (escala estatal)</span>
                  <span className="font-medium">{fmt(result.cuotaIntegra)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">× Coeficiente multiplicador</span>
                  <span className="font-medium">{result.coeficienteMultiplicador.toFixed(4)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t font-semibold">
                  <span>Cuota tributaria</span>
                  <span>{fmt(result.cuotaTributaria)}</span>
                </div>
                {result.bonificacionCcaa > 0 && (
                  <>
                    <div className="flex justify-between text-green-700">
                      <span>− Bonificación CCAA</span>
                      <span>{fmt(result.bonificacionCcaa)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t font-bold text-lg">
                      <span>Cuota a pagar</span>
                      <span>{fmt(result.cuotaAPagar)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
                <strong>Aviso:</strong> Este cálculo aplica la escala estatal y reducciones generales.
                Las CCAA tienen escalas, reducciones y bonificaciones propias que pueden modificar el resultado.
                La cuota final debe ser revisada por un profesional fiscal.
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p>Rellena los datos y pulsa <span className="font-semibold">Calcular ISD</span> para ver el desglose.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
