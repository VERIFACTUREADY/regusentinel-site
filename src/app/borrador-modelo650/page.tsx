import type { Metadata } from "next";
import Link from "next/link";
import { BorradorClient } from "./borrador-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Borrador Modelo 650 gratis — Generador de PDF de Sucesiones",
  description:
    "Genera gratis un borrador del Modelo 650 (Impuesto sobre Sucesiones) en PDF con plazos legales y cuota estimada. Sin registro. Útil para gestorías y herederos.",
  keywords: [
    "borrador modelo 650",
    "modelo 650 pdf",
    "modelo 650 gratis",
    "generador modelo 650",
    "plantilla modelo 650",
    "impuesto sucesiones pdf",
  ],
  alternates: {
    canonical: "https://bariturpro.com/borrador-modelo650",
  },
  openGraph: {
    title: "Borrador del Modelo 650 — PDF gratuito",
    description:
      "Genera un borrador profesional del Modelo 650 en 30 segundos. Plazos legales calculados, bonificación CCAA aplicada y cuota estimada.",
    type: "website",
  },
};

export default function BorradorModelo650Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Borrador Modelo 650",
    description: "Generador gratuito de borrador del Modelo 650 (Impuesto sobre Sucesiones y Donaciones)",
    applicationCategory: "BusinessApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    operatingSystem: "Web",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <SiteHeader />

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              Gratis · Sin registro · PDF profesional en 30 segundos
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
              Borrador del Modelo 650 <br className="hidden sm:block" />
              <span className="text-blue-300">listo en un clic</span>
            </h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-2xl mb-6">
              Rellena los datos del causante, descarga un PDF de trabajo de 2 páginas con plazos legales,
              bonificación autonómica aplicada y checklist de documentación. Sin registro.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-blue-200">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Plazos calculados (6 meses, prórroga)
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Cuota estimada por CCAA
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Checklist de 11 documentos
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-3xl mx-auto px-4 -mt-8 mb-10">
          <BorradorClient />
        </div>

        {/* What's in the PDF */}
        <div className="max-w-4xl mx-auto px-4 mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 text-center">Qué contiene el PDF</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
                title: "Datos del causante",
                desc: "Nombre, DNI, fecha de fallecimiento, provincia y CCAA competente auto-detectada.",
              },
              {
                icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                title: "Plazos legales calculados",
                desc: "Fecha límite ordinaria (6 meses), ventana de prórroga (mes 5) y plazo extendido.",
              },
              {
                icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
                title: "Tabla de bienes",
                desc: "Bloques estructurados para inmuebles, bancos, valores, vehículos, seguros y otros.",
              },
              {
                icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16l-3-3m3 3l3-3",
                title: "Reducciones aplicables",
                desc: "Reducciones del art. 20 Ley 29/1987: parentesco, vivienda habitual, empresa familiar, seguros, discapacidad.",
              },
              {
                icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1",
                title: "Cuota estimada",
                desc: "Si rellenas el valor estimado, calculamos la cuota a pagar con la bonificación autonómica aplicada.",
              },
              {
                icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                title: "Checklist documental",
                desc: "11 documentos imprescindibles: defunción, últimas voluntades, RCSV, escrituras, tasaciones, etc.",
              },
            ].map((b, i) => (
              <div key={i} className="bg-white rounded-xl border p-5">
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

        {/* CTA — pro version */}
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 sm:p-10 text-white">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <h2 className="text-2xl font-bold mb-3">Para gestorías y funerarias profesionales</h2>
                <p className="text-blue-200 text-sm mb-4">
                  Esta es la versión gratuita. La versión Pro de BARITUR PRO añade:
                </p>
                <ul className="space-y-2 text-sm text-blue-100">
                  <li className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    Genera el borrador desde un expediente real con todos los datos del causante y herederos
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    Radar ISD que avisa de plazos críticos y proximidad a tramos de bonificación
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    Portal familia con seguimiento del expediente, mensajes y documentos
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    Plantillas de tareas con plazos legales precargadas
                  </li>
                </ul>
              </div>
              <div className="text-center md:text-right">
                <Link
                  href="/#demo"
                  className="inline-block px-7 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition"
                >
                  Probar gratis 14 días →
                </Link>
                <p className="text-xs text-blue-300 mt-2">Sin tarjeta. Cancela cuando quieras.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            <strong>Aviso legal:</strong> El PDF generado es un documento de trabajo orientativo y no
            sustituye al modelo oficial de la AEAT ni al asesoramiento de un profesional fiscal. Los
            cálculos de cuota se basan en la tarifa estatal y la bonificación autonómica vigente al
            momento de la actualización; pueden no aplicar a todos los supuestos. Los regímenes forales
            (Navarra, País Vasco) tributan según su normativa propia.
          </p>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
