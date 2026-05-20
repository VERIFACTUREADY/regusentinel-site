import type { Metadata } from "next";
import { PlusvaliaClient } from "./plusvalia-client";
import { ProUpsell } from "@/components/pro-upsell";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Calculadora de Plusvalía Municipal 2025 — IIVTNU por herencia",
  description:
    "Calcula gratis la plusvalía municipal de un inmueble heredado por los dos métodos (objetivo y real) y descubre cuál te conviene. Actualizada a la reforma de 2021.",
  keywords: [
    "calculadora plusvalia municipal",
    "plusvalia municipal herencia",
    "iivtnu",
    "plusvalia inmueble heredado",
    "metodo objetivo plusvalia",
    "plusvalia real",
  ],
  alternates: { canonical: "https://bariturpro.com/calculadora-plusvalia" },
  openGraph: {
    title: "Calculadora de Plusvalía Municipal — IIVTNU",
    description: "Calcula la plusvalía municipal por los dos métodos y elige el menor.",
    type: "website",
  },
};

export default function CalculadoraPlusvaliaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Qué es la plusvalía municipal en una herencia?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "La plusvalía municipal (IIVTNU) es un impuesto del ayuntamiento que grava el incremento del valor del suelo urbano cuando se transmite un inmueble. En una herencia la pagan los herederos, además del Impuesto de Sucesiones (Modelo 650). El plazo es de 6 meses desde el fallecimiento, prorrogable a un año.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cuáles son los dos métodos de cálculo de la plusvalía municipal?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Tras la reforma de 2021 (RDL 26/2021) existen dos métodos: el objetivo (valor catastral del suelo × coeficiente según años de tenencia) y el real (incremento real de valor × proporción del suelo). El contribuyente puede elegir el que resulte más bajo.",
        },
      },
      {
        "@type": "Question",
        name: "¿Se paga plusvalía municipal si el inmueble ha perdido valor?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Si no hay incremento real de valor entre la adquisición y la transmisión, la operación está no sujeta al impuesto. El contribuyente debe poder acreditarlo con las escrituras de compra y de la herencia.",
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
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-14">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              IIVTNU · Reforma 2021 · Los dos métodos
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Calculadora de Plusvalía Municipal</h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-2xl">
              Calcula la plusvalía municipal de un inmueble heredado por los dos métodos legales —
              objetivo y real — y descubre cuál te conviene. Si no hubo incremento de valor, no se paga.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 -mt-6 mb-10 relative z-0">
          <PlusvaliaClient />
        </div>

        {/* Explanation */}
        <div className="max-w-3xl mx-auto px-4 pb-12 space-y-6">
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Qué es la plusvalía municipal en una herencia</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              La plusvalía municipal (oficialmente IIVTNU, Impuesto sobre el Incremento de Valor de los
              Terrenos de Naturaleza Urbana) grava el aumento de valor del <strong>suelo urbano</strong>
              {" "}cuando se transmite un inmueble. En una herencia la pagan los herederos.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              Es un impuesto <strong>municipal</strong>, distinto e independiente del Impuesto de
              Sucesiones (Modelo 650, que es autonómico). Por una vivienda heredada se pagan ambos.
            </p>
          </section>

          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Los dos métodos tras la reforma de 2021</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <p className="font-semibold text-gray-900">Método objetivo</p>
                <p>Valor catastral del suelo × coeficiente (según años de tenencia) × tipo de gravamen municipal. Coeficientes y tipos máximos fijados por ley; cada ayuntamiento puede aplicar valores inferiores.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Método real (estimación directa)</p>
                <p>Incremento real de valor (valor de transmisión − valor de adquisición) × proporción que el suelo representa del valor catastral total × tipo de gravamen.</p>
              </div>
            </div>
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-900">
                <strong>Puedes elegir el método que te resulte más barato.</strong> Y si no hubo
                incremento de valor (el inmueble vale menos que cuando se adquirió), la operación está
                no sujeta y no se paga nada — debes acreditarlo con las escrituras.
              </p>
            </div>
          </section>

          <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-amber-900 mb-2">Importante: plazos y exactitud</h2>
            <p className="text-sm text-amber-900">
              El plazo para liquidar la plusvalía en una herencia es de 6 meses desde el fallecimiento,
              prorrogable a un año en la mayoría de municipios. Esta calculadora usa los coeficientes
              máximos estatales: el resultado es orientativo, ya que cada ayuntamiento fija sus propios
              coeficientes y tipos. Consulta la ordenanza fiscal de tu municipio para el cálculo exacto.
            </p>
          </section>
        </div>

        {/* CTA */}
        <ProUpsell
          freeToolName="Esta calculadora de plusvalía municipal"
          freeToolDesc="estima el IIVTNU de un inmueble puntual; no lo vincula al expediente ni a sus plazos."
        />

        <div className="max-w-3xl mx-auto px-4 pb-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            <strong>Aviso:</strong> Cálculo orientativo basado en los coeficientes máximos estatales.
            Cada ayuntamiento fija sus propios coeficientes y tipos de gravamen (siempre iguales o
            inferiores a los máximos legales). No constituye asesoramiento fiscal.
          </p>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
