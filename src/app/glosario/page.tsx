import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "Glosario del Impuesto de Sucesiones y Donaciones (ISD) — BARITUR PRO",
  description:
    "Diccionario de términos del ISD: base imponible, coeficiente multiplicador, bonificación autonómica, Modelo 650, plazos, RCSV y más de 30 términos explicados.",
  alternates: { canonical: "https://bariturpro.com/glosario" },
  openGraph: {
    title: "Glosario ISD - Modelo 650 y Donaciones",
    description: "Diccionario completo de términos del Impuesto sobre Sucesiones y Donaciones",
    type: "website",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Base imponible": "bg-blue-100 text-blue-700",
  "Cuota y calculo": "bg-emerald-100 text-emerald-700",
  "Plazos y procedimiento": "bg-amber-100 text-amber-700",
  Sujetos: "bg-purple-100 text-purple-700",
  "Bonificaciones y reducciones": "bg-rose-100 text-rose-700",
  "Bienes y caudal": "bg-cyan-100 text-cyan-700",
  Documentacion: "bg-gray-100 text-gray-700",
};

export default function GlosarioPage() {
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, "es"));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Glosario del Impuesto sobre Sucesiones y Donaciones",
    hasDefinedTerm: sorted.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.definition,
      url: `https://bariturpro.com/glosario/${t.slug}`,
    })),
  };

  // Group by category for the alternative view
  const byCategory = GLOSSARY_CATEGORIES.map((cat) => ({
    category: cat,
    terms: sorted.filter((t) => t.category === cat),
  }));

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
          <div className="relative max-w-4xl mx-auto px-4 py-14 sm:py-16">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 text-xs text-blue-300 mb-4">
              {GLOSSARY.length} términos · Actualizado 2025
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">
              Glosario del Impuesto de Sucesiones y Donaciones
            </h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-3xl">
              Diccionario completo de los términos del ISD: base imponible, coeficiente multiplicador,
              bonificación autonómica, Modelo 650, RCSV y todo lo que necesitas saber para tramitar una herencia.
            </p>
          </div>
        </div>

        {/* Categories grid */}
        <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
          {byCategory.map(({ category, terms }) => (
            <section key={category}>
              <div className="flex items-baseline gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-900">{category}</h2>
                <span className="text-xs text-gray-500">{terms.length} términos</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {terms.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/glosario/${t.slug}`}
                    className="bg-white border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <h3 className="font-bold text-gray-900 text-sm group-hover:text-primary transition">
                        {t.term}
                      </h3>
                      {t.normRef && (
                        <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">{t.normRef}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-snug line-clamp-2">{t.definition}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Alphabetical index */}
        <div className="bg-white border-t">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Índice alfabético</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
              {sorted.map((t) => (
                <Link
                  key={t.slug}
                  href={`/glosario/${t.slug}`}
                  className="text-sm text-gray-700 hover:text-primary py-1.5 border-b border-gray-100 hover:border-primary transition flex items-center justify-between gap-2"
                >
                  <span className="truncate">{t.term}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${CATEGORY_COLORS[t.category]} whitespace-nowrap`}>
                    {t.category.split(" ")[0]}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-3">Aplica estos términos con tus datos reales</h2>
            <p className="text-blue-200 mb-6 max-w-lg mx-auto">
              Calculadora ISD con tarifa, reducciones, coeficiente y bonificación CCAA aplicados automáticamente. Gratis, sin registro.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/calculadora-isd"
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition"
              >
                Calculadora ISD →
              </Link>
              <Link
                href="/borrador-modelo650"
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition"
              >
                Generar borrador Modelo 650
              </Link>
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
