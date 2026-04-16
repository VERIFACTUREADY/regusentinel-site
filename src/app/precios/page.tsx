import type { Metadata } from "next";
import Link from "next/link";
import { PricingTable } from "./pricing-table";

export const metadata: Metadata = {
  title: "Precios — Software de gestión de herencias para gestorías",
  description:
    "Planes desde 149 EUR/mes. Software B2B para gestorías y funerarias: motor de plazos ISD, portal familia, pack banco y cumplimiento RGPD. Prueba la demo gratis.",
  openGraph: {
    title: "Precios BARITUR PRO — Gestión post-mortem para profesionales",
    description:
      "Tres planes para gestorías y funerarias. Sin permanencia. Ahorra 2 meses con prepago anual. Incluye onboarding y soporte en español.",
  },
  alternates: { canonical: "https://baritur.pro/precios" },
};

const faqItems = [
  {
    q: "¿Hay permanencia o compromiso mínimo?",
    a: "No. Los planes mensuales se pueden cancelar en cualquier momento. El prepago anual tiene un descuento del 17% (2 meses gratis) y no es reembolsable.",
  },
  {
    q: "¿Qué incluye la cuota de setup?",
    a: "La cuota única de setup (Despacho: 299 EUR, Firma: 990 EUR) cubre el onboarding asistido, migración de expedientes existentes, configuración de marca (white-label) y formación del equipo.",
  },
  {
    q: "¿Qué pasa si supero el límite de expedientes mensuales?",
    a: "Cada expediente adicional se factura al final del mes según la tarifa overage de tu plan. Puedes ver el consumo en tiempo real desde el panel de facturación.",
  },
  {
    q: "¿BARITUR PRO presta asesoramiento fiscal o jurídico?",
    a: "No. BARITUR PRO es una herramienta de orquestación y documentación. Las decisiones profesionales (fiscales, jurídicas) las toma el gestor o asesor responsable del expediente.",
  },
  {
    q: "¿Cómo funciona el portal familia?",
    a: "Cada expediente tiene un enlace único y seguro para que la familia suba documentos y consulte el estado. En planes Despacho y Firma el portal lleva el logo, colores y nombre de tu despacho (white-label).",
  },
  {
    q: "¿Es compatible con el RGPD y la LOPDGDD?",
    a: "Sí. Mantenemos el RAT actualizado, aplicamos minimización de datos, cifrado en tránsito y reposo, política de retención configurable y DPA con cada cliente. El tratamiento de datos de personas fallecidas sigue el marco del art. 3 de la LO 3/2018.",
  },
];

export default function PreciosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "BARITUR PRO",
        applicationCategory: "BusinessApplication",
        offers: [
          {
            "@type": "Offer",
            name: "Inicia",
            price: "149",
            priceCurrency: "EUR",
            priceSpecification: { "@type": "UnitPriceSpecification", unitCode: "MON" },
            description: "Hasta 2 usuarios, 15 expedientes/mes, motor de plazos ISD.",
          },
          {
            "@type": "Offer",
            name: "Despacho",
            price: "349",
            priceCurrency: "EUR",
            priceSpecification: { "@type": "UnitPriceSpecification", unitCode: "MON" },
            description: "Hasta 5 usuarios, 50 expedientes/mes, white-label, pack banco.",
          },
          {
            "@type": "Offer",
            name: "Firma",
            price: "749",
            priceCurrency: "EUR",
            priceSpecification: { "@type": "UnitPriceSpecification", unitCode: "MON" },
            description: "Hasta 20 usuarios, 200 expedientes/mes, SSO, API.",
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-primary">BARITUR PRO</Link>
          <div className="flex gap-2 sm:gap-4 items-center">
            <Link href="/login" className="hidden sm:inline px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary">
              Iniciar sesion
            </Link>
            <Link href="/login?demo=1" className="px-4 py-2 text-sm font-medium border border-primary text-primary rounded-md hover:bg-primary/5">
              Probar demo
            </Link>
            <Link href="/onboarding" className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90">
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">
            Sin permanencia · Soporte en español · Precios sin IVA
          </p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Precios transparentes para profesionales
          </h1>
          <p className="text-lg text-gray-600">
            Elige el plan que se adapta al volumen de tu despacho. Cambia cuando quieras.
            Prepago anual incluye 2 meses gratis.
          </p>
        </div>
      </section>

      {/* Pricing table (client: handles monthly/annual toggle) */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4">
          <PricingTable />
        </div>
      </section>

      {/* Feature comparison */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10">Comparativa detallada</h2>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-4 text-left text-gray-700 font-semibold">Funcionalidad</th>
                  <th className="px-6 py-4 text-center text-gray-700 font-semibold">Inicia</th>
                  <th className="px-6 py-4 text-center text-primary font-semibold">Despacho</th>
                  <th className="px-6 py-4 text-center text-gray-700 font-semibold">Firma</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["Usuarios", "2", "5", "20"],
                  ["Expedientes/mes incluidos", "15", "50", "200"],
                  ["Motor de plazos ISD (6m)", "✓", "✓", "✓"],
                  ["Checklist inteligente por categoría", "✓", "✓", "✓"],
                  ["Portal familia", "Básico", "White-label", "White-label"],
                  ["Pack banco unificado (PDF+ZIP)", "—", "✓", "✓"],
                  ["Plantillas versionadas con aprobación", "—", "✓", "✓"],
                  ["Notificaciones email automáticas ISD", "—", "✓", "✓"],
                  ["Reporting operativo (lead time, bloqueos)", "—", "✓", "✓"],
                  ["Export PDF/ZIP expediente completo", "✓", "✓", "✓"],
                  ["Audit trail inmutable", "✓", "✓", "✓"],
                  ["Roles y permisos avanzados (SSO)", "—", "—", "✓"],
                  ["API / webhooks", "—", "—", "✓"],
                  ["DPA extendido + auditorías", "—", "—", "✓"],
                  ["Onboarding asistido + formación", "—", "—", "✓"],
                  ["SLA soporte", "48h", "24h", "Prioritario"],
                ].map(([feature, inicia, despacho, firma]) => (
                  <tr key={feature} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-700">{feature}</td>
                    <td className="px-6 py-3 text-center text-gray-600">{inicia}</td>
                    <td className="px-6 py-3 text-center font-medium">{despacho}</td>
                    <td className="px-6 py-3 text-center text-gray-600">{firma}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {faqItems.map(({ q, a }) => (
              <details
                key={q}
                className="border rounded-lg group"
              >
                <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 list-none flex justify-between items-center">
                  {q}
                  <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-3">¿Dudas sobre qué plan elegir?</h2>
          <p className="text-primary-foreground/80 mb-8 text-white/80">
            Hablamos 20 minutos, vemos tu volumen actual y te recomendamos el plan que tiene sentido. Sin presión.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login?demo=1"
              className="px-8 py-3 bg-white text-primary font-semibold rounded-md hover:bg-gray-50"
            >
              Probar demo gratis
            </Link>
            <Link
              href="/#demo"
              className="px-8 py-3 border-2 border-white text-white font-semibold rounded-md hover:bg-white/10"
            >
              Solicitar reunión
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 space-y-2">
          <p>Precios sin IVA. Facturación en euros. Domicilio fiscal en España.</p>
          <p className="font-medium text-gray-700">BARITUR no presta asesoramiento jurídico ni fiscal individual.</p>
          <p className="mt-4">
            <Link href="/" className="text-primary hover:underline mr-4">Inicio</Link>
            <Link href="/login" className="text-primary hover:underline">Acceder</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
