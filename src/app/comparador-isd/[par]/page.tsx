import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { notFound } from "next/navigation";
import {
  CCAA_LABELS,
  getCCAABonification,
  calculateISDForCCAA,
  type CCAAKey,
  type ParentescoGroup,
} from "@/lib/isd-calculator";
import { CCAA_CONTENT, getCCAABySlug } from "@/lib/ccaa-content";

const ALL_KEYS = Object.keys(CCAA_LABELS) as CCAAKey[];

/** Generate all unordered pairs (a, b) where a < b alphabetically by slug. */
function allPairs(): { par: string }[] {
  const slugs = ALL_KEYS.map((k) => CCAA_CONTENT[k].slug).sort();
  const out: { par: string }[] = [];
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      out.push({ par: `${slugs[i]}-vs-${slugs[j]}` });
    }
  }
  return out;
}

export async function generateStaticParams() {
  return allPairs();
}

function parsePair(par: string): { a: CCAAKey; b: CCAAKey } | null {
  const idx = par.indexOf("-vs-");
  if (idx < 0) return null;
  const slugA = par.slice(0, idx);
  const slugB = par.slice(idx + 4);
  const a = getCCAABySlug(slugA);
  const b = getCCAABySlug(slugB);
  if (!a || !b || a.ccaa === b.ccaa) return null;
  return { a: a.ccaa, b: b.ccaa };
}

export async function generateMetadata({ params }: { params: { par: string } }): Promise<Metadata> {
  const pair = parsePair(params.par);
  if (!pair) return {};
  const labelA = CCAA_LABELS[pair.a];
  const labelB = CCAA_LABELS[pair.b];
  const title = `Sucesiones ${labelA} vs ${labelB} 2025 — Comparativa fiscal`;
  return {
    title,
    description: `Compara el Impuesto sobre Sucesiones entre ${labelA} y ${labelB}: bonificaciones, cuotas reales según base imponible y diferencia fiscal por grupo de parentesco.`,
    keywords: [
      `${labelA.toLowerCase()} vs ${labelB.toLowerCase()} herencia`,
      `sucesiones ${labelA.toLowerCase()} ${labelB.toLowerCase()}`,
      `comparativa isd ${labelA.toLowerCase()} ${labelB.toLowerCase()}`,
      `donde se paga menos herencia espana`,
    ],
    alternates: {
      canonical: `https://bariturpro.com/comparador-isd/${params.par}`,
    },
    openGraph: {
      title,
      description: `Cuánto se paga de herencia en ${labelA} comparado con ${labelB}. Cifras reales para 4 grupos de parentesco.`,
      type: "article",
    },
  };
}

const SAMPLE_BASES = [50000, 100000, 200000, 500000, 1000000];
const GROUPS: { key: ParentescoGroup; label: string; desc: string }[] = [
  { key: "I", label: "Grupo I", desc: "Hijos < 21 años" },
  { key: "II", label: "Grupo II", desc: "Cónyuge / hijos / padres" },
  { key: "III", label: "Grupo III", desc: "Hermanos, tíos, sobrinos" },
  { key: "IV", label: "Grupo IV", desc: "Sin parentesco" },
];

