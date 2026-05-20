import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Radar ISD — Cero presentaciones tardías del Modelo 650 | BARITUR PRO",
  description:
    "Radar ISD vigila los 17 calendarios autonómicos del Impuesto de Sucesiones por ti. Alertas antes de cada plazo, ventana de prórroga, umbral de patrimonio o cambio de residencia. Cero recargos del 5-20%.",
  keywords: [
    "radar isd",
    "plazos modelo 650",
    "alertas impuesto sucesiones",
    "recargo presentacion tardia",
    "prorroga modelo 650",
    "vigilancia plazos herencia",
  ],
  alternates: { canonical: "https://bariturpro.com/radar-isd" },
  openGraph: {
    title: "Radar ISD — Cero presentaciones tardías",
    description:
      "Alertas proactivas en los 17 calendarios autonómicos. Tu equipo nunca vuelve a olvidar un plazo del Modelo 650.",
    type: "article",
  },
};

const ALERT_TYPES = [
  {
    code: "PLAZO",
    title: "Plazo del Modelo 650 a punto de vencer",
    severity: "Crítico",
    color: "rose",
    example:
      "Expediente Pérez-García (Andalucía). Vence en 14 días. Aún no se ha presentado y no se ha solicitado prórroga. Recargo estimado si se presenta fuera de plazo: 1.847 €.",
  },
  {
    code: "VENTANA_PRORROGA",
    title: "Ventana de prórroga abierta",
    severity: "Atención",
    color: "amber",
    example:
      "Expediente Rodríguez (Bizkaia). Quedan 12 días para poder solicitar la prórroga de 6 meses. Si la familia no completa los documentos a tiempo, el plazo expira sin opción a prórroga.",
  },
  {
    code: "TRAMO_PATRIMONIO",
    title: "Patrimonio preexistente cerca de cambio de tramo",
    severity: "Optimización",
    color: "indigo",
    example:
      "Heredero Martínez está 3.214 € por debajo del siguiente tramo del coeficiente multiplicador (×1,5882 → ×1,9059). Una reducción adicional permitida puede ahorrar 4.620 € en la cuota.",
  },
  {
    code: "CAMBIO_RESIDENCIA",
    title: "Cambio de residencia del causante",
    severity: "Riesgo legal",
    color: "fuchsia",
    example:
      "El causante consta empadronado en Madrid sólo en los últimos 3 años. Su residencia fiscal previa fue Cataluña. Riesgo de revisión por la AEAT: revisa los 5 años exigidos por el art. 28 Ley 22/2009.",
  },
  {
    code: "PLUSVALIA",
    title: "Plusvalía municipal próxima a vencer",
    severity: "Atención",
    color: "amber",
    example:
      "Inmueble urbano en Valencia heredado. Plazo IIVTNU vence en 23 días. Plusvalía estimada por método objetivo: 2.134 €. Método real podría reducirla a 0 € — verifica las escrituras.",
  },
  {
    code: "BONIFICACION_EXPIRA",
    title: "Bonificación autonómica con fecha de caducidad",
    severity: "Optimización",
    color: "indigo",
    example:
      "Reducción por vivienda habitual aplicada (95%, máx. 122.606 €). Requisito: el heredero debe mantener la vivienda durante 5 años. Próximo aniversario crítico: 14/12/2027. Programa recordatorio interno.",
  },
];

const SEVERITY_CLASSES: Record<string, { badge: string; ring: string; dot: string }> = {
  rose: {
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    ring: "ring-rose-100",
    dot: "bg-rose-500",
  },
  amber: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    ring: "ring-amber-100",
    dot: "bg-amber-500",
  },
  indigo: {
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    ring: "ring-indigo-100",
    dot: "bg-indigo-500",
  },
  fuchsia: {
    badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    ring: "ring-fuchsia-100",
    dot: "bg-fuchsia-500",
  },
};

