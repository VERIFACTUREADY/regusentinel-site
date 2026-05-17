import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-posts";

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
}

const ICON_CALC = "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z";
const ICON_PDF = "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
const ICON_CHART = "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
const ICON_CODE = "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4";
const ICON_BOOK = "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253";
const ICON_LIST = "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4";

const TOOLS: Resource[] = [
  {
    title: "Calculadora ISD (Sucesiones)",
    desc: "Calcula la cuota del Modelo 650 con todas las reducciones estatales y la bonificación autonómica de tu CCAA.",
    href: "/calculadora-isd",
    badge: "Más usado",
    badgeTone: "blue",
    icon: ICON_CALC,
  },
  {
    title: "Calculadora de Donaciones",
    desc: "Cuánto tributa una donación (Modelo 651) según CCAA, parentesco, tipo de bien y reducciones específicas.",
    href: "/calculadora-donaciones",
    icon: ICON_CALC,
  },
  {
    title: "Calculadora de Plusvalía Municipal",
    desc: "Plusvalía municipal (IIVTNU) de un inmueble heredado por los dos métodos legales: el sistema elige el más barato.",
    href: "/calculadora-plusvalia",
    icon: ICON_CALC,
  },
  {
    title: "Coste total de heredar",
    desc: "ISD + plusvalía + notaría + registro en un único desglose. Responde la pregunta: ¿cuánto cuesta heredar?",
    href: "/coste-herencia",
    badge: "Nuevo",
    badgeTone: "emerald",
    icon: ICON_CALC,
  },
  {
    title: "Borrador Modelo 650 en PDF",
    desc: "Genera un PDF de trabajo de 2 páginas: causante, plazos, cuota estimada, reducciones y checklist documental.",
    href: "/borrador-modelo650",
    icon: ICON_PDF,
  },
  {
    title: "Borrador Modelo 651 en PDF",
    desc: "El borrador de trabajo para donaciones: donante, donatario, plazos, reducción aplicable y cuota estimada.",
    href: "/borrador-modelo651",
    icon: ICON_PDF,
  },
  {
    title: "Comparador ISD por CCAA",
    desc: "Tabla interactiva con la cuota a pagar en las 17 comunidades para los 4 grupos de parentesco.",
    href: "/comparador-isd",
    icon: ICON_CHART,
  },
  {
    title: "Comparador de Donaciones por CCAA",
    desc: "La misma comparativa interactiva pero para el Modelo 651: dónde se paga menos por una donación.",
    href: "/comparador-donaciones",
    badge: "Nuevo",
    badgeTone: "emerald",
    icon: ICON_CHART,
  },
  {
    title: "Plantillas de documentos",
    desc: "Modelos de carta al banco, prórroga del ISD, declaración de siniestro y más. Auto-rellenados, descargables en PDF.",
    href: "/plantillas-documentos",
    icon: ICON_PDF,
  },
  {
    title: "Guía: qué hacer tras un fallecimiento",
    desc: "Responde 6 preguntas y obtén un plan personalizado de trámites con plazos, ordenado por urgencia.",
    href: "/guia-fallecimiento",
    icon: ICON_LIST,
  },
  {
    title: "Glosario del ISD",
    desc: "35 términos del Impuesto de Sucesiones y Donaciones explicados: base imponible, coeficiente, bonificación...",
    href: "/glosario",
    icon: ICON_BOOK,
  },
  {
    title: "Calculadora de ROI para gestorías",
    desc: "Cuánto ahorra tu despacho automatizando la tramitación: horas, errores evitados y capacidad recuperada.",
    href: "/calculadora-roi",
    icon: ICON_CHART,
  },
  {
    title: "Widget gratuito para tu web",
    desc: "Embed de la calculadora ISD en cualquier web con personalización de color y tema. Atribución incluida.",
    href: "/widget",
    icon: ICON_CODE,
  },
  {
    title: "API pública v1",
    desc: "Endpoints REST para calcular ISD, comparar CCAA y detectar riesgos. Sin autenticación, CORS abierto.",
    href: "/docs/api",
    badge: "Para devs",
    badgeTone: "purple",
    icon: ICON_CODE,
  },
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-primary">BARITUR PRO</Link>
          <nav className="flex gap-3 sm:gap-4 text-sm">
            <Link href="/recursos" className="text-primary font-semibold">Recursos</Link>
            <Link href="/blog" className="text-gray-700 hover:text-primary">Blog</Link>
            <Link href="/precios" className="text-gray-700 hover:text-primary">Precios</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
            Todo gratuito · Sin registro
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Recursos gratuitos sobre el ISD
          </h1>
          <p className="text-base sm:text-lg text-blue-100 max-w-2xl">
            Herramientas, guías y datasets sobre el Impuesto de Sucesiones, Modelo 650
            y trámites tras una defunción en España. Todo accesible sin registro ni límites.
          </p>
        </div>
      </div>

      {/* Tools grid */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Herramientas interactivas</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group bg-white border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
                  </svg>
                </div>
                {t.badge && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeClass(t.badgeTone)}`}>
                    {t.badge}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 mb-1 group-hover:text-primary transition">
                {t.title}
              </h3>
              <p className="text-sm text-gray-600 flex-1">{t.desc}</p>
              <p className="mt-3 text-xs font-medium text-primary group-hover:underline">Abrir →</p>
            </Link>
          ))}
        </div>
      </div>

      {/* CCAA Guides */}
      <div className="bg-white border-t border-b">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Guías por Comunidad Autónoma</h2>
          <p className="text-sm text-gray-600 mb-6">17 páginas con información local de cada CCAA: bonificaciones, plazos, hacienda autonómica.</p>
          <div className="flex flex-wrap gap-2">
            {GUIDES.map((g) => (
              <Link
                key={g.slug}
                href={`/sucesiones/${g.slug}`}
                className="px-3 py-1.5 bg-gray-100 hover:bg-primary hover:text-white text-gray-700 rounded-lg text-sm transition"
              >
                {g.label}
              </Link>
            ))}
            <Link
              href="/comparador-isd"
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary rounded-lg text-sm font-medium transition"
            >
              Ver las 17 →
            </Link>
          </div>
        </div>
      </div>

      {/* Blog */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Artículos recientes</h2>
          <Link href="/blog" className="text-sm font-medium text-primary hover:underline">Ver todos →</Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {recentPosts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block bg-white border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition group"
            >
              <p className="text-xs text-gray-500 mb-1">
                {new Date(p.publishedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} · {p.readingMinutes} min
              </p>
              <h3 className="font-bold text-gray-900 mb-1 group-hover:text-primary transition leading-snug">{p.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{p.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 sm:p-10 text-white text-center">
          <h2 className="text-2xl font-bold mb-3">¿Gestoría o funeraria que tramita herencias?</h2>
          <p className="text-blue-200 mb-6 max-w-lg mx-auto">
            BARITUR PRO automatiza el seguimiento del ISD, los plazos del Modelo 650 y centraliza
            toda la documentación de cada expediente. 14 días gratis, sin tarjeta.
          </p>
          <Link
            href="/#demo"
            className="inline-block px-7 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition"
          >
            Probar BARITUR PRO →
          </Link>
        </div>
      </div>
    </div>
  );
}
