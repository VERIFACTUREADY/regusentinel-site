import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "API pública gratuita ISD — Heredia Developers",
  description:
    "API REST pública y gratuita para calcular el Impuesto sobre Sucesiones, comparar bonificaciones por CCAA y detectar riesgos de plazos. Sin autenticación. Rate limit 60 req/min.",
  keywords: [
    "api impuesto sucesiones",
    "api isd españa",
    "calculadora isd api",
    "api modelo 650",
    "api gestoria",
  ],
  alternates: {
    canonical: "https://heredia.app/docs/api",
  },
};

const BASE = "https://heredia.app";

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <SiteHeader />

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-14">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 text-xs text-blue-300 mb-4">
            v1 · Pública · Sin autenticación
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">API pública del ISD</h1>
          <p className="text-base text-blue-100 max-w-2xl mb-6">
            Endpoints REST gratuitos para calcular el Impuesto sobre Sucesiones, comparar bonificaciones
            entre las 17 CCAA y detectar riesgos de plazos. Pensados para integrar en gestorías,
            funerarias, software contable o cualquier aplicación que necesite cálculo del Modelo 650.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a href="#endpoints" className="px-4 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg font-medium transition">
              Ver endpoints
            </a>
            <a href="#ejemplos" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition">
              Ejemplos de código
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        {/* Quick facts */}
        <section className="grid sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Base URL</p>
            <p className="font-mono text-sm font-bold text-gray-900 mt-1 break-all">heredia.app</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Versión</p>
            <p className="font-mono text-sm font-bold text-gray-900 mt-1">v1</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Rate limit</p>
            <p className="font-mono text-sm font-bold text-gray-900 mt-1">60 req/min/IP</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Auth</p>
            <p className="font-mono text-sm font-bold text-green-600 mt-1">No requerida</p>
          </div>
        </section>

        {/* Use cases */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Para qué sirve</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="text-green-500">✓</span>
              <span>Embeber un calculador de ISD en tu propia web sin necesidad del widget visual</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500">✓</span>
              <span>Integrar comparativas entre CCAA en software de planificación patrimonial</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500">✓</span>
              <span>Comprobar plazos del Modelo 650 desde un CRM o ERP de despachos profesionales</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500">✓</span>
              <span>Mostrar alertas de bonificación en tramos progresivos (Cataluña, Castilla-La Mancha)</span>
            </li>
          </ul>
        </section>

        {/* Endpoints list */}
        <section id="endpoints">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Endpoints</h2>
          <div className="space-y-6">
            {/* /isd-calc */}
            <EndpointCard
              method="POST"
              path="/api/public/isd-calc"
              title="Calcular ISD"
              description="Calcula la cuota tributaria con todas las reducciones estatales y la bonificación autonómica de la CCAA indicada."
              params={[
                { name: "group", type: "'I' | 'II' | 'III' | 'IV'", required: true, desc: "Grupo de parentesco según art. 20.2 Ley 29/1987" },
                { name: "baseImponible", type: "number", required: true, desc: "Caudal hereditario neto en euros (1 a 100.000.000)" },
                { name: "ccaa", type: "CCAAKey", required: false, desc: "Si se especifica, devuelve cuota con bonificación autonómica aplicada" },
                { name: "preexistingPatrimony", type: "number", required: false, desc: "Patrimonio preexistente del heredero (afecta coeficiente)" },
                { name: "ageIfMinor", type: "number", required: false, desc: "Edad del heredero si es menor de 21 (grupo I)" },
                { name: "dwellingReduction", type: "boolean", required: false, desc: "Aplica reducción del 95% por vivienda habitual del causante" },
                { name: "dwellingValue", type: "number", required: false, desc: "Valor de la vivienda habitual (necesario si dwellingReduction=true)" },
                { name: "disability", type: "'none' | '33-65' | '65+'", required: false, desc: "Reducción estatal por discapacidad del heredero" },
                { name: "lifeInsuranceAmount", type: "number", required: false, desc: "Importe del seguro de vida del causante (reducción art. 20.2.b)" },
              ]}
              example={`curl -X POST ${BASE}/api/public/isd-calc \\
  -H "Content-Type: application/json" \\
  -d '{
    "group": "II",
    "baseImponible": 200000,
    "ccaa": "MADRID",
    "preexistingPatrimony": 0
  }'`}
              response={`{
  "result": {
    "baseImponible": 200000,
    "totalReducciones": 15956.87,
    "baseLiquidable": 184043.13,
    "cuotaIntegra": 23797.27,
    "coeficienteMultiplicador": 1.0,
    "cuotaTributaria": 23797.27,
    "bonificacionCcaa": 23559.30,
    "cuotaAPagar": 237.97,
    "desglose": { ... }
  },
  "comparison": [ /* todas las CCAA ordenadas */ ],
  "ccaa": "MADRID"
}`}
            />

            {/* /isd-compare */}
            <EndpointCard
              method="GET"
              path="/api/public/isd-compare"
              title="Comparar 17 CCAA"
              description="Devuelve las cuotas a pagar en las 17 comunidades autónomas para los inputs dados, ordenadas de menor a mayor. Cacheable durante 1 hora."
              params={[
                { name: "group", type: "'I' | 'II' | 'III' | 'IV'", required: false, desc: "Grupo de parentesco (default: II)" },
                { name: "baseImponible", type: "number", required: false, desc: "Base imponible en euros (default: 200000)" },
                { name: "preexistingPatrimony", type: "number", required: false, desc: "Patrimonio preexistente (default: 0)" },
              ]}
              example={`curl "${BASE}/api/public/isd-compare?group=II&baseImponible=300000"`}
              response={`{
  "ccaaCount": 17,
  "group": "II",
  "baseImponible": 300000,
  "results": [
    { "ccaa": "MADRID", "label": "Madrid", "cuotaAPagar": 462.34, "bonificacionPct": 99 },
    { "ccaa": "ANDALUCIA", "label": "Andalucía", "cuotaAPagar": 462.34, "bonificacionPct": 99 },
    ...
  ]
}`}
            />

            {/* /isd-risks */}
            <EndpointCard
              method="POST"
              path="/api/public/isd-risks"
              title="Detectar riesgos"
              description="Detecta riesgos accionables sobre un caso concreto: vencimiento del plazo de presentación, ventana de prórroga, proximidad a tramos de bonificación, regímenes forales y CCAA desconocida."
              params={[
                { name: "deathDate", type: "string (ISO 8601)", required: true, desc: "Fecha del fallecimiento. Si es null, devuelve []" },
                { name: "province", type: "string", required: false, desc: "Provincia del causante (slug-friendly). Determina la CCAA competente" },
                { name: "estimatedInheritanceValue", type: "number", required: false, desc: "Importe estimado de la herencia (mejora detección de tramos)" },
                { name: "group", type: "'I' | 'II' | 'III' | 'IV'", required: false, desc: "Grupo de parentesco (default: II)" },
              ]}
              example={`curl -X POST ${BASE}/api/public/isd-risks \\
  -H "Content-Type: application/json" \\
  -d '{
    "deathDate": "2024-12-15",
    "province": "barcelona",
    "estimatedInheritanceValue": 105000,
    "group": "II"
  }'`}
              response={`{
  "risks": [
    {
      "id": "isd_30d",
      "severity": "warning",
      "title": "Quedan 28 días para presentar el Modelo 650",
      "description": "El plazo se acerca...",
      "action": "Validar tasaciones, certificados y escritura"
    },
    {
      "id": "threshold_CATALUNA_100000",
      "severity": "warning",
      "title": "Has cruzado el umbral de 100.000€ en Cataluña",
      "description": "..."
    }
  ],
  "meta": { "ccaaCount": 17, "engine": "deterministic" }
}`}
            />

            {/* /modelo650-preview */}
            <EndpointCard
              method="POST"
              path="/api/public/modelo650-preview"
              title="Generar borrador Modelo 650 (PDF)"
              description="Devuelve un PDF de trabajo del Modelo 650 (Impuesto sobre Sucesiones) pre-rellenado con los datos del caudal. No es válido para presentar — sustituye al modelo oficial para revisión interna del despacho. Rate-limit más bajo (8 req/min/IP) por ser generación de PDF."
              params={[
                { name: "deceasedName", type: "string", required: true, desc: "Nombre del causante (2-200 caracteres)" },
                { name: "deceasedDni", type: "string", required: false, desc: "DNI/NIE del causante" },
                { name: "deathDate", type: "string (ISO 8601)", required: false, desc: "Fecha del fallecimiento. Si está, calcula plazos en el PDF" },
                { name: "province", type: "string", required: false, desc: "Provincia del causante (slug-friendly)" },
                { name: "contactName", type: "string", required: false, desc: "Nombre del heredero principal" },
                { name: "contactRelationship", type: "string", required: false, desc: "Parentesco con el causante" },
                { name: "estimatedValue", type: "number", required: false, desc: "Caudal estimado en € (calcula cuota orientativa)" },
                { name: "hasInsurance", type: "boolean", required: false, desc: "Si hay seguro de vida (añade sección)" },
              ]}
              example={`curl -X POST ${BASE}/api/public/modelo650-preview \\
  -H "Content-Type: application/json" \\
  -d '{
    "deceasedName": "García López, María",
    "deathDate": "2024-12-15",
    "province": "madrid",
    "estimatedValue": 200000
  }' \\
  --output borrador-650.pdf`}
              response={`PDF binario (Content-Type: application/pdf)
Cabeceras incluyen Content-Disposition: attachment; filename="borrador-modelo-650.pdf"`}
            />

            {/* /modelo651-preview */}
            <EndpointCard
              method="POST"
              path="/api/public/modelo651-preview"
              title="Generar borrador Modelo 651 (PDF)"
              description="Equivalente al endpoint 650 pero para donaciones. Devuelve un PDF de trabajo del Modelo 651 con plazo de 30 días hábiles calculado. Mismo rate-limit (8 req/min/IP)."
              params={[
                { name: "donorName", type: "string", required: true, desc: "Nombre del donante (2-200 caracteres)" },
                { name: "doneeName", type: "string", required: true, desc: "Nombre del donatario (2-200 caracteres)" },
                { name: "donationDate", type: "string (ISO 8601)", required: false, desc: "Fecha de la donación. Si está, calcula plazo en el PDF" },
                { name: "province", type: "string", required: false, desc: "Provincia del donatario (determina CCAA)" },
                { name: "amount", type: "number", required: false, desc: "Importe donado en € (calcula cuota orientativa)" },
                { name: "group", type: "'I' | 'II' | 'III' | 'IV'", required: false, desc: "Grupo de parentesco (default: II)" },
              ]}
              example={`curl -X POST ${BASE}/api/public/modelo651-preview \\
  -H "Content-Type: application/json" \\
  -d '{
    "donorName": "García López, María",
    "doneeName": "García Pérez, Antonio",
    "donationDate": "2025-03-01",
    "amount": 80000,
    "group": "II"
  }' \\
  --output borrador-651.pdf`}
              response={`PDF binario (Content-Type: application/pdf)`}
            />

            {/* /plantilla-documento */}
            <EndpointCard
              method="POST"
              path="/api/public/plantilla-documento"
              title="Generar plantilla de documento (PDF)"
              description="Renderiza una de las plantillas oficiales (carta al banco, solicitud de prórroga, declaración de siniestro, etc.) con los valores que pases. Rate-limit 12 req/min/IP."
              params={[
                { name: "slug", type: "string", required: true, desc: "Identificador de la plantilla. Ver /plantillas-documentos para el catálogo (banco-saldo, prorroga-650, aseguradora-siniestro, …)" },
                { name: "values", type: "object", required: false, desc: "Diccionario campo → valor con los placeholders de la plantilla. Strings limitadas a 1000 chars" },
              ]}
              example={`curl -X POST ${BASE}/api/public/plantilla-documento \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "banco-saldo",
    "values": {
      "entidad": "Banco Santander",
      "iban": "ES12 3456 …",
      "fechaFallecimiento": "2024-12-15"
    }
  }' \\
  --output carta-banco.pdf`}
              response={`PDF binario (Content-Type: application/pdf)
Si el slug no existe → 404 { "error": "Plantilla no encontrada" }`}
            />
          </div>
        </section>

        {/* Code examples */}
        <section id="ejemplos">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ejemplos en lenguajes</h2>
          <div className="space-y-4">
            <CodeBlock
              title="JavaScript (Fetch)"
              code={`const res = await fetch("${BASE}/api/public/isd-calc", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    group: "II",
    baseImponible: 200000,
    ccaa: "MADRID"
  })
});
const { result } = await res.json();
console.log("Cuota a pagar:", result.cuotaAPagar);`}
            />
            <CodeBlock
              title="Node.js (Axios)"
              code={`import axios from "axios";

const { data } = await axios.post(
  "${BASE}/api/public/isd-calc",
  { group: "II", baseImponible: 200000, ccaa: "MADRID" }
);
console.log("Cuota:", data.result.cuotaAPagar);`}
            />
            <CodeBlock
              title="Python"
              code={`import requests

r = requests.post(
    "${BASE}/api/public/isd-calc",
    json={"group": "II", "baseImponible": 200000, "ccaa": "MADRID"}
)
data = r.json()
print(f"Cuota: {data['result']['cuotaAPagar']}€")`}
            />
            <CodeBlock
              title="PHP"
              code={`$ch = curl_init("${BASE}/api/public/isd-calc");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
  "group" => "II",
  "baseImponible" => 200000,
  "ccaa" => "MADRID"
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);
echo "Cuota: " . $response["result"]["cuotaAPagar"];`}
            />
          </div>
        </section>

        {/* CCAA reference */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Códigos de CCAA (CCAAKey)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Usa estos identificadores en el campo <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">ccaa</code>:
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              "ANDALUCIA", "ARAGON", "ASTURIAS", "BALEARES", "CANARIAS",
              "CANTABRIA", "CASTILLA_LEON", "CASTILLA_LA_MANCHA", "CATALUNA",
              "EXTREMADURA", "GALICIA", "LA_RIOJA", "MADRID", "MURCIA",
              "NAVARRA", "PAIS_VASCO", "VALENCIA",
            ].map((c) => (
              <code key={c} className="bg-gray-50 border rounded px-2 py-1 font-mono text-gray-800">{c}</code>
            ))}
          </div>
        </section>

        {/* Errors */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Errores</h2>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <code className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono text-xs h-fit">400</code>
              <p className="text-gray-700">Datos inválidos. Devuelve <code className="text-xs bg-gray-100 px-1 rounded">{`{ "error": "..." }`}</code></p>
            </div>
            <div className="flex gap-3">
              <code className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-mono text-xs h-fit">429</code>
              <p className="text-gray-700">Rate limit superado. Cabecera <code className="text-xs bg-gray-100 px-1 rounded">Retry-After</code> indica los segundos hasta el reset.</p>
            </div>
          </div>
        </section>

        {/* Limits */}
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-amber-900 mb-3">Límites de uso</h2>
          <ul className="space-y-2 text-sm text-amber-900">
            <li>• 60 req/min/IP en endpoints de cálculo</li>
            <li>• 120 req/min/IP en /isd-compare (cacheable)</li>
            <li>• Sin autenticación — los datos son cálculos públicos</li>
            <li>• Para volúmenes mayores o SLA garantizado, contacta para una API key dedicada</li>
            <li>• Los regímenes forales (Navarra, País Vasco) devuelven cálculo orientativo basado en tarifa estatal</li>
          </ul>
        </section>

        {/* Disclaimer */}
        <section className="text-xs text-gray-500 border-t pt-6">
          <p>
            <strong>Aviso:</strong> Esta API devuelve cálculos orientativos según la normativa estatal y la
            bonificación autonómica vigente al momento de la actualización. No sustituye al asesoramiento
            de un profesional fiscal. La empresa que integra la API es responsable de validar los resultados
            antes de mostrarlos a usuarios finales.
          </p>
          <p className="mt-3">
            Para incidencias, mejoras o solicitar tipos de cálculo adicionales, escríbenos a{" "}
            <Link href="/contacto" className="text-primary hover:underline">contacto</Link>.
          </p>
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}

