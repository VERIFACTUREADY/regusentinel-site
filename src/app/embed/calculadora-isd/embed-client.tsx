"use client";

import { useState, useEffect, useMemo } from "react";

type Group = "I" | "II" | "III" | "IV";

interface Comparison {
  ccaa: string;
  label: string;
  cuotaAPagar: number;
  bonificacionPct: number;
  foralRegime: boolean;
}

interface ApiResponse {
  result: {
    baseImponible: number;
    baseLiquidable: number;
    cuotaTributaria: number;
    bonificacionCcaa: number;
    cuotaAPagar: number;
  };
  comparison: Comparison[];
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
  { value: "II", label: "Cónyuge / hijos ≥21 / ascendientes" },
  { value: "I", label: "Hijos < 21 años" },
  { value: "III", label: "Hermanos / tíos / sobrinos" },
  { value: "IV", label: "Primos y otros" },
];

function fmtEUR(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface Props {
  theme: "light" | "dark";
  primaryHex: string;
  defaultCcaa: string;
  showCompare: boolean;
  utmSource: string;
}

export function EmbedClient({ theme, primaryHex, defaultCcaa, showCompare, utmSource }: Props) {
  const isDark = theme === "dark";
  const primaryColor = primaryHex ? `#${primaryHex}` : "#2563eb";

  const validCcaa = CCAA_OPTIONS.find((o) => o.value === defaultCcaa)?.value || "MADRID";

  const [ccaa, setCcaa] = useState(validCcaa);
  const [group, setGroup] = useState<Group>("II");
  const [base, setBase] = useState<string>("200000");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [patrimony, setPatrimony] = useState<string>("0");
  const [hasDwelling, setHasDwelling] = useState(false);
  const [dwellingValue, setDwellingValue] = useState<string>("");
  const [insurance, setInsurance] = useState<string>("");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctaUrl = `https://heredia.app/calculadora-isd?utm_source=${encodeURIComponent(utmSource)}&utm_medium=embed&utm_campaign=calculadora-isd`;
  const brandUrl = `https://heredia.app/?utm_source=${encodeURIComponent(utmSource)}&utm_medium=embed&utm_campaign=calculadora-isd-brand`;

  const canCalculate = useMemo(() => {
    const b = Number(base);
    return isFinite(b) && b > 0;
  }, [base]);

  // Notifica al host la altura del contenido para que pueda autoajustar el iframe.
  useEffect(() => {
    function notifyHeight() {
      if (typeof window === "undefined") return;
      const h = document.documentElement.scrollHeight;
      window.parent?.postMessage({ type: "heredia-isd-height", height: h }, "*");
    }
    notifyHeight();
    const ro = new ResizeObserver(notifyHeight);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [data, showAdvanced]);

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
          baseImponible: Number(base),
          preexistingPatrimony: Number(patrimony) || 0,
          dwellingReduction: hasDwelling,
          dwellingValue: hasDwelling ? Number(dwellingValue) || 0 : 0,
          lifeInsuranceAmount: Number(insurance) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const bg = isDark ? "bg-slate-900" : "bg-white";
  const fg = isDark ? "text-slate-100" : "text-slate-900";
  const subtle = isDark ? "text-slate-400" : "text-slate-500";
  const border = isDark ? "border-slate-700" : "border-slate-200";
  const inputBg = isDark ? "bg-slate-800" : "bg-white";
  const cardBg = isDark ? "bg-slate-800" : "bg-slate-50";

  return (
    <div className={`min-h-screen ${bg} ${fg} font-sans`} style={{ "--primary": primaryColor } as React.CSSProperties}>
      <div className="mx-auto max-w-md p-4 space-y-4">
        <div>
          <h1 className="text-base font-semibold">Calculadora del Impuesto de Sucesiones</h1>
          <p className={`mt-0.5 text-xs ${subtle}`}>Modelo 650 · Tarifa estatal + bonificaciones autonómicas</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className={`text-xs font-medium ${subtle}`}>Comunidad Autónoma</label>
            <select
              value={ccaa}
              onChange={(e) => setCcaa(e.target.value)}
              className={`mt-1 w-full rounded-md border ${border} ${inputBg} px-2 py-1.5 text-sm`}
            >
              {CCAA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={`text-xs font-medium ${subtle}`}>Parentesco</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as Group)}
              className={`mt-1 w-full rounded-md border ${border} ${inputBg} px-2 py-1.5 text-sm`}
            >
              {GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={`text-xs font-medium ${subtle}`}>Valor neto heredado (€)</label>
            <input
              type="number"
              min={0}
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="200000"
              className={`mt-1 w-full rounded-md border ${border} ${inputBg} px-2 py-1.5 text-sm`}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`text-xs ${subtle} hover:underline`}
          >
            {showAdvanced ? "▾ Ocultar opciones avanzadas" : "▸ Mostrar opciones avanzadas"}
          </button>

          {showAdvanced && (
            <div className={`space-y-3 rounded-md ${cardBg} p-3`}>
              <div>
                <label className={`text-xs font-medium ${subtle}`}>Patrimonio preexistente (€)</label>
                <input
                  type="number"
                  min={0}
                  value={patrimony}
                  onChange={(e) => setPatrimony(e.target.value)}
                  className={`mt-1 w-full rounded-md border ${border} ${inputBg} px-2 py-1.5 text-sm`}
                />
              </div>
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={hasDwelling}
                  onChange={(e) => setHasDwelling(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Hereda vivienda habitual (reducción 95%)</span>
              </label>
              {hasDwelling && (
                <input
                  type="number"
                  min={0}
                  value={dwellingValue}
                  onChange={(e) => setDwellingValue(e.target.value)}
                  placeholder="Valor vivienda (€)"
                  className={`w-full rounded-md border ${border} ${inputBg} px-2 py-1.5 text-sm`}
                />
              )}
              <div>
                <label className={`text-xs font-medium ${subtle}`}>Seguros de vida cobrados (€)</label>
                <input
                  type="number"
                  min={0}
                  value={insurance}
                  onChange={(e) => setInsurance(e.target.value)}
                  className={`mt-1 w-full rounded-md border ${border} ${inputBg} px-2 py-1.5 text-sm`}
                />
              </div>
            </div>
          )}

          <button
            onClick={calculate}
            disabled={!canCalculate || loading}
            className="w-full rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {loading ? "Calculando..." : "Calcular"}
          </button>

          {error && (
            <p className="rounded-md bg-rose-100 p-2 text-xs text-rose-800">{error}</p>
          )}
        </div>

        {data && (
          <div className={`rounded-lg border ${border} ${cardBg} p-4 space-y-3`}>
            <div>
              <div className={`text-xs uppercase tracking-wide ${subtle}`}>Cuota a pagar</div>
              <div className="mt-1 text-3xl font-bold" style={{ color: "var(--primary)" }}>
                {fmtEUR(data.result.cuotaAPagar)}
              </div>
            </div>

            <div className={`space-y-1 border-t ${border} pt-3 text-xs`}>
              <Row label="Base liquidable" value={fmtEUR(data.result.baseLiquidable)} muted={isDark} />
              <Row label="Cuota tributaria" value={fmtEUR(data.result.cuotaTributaria)} muted={isDark} />
              {data.result.bonificacionCcaa > 0 && (
                <Row label="Bonificación autonómica" value={`− ${fmtEUR(data.result.bonificacionCcaa)}`} muted={isDark} />
              )}
            </div>

            {showCompare && data.comparison && (
              <details>
                <summary className={`cursor-pointer text-xs font-medium ${subtle}`}>
                  ¿Cuánto pagarías en otra CCAA? ({data.comparison.length})
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody className={`divide-y ${border}`}>
                      {data.comparison.map((c) => (
                        <tr key={c.ccaa} className={c.ccaa === ccaa ? "font-semibold" : ""}>
                          <td className="py-1">{c.label}</td>
                          <td className="py-1 text-right tabular-nums">{fmtEUR(c.cuotaAPagar)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <a
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-md px-3 py-2 text-center text-xs font-medium text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Ver desglose completo y comparativa
            </a>
          </div>
        )}

        <div className={`text-[10px] ${subtle} space-y-1`}>
          <p>Estimación orientativa basada en la Ley 29/1987 y bonificaciones autonómicas vigentes 2025. No sustituye asesoramiento profesional.</p>
          <p className="pt-2">
            <a
              href={brandUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Powered by <strong>Heredia</strong>
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={muted ? "text-slate-400" : "text-slate-600"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
