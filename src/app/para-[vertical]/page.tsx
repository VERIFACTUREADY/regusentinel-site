import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { notFound } from "next/navigation";
import { VERTICAL_CONFIG, ALL_VERTICAL_SLUGS, getVerticalBySlug } from "@/lib/vertical-landings";

export async function generateStaticParams() {
  return ALL_VERTICAL_SLUGS.map((slug) => ({ vertical: slug }));
}

export async function generateMetadata({ params }: { params: { vertical: string } }): Promise<Metadata> {
  const v = getVerticalBySlug(params.vertical);
  if (!v) return {};
  return {
    title: v.title,
    description: v.description,
    alternates: { canonical: `https://bariturpro.com/para-${v.slug}` },
    openGraph: {
      title: v.title,
      description: v.description,
      type: "website",
    },
  };
}

const PLAN_PRICES = {
  INICIA: { price: "149 €", limit: "30 expedientes/mes" },
  DESPACHO: { price: "349 €", limit: "100 expedientes/mes" },
  FIRMA: { price: "749 €", limit: "250 expedientes/mes" },
};

export default function VerticalPage({ params }: { params: { vertical: string } }) {
  const v = getVerticalBySlug(params.vertical);
  if (!v) return notFound();

  const plan = PLAN_PRICES[v.recommendedPlan];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: v.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-5xl mx-auto px-4 py-14 sm:py-20">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 text-xs text-blue-300 mb-5">
              {v.badge}
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
              {v.headline} <span className="text-blue-300">{v.highlight}</span>
            </h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-3xl mb-6">{v.subtitle}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#demo"
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition"
              >
                Probar gratis 14 días →
              </Link>
              <Link
                href="/calculadora-roi"
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition"
              >
                Calcular cuánto ahorras
              </Link>
            </div>
          </div>
        </div>

        {/* Pain points */}
        <div className="max-w-5xl mx-auto px-4 -mt-8 mb-12 relative z-0">
          <div className="bg-white rounded-2xl shadow-lg border p-6 sm:p-8">
            <h2 className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-3">Problemas reales</h2>
            <h3 className="text-xl font-bold text-gray-900 mb-5">Lo que oímos cada semana en los despachos</h3>
            <div className="grid md:grid-cols-3 gap-5">
              {v.painPoints.map((p, i) => (
                <div key={i} className="border-l-4 border-rose-200 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-1">{p.title}</h4>
                  <p className="text-sm text-gray-600">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits grid */}
        <div className="max-w-5xl mx-auto px-4 mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Cómo te ayuda BARITUR PRO</h2>
          <p className="text-sm text-gray-600 text-center mb-8">Diseñado específicamente para tu segmento.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {v.benefits.map((b, i) => (
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

        {/* Workflow */}
        <div className="bg-white border-t border-b">
          <div className="max-w-5xl mx-auto px-4 py-14">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Cómo se integra en tu día a día</h2>
            <p className="text-sm text-gray-600 text-center mb-8">4 pasos del flujo real.</p>
            <div className="grid md:grid-cols-4 gap-5">
              {v.workflow.map((s, i) => (
                <div key={i} className="relative">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold mb-3">
                    {s.step}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-600">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scenarios */}
        <div className="max-w-5xl mx-auto px-4 py-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Casos reales</h2>
          <p className="text-sm text-gray-600 text-center mb-8">Cómo BARITUR PRO resuelve problemas concretos.</p>
          <div className="space-y-5">
            {v.scenarios.map((s, i) => (
              <div key={i} className="bg-white rounded-xl border overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b">
                  <h3 className="font-bold text-gray-900">{s.title}</h3>
                </div>
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                  <div className="p-6">
                    <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-2">Sin BARITUR</p>
                    <p className="text-sm text-gray-700">{s.problem}</p>
                  </div>
                  <div className="p-6 bg-emerald-50/40">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Con BARITUR</p>
                    <p className="text-sm text-gray-700">{s.solution}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="bg-white border-t border-b">
          <div className="max-w-3xl mx-auto px-4 py-12 text-center">
            <svg className="w-10 h-10 text-blue-200 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <p className="text-lg sm:text-xl text-gray-800 leading-relaxed mb-4">"{v.quote.text}"</p>
            <p className="text-sm text-gray-500">— {v.quote.attribution}</p>
          </div>
        </div>

        {/* Recommended plan */}
        <div className="max-w-3xl mx-auto px-4 py-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Plan recomendado</h2>
          <p className="text-sm text-gray-600 text-center mb-6">Lo que mejor encaja con tu segmento.</p>
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">Plan {v.recommendedPlan}</p>
            <p className="text-5xl font-bold mb-2">{plan.price}<span className="text-lg text-blue-300">/mes</span></p>
            <p className="text-sm text-blue-200 mb-6">Hasta {plan.limit}. Sin permanencia.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/precios"
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition"
              >
                Ver todos los planes
              </Link>
              <Link
                href="/#demo"
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition"
              >
                Empezar 14 días gratis →
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto px-4 pb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {v.faq.map((f, i) => (
              <div key={i} className="bg-white border rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{f.q}</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cross-sell to other verticals */}
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 text-center">También para</p>
          <div className="flex flex-wrap justify-center gap-3">
            {ALL_VERTICAL_SLUGS.filter((s) => s !== v.slug).map((s) => {
              const other = VERTICAL_CONFIG[s];
              return (
                <Link
                  key={s}
                  href={`/para-${s}`}
                  className="px-4 py-2 bg-white border rounded-lg text-sm text-gray-700 hover:border-primary hover:text-primary transition"
                >
                  {other.badge.replace("Para ", "")}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
