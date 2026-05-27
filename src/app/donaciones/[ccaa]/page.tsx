import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { notFound } from "next/navigation";
import { CCAA_CONTENT, getCCAABySlug } from "@/lib/ccaa-content";
import { CCAA_LABELS, type ParentescoGroup } from "@/lib/isd-calculator";
import {
  calculateDonacion,
  getDonacionBonification,
} from "@/lib/donaciones-calculator";

export async function generateStaticParams() {
  return Object.values(CCAA_CONTENT).map((c) => ({ ccaa: c.slug }));
}

export async function generateMetadata({ params }: { params: { ccaa: string } }): Promise<Metadata> {
  const content = getCCAABySlug(params.ccaa);
  if (!content) return {};
  const label = CCAA_LABELS[content.ccaa];
  return {
    title: `Donaciones en ${label} 2025 — Modelo 651, bonificaciones y reducciones`,
    description: `Cómo tributa una donación en ${label}: bonificaciones autonómicas, reducciones específicas (vivienda, empresa familiar) y plazo del Modelo 651.`,
    keywords: [
      `donaciones ${label.toLowerCase()}`,
      `modelo 651 ${label.toLowerCase()}`,
      `impuesto donaciones ${label.toLowerCase()}`,
      `donacion vivienda ${label.toLowerCase()}`,
      `bonificacion donaciones ${label.toLowerCase()}`,
    ],
    alternates: { canonical: `https://heredia.app/donaciones/${content.slug}` },
    openGraph: {
      title: `Donaciones en ${label} 2025`,
      description: `Bonificaciones, plazos y Modelo 651 en ${label}.`,
      type: "article",
    },
  };
}

const SAMPLE_BASES = [50000, 100000, 200000, 500000];
const GROUPS: { key: ParentescoGroup; label: string }[] = [
  { key: "I", label: "Hijos < 21" },
  { key: "II", label: "Cónyuge / hijos / padres" },
  { key: "III", label: "Hermanos / tíos" },
  { key: "IV", label: "Sin parentesco" },
];