function formatEUR(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

interface CellResult {
  cuota: number;
  bonifPct: number;
  foral: boolean;
}

function compute(ccaa: CCAAKey, group: ParentescoGroup, base: number): CellResult {
  const bonif = getCCAABonification(ccaa, group, base);
  const result = calculateISDForCCAA(ccaa, {
    baseImponible: base,
    group,
    preexistingPatrimony: 0,
  });
  return { cuota: result.cuotaAPagar, bonifPct: bonif.pct, foral: bonif.foralRegime };
}

export default function PairPage({ params }: { params: { par: string } }) {
  const pair = parsePair(params.par);
  if (!pair) return notFound();

  const labelA = CCAA_LABELS[pair.a];
  const labelB = CCAA_LABELS[pair.b];
  const contentA = CCAA_CONTENT[pair.a];
  const contentB = CCAA_CONTENT[pair.b];

  // For sample (group II, 200K) — define which is cheaper
  const sampleA = compute(pair.a, "II", 200000);
  const sampleB = compute(pair.b, "II", 200000);

  const cheaper = sampleA.cuota <= sampleB.cuota ? "A" : "B";
  const cheaperLabel = cheaper === "A" ? labelA : labelB;
  const expensiveLabel = cheaper === "A" ? labelB : labelA;
  const saving = Math.abs(sampleB.cuota - sampleA.cuota);

  // Build matrix [group][base][a|b]
  const matrix = GROUPS.map((g) =>
    SAMPLE_BASES.map((b) => ({
      group: g,
      base: b,
      a: compute(pair.a, g.key, b),
      b: compute(pair.b, g.key, b),
    }))
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `¿Donde se paga menos herencia, ${labelA} o ${labelB}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: saving === 0
            ? `En grupo II con base 200.000 €, ambas comunidades aplican aproximadamente la misma cuota (${formatEUR(sampleA.cuota)}).`
            : `Para grupo II y base 200.000 €, ${cheaperLabel} aplica una cuota de ${formatEUR(Math.min(sampleA.cuota, sampleB.cuota))}, mientras ${expensiveLabel} aplica ${formatEUR(Math.max(sampleA.cuota, sampleB.cuota))}. Diferencia: ${formatEUR(saving)}.`,
        },
      },
      {
        "@type": "Question",
        name: `¿Cómo cambia la cuota entre ${labelA} y ${labelB} según el grupo de parentesco?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Las CCAA suelen bonificar a grupos I y II (cónyuge, descendientes, ascendientes) y aplicar tarifa estatal completa a grupos III y IV. La diferencia entre ${labelA} y ${labelB} suele ser mínima en grupos III y IV pero significativa en grupos I y II.`,
        },
      },
    ],
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

        {/* Breadcrumb */}
        <nav className="max-w-5xl mx-auto px-4 py-3 text-xs text-gray-500">
          <Link href="/" className="hover:text-primary">Inicio</Link>
          <span className="mx-2">›</span>
          <Link href="/comparador-isd" className="hover:text-primary">Comparador</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-700">{labelA} vs {labelB}</span>
        </nav>

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-14">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">
              Sucesiones: {labelA} <span className="text-blue-300">vs</span> {labelB}
            </h1>
            <p className="text-base text-blue-100 max-w-3xl">
              Cuánto cuesta heredar en {labelA} comparado con {labelB}. Bonificaciones, cuotas reales y diferencia fiscal para los 4 grupos de parentesco.
            </p>
          </div>
        </div>

        {/* TL;DR sample */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 mb-10 relative z-0">
          <div className="bg-white rounded-2xl shadow-lg border p-6 sm:p-8">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Ejemplo: hijo / cónyuge heredando 200.000 €</p>
            <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 items-center">
              <div className={`rounded-xl p-5 ${cheaper === "A" ? "bg-green-50 border border-green-200" : "bg-rose-50 border border-rose-200"}`}>
                <p className="text-xs text-gray-500">{labelA}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatEUR(sampleA.cuota)}</p>
                <p className="text-xs text-gray-500 mt-1">{sampleA.foral ? "Régimen foral" : `Bonif. ${sampleA.bonifPct}%`}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-300">vs</div>
                {saving > 0 && (
                  <p className="text-sm text-amber-600 font-semibold mt-2">{formatEUR(saving)} de diferencia</p>
                )}
              </div>
              <div className={`rounded-xl p-5 ${cheaper === "B" ? "bg-green-50 border border-green-200" : "bg-rose-50 border border-rose-200"}`}>
                <p className="text-xs text-gray-500">{labelB}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatEUR(sampleB.cuota)}</p>
                <p className="text-xs text-gray-500 mt-1">{sampleB.foral ? "Régimen foral" : `Bonif. ${sampleB.bonifPct}%`}</p>
              </div>
            </div>
            {saving > 0 && (
              <p className="text-sm text-gray-600 mt-5 text-center">
                Para una herencia de 200.000 € entre cónyuge / hijos / padres,{" "}
                <strong className="text-gray-900">{cheaperLabel} es más favorable que {expensiveLabel}</strong>.
              </p>
            )}
          </div>
        </div>

        {/* Big matrix */}
        <div className="max-w-5xl mx-auto px-4 mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Tabla comparativa por grupo y base imponible</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Grupo</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Base</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{labelA}</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{labelB}</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.flatMap((row, i) =>
                    row.map((cell, j) => {
                      const diff = Math.abs(cell.a.cuota - cell.b.cuota);
                      const winner = cell.a.cuota === cell.b.cuota ? "tie" : cell.a.cuota < cell.b.cuota ? "a" : "b";
                      return (
                        <tr
                          key={`${i}-${j}`}
                          className="border-b last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-3 py-3">
                            {j === 0 && (
                              <>
                                <span className="font-semibold text-gray-900">{cell.group.key}</span>
                                <span className="block text-[10px] text-gray-400">{cell.group.desc}</span>
                              </>
                            )}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-gray-600">{formatEUR(cell.base)}</td>
                          <td className={`px-3 py-3 text-right font-semibold ${winner === "a" ? "text-green-600" : "text-gray-700"}`}>
                            {cell.a.foral ? "Foral" : formatEUR(cell.a.cuota)}
                          </td>
                          <td className={`px-3 py-3 text-right font-semibold ${winner === "b" ? "text-green-600" : "text-gray-700"}`}>
                            {cell.b.foral ? "Foral" : formatEUR(cell.b.cuota)}
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-gray-500">
                            {diff === 0 ? "—" : formatEUR(diff)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-500">
              En verde la cuota más favorable de cada fila. Sin patrimonio preexistente, sin reducciones especiales.
            </div>
          </div>
        </div>

        {/* CCAA detail cards */}
        <div className="max-w-5xl mx-auto px-4 mb-10 grid md:grid-cols-2 gap-5">
          <DetailCard ccaa={pair.a} content={contentA} />
          <DetailCard ccaa={pair.b} content={contentB} />
        </div>

        {/* CTA */}
        <div className="max-w-5xl mx-auto px-4 mb-10">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <h2 className="text-xl font-bold mb-2">Calcula tu caso concreto</h2>
            <p className="text-blue-200 text-sm mb-5">
              Con tus datos reales (base, reducciones, edad, vivienda habitual) la diferencia puede variar.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/calculadora-isd"
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg text-sm transition"
              >
                Abrir calculadora →
              </Link>
              <Link
                href="/borrador-modelo650"
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition"
              >
                Generar borrador 650 (PDF)
              </Link>
            </div>
          </div>
        </div>

        {/* Other pairs */}
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-base font-bold text-gray-900 mb-3">Otras comparativas populares</h2>
          <div className="flex flex-wrap gap-2">
            {[
              ["madrid", "cataluna"],
              ["madrid", "comunidad-valenciana"],
              ["madrid", "andalucia"],
              ["cataluna", "comunidad-valenciana"],
              ["andalucia", "cataluna"],
              ["madrid", "asturias"],
              ["madrid", "galicia"],
              ["asturias", "comunidad-valenciana"],
            ].map(([a, b]) => {
              const sortedSlug = [a, b].sort().join("-vs-");
              if (sortedSlug === params.par) return null;
              const aLabel = getCCAABySlug(a)?.ccaa ? CCAA_LABELS[getCCAABySlug(a)!.ccaa] : a;
              const bLabel = getCCAABySlug(b)?.ccaa ? CCAA_LABELS[getCCAABySlug(b)!.ccaa] : b;
              return (
                <Link
                  key={sortedSlug}
                  href={`/comparador-isd/${sortedSlug}`}
                  className="px-3 py-1.5 bg-white border rounded-lg text-xs text-gray-700 hover:border-primary hover:text-primary"
                >
                  {aLabel} vs {bLabel}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function DetailCard({
  ccaa,
  content,
}: {
  ccaa: CCAAKey;
  content: typeof CCAA_CONTENT[keyof typeof CCAA_CONTENT];
}) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <h3 className="font-bold text-gray-900 mb-2">{CCAA_LABELS[ccaa]}</h3>
      <p className="text-xs text-gray-500 mb-4">Capital: {content.capital}</p>
      <ul className="space-y-2 mb-4">
        {content.highlights.slice(0, 3).map((h, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700">
            <span className="text-green-500 flex-shrink-0">✓</span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <Link
        href={`/sucesiones/${content.slug}`}
        className="text-sm font-medium text-primary hover:underline"
      >
        Guía completa de {CCAA_LABELS[ccaa]} →
      </Link>
    </div>
  );
}
