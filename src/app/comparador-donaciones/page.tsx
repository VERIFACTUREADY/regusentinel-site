import type { Metadata } from "next";
import Link from "next/link";
import {
  compareDonacionCCAAs,
  getDonacionBonification,
} from "@/lib/donaciones-calculator";
import { CCAA_LABELS, type CCAAKey } from "@/lib/isd-calculator";
import { ComparadorDonacionesClient } from "./comparador-donaciones-client";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Comparador del Impuesto de Donaciones por CCAA 2025 — Modelo 651",
  description:
    "Compara cuánto se paga por una donación en las 17 comunidades autónomas. Tabla interactiva del Modelo 651 con bonificaciones y cuotas reales por grupo de parentesco.",
  keywords: [
    "comparador donaciones ccaa",
    "donde se paga menos donacion",
    "impuesto donaciones comparativa",
    "modelo 651 por comunidad",
    "bonificacion donaciones autonomica",
  ],
  alternates: { canonical: "https://bariturpro.com/comparador-donaciones" },
  openGraph: {
    title: "Comparador del Impuesto de Donaciones por CCAA",
    description: "Cuánto tributa una donación en cada comunidad autónoma. Tabla interactiva 2025.",
    type: "website",
  },
};

const ALL_CCAA = Object.keys(CCAA_LABELS) as CCAAKey[];

function formatEUR(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export default function ComparadorDonacionesPage() {
  // Datos por defecto para SSR (grupo II, 100.000 €)
  const initialRows = compareDonacionCCAAs({
    group: "II",
    baseImponible: 100000,
    preexistingPatrimony: 0,
  });

  const cheapest = initialRows[0];
  const mostExpensive = initialRows[initialRows.length - 1];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿En qué comunidad autónoma se paga menos por una donación?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Para una donación de 100.000 € a un descendiente directo (grupo II), ${cheapest.label} aplica la cuota más baja. La diferencia con la comunidad más cara puede superar varios miles de euros, porque cada CCAA fija sus propias bonificaciones para donaciones.`,
        },
      },
      {
        "@type": "Question",
        name: "¿Las bonificaciones de donaciones son iguales que las de herencias?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Muchas comunidades bonifican las donaciones de forma distinta a las sucesiones. Por ejemplo, Cataluña no aplica bonificación porcentual en donaciones (aunque tiene tarifa reducida), y otras CCAA tienen escalas diferentes.",
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 text-xs text-blue-300 mb-4">
              Modelo 651 · Actualizado 2025 · 17 CCAA
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">
              Comparador del Impuesto de Donaciones
            </h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-2xl">
              Cuánto se paga por una donación en cada comunidad autónoma. La misma donación puede
              costar muy distinto según la CCAA: compara las 17 al instante.
            </p>
          </div>
        </div>

        {/* Stats band */}
        <div className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">17</p>
              <p className="text-xs text-gray-500 mt-0.5">Comunidades comparadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{formatEUR(cheapest.cuotaAPagar)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Mínimo (gr. II, 100K)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-600">{formatEUR(mostExpensive.cuotaAPagar)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Máximo (gr. II, 100K)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">30 días</p>
              <p className="text-xs text-gray-500 mt-0.5">Plazo del Modelo 651</p>
            </div>
          </div>
        </div>

        {/* Interactive comparator */}
        <div className="max-w-5xl mx-auto px-4 py-10">
          <ComparadorDonacionesClient initialRows={initialRows} />
        </div>

        {/* CCAA cards */}
        <div className="max-w-5xl mx-auto px-4 pb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Bonificación de donaciones por CCAA (grupo II)</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {ALL_CCAA.map((ccaa) => {
              const b = getDonacionBonification(ccaa, "II");
              const tier = b.foralRegime ? "foral" : b.pct >= 99 ? "excellent" : b.pct >= 80 ? "good" : b.pct >= 50 ? "medium" : "low";
              const tierColors = {
                foral: "border-purple-200 bg-purple-50",
                excellent: "border-emerald-200 bg-emerald-50",
                good: "border-blue-200 bg-blue-50",
                medium: "border-amber-200 bg-amber-50",
                low: "border-rose-200 bg-rose-50",
              };
              const badgeColors = {
                foral: "bg-purple-100 text-purple-700",
                excellent: "bg-emerald-100 text-emerald-700",
                good: "bg-blue-100 text-blue-700",
                medium: "bg-amber-100 text-amber-700",
                low: "bg-rose-100 text-rose-700",
              };
              return (
                <div key={ccaa} className={`rounded-lg border p-4 ${tierColors[tier]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{CCAA_LABELS[ccaa]}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColors[tier]}`}>
                      {b.foralRegime ? "Foral" : `${b.pct}%`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-snug line-clamp-2">{b.note}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div className="max-w-3xl mx-auto px-4 pb-12">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Donaciones: por qué importa la CCAA</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              En una donación, la comunidad autónoma competente es la de residencia del donatario (para
              bienes muebles) o la de ubicación del inmueble. Esa CCAA determina la bonificación aplicable.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              A diferencia de las herencias, las bonificaciones de donaciones varían más entre comunidades.
              Algunas que bonifican al 99% las sucesiones aplican escalas distintas a las donaciones, y
              Cataluña no usa bonificación porcentual sino una tarifa reducida específica.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-5xl mx-auto px-4 pb-16">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-3">Calcula tu donación concreta</h2>
            <p className="text-blue-200 mb-6 max-w-lg mx-auto">
              Con la calculadora del Modelo 651 obtienes la cuota exacta con reducciones específicas
              (vivienda habitual, empresa familiar) aplicadas.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/calculadora-donaciones" className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition">
                Calculadora de Donaciones →
              </Link>
              <Link href="/borrador-modelo651" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition">
                Borrador Modelo 651
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
