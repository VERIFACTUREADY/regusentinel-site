import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { notFound } from "next/navigation";
import { CCAA_CONTENT, getCCAABySlug } from "@/lib/ccaa-content";
import {
  CCAA_LABELS,
  getCCAABonification,
  calculateISDForCCAA,
  type ParentescoGroup,
} from "@/lib/isd-calculator";

export async function generateStaticParams() {
  return Object.values(CCAA_CONTENT).map((c) => ({ ccaa: c.slug }));
}

export async function generateMetadata({ params }: { params: { ccaa: string } }): Promise<Metadata> {
  const content = getCCAABySlug(params.ccaa);
  if (!content) return {};
  const label = CCAA_LABELS[content.ccaa];
  return {
    title: `Impuesto de Sucesiones en ${label} 2025 — Cuánto se paga, plazos y Modelo 650`,
    description: `Guía completa del ISD en ${label}: bonificaciones autonómicas, plazos del Modelo 650, oficinas de Hacienda y calculadora actualizada para 2025.`,
    keywords: [
      `impuesto sucesiones ${label.toLowerCase()}`,
      `herencia ${label.toLowerCase()}`,
      `modelo 650 ${label.toLowerCase()}`,
      `bonificación isd ${label.toLowerCase()}`,
      `plazo herencia ${label.toLowerCase()}`,
    ],
    alternates: {
      canonical: `https://bariturpro.com/sucesiones/${content.slug}`,
    },
    openGraph: {
      title: `Impuesto de Sucesiones en ${label} 2025`,
      description: `Bonificaciones, plazos y Modelo 650 en ${label}. Calculadora interactiva y guía paso a paso.`,
      type: "article",
    },
  };
}

const SAMPLE_BASES = [50000, 100000, 200000, 500000];
const GROUPS: { key: ParentescoGroup; label: string }[] = [
  { key: "I", label: "Hijos < 21" },
  { key: "II", label: "Cónyuge / hijos / padres" },
  { key: "III", label: "Hermanos, tíos, sobrinos" },
  { key: "IV", label: "Sin parentesco" },
];

