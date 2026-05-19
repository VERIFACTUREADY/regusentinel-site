import { Metadata } from "next";
import Link from "next/link";
import { CalculatorClient } from "./calculator-client";
import { ProUpsell } from "@/components/pro-upsell";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Calculadora del Impuesto de Sucesiones (ISD) por Comunidad Autónoma | BARITUR PRO",
  description:
    "Calcula gratis cuánto se paga por el Impuesto de Sucesiones (Modelo 650) en España según tu Comunidad Autónoma. Compara entre todas las CCAA: Madrid, Andalucía, Cataluña, Galicia, Valencia y más. Estimación basada en la normativa estatal y bonificaciones autonómicas vigentes.",
  keywords: [
    "calculadora impuesto sucesiones",
    "modelo 650",
    "ISD",
    "impuesto sucesiones por comunidad autonoma",
    "cuanto se paga herencia España",
    "bonificacion sucesiones",
    "calculadora herencia",
    "tarifa estatal ISD",
  ],
  alternates: { canonical: "/calculadora-isd" },
  openGraph: {
    title: "Calculadora ISD: ¿Cuánto se paga por el Impuesto de Sucesiones?",
    description:
      "Estima la cuota del Modelo 650 según tu CCAA y compara entre las 17 Comunidades Autónomas. Gratis y sin registro.",
    type: "website",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Calculadora ISD por Comunidad Autónoma",
    description:
      "¿Cuánto se paga por el Impuesto de Sucesiones en España? Calcula y compara entre CCAAs.",
  },
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Cómo se calcula el Impuesto de Sucesiones en España?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Se aplica la tarifa estatal progresiva (del 7,65% al 34%) sobre la base liquidable, multiplicada por un coeficiente que depende del grupo de parentesco y del patrimonio preexistente del heredero. Cada Comunidad Autónoma aplica además bonificaciones que pueden reducir la cuota hasta el 99-100% para cónyuge, hijos y ascendientes.",
      },
    },
    {
      "@type": "Question",
      name: "¿En qué Comunidad Autónoma se paga menos por el Impuesto de Sucesiones?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Para cónyuge, hijos y ascendientes (Grupos I y II), Madrid, Andalucía, Murcia, Galicia, La Rioja, Extremadura, Castilla y León, Comunidad Valenciana, Aragón y Cantabria bonifican entre el 99% y el 100% de la cuota. Asturias, Cataluña y otras tienen escalado más restrictivo. Navarra y País Vasco tienen régimen foral propio.",
      },
    },
    {
      "@type": "Question",
      name: "¿Cuáles son los grupos de parentesco del ISD?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Grupo I: descendientes y adoptados menores de 21 años. Grupo II: descendientes mayores de 21, cónyuge, ascendientes. Grupo III: hermanos, tíos, sobrinos, ascendientes/descendientes por afinidad. Grupo IV: primos y otros parientes lejanos o extraños.",
      },
    },
    {
      "@type": "Question",
      name: "¿Qué plazo hay para presentar el Modelo 650?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "6 meses desde la fecha de fallecimiento, prorrogables otros 6 meses si se solicita la prórroga dentro de los 5 primeros meses. La presentación fuera de plazo conlleva recargos del 5% al 20% más intereses de demora.",
      },
    },
    {
      "@type": "Question",
      name: "¿Esta calculadora sustituye el asesoramiento profesional?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Es una estimación orientativa. Para presentar el Modelo 650 y aprovechar todas las reducciones (vivienda habitual, empresa familiar, discapacidad, etc.) es imprescindible contar con un asesor fiscal o gestoría especializada.",
      },
    },
  ],
};

export default function CalculadoraISDPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />

      {/* ─── Header ───────────────────────────────────────── */}
      <SiteHeader />

      {/* ─── Hero ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Calculadora gratuita · Sin registro
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Calculadora del Impuesto de Sucesiones por Comunidad Autónoma
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Estima la cuota del <strong>Modelo 650</strong> según tu CCAA y compara
            entre las 17 Comunidades Autónomas. Tarifa estatal vigente,
            coeficientes multiplicadores y bonificaciones autonómicas
            actualizadas.
          </p>
        </div>
      </section>

      {/* ─── Calculadora interactiva ─────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <CalculatorClient />
      </section>

      {/* ─── Cómo funciona ────────────────────────────────── */}
      <section className="bg-white border-y">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-bold text-slate-900">¿Cómo se calcula el ISD?</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div>
              <div className="text-3xl font-bold text-blue-600">1</div>
              <h3 className="mt-2 font-semibold text-slate-900">Base liquidable</h3>
              <p className="mt-1 text-sm text-slate-600">
                Valor neto de la herencia recibida menos las reducciones estatales
                por parentesco (15.956,87€ para grupos I-II, 7.993,46€ para grupo
                III), reducción por vivienda habitual (95%, máx. 122.606,47€) y
                seguros de vida (máx. 9.195,49€).
              </p>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">2</div>
              <h3 className="mt-2 font-semibold text-slate-900">Cuota íntegra y multiplicador</h3>
              <p className="mt-1 text-sm text-slate-600">
                Sobre la base liquidable se aplica la tarifa estatal progresiva
                (7,65% al 34%) y luego un coeficiente multiplicador del 1,00 al
                2,40 según grupo de parentesco y patrimonio preexistente del
                heredero (art. 22 Ley 29/1987).
              </p>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">3</div>
              <h3 className="mt-2 font-semibold text-slate-900">Bonificación autonómica</h3>
              <p className="mt-1 text-sm text-slate-600">
                Cada CCAA aplica su propia bonificación sobre la cuota tributaria.
                Madrid, Andalucía o Murcia bonifican el 99% para cónyuge e hijos.
                Cataluña y Castilla-La Mancha aplican escalas progresivas
                inversas. Navarra y País Vasco tienen régimen foral propio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="text-2xl font-bold text-slate-900">Preguntas frecuentes</h2>
        <div className="mt-6 space-y-4">
          {FAQ_JSON_LD.mainEntity.map((q) => (
            <details key={q.name} className="group rounded-lg border bg-white p-4">
              <summary className="cursor-pointer font-medium text-slate-900">
                {q.name}
              </summary>
              <p className="mt-3 text-sm text-slate-600">{q.acceptedAnswer.text}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ─── CTA al producto ──────────────────────────────── */}
      <ProUpsell
        freeToolName="Esta calculadora del Impuesto de Sucesiones"
        freeToolDesc="estima la cuota de un caso puntual; hay que reintroducir todos los datos en cada consulta."
      />

      {/* ─── Disclaimer + Footer ──────────────────────────── */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-500">
          <p>
            <strong>Aviso legal:</strong> Esta calculadora es una herramienta
            orientativa basada en la tarifa estatal del Impuesto sobre Sucesiones
            y Donaciones (Ley 29/1987) y un resumen de las bonificaciones
            autonómicas vigentes en 2025. No sustituye el asesoramiento de un
            profesional. Las normativas autonómicas evolucionan y pueden tener
            requisitos específicos que no se modelan aquí. Navarra y País Vasco
            tienen régimen foral propio. BARITUR no presta asesoramiento
            jurídico ni fiscal individual.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <span>© BARITUR PRO</span>
            <div className="flex gap-4">
              <Link href="/legal/terminos" className="hover:text-slate-700">Términos</Link>
              <Link href="/legal/privacidad" className="hover:text-slate-700">Privacidad</Link>
              <Link href="/legal/cookies" className="hover:text-slate-700">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
