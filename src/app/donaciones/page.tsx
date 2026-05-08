import type { Metadata } from "next";
import Link from "next/link";
import { CCAA_LABELS, type CCAAKey } from "@/lib/isd-calculator";
import { getDonacionBonification, calculateDonacion } from "@/lib/donaciones-calculator";

export const metadata: Metadata = {
  title: "Impuesto sobre Donaciones (Modelo 651) — Guía completa por CCAA 2025",
  description:
    "Bonificaciones, plazos, reducciones específicas y cuotas reales del Impuesto sobre Donaciones en las 17 comunidades autónomas. Modelo 651 explicado paso a paso.",
  keywords: [
    "impuesto donaciones",
    "modelo 651",
    "donacion vivienda",
    "donacion dineraria",
    "isd donacion",
    "bonificacion donacion ccaa",
  ],
  alternates: { canonical: "https://bariturpro.com/donaciones" },
  openGraph: {
    title: "Impuesto sobre Donaciones — Guía CCAA 2025",
    description: "Cuánto se paga por una donación según CCAA y parentesco. Cifras reales para 4 grupos.",
    type: "article",
  },
};

const ALL_CCAA = Object.keys(CCAA_LABELS) as CCAAKey[];

function formatEUR(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export default function DonacionesPage() {
  // Compute table for sample: 100K donation, group II
  const sampleRows = ALL_CCAA.map((ccaa) => {
    const result = calculateDonacion(
      { group: "II", baseImponible: 100000, preexistingPatrimony: 0 },
      ccaa
    );
    const bonif = getDonacionBonification(ccaa, "II");
    return { ccaa, label: CCAA_LABELS[ccaa], cuota: result.cuotaAPagar, bonifPct: bonif.pct, foral: bonif.foralRegime };
  }).sort((a, b) => a.cuota - b.cuota);

  const cheapest = sampleRows[0];
  const mostExpensive = sampleRows[sampleRows.length - 1];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Qué es el Modelo 651?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "El Modelo 651 es la autoliquidación del Impuesto sobre Donaciones. Lo presenta el donatario (quien recibe) en los 30 días hábiles siguientes a la donación, ante la oficina liquidadora de la CCAA competente.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué CCAA es competente en una donación?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Para bienes muebles (dinero, valores, vehículos) la CCAA del donatario en los 5 años previos. Para inmuebles, la CCAA donde se ubica el inmueble.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué reducciones aplican a las donaciones?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A diferencia de las sucesiones, no hay reducción base por parentesco. Pero sí existen reducciones específicas: empresa familiar (95%), donación de vivienda habitual a descendiente menor de 35, donación dineraria para adquisición de vivienda habitual, entre otras.",
        },
      },
      {
        "@type": "Question",
        name: "¿Por qué Cataluña no bonifica donaciones?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Cataluña tiene una tarifa específica reducida para donaciones (5%-9% para grupos I-II en escritura pública), pero no aplica la bonificación porcentual sobre la cuota como sí hace en sucesiones.",
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-primary">BARITUR PRO</Link>
            <nav className="flex gap-3 sm:gap-4 text-sm">
              <Link href="/calculadora-isd" className="text-gray-700 hover:text-primary">Sucesiones</Link>
              <Link href="/donaciones" className="text-primary font-semibold">Donaciones</Link>
              <Link href="/blog" className="text-gray-700 hover:text-primary">Blog</Link>
              <Link href="/#demo" className="text-primary font-semibold hidden sm:inline">Probar gratis</Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-14 sm:py-16">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 text-xs text-blue-300 mb-4">
              Modelo 651 · Actualizado 2025 · 17 CCAA
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">
              Impuesto sobre Donaciones (Modelo 651)
            </h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-3xl mb-6">
              Cómo se calcula el ISD en donaciones inter vivos, qué bonificaciones aplica cada CCAA,
              cuáles son las reducciones específicas y cómo difiere del Modelo 650 (sucesiones).
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/calculadora-donaciones"
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-lg text-sm transition"
              >
                Calcular tu donación →
              </Link>
              <Link
                href="/calculadora-isd"
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition"
              >
                Si es herencia → Modelo 650
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">17</p>
              <p className="text-xs text-gray-500 mt-0.5">CCAA cubiertas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">30 días</p>
              <p className="text-xs text-gray-500 mt-0.5">Plazo del Modelo 651</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-600">{formatEUR(mostExpensive.cuota)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Cuota máxima (100K, gr II)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">95%</p>
              <p className="text-xs text-gray-500 mt-0.5">Reducción vivienda hijo</p>
            </div>
          </div>
        </div>

        {/* Diferencias */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Donación vs Herencia: 5 diferencias clave</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { title: "Plazo", a: "Donación: 30 días hábiles", b: "Herencia: 6 meses + prórroga" },
              { title: "Sujeto pasivo", a: "Donación: el donatario (recibe)", b: "Herencia: cada heredero por su parte" },
              { title: "Reducción base por parentesco", a: "Donación: NO aplica", b: "Herencia: SÍ (15.956 €+)" },
              { title: "CCAA aplicable", a: "Donación: residencia donatario / ubicación inmueble", b: "Herencia: residencia del causante" },
              { title: "Acumulación con herencia", a: "Donaciones de los 4 años previos al fallecimiento se acumulan al ISD de sucesión", b: "" },
              { title: "Bonificaciones autonómicas", a: "Donaciones: en muchas CCAA distintas (Cataluña, Asturias, Aragón) o más restrictivas", b: "" },
            ].map((b, i) => (
              <div key={i} className="bg-white border rounded-xl p-5">
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{b.title}</h3>
                <p className="text-sm text-gray-700">{b.a}</p>
                {b.b && <p className="text-sm text-gray-600 mt-1">{b.b}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Tabla CCAA */}
        <div className="bg-white border-t border-b">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Tabla de cuotas por CCAA</h2>
            <p className="text-sm text-gray-600 mb-6">Donación de 100.000 € a un descendiente o cónyuge (grupo II), sin reducción específica.</p>
            <div className="overflow-x-auto bg-white rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">CCAA</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Bonif.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Cuota a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, i) => (
                    <tr key={row.ccaa} className={`border-b last:border-0 hover:bg-gray-50 ${i === 0 ? "bg-emerald-50/50" : ""}`}>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 text-sm">
                        {row.label}
                        {i === 0 && <span className="ml-2 text-xs text-emerald-600">✓ más baja</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {row.foral ? (
                          <span className="bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">Foral</span>
                        ) : row.bonifPct >= 99 ? (
                          <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">{row.bonifPct}%</span>
                        ) : row.bonifPct > 0 ? (
                          <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{row.bonifPct}%</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">0%</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${row.cuota === 0 ? "text-emerald-600" : row.cuota > 5000 ? "text-rose-600" : "text-gray-900"}`}>
                        {formatEUR(row.cuota)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Cálculo orientativo grupo II, sin patrimonio preexistente, sin reducciones específicas.
            </p>
          </div>
        </div>

        {/* Reducciones específicas */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Reducciones específicas en donaciones</h2>
          <div className="space-y-4">
            {[
              {
                title: "Donación de vivienda habitual del causante a descendiente menor de 35 años",
                pct: "95%",
                desc: "Reduce el 95% del valor de la vivienda con tope variable según CCAA. Requisitos: el donatario debe ser menor de 35 años (40 en algunas CCAA), debe residir en la vivienda y no tener otra en propiedad. Periodo de mantenimiento (5-10 años habitualmente).",
              },
              {
                title: "Donación dineraria para adquisición de primera vivienda habitual",
                pct: "80%",
                desc: "Reduce un porcentaje variable del importe donado siempre que se destine a la compra de la primera vivienda habitual del donatario. Existen topes (60.000 €-180.000 € según CCAA) y plazos para acreditar la compra (6 meses-1 año).",
              },
              {
                title: "Donación de empresa familiar o participaciones sociales",
                pct: "95%",
                desc: "Art. 20.6 Ley 29/1987. Requiere: el donante tener 65+, ejercer función directiva con remuneración mayoritaria, mantener participación durante el plazo legal (10 años habitualmente). Aplica a empresas familiares con titularidad real.",
              },
              {
                title: "Donación a personas con discapacidad",
                pct: "Variable",
                desc: "Reducciones específicas por CCAA. Pueden combinarse con discapacidad ≥33% o ≥65%. Algunos casos eximen totalmente la cuota.",
              },
            ].map((r, i) => (
              <div key={i} className="bg-white border rounded-xl p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-gray-900 text-sm">{r.title}</h3>
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{r.pct}</span>
                </div>
                <p className="text-sm text-gray-700">{r.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-sm text-amber-900">
              <strong>Importante:</strong> cada CCAA puede tener requisitos, importes máximos y plazos
              distintos. Verifica siempre la normativa autonómica vigente o consulta con un asesor
              especializado.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-3xl mx-auto px-4 py-14 text-center">
            <h2 className="text-2xl font-bold mb-3">¿Tramitas donaciones para clientes?</h2>
            <p className="text-blue-200 text-sm mb-6">
              BARITUR PRO automatiza también los expedientes de donación. 14 días gratis.
            </p>
            <Link
              href="/#demo"
              className="inline-block px-7 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition"
            >
              Probar BARITUR PRO →
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            <strong>Aviso:</strong> Esta página recoge información orientativa sobre el Impuesto sobre
            Donaciones. La normativa autonómica varía y puede haber cambios recientes no reflejados.
            No constituye asesoramiento jurídico ni fiscal individualizado.
          </p>
        </div>
      </div>
    </>
  );
}
