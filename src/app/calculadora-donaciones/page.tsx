import type { Metadata } from "next";
import Link from "next/link";
import { CalculadoraDonacionesClient } from "./donaciones-client";

export const metadata: Metadata = {
  title: "Calculadora Modelo 651 — Impuesto sobre Donaciones por CCAA 2025",
  description:
    "Calcula online el impuesto sobre donaciones (Modelo 651) según CCAA, grupo de parentesco, tipo de bien y reducciones aplicables. Bonificaciones autonómicas actualizadas.",
  keywords: [
    "calculadora donaciones",
    "modelo 651",
    "impuesto donaciones",
    "donacion vivienda hijo",
    "donacion dineraria",
    "isd donacion",
  ],
  alternates: {
    canonical: "https://bariturpro.com/calculadora-donaciones",
  },
  openGraph: {
    title: "Calculadora Modelo 651 — Donaciones por CCAA",
    description:
      "Cuánto tributa una donación según CCAA, parentesco y tipo de bien. Calcula al instante con la bonificación autonómica aplicada.",
    type: "website",
  },
};

export default function CalculadoraDonacionesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Cuánto se paga por una donación de un padre a un hijo?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Depende de la CCAA del donatario (o de la ubicación del inmueble si se dona). En Madrid, Andalucía, Galicia, Murcia, La Rioja, Castilla y León, Extremadura, Canarias, Baleares y Comunidad Valenciana se bonifica la cuota entre el 95% y el 100% para donaciones a descendientes. En Cataluña no se bonifica pero hay tarifa específica reducida. En Asturias se aplica la tarifa estatal completa.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué plazo hay para presentar el Modelo 651?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "30 días hábiles desde la fecha de la donación. Es un plazo mucho más corto que el del Modelo 650 (sucesiones, 6 meses), por lo que conviene presentarlo cuanto antes.",
        },
      },
      {
        "@type": "Question",
        name: "¿Hay reducciones aplicables a las donaciones?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A diferencia de las sucesiones, no hay reducción base por parentesco. Pero sí hay reducciones específicas: vivienda habitual a descendiente menor de 35, donación dineraria para adquisición de vivienda, empresa familiar (95% si se cumplen requisitos del art. 20.6 Ley 29/1987), entre otras.",
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
              <Link href="/donaciones" className="text-gray-700 hover:text-primary hidden sm:inline">Donaciones</Link>
              <Link href="/recursos" className="text-gray-700 hover:text-primary hidden md:inline">Recursos</Link>
              <Link href="/#demo" className="text-primary font-semibold">Probar gratis</Link>
            </nav>
          </div>
        </header>

        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-14">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              Modelo 651 · Sin registro · Plazo 30 días
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Calculadora del Impuesto sobre Donaciones</h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-2xl">
              Cuánto se paga por una donación según CCAA, parentesco con el donante, tipo de bien y reducciones específicas.
              Tarifa estatal + bonificación autonómica aplicada al instante.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 -mt-6 mb-10 relative z-0">
          <CalculadoraDonacionesClient />
        </div>

        {/* Diferencias clave con sucesiones */}
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-amber-900 mb-3">Donaciones vs Sucesiones — diferencias clave</h2>
            <ul className="space-y-2 text-sm text-amber-900">
              <li className="flex gap-2">
                <span className="text-amber-600 font-bold">→</span>
                <span><strong>Plazo:</strong> 30 días hábiles desde la donación, frente a los 6 meses de sucesiones.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600 font-bold">→</span>
                <span><strong>Sujeto pasivo:</strong> el donatario (quien recibe), no los herederos.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600 font-bold">→</span>
                <span><strong>Sin reducción base por parentesco:</strong> no se aplica el descuento del art. 20.2.a — toda la base tributa.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600 font-bold">→</span>
                <span><strong>CCAA aplicable:</strong> residencia del donatario (bienes muebles) o ubicación del inmueble.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600 font-bold">→</span>
                <span><strong>Bonificaciones autonómicas distintas:</strong> Cataluña no bonifica donaciones; otras CCAA sí pero con escala diferente a sucesiones.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-3xl mx-auto px-4 pb-16">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <h2 className="text-xl font-bold mb-2">¿Tramitas donaciones para clientes?</h2>
            <p className="text-blue-200 mb-5 text-sm">
              BARITUR PRO automatiza también los expedientes de donación: plazos del Modelo 651, captura
              documental por portal y generación de borradores.
            </p>
            <Link
              href="/#demo"
              className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition"
            >
              Probar BARITUR PRO →
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            <strong>Aviso:</strong> El cálculo es orientativo y se basa en la tarifa estatal y la
            bonificación autonómica vigente. Algunas CCAA aplican reducciones específicas adicionales no
            contempladas aquí. Para una valoración rigurosa consulta con un asesor fiscal.
          </p>
        </div>
      </div>
    </>
  );
}