function formatEUR(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export default function CCAAPage({ params }: { params: { ccaa: string } }) {
  const content = getCCAABySlug(params.ccaa);
  if (!content) return notFound();

  const label = CCAA_LABELS[content.ccaa];
  const sampleGroup: ParentescoGroup = "II";
  const sampleBase = 200000;
  const sampleBonif = getCCAABonification(content.ccaa, sampleGroup, sampleBase);
  const sampleResult = calculateISDForCCAA(content.ccaa, {
    baseImponible: sampleBase,
    group: sampleGroup,
    preexistingPatrimony: 0,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  // Build matrix for groups × bases
  const matrix = GROUPS.map((g) =>
    SAMPLE_BASES.map((base) => {
      const bonif = getCCAABonification(content.ccaa, g.key, base);
      const result = calculateISDForCCAA(content.ccaa, {
        baseImponible: base,
        group: g.key,
        preexistingPatrimony: 0,
      });
      return { group: g, base, bonifPct: bonif.pct, foral: bonif.foralRegime, cuotaAPagar: result.cuotaAPagar };
    })
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <SiteHeader />

        {/* Breadcrumb */}
        <nav className="max-w-5xl mx-auto px-4 py-3 text-xs text-gray-500">
          <Link href="/" className="hover:text-primary">Inicio</Link>
          <span className="mx-2">›</span>
          <Link href="/comparador-isd" className="hover:text-primary">Sucesiones por CCAA</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-700">{label}</span>
        </nav>

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 text-xs text-blue-300 mb-4">
              Actualizado 2025 · {content.haciendaName.split(" — ")[0]}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              Impuesto de Sucesiones en {label}
            </h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-2xl mb-6">
              Bonificaciones, plazos del Modelo 650 y guía completa de la tributación de herencias en {label} ({content.capital}).
            </p>
            <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
              {content.highlights.slice(0, 4).map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-blue-100">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sample calculation card */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 mb-12 relative z-0">
          <div className="bg-white rounded-2xl shadow-lg border p-6 sm:p-8">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Ejemplo orientativo</p>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Herencia de {formatEUR(sampleBase)} a un hijo / cónyuge en {label}
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <p className="text-xs text-gray-500">Cuota íntegra (estatal)</p>
                <p className="text-xl font-bold text-gray-700">{formatEUR(sampleResult.cuotaIntegra)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Bonificación {label}</p>
                <p className="text-xl font-bold text-blue-600">
                  {sampleBonif.foralRegime ? "Foral" : `${sampleBonif.pct}%`}
                </p>
              </div>
              <div className="sm:border-l sm:pl-6">
                <p className="text-xs text-gray-500">Cuota a pagar (grupo II)</p>
                <p className={`text-xl font-bold ${sampleResult.cuotaAPagar < 100 ? "text-green-600" : sampleResult.cuotaAPagar > 10000 ? "text-red-600" : "text-amber-600"}`}>
                  {formatEUR(sampleResult.cuotaAPagar)}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 italic">
              {sampleBonif.note}
            </p>
            <Link
              href={`/calculadora-isd?ccaa=${content.ccaa}`}
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Calcular mi caso concreto →
            </Link>
          </div>
        </div>

        {/* Long-form content */}
        <div className="max-w-3xl mx-auto px-4 pb-12 space-y-8">
          {/* Paragraphs */}
          <section className="prose prose-sm prose-slate max-w-none">
            <h2 className="text-xl font-bold text-gray-900 mb-4 not-prose">¿Cómo funciona el ISD en {label}?</h2>
            {content.paragraphs.map((p, i) => (
              <p key={i} className="text-gray-700 leading-relaxed mb-4">{p}</p>
            ))}
          </section>

          {/* Cuota matrix */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Tabla de cuotas a pagar por grupo y base imponible
            </h2>
            <div className="overflow-x-auto bg-white rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Grupo / Base</th>
                    {SAMPLE_BASES.map((b) => (
                      <th key={b} className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{formatEUR(b)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{row[0].group.key}</div>
                        <div className="text-xs text-gray-500">{row[0].group.label}</div>
                      </td>
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-3 text-right">
                          <div className={`font-semibold ${cell.cuotaAPagar < 100 ? "text-green-600" : cell.cuotaAPagar > 10000 ? "text-red-600" : "text-gray-900"}`}>
                            {cell.foral ? "Foral" : formatEUR(cell.cuotaAPagar)}
                          </div>
                          {!cell.foral && cell.bonifPct > 0 && (
                            <div className="text-[10px] text-gray-400">bonif {cell.bonifPct}%</div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Cálculos orientativos sin patrimonio preexistente, sin reducciones especiales aplicables.
            </p>
          </section>

          {/* Hacienda */}
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Dónde se presenta el {content.modelo.split(" ")[0]} en {label}</h2>
            <p className="text-sm text-gray-700 mb-3">
              <strong>{content.haciendaName}</strong>
            </p>
            <p className="text-sm text-gray-700 mb-3">{content.modelo}</p>
            <a
              href={content.haciendaUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Sede electrónica oficial →
            </a>
          </section>

          {/* Notes */}
          {content.notes.length > 0 && (
            <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-amber-900 mb-3">⚠ Aspectos clave a tener en cuenta</h2>
              <ul className="space-y-2 text-sm text-amber-900">
                {content.notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-600">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* FAQ */}
          {content.faq.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Preguntas frecuentes sobre el ISD en {label}</h2>
              <div className="space-y-4">
                {content.faq.map((f, i) => (
                  <div key={i} className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-900 text-sm mb-2">{f.q}</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Internal links to other CCAA */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Otras Comunidades Autónomas</h2>
            <div className="flex flex-wrap gap-2">
              {Object.values(CCAA_CONTENT)
                .filter((c) => c.slug !== content.slug)
                .map((c) => (
                  <Link
                    key={c.slug}
                    href={`/sucesiones/${c.slug}`}
                    className="px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700 hover:border-primary hover:text-primary transition"
                  >
                    {CCAA_LABELS[c.ccaa]}
                  </Link>
                ))}
            </div>
          </section>

          {/* CTA */}
          <section className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <h2 className="text-xl font-bold mb-3">Gestoría o funeraria que tramita herencias</h2>
            <p className="text-blue-200 mb-5 text-sm max-w-md mx-auto">
              BARITUR PRO automatiza el seguimiento de plazos del Modelo 650, genera borradores y centraliza toda la documentación de cada expediente.
            </p>
            <Link
              href="/#demo"
              className="inline-block px-6 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg text-sm transition"
            >
              Probar gratis 14 días →
            </Link>
          </section>

          {/* Disclaimer */}
          <section className="text-xs text-gray-500 border-t pt-6">
            <p>
              <strong>Aviso legal:</strong> Esta página recoge información orientativa sobre la normativa autonómica del ISD en {label}. No constituye asesoramiento jurídico ni fiscal individualizado. Las cuotas estimadas se calculan sobre la tarifa estatal y la bonificación autonómica, sin tener en cuenta circunstancias particulares. Para una valoración rigurosa consulte con un asesor fiscal o gestoría especializada.
            </p>
          </section>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
