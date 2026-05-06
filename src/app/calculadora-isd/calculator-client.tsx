"use client";

import { useState, useMemo } from "react";

type Group = "I" | "II" | "III" | "IV";
type Disability = "none" | "33-65" | "65+";

interface Result {
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

interface Comparison {
  ccaa: string;
  label: string;
  cuotaAPagar: number;
  bonificacionPct: number;
  foralRegime: boolean;
}

interface ApiResponse {
  result: Result;
  comparison: Comparison[];
  ccaa: string | null;
}

const CCAA_OPTIONS: { value: string; label: string }[] = [
  { value: "MADRID", label: "Madrid" },
  { value: "ANDALUCIA", label: "Andalucía" },
  { value: "ARAGON", label: "Aragón" },
  { value: "ASTURIAS", label: "Asturias" },
  { value: "BALEARES", label: "Islas Baleares" },
  { value: "CANARIAS", label: "Canarias" },
  { value: "CANTABRIA", label: "Cantabria" },
  { value: "CASTILLA_LEON", label: "Castilla y León" },
  { value: "CASTILLA_LA_MANCHA", label: "Castilla-La Mancha" },
  { value: "CATALUNA", label: "Cataluña" },
  { value: "EXTREMADURA", label: "Extremadura" },
  { value: "GALICIA", label: "Galicia" },
  { value: "LA_RIOJA", label: "La Rioja" },
  { value: "MURCIA", label: "Murcia" },
  { value: "NAVARRA", label: "Navarra (foral)" },
  { value: "PAIS_VASCO", label: "País Vasco (foral)" },
  { value: "VALENCIA", label: "Comunidad Valenciana" },
];

const GROUP_OPTIONS: { value: Group; label: string }[] = [
  { value: "I", label: "Grupo I — Hijos < 21 años" },
  { value: "II", label: "Grupo II — Hijos ≥21, cónyuge, ascendientes" },
  { value: "III", label: "Grupo III — Hermanos, tíos, sobrinos" },
  { value: "IV", label: "Grupo IV — Primos y otros" },
];

function fmtEUR(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
}

export function CalculatorClient() {
  const [ccaa, setCcaa] = useState<string>("MADRID");
  const [group, setGroup] = useState<Group>("II");
  const [age, setAge] = useState<string>("");
  const [base, setBase] = useState<string>("200000");
  const [patrimony, setPatrimony] = useState<string>("0");
  const [hasDwelling, setHasDwelling] = useState(false);
  const [dwellingValue, setDwellingValue] = useState<string>("");
  const [disability, setDisability] = useState<Disability>("none");
  const [insurance, setInsurance] = useState<string>("");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCalculate = useMemo(() => {
    const b = Number(base);
    return isFinite(b) && b > 0;
  }, [base]);

  async function calculate() {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/isd-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ccaa,
          group,
          ageIfMinor: group === "I" && age ? Number(age) : null,
          baseImponible: Number(base),
          preexistingPatrimony: Number(patrimony) || 0,
          dwellingReduction: hasDwelling,
          dwellingValue: hasDwelling ? Number(dwellingValue) || 0 : 0,
          disability,
          lifeInsuranceAmount: Number(insurance) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error en el cálculo");
      }
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-5">
      {/* ─── Formulario ─────────────────────────────────── */}
      <div className="md:col-span-2 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Datos de la herencia</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Comunidad Autónoma</label>
            <select
              value={ccaa}
              onChange={(e) => setCcaa(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {CCAA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Grupo de parentesco</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as Group)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {group === "I" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Edad del heredero (años)</label>
              <input
                type="number"
                min={0}
                max={20}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Ej. 12"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Valor neto heredado (€) <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="200000"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Patrimonio preexistente del heredero (€)
            </label>
            <input
              type="number"
              min={0}
              value={patrimony}
              onChange={(e) => setPatrimony(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Determina el coeficiente multiplicador (art. 22).
            </p>
          </div>

          <div className="rounded-md bg-slate-50 p-3 space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasDwelling}
                onChange={(e) => setHasDwelling(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-slate-700">Heredo vivienda habitual</span>
                <span className="block text-xs text-slate-500">
                  Reducción del 95% (máx. 122.606€). Sólo grupos I, II y III con convivencia.
                </span>
              </span>
            </label>
            {hasDwelling && (
              <input
                type="number"
                min={0}
                value={dwellingValue}
                onChange={(e) => setDwellingValue(e.target.value)}
                placeholder="Valor de la vivienda (€)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Discapacidad del heredero</label>
            <select
              value={disability}
              onChange={(e) => setDisability(e.target.value as Disability)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="none">Sin discapacidad</option>
              <option value="33-65">Entre 33% y 65% (47.858€)</option>
              <option value="65+">≥ 65% (150.253€)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Seguros de vida cobrados (€)</label>
            <input
              type="number"
              min={0}
              value={insurance}
              onChange={(e) => setInsurance(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Reducción del 100% hasta 9.195€ (grupos I-II).
            </p>
          </div>

          <button
            onClick={calculate}
            disabled={!canCalculate || loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Calculando..." : "Calcular impuesto"}
          </button>

          {error && (
            <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
          )}
        </div>
      </div>

      {/* ─── Resultado + comparativa ─────────────────────── */}
      <div className="md:col-span-3 space-y-6">
        {!data ? (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
            <div>
              <p className="text-slate-600">
                Introduce los datos de la herencia y pulsa <strong>Calcular impuesto</strong>.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Verás la cuota a pagar, el desglose oficial y la comparativa con
                el resto de Comunidades Autónomas.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ResultCard data={data} ccaaLabel={CCAA_OPTIONS.find(o => o.value === ccaa)?.label || ccaa} comparison={data.comparison} />
            <ComparisonTable comparison={data.comparison} currentCcaa={ccaa} />
          </>
        )}
      </div>
    </div>
  );
}

function ResultCard({ data, ccaaLabel, comparison }: { data: ApiResponse; ccaaLabel: string; comparison: Comparison[] }) {
  const { result } = data;
  const cheapest = comparison[0];
  const savingsVsCurrent = result.cuotaAPagar - cheapest.cuotaAPagar;

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Cuota a pagar en {ccaaLabel}
        </h3>
        {result.cuotaAPagar > 0 && (
          <span className="text-xs text-slate-500">
            Tipo efectivo: {((result.cuotaAPagar / result.baseImponible) * 100).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="mt-2 text-4xl font-bold text-slate-900">
        {fmtEUR(result.cuotaAPagar)}
      </div>

      {savingsVsCurrent > 0.5 && cheapest.ccaa !== "" && (
        <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          En <strong>{cheapest.label}</strong> pagarías {fmtEUR(cheapest.cuotaAPagar)} —
          una diferencia de <strong>{fmtEUR(savingsVsCurrent)}</strong>.
        </p>
      )}

      <div className="mt-6 space-y-2 border-t pt-4 text-sm">
        <Row label="Base imponible" value={fmtEUR(result.baseImponible)} />
        <Row label="Reducción por parentesco" value={`− ${fmtEUR(result.desglose.reduccionParentesco)}`} muted />
        {result.desglose.reduccionVivienda > 0 && (
          <Row label="Reducción por vivienda habitual" value={`− ${fmtEUR(result.desglose.reduccionVivienda)}`} muted />
        )}
        {result.desglose.reduccionDiscapacidad > 0 && (
          <Row label="Reducción por discapacidad" value={`− ${fmtEUR(result.desglose.reduccionDiscapacidad)}`} muted />
        )}
        {result.desglose.reduccionSeguroVida > 0 && (
          <Row label="Reducción seguros de vida" value={`− ${fmtEUR(result.desglose.reduccionSeguroVida)}`} muted />
        )}
        <Row label="Base liquidable" value={fmtEUR(result.baseLiquidable)} bold />
        <Row label="Cuota íntegra (tarifa estatal)" value={fmtEUR(result.cuotaIntegra)} />
        <Row label={`Coeficiente multiplicador (×${result.coeficienteMultiplicador})`} value={fmtEUR(result.cuotaTributaria)} />
        {result.bonificacionCcaa > 0 && (
          <Row label="Bonificación autonómica" value={`− ${fmtEUR(result.bonificacionCcaa)}`} muted />
        )}
        <Row label="Cuota a pagar" value={fmtEUR(result.cuotaAPagar)} bold highlight />
      </div>
    </div>
  );
}

function Row({ label, value, muted, bold, highlight }: { label: string; value: string; muted?: boolean; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${highlight ? "rounded-md bg-blue-50 px-2 py-1 -mx-2" : ""}`}>
      <span className={`text-slate-${muted ? "500" : "700"} ${bold ? "font-semibold" : ""}`}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold text-slate-900" : "text-slate-700"} ${muted ? "text-slate-500" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function ComparisonTable({ comparison, currentCcaa }: { comparison: Comparison[]; currentCcaa: string }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Comparativa entre Comunidades Autónomas</h3>
      <p className="mt-1 text-sm text-slate-500">
        Cuota a pagar con los mismos datos en cada CCAA. Ordenado de menor a mayor.
      </p>
      <div className="mt-4 overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Comunidad Autónoma</th>
              <th className="px-3 py-2 text-right">Bonificación</th>
              <th className="px-3 py-2 text-right">Cuota a pagar</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {comparison.map((c) => (
              <tr
                key={c.ccaa}
                className={c.ccaa === currentCcaa ? "bg-blue-50 font-semibold" : ""}
              >
                <td className="px-3 py-2 text-slate-700">
                  {c.label}
                  {c.foralRegime && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase text-amber-800">
                      Foral
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                  {fmtPct(c.bonificacionPct)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {fmtEUR(c.cuotaAPagar)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Las CCAA forales (Navarra, País Vasco) aplican régimen propio; el cálculo
        mostrado es orientativo según la tarifa estatal.
      </p>
    </div>
  );
}
