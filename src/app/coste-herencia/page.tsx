import type { Metadata } from "next";
import Link from "next/link";
import { CosteHerenciaClient } from "./coste-herencia-client";

export const metadata: Metadata = {
  title: "Cuánto cuesta heredar una casa — Calculadora del coste total de una herencia",
  description:
    "Calcula gratis el coste total de heredar: Impuesto de Sucesiones, plusvalía municipal, notaría y registro en un único desglose. Actualizado 2025.",
  keywords: [
    "cuanto cuesta heredar una casa",
    "coste de una herencia",
    "gastos de heredar",
    "cuanto se paga por heredar",
    "impuestos herencia total",
    "gastos notaria herencia",
  ],
  alternates: { canonical: "https://bariturpro.com/coste-herencia" },
  openGraph: {
    title: "Cuánto cuesta heredar — Calculadora del coste total",
    description: "ISD + plusvalía + notaría + registro en un solo desglose.",
    type: "website",
  },
};

export default function CosteHerenciaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Cuánto cuesta heredar una casa en España?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "El coste de heredar incluye el Impuesto de Sucesiones (Modelo 650, autonómico), la plusvalía municipal si hay inmuebles, los aranceles de notaría por la escritura de aceptación y los del Registro de la Propiedad. En comunidades con bonificación del 99% como Madrid, el grueso del coste suelen ser notaría y registro (unos cientos a un par de miles de euros). En comunidades sin bonificación, el Impuesto de Sucesiones puede ser la partida más alta.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué gastos tiene aceptar una herencia?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Impuesto sobre Sucesiones, plusvalía municipal (si hay inmuebles urbanos), aranceles notariales por la escritura de aceptación y partición, aranceles del Registro de la Propiedad para inscribir los bienes, y opcionalmente honorarios de gestoría o abogado.",
        },
      },
      {
        "@type": "Question",
        name: "¿Se puede rechazar una herencia para no pagar?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sí. Si la herencia tiene más deudas que bienes, se puede renunciar ante notario o aceptarla a beneficio de inventario (responder de las deudas solo hasta el valor de los bienes recibidos). Conviene valorar el caudal completo antes de decidir.",
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-primary">BARITUR PRO</Link>
            <nav className="flex gap-3 sm:gap-4 text-sm">
              <Link href="/calculadora-isd" className="text-gray-700 hover:text-primary">Sucesiones</Link>
              <Link href="/calculadora-plusvalia" className="text-gray-700 hover:text-primary hidden sm:inline">Plusvalía</Link>
              <Link href="/guia-fallecimiento" className="text-gray-700 hover:text-primary hidden md:inline">Guía</Link>
              <Link href="/#demo" className="text-primary font-semibold">Probar gratis</Link>
            </nav>
          </div>
        </header>

        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-14">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              ISD + plusvalía + notaría + registro · Todo en uno
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">¿Cuánto cuesta heredar?</h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-2xl">
              La pregunta que toda familia se hace. Calcula el coste total de una herencia con todos
              los conceptos: Impuesto de Sucesiones, plusvalía municipal, notaría y registro.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 -mt-6 mb-10 relative z-0">
          <CosteHerenciaClient />
        </div>

        {/* Explanation */}
        <div className="max-w-3xl mx-auto px-4 pb-12 space-y-6">
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Los 4 (o 5) costes de heredar</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <p className="font-semibold text-gray-900">1. Impuesto sobre Sucesiones (Modelo 650)</p>
                <p>Impuesto autonómico. Varía enormemente según la CCAA: de prácticamente cero en comunidades con bonificación del 99% a decenas de miles de euros donde no hay bonificación.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">2. Plusvalía municipal (si hay inmuebles)</p>
                <p>Impuesto del ayuntamiento sobre el incremento de valor del suelo urbano. Solo aplica a inmuebles urbanos.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">3. Notaría</p>
                <p>Aranceles por la escritura de aceptación y partición de la herencia. Dependen del valor de los bienes y del número de herederos.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">4. Registro de la Propiedad</p>
                <p>Aranceles por inscribir los inmuebles a nombre de los herederos.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">5. Gestoría o abogado (opcional)</p>
                <p>Honorarios por tramitar la herencia. No es obligatorio, pero recomendable en herencias con inmuebles o varios herederos.</p>
              </div>
            </div>
          </section>

          <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-amber-900 mb-2">Estimación orientativa</h2>
            <p className="text-sm text-amber-900">
              Esta calculadora ofrece una estimación. El Impuesto de Sucesiones se calcula con la
              tarifa estatal y la bonificación autonómica vigente. Los aranceles de notaría y registro
              siguen escalas oficiales pero el importe real depende del número de bienes, herederos y
              diligencias. Para una cifra exacta, pide presupuesto a la notaría y consulta la ordenanza
              fiscal de tu ayuntamiento.
            </p>
          </section>
        </div>

        {/* CTA */}
        <div className="max-w-3xl mx-auto px-4 pb-16">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <h2 className="text-xl font-bold mb-2">¿Gestionas herencias profesionalmente?</h2>
            <p className="text-blue-200 text-sm mb-5">
              BARITUR PRO calcula automáticamente todos los impuestos y coordina los plazos de cada
              expediente. 14 días gratis.
            </p>
            <Link
              href="/#demo"
              className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition"
            >
              Probar BARITUR PRO →
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            <strong>Aviso:</strong> Cálculo orientativo. No constituye asesoramiento fiscal ni jurídico.
            Los aranceles de notaría y registro son estimaciones simplificadas de las escalas oficiales.
          </p>
        </div>
      </div>
    </>
  );
}
