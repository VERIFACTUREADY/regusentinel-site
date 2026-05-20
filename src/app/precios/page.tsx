import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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
      <SiteHeader />

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

      {/* Moat features — lo que justifica el precio */}
      <section className="py-12 bg-gradient-to-b from-white to-slate-50 border-y">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Qué incluye cualquier plan</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Las 3 piezas que justifican el precio</h2>
            <p className="mt-3 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
              No vendemos un CRM más. Vendemos las tres herramientas que evitan que
              pierdas un cliente, un plazo o una tarde en tareas repetitivas.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                href: "/radar-isd",
                tile: "from-rose-500/15 to-amber-500/10 text-rose-600 ring-rose-100",
                title: "Radar ISD",
                desc: "Vigila los 17 calendarios autonómicos, las ventanas de prórroga y los tramos de patrimonio. Cero recargos del 5-20%.",
              },
              {
                href: "/portal-familia",
                tile: "from-emerald-500/15 to-sky-500/10 text-emerald-700 ring-emerald-100",
                title: "Portal Familia",
                desc: "Cada heredero ve el estado del expediente sin llamarte. Reduce 68% las consultas, capta por recomendación.",
              },
              {
                href: "/borrador-modelo650",
                tile: "from-indigo-500/15 to-blue-500/10 text-indigo-600 ring-indigo-100",
                title: "Borrador automático",
                desc: "Modelo 650 y 651 generados desde el expediente con plazos, bonificación CCAA y cuota estimada. PDF en 5 segundos.",
              },
            ].map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group relative bg-white border rounded-2xl p-6 shadow-sm card-lift hover:border-primary/30"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.tile} ring-4 flex items-center justify-center mb-4`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{m.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-3">{m.desc}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                  Saber más
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Feature comparison */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10">Comparativa detallada</h2>
          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
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
                  ["Radar ISD (los 17 calendarios autonómicos)", "✓", "✓", "✓"],
                  ["Checklist inteligente por categoría", "✓", "✓", "✓"],
                  ["Portal Familia", "Básico", "White-label", "White-label"],
                  ["Borrador automático Modelo 650 / 651", "✓", "✓", "✓"],
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

      {/* Disclaimer */}
      <section className="py-8 border-t bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Precios sin IVA. Facturación en euros. Domicilio fiscal en España.</p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