function EndpointCard({
  method,
  path,
  title,
  description,
  params,
  example,
  response,
}: {
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  params: { name: string; type: string; required: boolean; desc: string }[];
  example: string;
  response: string;
}) {
  const methodColor = method === "GET" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";

  return (
    <article className="bg-white rounded-xl border overflow-hidden">
      <header className="px-5 py-4 border-b flex items-center gap-3 flex-wrap">
        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${methodColor}`}>{method}</span>
        <code className="text-sm font-mono text-gray-900">{path}</code>
        <span className="text-xs text-gray-500 ml-auto">{title}</span>
      </header>

      <div className="p-5 space-y-5">
        <p className="text-sm text-gray-700">{description}</p>

        {/* Params table */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Parámetros</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Req.</th>
                  <th className="py-2 pr-3 font-medium">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p) => (
                  <tr key={p.name} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-gray-900">{p.name}</td>
                    <td className="py-2 pr-3 font-mono text-gray-600">{p.type}</td>
                    <td className="py-2 pr-3">
                      {p.required ? (
                        <span className="text-rose-600">sí</span>
                      ) : (
                        <span className="text-gray-400">no</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Example */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ejemplo de petición</h4>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto"><code>{example}</code></pre>
        </div>

        {/* Response */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Respuesta</h4>
          <pre className="bg-gray-50 border rounded-lg p-4 text-xs overflow-x-auto"><code>{response}</code></pre>
        </div>
      </div>
    </article>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-2 border-b bg-gray-50 text-xs font-medium text-gray-700">{title}</div>
      <pre className="bg-gray-900 text-gray-100 p-4 text-xs overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
}
