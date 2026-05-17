import type { Metadata } from "next";
import Link from "next/link";
import {
  CCAA_LABELS,
  getCCAABonification,
  calculateISDForCCAA,
  type CCAAKey,
  type ParentescoGroup,
} from "@/lib/isd-calculator";
import { CCAA_CONTENT } from "@/lib/ccaa-content";
import { ComparadorClient } from "./comparador-client";

export const metadata: Metadata = {
  title: "Comparador ISD por Comunidad Autónoma 2025 — Cuánto se paga en cada CCAA",
  description:
    "Compara el Impuesto sobre Sucesiones y Donaciones en las 17 comunidades autónomas. Tablas actualizadas 2025: bonificaciones, cuotas reales y diferencias de hasta 300.000 € entre autonomías.",
  keywords: [
    "impuesto sucesiones comunidades autonomas",
    "ISD por CCAA 2025",
    "comparador herencia españa",
    "cuanto se paga herencia madrid",
    "herencia cataluña",
    "bonificacion sucesiones",
    "modelo 650 autonomias",
  ],
  openGraph: {
    title: "Comparador ISD por Comunidad Autónoma 2025",
    description:
      "¿Cuánto tributa una herencia en Madrid frente a Valencia o Cataluña? Compara bonificaciones y cuotas reales para los 4 grupos de parentesco.",
    type: "website",
  },
  alternates: {
    canonical: "https://bariturpro.com/comparador-isd",
  },
};

const GROUPS: { key: ParentescoGroup; label: string; desc: string }[] = [
  { key: "I", label: "Grupo I", desc: "Hijos menores de 21 años" },
  { key: "II", label: "Grupo II", desc: "Cónyuge, hijos, padres" },
  { key: "III", label: "Grupo III", desc: "Hermanos, tíos, sobrinos" },
  { key: "IV", label: "Grupo IV", desc: "Sin vínculo familiar" },
];

const ALL_CCAA = Object.keys(CCAA_LABELS) as CCAAKey[];

// Precompute table data server-side for all scenario combinations
function buildTableData(group: ParentescoGroup, base: number) {
  return ALL_CCAA.map((ccaa) => {
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
  }).sort((a, b) => a.cuotaAPagar - b.cuotaAPagar);
}

// JSON-LD structured data
function buildJsonLd(group: ParentescoGroup, base: number) {
  const rows = buildTableData(group, base);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿En qué comunidad autónoma se paga menos herencia?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `En ${rows[0].label} la cuota es de ${rows[0].cuotaAPagar.toLocaleString("es-ES", { maximumFractionDigits: 0 })} € para una herencia de ${base.toLocaleString("es-ES")} € en ${GROUPS.find((g) => g.key === group)?.desc}. La diferencia con la comunidad más cara (${rows[rows.length - 1].label}) puede superar los ${Math.round((rows[rows.length - 1].cuotaAPagar - rows[0].cuotaAPagar) / 1000) * 1000} €.`,
        },
      },
      {
        "@type": "Question",
        name: "¿Cuánto se paga de herencia en Madrid?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Madrid tiene una bonificación del 99% para cónyuge, hijos y padres (grupo II). Para una herencia de ${base.toLocaleString("es-ES")} € la cuota efectiva es prácticamente cero.`,
        },
      },
      {
        "@type": "Question",
        name: "¿Hay diferencia entre comunidades autónomas en el impuesto de sucesiones?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sí, existe una diferencia enorme. Las comunidades con regímenes más favorables (Madrid, Andalucía, Galicia, Baleares) bonifican el 99-100% para herederos directos. En cambio, comunidades sin bonificación general pueden exigir cuotas de decenas de miles de euros.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué es el Modelo 650?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "El Modelo 650 es la autoliquidación del Impuesto sobre Sucesiones y Donaciones. Debe presentarse en la comunidad autónoma de residencia habitual del causante en los 6 meses siguientes al fallecimiento, con posibilidad de prórroga de 6 meses adicionales.",
        },
      },
    ],
  };
}

