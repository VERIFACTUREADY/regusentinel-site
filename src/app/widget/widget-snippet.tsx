"use client";

import { useState } from "react";

const HOST = typeof window !== "undefined" ? window.location.origin : "https://heredia.app";

export function WidgetSnippet() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [primary, setPrimary] = useState("2563eb");
  const [ccaa, setCcaa] = useState("MADRID");
  const [copied, setCopied] = useState(false);

  const src = `${HOST}/embed/calculadora-isd?theme=${theme}&primary=${primary}&ccaa=${ccaa}&utm_source=mi-web`;
  const snippet = `<iframe
  src="${src}"
  width="100%"
  height="720"
  frameborder="0"
  style="border:0; max-width:480px;"
  title="Calculadora del Impuesto de Sucesiones"
></iframe>`;

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Configuración + snippet */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Personaliza</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium text-slate-600">Tema</label>
              <div className="mt-1 flex gap-2">
                {(["light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`rounded-md border px-3 py-1.5 text-xs ${theme === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-700"}`}
                  >
                    {t === "light" ? "Claro" : "Oscuro"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Color principal (hex sin #)</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value.replace(/[^a-fA-F0-9]/g, "").slice(0, 6))}
                  placeholder="2563eb"
                  className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono"
                />
                <span
                  className="h-7 w-7 rounded-md border border-slate-300"
                  style={{ backgroundColor: `#${primary || "2563eb"}` }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">CCAA por defecto</label>
              <select
                value={ccaa}
                onChange={(e) => setCcaa(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="MADRID">Madrid</option>
                <option value="ANDALUCIA">Andalucía</option>
                <option value="CATALUNA">Cataluña</option>
                <option value="VALENCIA">Comunidad Valenciana</option>
                <option value="GALICIA">Galicia</option>
                <option value="MURCIA">Murcia</option>
                <option value="CASTILLA_LEON">Castilla y León</option>
                <option value="CASTILLA_LA_MANCHA">Castilla-La Mancha</option>
                <option value="CANARIAS">Canarias</option>
                <option value="BALEARES">Islas Baleares</option>
                <option value="ARAGON">Aragón</option>
                <option value="ASTURIAS">Asturias</option>
                <option value="CANTABRIA">Cantabria</option>
                <option value="EXTREMADURA">Extremadura</option>
                <option value="LA_RIOJA">La Rioja</option>
                <option value="NAVARRA">Navarra</option>
                <option value="PAIS_VASCO">País Vasco</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase text-slate-400">Snippet HTML</h3>
            <button
              onClick={copy}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
            >
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto text-xs leading-relaxed text-slate-100">
{snippet}
          </pre>
        </div>
      </div>

      {/* Preview en vivo */}
      <div className="rounded-xl border bg-slate-100 p-3">
        <div className="mb-2 text-xs font-medium text-slate-500">Vista previa</div>
        <iframe
          key={`${theme}-${primary}-${ccaa}`}
          src={`/embed/calculadora-isd?theme=${theme}&primary=${primary}&ccaa=${ccaa}&utm_source=widget-preview`}
          width="100%"
          height="720"
          frameBorder={0}
          style={{ border: 0, maxWidth: 480, display: "block", margin: "0 auto", borderRadius: 8, background: "white" }}
          title="Calculadora ISD — preview"
        />
      </div>
    </div>
  );
}