function formatEUR(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export default function DonacionCCAAPage({ params }: { params: { ccaa: string } }) {
  const content = getCCAABySlug(params.ccaa);
  if (!content) return notFound();

  const label = CCAA_LABELS[content.ccaa];
  const sampleResult = calculateDonacion(
    { group: "II", baseImponible: 100000, preexistingPatrimony: 0 },
    content.ccaa
  );
  const sampleBonif = getDonacionBonification(content.ccaa, "II");

  const matrix = GROUPS.map((g) =>
    SAMPLE_BASES.map((b) => {
      const r = calculateDonacion({ group: g.key, baseImponible: b, preexistingPatrimony: 0 }, content.ccaa);
      const bonif = getDonacionBonification(content.ccaa, g.key);
      return { group: g, base: b, cuota: r.cuotaAPagar, bonifPct: bonif.pct, foral: bonif.foralRegime };
    })
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `¿Cuánto se paga por una donación en ${label}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: sampleBonif.foralRegime
            ? `${label} aplica régimen foral: la cuota orientativa estatal para 100.000 € a un descendiente directo es ${formatEUR(sampleResult.cuotaAPagar)}, pero la liquidación real se hace en la Hacienda Foral.`
            : `Para una donación de 100.000 € a un descendiente directo (grupo II), la cuota a pagar es aproximadamente ${formatEUR(sampleResult.cuotaAPagar)}. ${label} aplica una bonificación del ${sampleBonif.pct}% sobre la cuota tributaria.`,
        },
      },
      {
        "@type": "Question",
        name: `¿Cuál es el plazo del Modelo 651 en ${label}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "30 días hábiles desde la fecha de la donación. Es un plazo común a todas las CCAA del régimen general.",
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        <nav className="max-w-5xl mx-auto px-4 py-3 text-xs text-gray-500">
          <Link href="/" className="hover:text-primary">Inicio</Link>
          <span className="mx-2">›</span>
          <Link href="/donaciones" className="hover:text-primary">Donaciones</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-700">{label}</span>
        </nav>

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-5xl mx-auto px-4 py-12 sm:py-14">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 text-xs text-blue-300 mb-4">
              Modelo 651 · Actualizado 2025 · {content.haciendaName.split(" — ")[0]}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">
              Donaciones en {label}
            </h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-3xl">
              Cómo tributa una donación inter vivos en {label}. Bonificaciones autonómicas para el
              Modelo 651, reducciones específicas y comparativa con otras comunidades.
            </p>
          </div>
        </div>

        {/* Sample card */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 mb-10 relative z-0">
          <div className="bg-white rounded-2xl shadow-lg border p-6 sm:p-8">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Ejemplo orientativo</p>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Donación de 100.000 € a un descendiente o cónyuge en {label}
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <p className="text-xs text-gray-500">Cuota tributaria</p>
                <p className="text-xl font-bold text-gray-700">{formatEUR(sampleResult.cuotaTributaria)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Bonificación {label}</p>
                <p className="text-xl font-bold text-blue-600">
                  {sampleBonif.foralRegime ? "Foral" : `${sampleBonif.pct}%`}
                </p>
              </div>
              <div className="sm:border-l sm:pl-6">
                <p className="text-xs text-gray-500">Cuota a pagar</p>
                <p className={`text-xl font-bold ${sampleResult.cuotaAPagar < 100 ? "text-emerald-600" : sampleResult.cuotaAPagar > 5000 ? "text-rose-600" : "text-amber-600"}`}>
                  {formatEUR(sampleResult.cuotaAPagar)}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 italic">{sampleBonif.note}</p>
            <Link
              href="/calculadora-donaciones"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Calcular tu caso concreto →
            </Link>
          </div>
        </div>

        {/* Matrix table */}
        <div className="max-w-5xl mx-auto px-4 mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Tabla de cuotas por grupo y base imponible</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Grupo</th>
                    {SAMPLE_BASES.map((b) => (
                      <th key={b} className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{formatEUR(b)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-gray-900">{row[0].group.key}</div>
                        <div className="text-xs text-gray-500">{row[0].group.label}</div>
                      </td>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-3 text-right">
                          <div className={`font-semibold ${cell.cuota < 100 ? "text-emerald-600" : cell.cuota > 10000 ? "text-rose-600" : "text-gray-900"}`}>
                            {cell.foral ? "Foral" : formatEUR(cell.cuota)}
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
            <p className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-500">
              Cálculos orientativos sin reducciones específicas (vivienda habitual, empresa familiar). Aplican distintos requisitos según CCAA.
            </p>
          </div>
        </div>

        {/* Reducciones específicas relevantes */}
        <div className="max-w-3xl mx-auto px-4 mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Reducciones específicas en {label}</h2>
          <div className="space-y-4">
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-bold text-gray-900 mb-2 text-sm">Donación de vivienda habitual a descendiente</h3>
              <p className="text-sm text-gray-600">
                Reducción habitual del 95% del valor con tope variable según CCAA. Requiere donatario menor de 35 años (40 en algunas CCAA), residencia habitual y mantenimiento durante el periodo legal.
              </p>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-bold text-gray-900 mb-2 text-sm">Donación dineraria para adquirir vivienda habitual</h3>
              <p className="text-sm text-gray-600">
                Reducción específica del 80% (variable por CCAA) sobre el importe donado, condicionada a la compra de vivienda habitual del donatario en el plazo establecido.
              </p>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-bold text-gray-900 mb-2 text-sm">Donación de empresa familiar (art. 20.6 Ley 29/1987)</h3>
              <p className="text-sm text-gray-600">
                Reducción del 95% si se cumplen los requisitos: donante de 65+ años, ejercía función directiva con remuneración mayoritaria, y el donatario mantiene la titularidad durante 10 años.
              </p>
            </div>
          </div>
        </div>

        {/* Hacienda */}
        <div className="max-w-3xl mx-auto px-4 mb-10">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Dónde se presenta el Modelo 651</h2>
            <p className="text-sm text-gray-700 mb-3">
              <strong>{content.haciendaName}</strong>
            </p>
            <p className="text-sm text-gray-700 mb-3">
              Plazo: 30 días hábiles desde la donación. La presentación se realiza telemáticamente
              en la sede electrónica de la Hacienda autonómica.
            </p>
            <a
              href={content.haciendaUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Sede electrónica oficial →
            </a>
          </div>
        </div>

        {/* Cross-link to sucesiones */}
        <div className="max-w-3xl mx-auto px-4 mb-10">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <p className="text-sm text-blue-900">
              <strong>¿Era una herencia y no una donación?</strong>{" "}
              <Link href={`/sucesiones/${content.slug}`} className="underline hover:no-underline">
                Ver guía del Modelo 650 (sucesiones) en {label}
              </Link>
            </p>
          </div>
        </div>

        {/* Other CCAA */}
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-base font-bold text-gray-900 mb-3">Donaciones en otras CCAA</h2>
          <div className="flex flex-wrap gap-2">
            {Object.values(CCAA_CONTENT)
              .filter((c) => c.slug !== content.slug)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/donaciones/${c.slug}`}
                  className="px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700 hover:border-primary hover:text-primary transition"
                >
                  {CCAA_LABELS[c.ccaa]}
                </Link>
              ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-3xl mx-auto px-4 py-14 text-center">
            <h2 className="text-2xl font-bold mb-3">¿Tramitas donaciones para clientes?</h2>
            <p className="text-blue-200 text-sm mb-6">
              Heredia automatiza también los expedientes de donación. 14 días gratis, sin tarjeta.
            </p>
            <Link
              href="/#demo"
              className="inline-block px-7 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition"
            >
              Probar Heredia →
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            <strong>Aviso:</strong> Información orientativa. La normativa autonómica de donaciones varía y
            los requisitos de las reducciones específicas pueden cambiar. No constituye asesoramiento
            jurídico ni fiscal individualizado.
          </p>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
