import type { Metadata } from "next";
import Link from "next/link";
import { BorradorM651Client } from "./borrador-client";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Borrador Modelo 651 gratis - Generador de PDF de Donaciones",
  description:
    "Genera gratis un borrador del Modelo 651 (Impuesto sobre Donaciones) en PDF con plazos legales y cuota estimada por CCAA. Sin registro.",
  keywords: [
    "borrador modelo 651",
    "modelo 651 pdf",
    "modelo 651 gratis",
    "donacion pdf",
    "impuesto donaciones plantilla",
  ],
  alternates: { canonical: "https://bariturpro.com/borrador-modelo651" },
  openGraph: {
    title: "Borrador del Modelo 651 - PDF gratuito",
    description:
      "Genera un borrador profesional del Modelo 651 (donaciones) en 30 segundos. Plazos calculados, bonificacion CCAA y cuota estimada.",
    type: "website",
  },
};

export default function BorradorM651Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Borrador Modelo 651",
    description: "Generador gratuito de borrador del Modelo 651 (Impuesto sobre Donaciones)",
    applicationCategory: "BusinessApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    operatingSystem: "Web",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              Modelo 651 - Plazo 30 dias - Gratis sin registro
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
              Borrador del Modelo 651 <br className="hidden sm:block" />
              <span className="text-blue-300">de donaciones</span>
            </h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-2xl mb-6">
              Genera gratis un PDF de trabajo con datos del donante, donatario, plazos legales,
              cuota estimada y checklist de documentación. Sin registro.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-blue-200">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Plazo 30 dias hábiles calculado
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Cuota CCAA + reducciones
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Checklist documental
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 -mt-8 mb-10">
          <BorradorM651Client />
        </div>

        {/* CTA */}
        <div className="max-w-3xl mx-auto px-4 pb-16">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white">
            <h2 className="text-xl font-bold mb-3">Para gestorías que tramitan donaciones</h2>
            <p className="text-blue-200 text-sm mb-5">
              BARITUR PRO automatiza también los expedientes de donación: portal donatario,
              alertas del plazo de 30 días y dossier para escritura pública.
            </p>
            <Link
              href="/#demo"
              className="inline-block px-7 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition"
            >
              Probar 14 días gratis →
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            <strong>Aviso legal:</strong> El PDF generado es un documento de trabajo orientativo y no
            sustituye al modelo oficial de la AEAT/CCAA ni al asesoramiento de un profesional fiscal.
            Las reducciones específicas (vivienda habitual, empresa familiar) tienen requisitos
            adicionales que deben verificarse caso a caso.
          </p>
        </div>
      </div>
    </>
  );
}