export default function RadarISDPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Radar ISD",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Sistema de vigilancia automatizada para el Impuesto de Sucesiones y Donaciones: alerta de plazos, ventanas de prórroga, umbrales de patrimonio, cambios de residencia y bonificaciones.",
    offers: { "@type": "Offer", price: "149", priceCurrency: "EUR" },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "34",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="absolute inset-0 dot-grid-light opacity-30" />
          <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-indigo-500/30 rounded-full blur-3xl animate-float-slow" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-rose-400/20 rounded-full blur-3xl animate-float" />
          <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24">
            <div className="inline-flex items-center gap-2 bg-rose-500/20 border border-rose-400/30 rounded-full px-3 py-1 text-xs text-rose-200 mb-5">
              <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse"></span>
              Cero recargos del 5-20% por presentación tardía
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight tracking-tight">
              El radar que no deja vencer
              <br className="hidden sm:block" />
              <span className="text-blue-300"> ningún plazo del ISD</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 max-w-3xl mb-7">
              Mientras tu equipo está con el siguiente expediente, Radar ISD vigila los{" "}
              <strong className="text-white">17 calendarios autonómicos</strong>, las
              ventanas de prórroga, los umbrales de patrimonio preexistente y los
              cambios de residencia. Si algo va a vencer o a costar dinero, te avisa
              antes — no después.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#demo"
                className="px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all text-sm"
              >
                Probar Radar ISD · 14 días gratis →
              </Link>
              <Link
                href="/precios"
                className="px-6 py-3 bg-white/10 border border-white/15 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm"
              >
                Ver planes
              </Link>
            </div>
          </div>
        </div>

        {/* Stats band */}
        <div className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-rose-600">5-20%</p>
              <p className="text-xs text-gray-500 mt-1">Recargo AEAT por presentación tardía</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-600">6 meses</p>
              <p className="text-xs text-gray-500 mt-1">Plazo legal del Modelo 650</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-indigo-600">17</p>
              <p className="text-xs text-gray-500 mt-1">Calendarios autonómicos vigilados</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-600">0</p>
              <p className="text-xs text-gray-500 mt-1">Plazos olvidados en clientes Pro</p>
            </div>
          </div>
        </div>

        {/* Mockup: panel de alertas */}
        <Reveal>
          <div className="max-w-5xl mx-auto px-4 py-14">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                Las 6 señales que Radar detecta
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Cada alerta es una pérdida de dinero evitada
              </h2>
              <p className="mt-3 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
                No son notificaciones genéricas. Cada señal es un evento fiscal o legal con
                impacto directo en la cuota — y un margen claro de acción.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {ALERT_TYPES.map((a) => {
                const c = SEVERITY_CLASSES[a.color];
                return (
                  <div
                    key={a.code}
                    className={`relative bg-white border rounded-xl p-5 ring-1 ${c.ring} card-lift hover:border-primary/30`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`mt-1.5 w-2 h-2 rounded-full ${c.dot} animate-pulse flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${c.badge}`}>
                            {a.severity}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">#{a.code}</span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm">{a.title}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed pl-5">{a.example}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Cómo funciona */}
        <div className="bg-white border-y">
          <div className="max-w-5xl mx-auto px-4 py-14">
            <Reveal>
              <div className="text-center mb-12">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Cómo funciona
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  De fecha de fallecimiento a alertas automáticas en 30 segundos
                </h2>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  num: "1",
                  title: "Abres el expediente",
                  desc: "Indicas la fecha de fallecimiento, CCAA de residencia y herederos. Radar calcula al instante los plazos del Modelo 650 y de la plusvalía municipal de cada inmueble.",
                },
                {
                  num: "2",
                  title: "Radar mapea el caso",
                  desc: "Identifica las ventanas de prórroga, los tramos de patrimonio preexistente cerca de saltar, los cambios de residencia en los últimos 5 años y las bonificaciones autonómicas con requisitos a mantener.",
                },
                {
                  num: "3",
                  title: "Tú recibes las alertas",
                  desc: "Email + panel diario + Slack opcional. Por urgencia, por expediente, por responsable. Sin checklist manual. Sin Excel. Sin que dependa de la memoria de nadie.",
                },
              ].map((s, i) => (
                <Reveal key={s.num} delay={i * 120}>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/25 mb-4">
                      {s.num}
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* Comparativa */}
        <div className="max-w-5xl mx-auto px-4 py-14">
          <Reveal>
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                El coste de no tener Radar
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Excel y memoria humana vs Radar ISD
              </h2>
            </div>
          </Reveal>
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
              <div className="p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">El método de la mayoría</p>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Hoja de cálculo + memoria</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  {[
                    "Alguien tiene que abrir el Excel cada lunes y revisar 30+ expedientes",
                    "Un olvido en un puente festivo = recargo del 5-20% sobre la cuota",
                    "Las bonificaciones autonómicas con caducidad no las vigila nadie",
                    "Si quien lleva el seguimiento se va, el conocimiento se va con ella",
                    "Sin trazabilidad: nadie sabe quién vio qué alerta ni cuándo",
                  ].map((x) => (
                    <li key={x} className="flex gap-2.5">
                      <svg className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-50/50 to-blue-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">El método de BARITUR PRO</p>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Radar ISD activo 24/7</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  {[
                    "Cada expediente se autovigila desde el día 1, sin tarea manual",
                    "Alertas con 30, 14, 7 y 1 día de antelación por canal configurable",
                    "Detección automática de tramos de patrimonio preexistente y bonificaciones",
                    "Si alguien deja el equipo, las alertas se reasignan; el conocimiento queda",
                    "Audit trail completo: quién vio qué alerta y cuándo, exportable",
                  ].map((x) => (
                    <li key={x} className="flex gap-2.5">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Caso numérico */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-t">
          <div className="max-w-4xl mx-auto px-4 py-14">
            <Reveal>
              <div className="bg-white rounded-2xl border shadow-sm p-6 sm:p-10">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Caso típico</p>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  Gestoría de tamaño medio · 40 expedientes mortis causa al año
                </h2>
                <div className="grid sm:grid-cols-2 gap-6 mt-6">
                  <div className="rounded-xl bg-rose-50 border border-rose-100 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2">Sin Radar</p>
                    <p className="text-sm text-gray-700 mb-3">
                      Probabilidad de 1 presentación tardía al año: ~5-8%. Recargo medio
                      sobre cuota de 18.000 € → recargo 15% = <strong>2.700 €</strong>.
                      Multiplica por casos en riesgo en cartera.
                    </p>
                    <p className="text-2xl font-bold text-rose-700">≈ 4.000-7.000 € / año</p>
                    <p className="text-xs text-rose-600 mt-1">en recargos absorbidos por la gestoría o cobrados al cliente</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Con Radar (BARITUR PRO Despacho)</p>
                    <p className="text-sm text-gray-700 mb-3">
                      Coste anual del plan: 349 € × 12 = <strong>4.188 €</strong>. Incluye
                      Radar, portal familia, borrador automático del Modelo 650 y equipo
                      de hasta 10 personas.
                    </p>
                    <p className="text-2xl font-bold text-emerald-700">4.188 € / año</p>
                    <p className="text-xs text-emerald-600 mt-1">y se evita el 100% de presentaciones tardías</p>
                  </div>
                </div>
                <p className="mt-6 text-sm text-gray-600 leading-relaxed">
                  El plan se paga sólo con evitar un único recargo grave al año — y BARITUR
                  PRO además te devuelve horas administrativas, te trae el portal familia y
                  el borrador automático. <Link href="/calculadora-roi" className="text-primary font-semibold hover:underline">Calcula tu caso →</Link>
                </p>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Datos vigilados */}
        <div className="max-w-5xl mx-auto px-4 py-14">
          <Reveal>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center tracking-tight">
              Qué normativa entiende Radar
            </h2>
            <p className="text-center text-sm text-gray-600 mb-8 max-w-2xl mx-auto">
              Radar conoce las particularidades de las 17 CCAA y los regímenes forales — no
              es un cronómetro genérico.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { title: "Ley 29/1987 ISD", desc: "Tarifa estatal y reducciones del art. 20." },
              { title: "RD 1629/1991", desc: "Reglamento del ISD: plazos, prórrogas, autoliquidación." },
              { title: "Normativa de las 15 CCAA", desc: "Bonificaciones y reducciones específicas en territorio común." },
              { title: "Hacienda Foral de Navarra", desc: "Régimen propio, plazos y cuota foral." },
              { title: "Haciendas Forales del País Vasco", desc: "Álava, Bizkaia y Gipuzkoa, cada una con su normativa." },
              { title: "RDL 26/2021 — Plusvalía", desc: "IIVTNU método objetivo y real, no sujeción si no hay incremento." },
              { title: "Ley 22/2009", desc: "Punto de conexión por residencia habitual del causante (5 años)." },
              { title: "Catastro y referencias", desc: "Valor de referencia y comparativa con valor declarado." },
              { title: "Actualización continua", desc: "Cada reforma autonómica se aplica en cuanto entra en vigor." },
            ].map((b) => (
              <div key={b.title} className="bg-white border rounded-xl p-5 card-lift">
                <h3 className="font-bold text-gray-900 text-sm mb-1">{b.title}</h3>
                <p className="text-sm text-gray-600">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white border-t">
          <div className="max-w-3xl mx-auto px-4 py-14">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Preguntas frecuentes</h2>
            <div className="space-y-3">
              {[
                {
                  q: "¿Cómo sabe Radar el plazo de cada expediente?",
                  a: "Lo calcula automáticamente desde la fecha de fallecimiento (Modelo 650: 6 meses, prorrogable a 12; Modelo 651 donaciones: 30 días hábiles; plusvalía municipal: 6 meses) y según la CCAA aplicable por residencia del causante. Tú no tocas un calendario.",
                },
                {
                  q: "¿Las alertas son por email o solo dentro de la app?",
                  a: "Ambas. Cada miembro del equipo recibe un resumen diario por email con las alertas críticas + un panel en la app. Plan Firma incluye notificaciones por Slack y un webhook configurable.",
                },
                {
                  q: "¿Distingue Radar entre CCAA con régimen común y foral?",
                  a: "Sí. Navarra y los tres territorios forales del País Vasco tienen calendarios y normativa específicos. Radar los aplica automáticamente cuando el causante reside en ellos.",
                },
                {
                  q: "¿Qué pasa si el cliente entrega documentos tarde?",
                  a: "Radar avisa cuando el expediente lleva 3 meses sin progresar y la documentación crítica sigue sin cerrarse. Permite priorizar y, si procede, recomendar la solicitud de prórroga al cliente con tiempo de margen.",
                },
                {
                  q: "¿Puedo silenciar alertas que no aplican a mi caso?",
                  a: "Sí. Cada alerta puede marcarse como 'no aplica con motivo'; queda en el audit trail con autor y fecha, lo que protege legalmente a la gestoría si la familia reclama después.",
                },
              ].map((f) => (
                <details key={f.q} className="group bg-gray-50 hover:bg-white border rounded-xl px-5 py-4 transition">
                  <summary className="cursor-pointer font-semibold text-gray-900 text-sm flex items-center justify-between">
                    {f.q}
                    <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <p className="text-sm text-gray-600 mt-3 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <Reveal>
          <div className="max-w-5xl mx-auto px-4 pb-16 pt-4">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white p-8 sm:p-12">
              <div className="absolute -top-20 right-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 -left-16 w-64 h-64 bg-rose-500/15 rounded-full blur-3xl" />
              <div className="relative max-w-2xl">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
                  Empieza a no perder ningún plazo desde mañana
                </h2>
                <p className="text-slate-300 text-sm sm:text-base mb-6">
                  14 días gratis, sin tarjeta. Importa tus expedientes en curso y Radar
                  empieza a vigilarlos en 30 minutos.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/#demo"
                    className="px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all text-sm"
                  >
                    Probar BARITUR PRO →
                  </Link>
                  <Link
                    href="/contacto"
                    className="px-6 py-3 bg-white/10 border border-white/15 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm"
                  >
                    Hablar con ventas
                  </Link>
                </div>
                <p className="text-xs text-slate-400 mt-3">Sin tarjeta · sin permanencia · setup en 30 minutos</p>
              </div>
            </div>
          </div>
        </Reveal>

        <SiteFooter />
      </div>
    </>
  );
}