export default function ComparadorISDPage() {
  const defaultGroup: ParentescoGroup = "II";
  const defaultBase = 100000;
  const tableData = buildTableData(defaultGroup, defaultBase);
  const jsonLd = buildJsonLd(defaultGroup, defaultBase);

  const best = tableData[0];
  const worst = tableData[tableData.length - 1];
  const saving = worst.cuotaAPagar - best.cuotaAPagar;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-6">
                <span>Actualizado 2025</span>
                <span>·</span>
                <span>17 comunidades autónomas</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
                Comparador del Impuesto de Sucesiones<br className="hidden sm:block" /> por Comunidad Autónoma
              </h1>
              <p className="text-lg text-blue-100 mb-6">
                La misma herencia puede costar <strong className="text-white">0 € en Madrid</strong> y{" "}
                <strong className="text-white">
                  {saving.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €
                </strong>{" "}
                más en {worst.label}. Compara bonificaciones reales, cuotas efectivas y diferencias
                entre las 17 CCAA.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/calculadora-isd"
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg text-sm transition"
                >
                  Calcular mi caso concreto →
                </Link>
                <Link
                  href="/#demo"
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition"
                >
                  Ver BARITUR PRO gratis
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats band */}
        <div className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">17</p>
              <p className="text-xs text-gray-500 mt-0.5">Comunidades analizadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">0 €</p>
              <p className="text-xs text-gray-500 mt-0.5">Mínimo (Madrid gr. II)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {worst.cuotaAPagar.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Máximo (gr. II, 100K)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">6 meses</p>
              <p className="text-xs text-gray-500 mt-0.5">Plazo presentar Modelo 650</p>
            </div>
          </div>
        </div>

        {/* Interactive comparator */}
        <div className="max-w-5xl mx-auto px-4 py-10">
          <ComparadorClient initialData={tableData} initialGroup={defaultGroup} initialBase={defaultBase} />
        </div>

        {/* Info sections */}
        <div className="max-w-5xl mx-auto px-4 pb-16 space-y-10">
          {/* Key differences */}
          <div className="bg-white rounded-xl border p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              ¿Por qué hay tanta diferencia entre comunidades?
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              La Ley 29/1987 fija una <strong>tarifa estatal progresiva</strong> del 7,65% al 34% aplicable en
              todo el territorio. Sin embargo, las comunidades autónomas tienen competencia normativa para
              establecer <strong>bonificaciones sobre la cuota</strong> de hasta el 99-100%.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Comunidades como <strong>Madrid, Andalucía, Galicia, Canarias o Baleares</strong> han aprobado
              bonificaciones del 99% para cónyuge, hijos y padres (grupos I y II), lo que en la práctica hace
              que la herencia tribute <strong>prácticamente a cero</strong>.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">
              En cambio, comunidades sin bonificación general como <strong>Asturias o Comunitat Valenciana</strong>{" "}
              aplican la tarifa estatal completa, lo que puede suponer cuotas de decenas de miles de euros para
              herencias medianas.
            </p>
          </div>

          {/* CCAA summaries */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Tabla de bonificaciones por CCAA (grupo II)</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {ALL_CCAA.map((ccaa) => {
                const b = getCCAABonification(ccaa, "II", 100000);
                const tier = b.foralRegime ? "foral" : b.pct >= 99 ? "excellent" : b.pct >= 80 ? "good" : b.pct >= 50 ? "medium" : "low";
                const tierColors = {
                  foral: "border-purple-200 bg-purple-50",
                  excellent: "border-green-200 bg-green-50",
                  good: "border-blue-200 bg-blue-50",
                  medium: "border-amber-200 bg-amber-50",
                  low: "border-red-200 bg-red-50",
                };
                const badgeColors = {
                  foral: "bg-purple-100 text-purple-700",
                  excellent: "bg-green-100 text-green-700",
                  good: "bg-blue-100 text-blue-700",
                  medium: "bg-amber-100 text-amber-700",
                  low: "bg-red-100 text-red-700",
                };
                const ccaaSlug = CCAA_CONTENT[ccaa]?.slug;
                return (
                  <Link
                    key={ccaa}
                    href={ccaaSlug ? `/sucesiones/${ccaaSlug}` : "#"}
                    className={`rounded-lg border p-4 transition hover:shadow-md ${tierColors[tier]}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{CCAA_LABELS[ccaa]}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColors[tier]}`}>
                        {b.foralRegime ? "Foral" : `${b.pct}%`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-snug line-clamp-2">{b.note}</p>
                    <p className="text-[10px] text-gray-500 mt-1 group-hover:underline">Guía completa →</p>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-xl border p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Preguntas frecuentes</h2>
            <div className="space-y-5">
              {[
                {
                  q: "¿Qué CCAA aplica en el impuesto de sucesiones?",
                  a: "La CCAA competente es la de la residencia habitual del causante (fallecido) en los últimos 5 años. No importa dónde vivan los herederos ni dónde estén los bienes.",
                },
                {
                  q: "¿Se puede cambiar de CCAA para pagar menos herencia?",
                  a: "Para que el cambio de domicilio sea válido fiscalmente, el causante debe haber residido en la nueva CCAA durante al menos 5 años antes del fallecimiento. Los traslados fraudulentos pueden ser revisados por la AEAT.",
                },
                {
                  q: "¿Los regímenes forales tienen su propio impuesto?",
                  a: "Sí. Navarra y el País Vasco tienen su propia normativa foral del impuesto de sucesiones, generalmente más favorable que el régimen general. La gestión se realiza ante la Hacienda Foral correspondiente, no ante la AEAT.",
                },
                {
                  q: "¿Cuál es el plazo para presentar el Modelo 650?",
                  a: "6 meses desde el fallecimiento. Es posible solicitar una prórroga de 6 meses adicionales (hasta 12 en total), pero la solicitud debe hacerse antes del quinto mes. Fuera de plazo se aplican recargos del 5% al 20% más intereses de demora.",
                },
                {
                  q: "¿Qué pasa si hay bienes en varias comunidades autónomas?",
                  a: "La competencia se determina exclusivamente por la residencia habitual del causante, independientemente de dónde se ubiquen los bienes. Todos los bienes tributan en la misma CCAA.",
                },
              ].map(({ q, a }, i) => (
                <div key={i} className="border-b pb-5 last:border-0 last:pb-0">
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">{q}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-3">¿Gestorías y funerarias?</h2>
            <p className="text-blue-200 mb-6 max-w-lg mx-auto">
              BARITUR PRO automatiza el seguimiento de plazos, genera borradores del Modelo 650 y
              centraliza toda la documentación de cada expediente.
            </p>
            <Link
              href="/#demo"
              className="inline-block px-8 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl text-sm transition"
            >
              Probar gratis 14 días →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
