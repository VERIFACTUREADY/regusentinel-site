import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { Reveal } from "@/components/reveal";
import { ProUpsell } from "@/components/pro-upsell";

export const metadata: Metadata = {
  title: "Recursos gratuitos sobre el Impuesto de Sucesiones — BARITUR PRO",
  description:
    "Calculadora ISD, generador de borrador del Modelo 650, comparador entre CCAA, widget para tu web, API pública y guías. Todo gratuito y sin registro.",
  alternates: { canonical: "https://bariturpro.com/recursos" },
};

interface Resource {
  title: string;
  desc: string;
  href: string;
  badge?: string;
  badgeTone?: "blue" | "emerald" | "purple" | "amber";
  icon: string;
  tone: string;
}

const ICON_CALC = "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z";
const ICON_PDF = "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
const ICON_CHART = "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
const ICON_CODE = "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4";
const ICON_BOOK = "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253";
const ICON_LIST = "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4";

const toneTile: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
};

const TOOLS: Resource[] = [
  { title: "Calculadora ISD (Sucesiones)", desc: "Calcula la cuota del Modelo 650 con todas las reducciones estatales y la bonificación autonómica de tu CCAA.", href: "/calculadora-isd", badge: "Más usado", badgeTone: "blue", icon: ICON_CALC, tone: "indigo" },
  { title: "Calculadora de Donaciones", desc: "Cuánto tributa una donación (Modelo 651) según CCAA, parentesco, tipo de bien y reducciones específicas.", href: "/calculadora-donaciones", icon: ICON_CALC, tone: "indigo" },
  { title: "Calculadora de Plusvalía Municipal", desc: "Plusvalía municipal (IIVTNU) de un inmueble heredado por los dos métodos legales: el sistema elige el más barato.", href: "/calculadora-plusvalia", icon: ICON_CALC, tone: "indigo" },
  { title: "Coste total de heredar", desc: "ISD + plusvalía + notaría + registro en un único desglose. Responde la pregunta: ¿cuánto cuesta heredar?", href: "/coste-herencia", badge: "Nuevo", badgeTone: "emerald", icon: ICON_CALC, tone: "amber" },
  { title: "Borrador Modelo 650 en PDF", desc: "Genera un PDF de trabajo de 2 páginas: causante, plazos, cuota estimada, reducciones y checklist documental.", href: "/borrador-modelo650", icon: ICON_PDF, tone: "emerald" },
  { title: "Borrador Modelo 651 en PDF", desc: "El borrador de trabajo para donaciones: donante, donatario, plazos, reducción aplicable y cuota estimada.", href: "/borrador-modelo651", icon: ICON_PDF, tone: "emerald" },
  { title: "Comparador ISD por CCAA", desc: "Tabla interactiva con la cuota a pagar en las 17 comunidades para los 4 grupos de parentesco.", href: "/comparador-isd", icon: ICON_CHART, tone: "amber" },
  { title: "Comparador de Donaciones por CCAA", desc: "La misma comparativa interactiva pero para el Modelo 651: dónde se paga menos por una donación.", href: "/comparador-donaciones", badge: "Nuevo", badgeTone: "emerald", icon: ICON_CHART, tone: "amber" },
  { title: "Plantillas de documentos", desc: "Modelos de carta al banco, prórroga del ISD, declaración de siniestro y más. Auto-rellenados, descargables en PDF.", href: "/plantillas-documentos", icon: ICON_PDF, tone: "emerald" },
  { title: "Guía: qué hacer tras un fallecimiento", desc: "Responde 6 preguntas y obtén un plan personalizado de trámites con plazos, ordenado por urgencia.", href: "/guia-fallecimiento", icon: ICON_LIST, tone: "sky" },
  { title: "Glosario del ISD", desc: "35 términos del Impuesto de Sucesiones y Donaciones explicados: base imponible, coeficiente, bonificación...", href: "/glosario", icon: ICON_BOOK, tone: "violet" },
  { title: "Calculadora de ROI para gestorías", desc: "Cuánto ahorra tu despacho automatizando la tramitación: horas, errores evitados y capacidad recuperada.", href: "/calculadora-roi", icon: ICON_CHART, tone: "amber" },
  { title: "Widget gratuito para tu web", desc: "Embed de la calculadora ISD en cualquier web con personalización de color y tema. Atribución incluida.", href: "/widget", icon: ICON_CODE, tone: "rose" },
  { title: "API pública v1", desc: "Endpoints REST para calcular ISD, comparar CCAA y detectar riesgos. Sin autenticación, CORS abierto.", href: "/docs/api", badge: "Para devs", badgeTone: "purple", icon: ICON_CODE, tone: "violet" },
];

