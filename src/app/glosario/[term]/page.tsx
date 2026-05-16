import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GLOSSARY,
  getTermBySlug,
  getRelatedTerms,
} from "@/lib/glossary";

export async function generateStaticParams() {
  return GLOSSARY.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({ params }: { params: { term: string } }): Promise<Metadata> {
  const t = getTermBySlug(params.term);
  if (!t) return {};
  return {
    title: `${t.term} — Glosario ISD | BARITUR PRO`,
    description: t.definition,
    keywords: [
      t.term.toLowerCase(),
      `qué es ${t.term.toLowerCase()}`,
      `${t.term.toLowerCase()} ISD`,
      `${t.term.toLowerCase()} modelo 650`,
      ...(t.synonyms ?? []),
    ],
    alternates: { canonical: `https://bariturpro.com/glosario/${t.slug}` },
    openGraph: {
      title: `${t.term} - Glosario ISD`,
      description: t.definition,
      type: "article",
    },
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  "Base imponible": "bg-blue-100 text-blue-700",
  "Cuota y calculo": "bg-emerald-100 text-emerald-700",
  "Plazos y procedimiento": "bg-amber-100 text-amber-700",
  Sujetos: "bg-purple-100 text-purple-700",
  "Bonificaciones y reducciones": "bg-rose-100 text-rose-700",
  "Bienes y caudal": "bg-cyan-100 text-cyan-700",
  Documentacion: "bg-gray-100 text-gray-700",
};

export default function GlossaryTermPage({ params }: { params: { term: string } }) {
  const t = getTermBySlug(params.term);
  if (!t) return notFound();

  const related = getRelatedTerms(t.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: t.term,
    description: t.definition,
    inDefinedTermSet: "https://bariturpro.com/glosario",
    url: `https://bariturpro.com/glosario/${t.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-primary">BARITUR PRO</Link>
            <nav className="flex gap-3 sm:gap-4 text-sm">
              <Link href="/glosario" className="text-gray-700 hover:text-primary">Glosario</Link>
              <Link href="/calculadora-isd" className="text-gray-700 hover:text-primary">Calculadora</Link>
              <Link href="/blog" className="text-gray-700 hover:text-primary hidden sm:inline">Blog</Link>
              <Link href="/#demo" className="text-primary font-semibold hidden sm:inline">Probar gratis</Link>
            </nav>
          </div>
        </header>

        <nav className="max-w-3xl mx-auto px-4 py-3 text-xs text-gray-500">
          <Link href="/" className="hover:text-primary">Inicio</Link>
          <span className="mx-2">›</span>
          <Link href="/glosario" className="hover:text-primary">Glosario</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-700">{t.term}</span>
        </nav>

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-3xl mx-auto px-4 py-12 sm:py-14">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${CATEGORY_COLORS[t.category]}`}>
                {t.category}
              </span>
              {t.normRef && (
                <span className="text-xs text-blue-300 font-mono">{t.normRef}</span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t.term}</h1>
            <p className="text-base sm:text-lg text-blue-100 leading-relaxed">{t.definition}</p>
          </div>
        </div>

        {/* Body */}
        <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
          {/* Long explanation */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Explicación detallada</h2>
            <div className="space-y-4">
              {t.longExplanation.map((p, i) => (
                <p key={i} className="text-gray-700 leading-relaxed">{p}</p>
              ))}
            </div>
          </section>

          {/* Tools */}
          {t.relatedTools.length > 0 && (
            <section className="bg-white border rounded-xl p-6">
              <h2 className="text-base font-bold text-gray-900 mb-3">Aplica este concepto</h2>
              <div className="flex flex-wrap gap-2">
                {t.relatedTools.map((tool, i) => (
                  <Link
                    key={i}
                    href={tool.href}
                    className="inline-block px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition"
                  >
                    {tool.label} →
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Synonyms */}
          {t.synonyms && t.synonyms.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">También conocido como</h2>
              <div className="flex flex-wrap gap-2">
                {t.synonyms.map((s) => (
                  <span key={s} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Related terms */}
          {related.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Términos relacionados</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/glosario/${r.slug}`}
                    className="bg-white border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group"
                  >
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-primary mb-1 transition">{r.term}</h3>
                    <p className="text-xs text-gray-600 line-clamp-2">{r.definition}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <h2 className="text-xl font-bold mb-2">¿Tramitas una herencia?</h2>
            <p className="text-blue-200 text-sm mb-5 max-w-md mx-auto">
              Aplica todos los conceptos del glosario automáticamente con la calculadora ISD: tarifa, reducciones, coeficiente, bonificación CCAA.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/calculadora-isd"
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition"
              >
                Calculadora gratis →
              </Link>
              <Link
                href="/#demo"
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition"
              >
                Probar BARITUR PRO
              </Link>
            </div>
          </section>

          {/* Disclaimer */}
          <section>
            <p className="text-xs text-gray-500 border-t pt-6">
              <strong>Aviso:</strong> Esta entrada del glosario es orientativa y no sustituye al asesoramiento
              profesional. La normativa autonómica puede modificar la aplicación práctica de algunos conceptos.
              Para casos concretos consulta con un gestor o asesor fiscal especializado.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
