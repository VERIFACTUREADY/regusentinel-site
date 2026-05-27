import type { Metadata } from "next";
import Link from "next/link";
import { DOCUMENT_TEMPLATES } from "@/lib/document-templates";
import { PlantillasClient } from "./plantillas-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Plantillas gratuitas de documentos para herencia y post-mortem",
  description:
    "Descarga gratis modelos de carta al banco, prorroga del Modelo 650, declaracion de siniestro a aseguradora, comunicacion a comunidad y mas. Auto-rellenadas y en PDF.",
  keywords: [
    "plantilla carta banco fallecimiento",
    "modelo carta aseguradora",
    "solicitud prorroga modelo 650",
    "carta comunidad propietarios fallecimiento",
    "documentos herencia plantilla",
  ],
  alternates: { canonical: "https://heredia.app/plantillas-documentos" },
  openGraph: {
    title: "Plantillas gratuitas para tramites de herencia",
    description: "6 modelos profesionales de carta y solicitud, auto-rellenados y descargables en PDF.",
    type: "website",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  banco: "Banco",
  aseguradora: "Aseguradora",
  fiscal: "Fiscal",
  comunidad: "Comunidad",
  otros: "Otros",
};

const CATEGORY_COLORS: Record<string, string> = {
  banco: "bg-blue-100 text-blue-700",
  aseguradora: "bg-purple-100 text-purple-700",
  fiscal: "bg-amber-100 text-amber-700",
  comunidad: "bg-emerald-100 text-emerald-700",
  otros: "bg-gray-100 text-gray-700",
};

export default function PlantillasDocumentosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Plantillas gratuitas de documentos para herencia",
    itemListElement: DOCUMENT_TEMPLATES.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.title,
      description: t.description,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="absolute inset-0 dot-grid-light opacity-30" />
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-float-slow" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-400/25 rounded-full blur-3xl animate-float" />
          <div className="relative max-w-4xl mx-auto px-4 py-12 sm:py-16">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              Gratis - Sin registro - 6 modelos
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
              Plantillas profesionales para <br className="hidden sm:block" />
              <span className="text-blue-300">tramites de herencia</span>
            </h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-2xl">
              Cartas al banco, solicitud de prorroga del ISD, declaracion de siniestro a aseguradora,
              comunicacion a comunidad de propietarios. Rellena un formulario y descarga el PDF
              listo para imprimir y firmar.
            </p>
          </div>
        </div>

        {/* Cards grid + interactive client */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 mb-10 relative z-0">
          <PlantillasClient templates={DOCUMENT_TEMPLATES.map((t) => ({
            slug: t.slug,
            title: t.title,
            description: t.description,
            destinatario: t.destinatario,
            category: t.category,
            categoryLabel: CATEGORY_LABELS[t.category],
            fields: t.fields,
          }))} categoryColors={CATEGORY_COLORS} />
        </div>

        {/* Why cards */}
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
            Por que estas plantillas estan bien hechas
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                title: "Redactadas por especialistas",
                desc: "Texto base validado por gestorias y abogados especializados en sucesiones. Lenguaje juridico cuidado y referencias normativas exactas.",
              },
              {
                icon: "M13 10V3L4 14h7v7l9-11h-7z",
                title: "Generacion instantanea",
                desc: "Rellenas un formulario corto, descargas un PDF en 5 segundos. Sin esperas, sin envios por email, sin subscripciones.",
              },
              {
                icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                title: "Sin recogida de datos",
                desc: "Lo que escribes en el formulario se queda en tu navegador. No guardamos tus datos ni los compartimos. Privacidad total.",
              },
            ].map((b, i) => (
              <div key={i} className="bg-white border rounded-xl p-5">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={b.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">{b.title}</h3>
                <p className="text-sm text-gray-600">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pro CTA */}
        <div className="max-w-4xl mx-auto px-4 pb-12">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 sm:p-10 text-white">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <h2 className="text-2xl font-bold mb-3">Para gestorias profesionales</h2>
                <p className="text-blue-200 text-sm">
                  En la version Pro, las plantillas se autocompletan desde los datos del expediente.
                  Genera la carta al banco con el saldo, IBAN y referencia ya cumplimentados, sin
                  copiar/pegar manualmente.
                </p>
              </div>
              <div className="text-center md:text-right">
                <Link
                  href="/#demo"
                  className="inline-block px-7 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition"
                >
                  Probar gratis 14 dias →
                </Link>
                <p className="text-xs text-blue-300 mt-2">Sin tarjeta. Cancela cuando quieras.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            <strong>Aviso legal:</strong> Las plantillas son modelos orientativos y no constituyen
            asesoramiento juridico individualizado. Para casos complejos o controvertidos consulta
            con un profesional. Verifica siempre la normativa autonomica vigente y los requisitos
            especificos de cada entidad.
          </p>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
