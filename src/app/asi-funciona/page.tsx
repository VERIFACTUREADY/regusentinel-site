import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Así funciona BARITUR PRO — Las 4 pantallas que usarás a diario",
  description:
    "Mira lo que verás cuando entres a BARITUR PRO: cola de acciones, expediente con Radar, borrador del Modelo 650 y Portal Familia. Sin signup, sin pedir demo.",
  keywords: [
    "como funciona bariturpro",
    "demo bariturpro",
    "ver producto bariturpro",
    "tour bariturpro",
    "software herencias demo",
  ],
  alternates: { canonical: "https://bariturpro.com/asi-funciona" },
  openGraph: {
    title: "Así funciona BARITUR PRO — sin signup",
    description:
      "Las 4 pantallas que verás todos los días: cola de acciones, expediente con Radar, borrador y portal familia.",
    type: "article",
  },
};

export default function AsiFuncionaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "BARITUR PRO",
    description:
      "Software B2B de gestión de herencias y post-mortem para gestorías, funerarias y despachos. Cola de acciones, Radar ISD, Borrador automático del Modelo 650 y Portal Familia.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "149", priceCurrency: "EUR" },
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
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-400/25 rounded-full blur-3xl animate-float" />
          <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 text-xs text-blue-200 mb-5">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
              Sin signup · 4 pantallas · 90 segundos de lectura
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight tracking-tight">
              Esto es lo que verás
              <br className="hidden sm:block" />
              <span className="text-blue-300"> cuando entres a BARITUR PRO</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 max-w-3xl">
              Sin pedir reunión, sin signup, sin email comercial. Te enseñamos las
              4 pantallas que tu equipo va a usar a diario y por qué cada una le
              ahorra tiempo y dinero.
            </p>
          </div>
        </div>

        {/* Pantalla 1: Cola de Acciones */}
        <Reveal>
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="grid lg:grid-cols-5 gap-10 items-center">
              <div className="lg:col-span-2 order-2 lg:order-1">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Pantalla 1 · La que abres cada mañana
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                  Cola de Acciones
                </h2>
                <p className="text-gray-700 leading-relaxed mb-5">
                  Toda tu cartera de expedientes ordenada por una única regla: la
                  acción siguiente más urgente. No es un "dashboard": es una lista
                  priorizada de qué hacer ahora.
                </p>
                <ul className="space-y-3">
                  {[
                    "Cada expediente muestra UNA acción siguiente, no 17 tareas",
                    "Ordenado por urgencia real (plazos, dependencias)",
                    "Filtros por responsable, CCAA, tipo de bien o fase",
                    "Cliquear avanza el expediente — no hay 4 menús que entender",
                  ].map((x) => (
                    <li key={x} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-3 order-1 lg:order-2">
                <BrowserMock url="bariturpro.com/today">
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Hoy · 14 mayo</p>
                        <h3 className="text-lg font-bold text-slate-900 mt-0.5">Cola de Acciones</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">12 expedientes activos</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {MOCK_QUEUE.map((q, i) => (
                        <div key={i} className={`border rounded-xl p-3.5 flex items-center gap-3 ${q.tone === "rose" ? "border-rose-200 bg-rose-50/50" : q.tone === "amber" ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white"} hover:shadow-sm transition`}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${q.tone === "rose" ? "bg-rose-500" : q.tone === "amber" ? "bg-amber-500" : "bg-slate-400"} ${q.tone !== "slate" && "animate-pulse"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-mono text-slate-400">{q.id}</span>
                              <span className="text-xs text-slate-500">·</span>
                              <span className="text-xs text-slate-600">{q.causante}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 truncate">{q.action}</p>
                          </div>
                          <span className={`text-xs font-bold flex-shrink-0 ${q.tone === "rose" ? "text-rose-700" : q.tone === "amber" ? "text-amber-700" : "text-slate-500"}`}>
                            {q.deadline}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </BrowserMock>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Pantalla 2: Expediente con Radar */}
        <Reveal>
          <div className="bg-white border-y">
            <div className="max-w-6xl mx-auto px-4 py-16">
              <div className="grid lg:grid-cols-5 gap-10 items-center">
                <div className="lg:col-span-3">
                  <BrowserMock url="bariturpro.com/cases/exp-2025-087">
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between mb-5 pb-4 border-b">
                        <div>
                          <p className="text-xs font-mono text-slate-400">EXP-2025-087</p>
                          <h3 className="text-lg font-bold text-slate-900 mt-0.5">Hervás Domínguez, María</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Causante · 3 herederos · Andalucía</p>
                        </div>
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold rounded-full px-3 py-1">
                          Fase 4/8
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="bg-slate-50 rounded-lg p-2.5">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Plazo Modelo 650</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">47 días</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2.5">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Base estimada</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">487.300 €</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2.5">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Cuota neta</p>
                          <p className="text-sm font-bold text-emerald-700 mt-0.5">2.140 €</p>
                        </div>
                      </div>

                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-2">Radar ISD · 2 alertas activas</p>
                      <div className="space-y-2">
                        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 animate-pulse flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-rose-900">Ventana de prórroga cierra en 12 días</p>
                            <p className="text-[11px] text-rose-700 mt-0.5">Si la familia no completa la documentación, considera solicitar la prórroga al mes 5.</p>
                          </div>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 animate-pulse flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-indigo-900">Optimización: 4.620 € posibles de ahorro</p>
                            <p className="text-[11px] text-indigo-700 mt-0.5">Heredero #2 está 3.214 € bajo el siguiente tramo. Aplica reducción adicional.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </BrowserMock>
                </div>

                <div className="lg:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                    Pantalla 2 · El expediente trabaja contigo
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                    Expediente con Radar
                  </h2>
                  <p className="text-gray-700 leading-relaxed mb-5">
                    Cada expediente lleva su propio Radar pegado. No es una lista
                    estática de tareas: es un asistente que detecta plazos,
                    optimizaciones fiscales y riesgos legales en tiempo real.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Alertas categorizadas: críticas, de atención, de optimización",
                      "Cada alerta muestra el impacto en euros, no genérica",
                      "Reduce 90% el tiempo de revisión manual del caso",
                      "Auditable: queda registro de qué viste y cuándo",
                    ].map((x) => (
                      <li key={x} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/radar-isd" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">
                    Ver Radar ISD en detalle
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Pantalla 3: Borrador del Modelo 650 */}
        <Reveal>
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="grid lg:grid-cols-5 gap-10 items-center">
              <div className="lg:col-span-2 order-2 lg:order-1">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Pantalla 3 · La que devuelve tu lunes por la tarde
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                  Borrador del Modelo 650 · 1 clic
                </h2>
                <p className="text-gray-700 leading-relaxed mb-5">
                  El borrador del Impuesto de Sucesiones generado en PDF desde
                  los datos del expediente. Plazos calculados, bonificación
                  autonómica aplicada, reducciones del art. 20 ya marcadas y
                  cuota estimada. Tu trabajo: revisar, no transcribir.
                </p>
                <ul className="space-y-3">
                  {[
                    "Auto-rellenado con datos del expediente (causante, herederos, bienes)",
                    "Bonificación autonómica vigente y reducciones aplicables",
                    "Plazos legales (6 meses + prórroga) calculados",
                    "Checklist de los 11 documentos imprescindibles incluido",
                  ].map((x) => (
                    <li key={x} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/borrador-modelo650" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">
                  Probar generador gratis
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>

              <div className="lg:col-span-3 order-1 lg:order-2">
                <div className="relative bg-gradient-to-br from-slate-200 to-slate-100 rounded-3xl p-6 shadow-xl">
                  <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-300 aspect-[3/4] max-w-sm mx-auto">
                    <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-bold tracking-wider">MODELO 650 · BORRADOR</span>
                      <span className="text-[10px] text-slate-400">Pág. 1 / 2</span>
                    </div>
                    <div className="p-5 space-y-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">Impuesto sobre Sucesiones</p>
                        <p className="text-slate-500 text-[10px]">CCAA: Andalucía · Plazo: 27/07/2025</p>
                      </div>
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Causante</p>
                        <p className="text-slate-700">Hervás Domínguez, María</p>
                        <p className="text-slate-500 text-[10px]">NIE 47.XXX.XXX-A · 09/01/2025</p>
                      </div>
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Caudal hereditario</p>
                        <div className="flex justify-between"><span className="text-slate-600">Bienes inmuebles</span><span className="font-mono text-slate-900">374.000 €</span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Depósitos bancarios</span><span className="font-mono text-slate-900">113.300 €</span></div>
                        <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold text-slate-900">Base imponible</span><span className="font-mono font-bold text-slate-900">487.300 €</span></div>
                      </div>
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Reducciones aplicables</p>
                        <div className="flex justify-between"><span className="text-slate-600">Parentesco (art. 20.2.a)</span><span className="font-mono text-slate-900">−15.957 €</span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Vivienda habitual (95%)</span><span className="font-mono text-slate-900">−122.606 €</span></div>
                      </div>
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Cuota</p>
                        <div className="flex justify-between"><span className="text-slate-600">Cuota íntegra</span><span className="font-mono text-slate-900">31.847 €</span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Bonif. autonómica 99%</span><span className="font-mono text-rose-600">−31.529 €</span></div>
                        <div className="flex justify-between border-t pt-1 mt-1 bg-emerald-50 -mx-5 px-5 py-2"><span className="font-bold text-emerald-900">A pagar</span><span className="font-mono font-bold text-emerald-900 text-sm">318 €</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Pantalla 4: Portal Familia */}
        <Reveal>
          <div className="bg-gradient-to-br from-slate-50 to-white border-t">
            <div className="max-w-5xl mx-auto px-4 py-16">
              <div className="bg-white border rounded-3xl shadow-sm p-8 sm:p-12 grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                    Pantalla 4 · La que tu cliente verá
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                    Portal Familia con tu marca
                  </h2>
                  <p className="text-gray-700 leading-relaxed mb-5">
                    Cada heredero entra por un enlace privado y ve el estado real
                    del expediente, los documentos pendientes y un chat directo
                    contigo. Sin app, sin contraseñas. Funciona en el móvil de su
                    madre.
                  </p>
                  <Link
                    href="/portal-familia"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all"
                  >
                    Ver el portal con tu marca en detalle
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  {[
                    { kpi: "−68%", label: "consultas '¿cómo va?'" },
                    { kpi: "+34%", label: "docs antes del plazo" },
                    { kpi: "94%", label: "familias recomiendan" },
                    { kpi: "5 min", label: "para activar el portal" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gradient-to-br from-slate-50 to-white border rounded-xl p-4">
                      <p className="text-2xl font-bold text-primary">{s.kpi}</p>
                      <p className="text-[11px] text-gray-500 mt-1 leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal>
          <div className="max-w-5xl mx-auto px-4 pb-16 pt-4">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white p-8 sm:p-12">
              <div className="absolute -top-20 right-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 -left-16 w-64 h-64 bg-emerald-400/15 rounded-full blur-3xl" />
              <div className="relative max-w-2xl">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
                  Acabas de ver el producto. Ahora úsalo gratis.
                </h2>
                <p className="text-slate-300 text-sm sm:text-base mb-6">
                  14 días sin tarjeta. Importas tus expedientes en curso y la cola de
                  acciones se llena sola con plazos vigilados desde el primer minuto.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/#demo"
                    className="px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all text-sm"
                  >
                    Empezar 14 días gratis →
                  </Link>
                  <Link
                    href="/login?demo=1"
                    className="px-6 py-3 bg-white/10 border border-white/15 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm"
                  >
                    Entrar a la demo con datos cargados
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

const MOCK_QUEUE = [
  { id: "EXP-2025-091", causante: "Castillo Ruiz, J.", action: "Solicitar prórroga del Modelo 650 (mes 5)", deadline: "2 días", tone: "rose" },
  { id: "EXP-2025-087", causante: "Hervás Domínguez, M.", action: "Pedir tasación oficial del piso de Goya 47", deadline: "5 días", tone: "rose" },
  { id: "EXP-2025-074", causante: "Romero Vega, A.", action: "Confirmar lectura del cálculo con heredera 2", deadline: "8 días", tone: "amber" },
  { id: "EXP-2025-082", causante: "Núñez Pérez, R.", action: "Generar borrador Modelo 650 para revisión", deadline: "11 días", tone: "amber" },
  { id: "EXP-2025-066", causante: "García Soto, L.", action: "Reclamar certificado del banco BBVA", deadline: "14 días", tone: "slate" },
  { id: "EXP-2025-079", causante: "Vidal Marín, C.", action: "Subir escritura de aceptación al expediente", deadline: "22 días", tone: "slate" },
];

function BrowserMock({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="relative bg-gradient-to-br from-slate-100 to-slate-50 rounded-3xl p-3 sm:p-6 shadow-xl">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-50 border-b px-3 py-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[11px] text-slate-500 font-mono mx-auto pr-12 truncate">{url}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