const GUIDES = [
  { slug: "madrid", label: "Madrid" },
  { slug: "cataluna", label: "Cataluña" },
  { slug: "andalucia", label: "Andalucía" },
  { slug: "comunidad-valenciana", label: "C. Valenciana" },
  { slug: "galicia", label: "Galicia" },
  { slug: "asturias", label: "Asturias" },
  { slug: "pais-vasco", label: "País Vasco" },
  { slug: "navarra", label: "Navarra" },
  { slug: "baleares", label: "Baleares" },
];

function badgeClass(tone?: string) {
  return {
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    purple: "bg-purple-100 text-purple-700",
    amber: "bg-amber-100 text-amber-700",
  }[tone ?? "blue"];
}

export default function RecursosPage() {
  const recentPosts = [...BLOG_POSTS]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-white text-slate-700 antialiased">
      {/* Header */}
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/70 via-white to-white" />
        <div className="absolute inset-0 dot-grid opacity-[0.5] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="absolute -top-24 -left-24 w-[26rem] h-[26rem] bg-indigo-300/30 rounded-full blur-3xl animate-float" />
        <div className="absolute top-20 -right-28 w-[24rem] h-[24rem] bg-amber-200/40 rounded-full blur-3xl animate-float-slow" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 backdrop-blur px-4 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Todo gratuito · sin registro · sin límites
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-7 text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
              Recursos gratuitos sobre{" "}
              <span className="text-gradient bg-gradient-to-r from-primary via-indigo-500 to-violet-500 animate-gradient">
                herencias y donaciones
              </span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Calculadoras, comparadores, generadores de documentos y guías sobre el Impuesto de
              Sucesiones, el Modelo 650 y los trámites tras una defunción en España.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Tools grid */}
      <section className="py-16 sm:py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Herramientas interactivas</h2>
            <p className="text-sm text-slate-500 mb-8">14 herramientas, todas abiertas y sin coste.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TOOLS.map((t, i) => (
              <Reveal key={t.href} delay={(i % 3) * 80}>
                <Link
                  href={t.href}
                  className="card-lift group flex flex-col h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-xl hover:border-primary/30"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className={`inline-flex w-11 h-11 rounded-xl items-center justify-center ring-4 ${toneTile[t.tone]}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={t.icon} />
                      </svg>
                    </span>
                    {t.badge && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeClass(t.badgeTone)}`}>
                        {t.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-primary transition">{t.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed flex-1">{t.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Abrir herramienta
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CCAA guides */}
      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Guías por Comunidad Autónoma</h2>
            <p className="text-sm text-slate-500 mb-7">
              17 páginas con información local de cada CCAA: bonificaciones, plazos y hacienda autonómica.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="flex flex-wrap gap-2.5">
              {GUIDES.map((g) => (
                <Link
                  key={g.slug}
                  href={`/sucesiones/${g.slug}`}
                  className="px-4 py-2 bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-lg text-sm font-medium transition"
                >
                  {g.label}
                </Link>
              ))}
              <Link
                href="/comparador-isd"
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-primary rounded-lg text-sm font-semibold transition inline-flex items-center gap-1"
              >
                Ver las 17
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Blog */}
      <section className="py-16 sm:py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="flex items-baseline justify-between mb-7">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Artículos recientes</h2>
              <Link href="/blog" className="text-sm font-semibold text-primary hover:underline">Ver todos →</Link>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-5">
            {recentPosts.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 2) * 90}>
                <Link
                  href={`/blog/${p.slug}`}
                  className="card-lift group block h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-xl hover:border-primary/30"
                >
                  <p className="text-xs text-slate-500 mb-1.5">
                    {new Date(p.publishedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} · {p.readingMinutes} min
                  </p>
                  <h3 className="font-bold text-slate-900 group-hover:text-primary transition leading-snug">{p.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{p.description}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pro upsell */}
      <ProUpsell
        freeToolName="Estos recursos gratuitos"
        freeToolDesc="resuelven consultas puntuales; no gestionan tu cartera de expedientes."
      />
    </div>
  );
}
