"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";

// ─── Datos ────────────────────────────────────────────────

const features = [
  {
    title: "Motor de plazos y dependencias",
    desc: "Control automático de los 15 días hábiles para certificados y los 6 meses del ISD. Alertas antes de vencer y bloqueos por dependencia documental.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    tone: "indigo",
  },
  {
    title: "Radar ISD y Cola de Acciones",
    desc: "El dashboard detecta riesgos en toda tu cartera y te dice, expediente a expediente, la única acción siguiente ordenada por urgencia.",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    tone: "amber",
    href: "/radar-isd",
  },
  {
    title: "Borradores del Modelo 650 y 651",
    desc: "Genera en PDF el borrador de Sucesiones y Donaciones con datos del expediente, plazos calculados y cuota estimada por CCAA.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    tone: "emerald",
    href: "/borrador-modelo650",
  },
  {
    title: "Pipeline de expedientes",
    desc: "Cada caso avanza por fases con trazabilidad completa: intake, validación, en proceso, pendiente de docs, listo, enviado, seguimiento y cierre.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    tone: "violet",
  },
  {
    title: "Portal familia con tu marca",
    desc: "Enlace seguro para que la familia suba documentos clasificados automáticamente. Vinculación documento-tarea y resumen claro de cómo va todo.",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    tone: "sky",
    href: "/portal-familia",
  },
  {
    title: "Pack 'listo para banco'",
    desc: "ZIP unificado con certificados, escrituras y autoliquidaciones. Checklist verificable por entidad basado en las guías del sector.",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    tone: "indigo",
  },
  {
    title: "Audit trail y aprobaciones",
    desc: "Registro inmutable de quién aprobó qué y cuándo. Export del expediente completo en PDF/ZIP con evidencias — válido en juicio.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    tone: "emerald",
  },
  {
    title: "Cumplimiento RGPD y LOPDGDD",
    desc: "Tratamiento post-mortem (art. 3 LO 3/2018), minimización de datos, cifrado en tránsito y reposo, hosting en la UE y DPA con cada cliente.",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    tone: "amber",
  },
];

const freeTools = [
  { title: "Calculadora del Impuesto de Sucesiones", desc: "Cuota del Modelo 650 con reducciones y bonificación de tu CCAA.", href: "/calculadora-isd", tone: "indigo" },
  { title: "Cuánto cuesta heredar", desc: "ISD + plusvalía + notaría + registro en un único desglose claro.", href: "/coste-herencia", tone: "amber" },
  { title: "Comparador de las 17 CCAA", desc: "Dónde se paga menos: tabla interactiva por grupo de parentesco.", href: "/comparador-isd", tone: "emerald" },
  { title: "Borrador del Modelo 650 en PDF", desc: "Genera un borrador de trabajo con plazos y cuota en 30 segundos.", href: "/borrador-modelo650", tone: "violet" },
  { title: "Guía: qué hacer tras un fallecimiento", desc: "Plan personalizado de trámites con plazos respondiendo 6 preguntas.", href: "/guia-fallecimiento", tone: "sky" },
  { title: "Plantillas de documentos", desc: "Carta al banco, prórroga del ISD, declaración de siniestro... en PDF.", href: "/plantillas-documentos", tone: "rose" },
];

const steps = [
  {
    n: "01",
    title: "Abre el expediente",
    desc: "Das de alta el caso con los datos del causante. Las plantillas generan el plan completo de tareas con sus plazos legales calculados.",
  },
  {
    n: "02",
    title: "Trabaja con guía",
    desc: "El Radar ISD y la Cola de Acciones te dicen qué hacer y cuándo. La familia sube su documentación por el portal con tu marca.",
  },
  {
    n: "03",
    title: "Cierra sin sustos",
    desc: "Generas el borrador del Modelo 650, el pack para el banco y el dossier final. Cada paso queda trazado y auditado.",
  },
];

const toneTile: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
};

// ─── Tarjeta-preview del producto en el hero ─────────────

function HeroPreview() {
  const score = 78;
  const radius = 30;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - score / 100);

  return (
    <div className="relative">
      {/* Resplandor */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-indigo-300/40 via-violet-200/30 to-amber-200/40 blur-3xl rounded-[3rem]" />

      <div className="relative bg-white rounded-2xl border border-slate-200/80 shadow-2xl shadow-indigo-900/10 overflow-hidden">
        {/* Barra de ventana */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 text-[11px] font-medium text-slate-400">BARITUR PRO — Expediente EXP-2024-087</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Siguiente acción */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Siguiente acción</p>
              <p className="text-sm font-semibold text-slate-900 leading-snug">Preparar la presentación del Modelo 650</p>
              <p className="text-xs text-slate-500 mt-0.5">Quedan 26 días para el plazo del ISD.</p>
            </div>
          </div>

          {/* Health + tareas */}
          <div className="flex gap-4">
            {/* Health ring */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="relative w-[76px] h-[76px]">
                <svg className="w-[76px] h-[76px] -rotate-90" viewBox="0 0 76 76">
                  <circle cx="38" cy="38" r={radius} fill="none" strokeWidth="7" className="stroke-slate-200" />
                  <circle
                    cx="38" cy="38" r={radius} fill="none" strokeWidth="7" strokeLinecap="round"
                    className="stroke-emerald-500"
                    strokeDasharray={circ} strokeDashoffset={offset}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-slate-900 leading-none">{score}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">salud</span>
                </div>
              </div>
              <span className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Grado B</span>
            </div>

            {/* Tareas */}
            <div className="flex-1 space-y-1.5">
              {[
                { t: "Certificado de defunción", done: true },
                { t: "Últimas voluntades y RCSV", done: true },
                { t: "Saldos bancarios a fecha", done: true },
                { t: "Tasación de la vivienda", done: false },
              ].map((task) => (
                <div key={task.t} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                      task.done ? "bg-emerald-500" : "border-2 border-slate-200"
                    }`}
                  >
                    {task.done && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-xs truncate ${task.done ? "text-slate-400 line-through" : "text-slate-700 font-medium"}`}>
                    {task.t}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mini radar */}
          <div className="rounded-xl bg-slate-900 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white">Radar ISD · cartera</span>
              <span className="text-[10px] text-slate-400">12 expedientes</span>
            </div>
            <div className="mt-2 flex gap-2">
              <span className="flex-1 rounded-md bg-rose-500/15 text-rose-300 text-[10px] font-semibold text-center py-1">2 críticos</span>
              <span className="flex-1 rounded-md bg-amber-500/15 text-amber-300 text-[10px] font-semibold text-center py-1">3 avisos</span>
              <span className="flex-1 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold text-center py-1">7 al día</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Landing ──────────────────────────────────────────────

export function LandingClient() {
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "", preferredTime: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const source = searchParams?.get("source") ?? "landing_hero";
  const fromDemoBanner = source === "demo_banner";

  useEffect(() => {
    if (fromDemoBanner && typeof window !== "undefined") {
      document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [fromDemoBanner]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar");
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://baritur.pro/#org",
        name: "BARITUR PRO",
        url: "https://baritur.pro",
        description:
          "Software B2B para gestorías y funerarias que automatiza los trámites post-fallecimiento en España.",
        contactPoint: { "@type": "ContactPoint", contactType: "sales", availableLanguage: "Spanish" },
      },
      {
        "@type": "SoftwareApplication",
        name: "BARITUR PRO",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: "149",
          highPrice: "749",
          offerCount: "3",
        },
        description:
          "Plataforma SaaS para gestión post-mortem: motor de plazos ISD, checklist inteligente, portal familia white-label, pack banco unificado y cumplimiento RGPD/LOPDGDD.",
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "¿Qué es el Modelo 650 y cuál es su plazo?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "El Modelo 650 es la autoliquidación del Impuesto de Sucesiones (ISD). El plazo legal es de 6 meses desde la fecha de fallecimiento, prorrogable otros 6 meses si se solicita en los primeros 5 meses.",
            },
          },
          {
            "@type": "Question",
            name: "¿Para qué tipo de empresa es BARITUR PRO?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "BARITUR PRO está diseñado para gestorías, asesorías fiscales, funerarias y despachos de abogados que gestionan trámites post-mortem de forma profesional para familias.",
            },
          },
          {
            "@type": "Question",
            name: "¿Cuántos trámites genera una herencia?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Una herencia típica en España implica gestiones ante más de 20 entidades: bancos, Seguridad Social, AEAT, suministros, telecomunicaciones, seguros y plataformas digitales, con plazos críticos entre 15 días hábiles y 6 meses.",
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white text-slate-700 antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ─── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-white font-bold text-lg">B</span>
            </span>
            <span className="text-lg font-bold text-slate-900 tracking-tight">BARITUR PRO</span>
          </Link>
          <div className="flex gap-1 sm:gap-2 items-center">
            <Link href="/recursos" className="hidden md:inline px-3 py-2 text-sm font-medium text-slate-600 hover:text-primary transition">Recursos</Link>
            <Link href="/blog" className="hidden md:inline px-3 py-2 text-sm font-medium text-slate-600 hover:text-primary transition">Blog</Link>
            <Link href="/precios" className="hidden sm:inline px-3 py-2 text-sm font-medium text-slate-600 hover:text-primary transition">Precios</Link>
            <Link href="/login" className="hidden sm:inline px-3 py-2 text-sm font-medium text-slate-600 hover:text-primary transition">Iniciar sesión</Link>
            <Link
              href="/login?demo=1"
              className="px-3.5 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition"
            >
              Probar demo
            </Link>
            <Link
              href="/onboarding"
              className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Fondo degradado */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/70 via-white to-white" />
        {/* Rejilla de puntos */}
        <div className="absolute inset-0 dot-grid opacity-[0.5] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        {/* Blobs */}
        <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] bg-indigo-300/30 rounded-full blur-3xl animate-float" />
        <div className="absolute top-32 -right-28 w-[26rem] h-[26rem] bg-amber-200/40 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-0 left-1/3 w-[22rem] h-[22rem] bg-emerald-200/30 rounded-full blur-3xl animate-float" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 backdrop-blur px-4 py-1.5 text-xs font-semibold text-primary shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-ring" />
              Software para gestorías, funerarias y despachos de herencias
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-7 text-4xl sm:text-6xl font-bold tracking-tight text-slate-900 leading-[1.08]">
              Cada herencia, ordenada
              <br className="hidden sm:block" />{" "}
              <span className="text-gradient bg-gradient-to-r from-primary via-indigo-500 to-violet-500 animate-gradient">
                sin perder un solo plazo
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              BARITUR PRO automatiza el backoffice post-fallecimiento: del certificado a los 15 días
              al Modelo 650 a los 6 meses. Plazos, documentación, portal familia y cumplimiento — en una sola plataforma.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login?demo=1"
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white text-base font-semibold rounded-xl shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all"
              >
                Probar la demo ahora
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-white border border-slate-300 text-slate-700 text-base font-semibold rounded-xl hover:border-primary/40 hover:text-primary hover:-translate-y-0.5 transition-all"
              >
                Solicitar demo guiada
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Acceso inmediato con datos ficticios. Sin registro, sin tarjeta.
            </p>
          </Reveal>

          {/* Preview del producto */}
          <Reveal delay={320} className="mt-14 max-w-2xl mx-auto">
            <HeroPreview />
          </Reveal>
        </div>
      </section>

      {/* ─── Problema ───────────────────────────────────── */}
      <section className="py-20 sm:py-24 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">El problema</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Una herencia es una carrera contra el reloj
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              Decenas de gestiones, plazos legales que no perdonan y más de 20 entidades implicadas. Un solo descuido cuesta dinero.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { num: "15 días", label: "hábiles de espera", desc: "Mínimo antes de poder pedir el certificado de últimas voluntades y el de seguros de vida.", tone: "indigo" },
              { num: "6 meses", label: "para el Modelo 650", desc: "Plazo del Impuesto de Sucesiones. Fuera de plazo: recargos del 5% al 20% más intereses.", tone: "amber" },
              { num: "+20", label: "entidades por caso", desc: "Bancos, Seguridad Social, AEAT, suministros, telecom, seguros y plataformas digitales.", tone: "emerald" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 110}>
                <div className="card-lift h-full rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-xl hover:border-slate-300/80">
                  <p className={`text-5xl font-bold tracking-tight ${
                    s.tone === "indigo" ? "text-primary" : s.tone === "amber" ? "text-amber-500" : "text-emerald-500"
                  }`}>
                    {s.num}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{s.label}</p>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Herramientas gratuitas ─────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 mb-3">
              Empieza gratis · sin registro
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Herramientas que puedes usar hoy mismo
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              Calculadoras, comparadores y generadores de documentos abiertos a todos.
              La misma tecnología que mueve BARITUR PRO, sin coste.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {freeTools.map((t, i) => (
              <Reveal key={t.href} delay={(i % 3) * 90}>
                <Link
                  href={t.href}
                  className="card-lift group block h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-xl hover:border-primary/30"
                >
                  <span className={`inline-flex w-11 h-11 rounded-xl items-center justify-center ring-4 ${toneTile[t.tone]}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-primary transition">{t.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{t.desc}</p>
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

          <Reveal className="text-center mt-9">
            <Link href="/recursos" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Ver todas las herramientas y recursos
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ─── Cómo funciona ──────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Cómo funciona</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              De la primera llamada al cierre, en tres pasos
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Línea conectora */}
            <div className="hidden md:block absolute top-9 left-[16%] right-[16%] h-px bg-gradient-to-r from-indigo-200 via-violet-200 to-amber-200" />
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 130}>
                <div className="relative text-center">
                  <div className="relative z-10 mx-auto w-[72px] h-[72px] rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center">
                    <span className="text-2xl font-bold text-gradient bg-gradient-to-br from-primary to-violet-500">{s.n}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Funcionalidades ────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">La plataforma</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Todo el expediente, bajo una misma lógica
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              No somos asesoría: somos orquestación. Reglas, plazos, aprobaciones y evidencias para tu backoffice profesional.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 80}>
                <div className={`relative card-lift h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-xl hover:border-slate-300/80 ${f.href ? "group" : ""}`}>
                  {f.href && <Link href={f.href} className="absolute inset-0 rounded-2xl" aria-label={f.title} />}
                  <span className={`inline-flex w-12 h-12 rounded-xl items-center justify-center ring-4 ${toneTile[f.tone]}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={f.icon} />
                    </svg>
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                  {f.href && (
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                      Saber más
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Planes ─────────────────────────────────────── */}
      <section id="plans" className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-3">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Planes</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Un plan para cada despacho</h2>
          </Reveal>
          <Reveal className="text-center mb-12">
            <p className="text-slate-500">Prepago anual = 2 meses gratis (−17%). Precios sin IVA.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {/* Inicia */}
            <Reveal>
              <div className="card-lift rounded-2xl bg-white border border-slate-200/80 p-7 shadow-sm hover:shadow-lg">
                <h3 className="text-lg font-bold text-slate-900">Inicia</h3>
                <p className="text-xs text-slate-500 mb-4">Empieza a no perder plazos</p>
                <p className="text-4xl font-bold text-slate-900">149<span className="text-lg">€</span><span className="text-sm font-normal text-slate-400">/mes</span></p>
                <p className="text-xs text-slate-500 mt-1">o 1.490€/año · sin cuota de setup</p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
                  {["Hasta 2 usuarios", "15 expedientes/mes", "Motor de plazos ISD (Modelo 650)", "Checklist automático + plantillas", "Portal familia básico", "Export PDF/ZIP"].map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href="/onboarding" className="mt-7 block text-center py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:border-primary/40 hover:text-primary transition">
                  Empezar con Inicia
                </Link>
              </div>
            </Reveal>

            {/* Despacho — destacado */}
            <Reveal delay={100}>
              <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 to-indigo-950 p-7 shadow-2xl shadow-indigo-900/30 md:-mt-4 md:mb-4">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                  Recomendado
                </span>
                <h3 className="text-lg font-bold text-white">Despacho</h3>
                <p className="text-xs text-slate-400 mb-4">El plan operativo de tu asesoría</p>
                <p className="text-4xl font-bold text-white">349<span className="text-lg">€</span><span className="text-sm font-normal text-slate-400">/mes</span></p>
                <p className="text-xs text-slate-400 mt-1">o 3.490€/año · + 299€ setup único</p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-200">
                  {["Hasta 5 usuarios", "50 expedientes/mes", "Pack banco unificado", "Plantillas versionadas + aprobación", "Reporting (lead time, bloqueos)", "Portal familia white-label", "Notificaciones email automáticas", "SLA soporte 24h"].map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href="/onboarding" className="mt-7 block text-center py-2.5 rounded-lg bg-white text-primary text-sm font-bold hover:bg-slate-100 transition">
                  Empezar con Despacho
                </Link>
              </div>
            </Reveal>

            {/* Firma */}
            <Reveal delay={200}>
              <div className="card-lift rounded-2xl bg-white border border-slate-200/80 p-7 shadow-sm hover:shadow-lg">
                <h3 className="text-lg font-bold text-slate-900">Firma</h3>
                <p className="text-xs text-slate-500 mb-4">Para firmas con volumen y equipo</p>
                <p className="text-4xl font-bold text-slate-900">749<span className="text-lg">€</span><span className="text-sm font-normal text-slate-400">/mes</span></p>
                <p className="text-xs text-slate-500 mt-1">o 7.490€/año · + 990€ setup único</p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
                  {["Hasta 20 usuarios", "200 expedientes/mes", "Roles/permisos avanzados, SSO", "API/webhooks + integraciones", "DPA extendido + auditorías", "Onboarding asistido + formación", "Soporte prioritario"].map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href="/onboarding" className="mt-7 block text-center py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:border-primary/40 hover:text-primary transition">
                  Empezar con Firma
                </Link>
              </div>
            </Reveal>
          </div>

          {/* MANAGED */}
          <Reveal delay={120}>
            <div className="mt-8 rounded-2xl bg-white border border-slate-200/80 p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Servicio gestionado</p>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">BARITUR MANAGED</h3>
                  <p className="text-sm text-slate-600 max-w-xl">
                    Operación administrativa coordinada por expediente: intake guiado, recopilación documental,
                    preparación de paquetes, coordinación de plazos y comunicación con la familia. Sin asesoría legal/fiscal.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-slate-500">Desde</p>
                  <p className="text-3xl font-bold text-slate-900">490€<span className="text-sm font-normal text-slate-400">/expediente</span></p>
                  <p className="text-xs text-slate-500 mt-1">330€/exp con 30+/mes</p>
                  <a href="#demo" className="inline-block mt-3 px-6 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition">
                    Solicitar info
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Confianza ──────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Confianza</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Diseñado para datos sensibles</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { t: "Cumplimiento RGPD", d: "RAT mantenido, DPA con clientes, minimización de datos y cifrado en tránsito y reposo.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              { t: "LOPDGDD art. 3", d: "Marco post-mortem: tratamiento y derechos de datos de personas fallecidas (LO 3/2018).", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
              { t: "Evidencias exportables", d: "Export PDF/ZIP del expediente con trazabilidad: quién aprobó qué y cuándo.", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 110}>
                <div className="text-center rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm card-lift hover:shadow-lg">
                  <span className="inline-flex w-12 h-12 rounded-xl bg-indigo-50 text-primary items-center justify-center ring-4 ring-indigo-100 mx-auto">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={x.icon} /></svg>
                  </span>
                  <h3 className="mt-4 font-bold text-slate-900">{x.t}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{x.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Demo / CTA final ───────────────────────────── */}
      <section id="demo" className="relative overflow-hidden py-20 sm:py-28 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
        <div className="absolute -top-20 right-10 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 -left-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl animate-float-slow" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              {fromDemoBanner ? "Gracias por probar la demo" : "Empieza un piloto con tus expedientes reales"}
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              {fromDemoBanner
                ? "Cuéntanos cuántos expedientes mueves al mes y concretamos una reunión de 20 minutos."
                : "Lo montamos contigo con 5-10 expedientes reales. Medimos el before/after: tiempo, re-trabajo y plazos cumplidos."}
            </p>
            <ul className="mt-6 space-y-3">
              {["Setup remoto en 30 minutos", "Plantillas y plazos precargados", "Sin permanencia · 14 días gratis"].map((x) => (
                <li key={x} className="flex items-center gap-3 text-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </span>
                  <span className="text-sm">{x}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            {sent ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-2xl">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="font-semibold text-slate-900">Solicitud recibida</p>
                <p className="text-sm text-slate-500 mt-1">Nos pondremos en contacto contigo muy pronto.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 sm:p-7 shadow-2xl space-y-3">
                <p className="text-sm font-semibold text-slate-900 mb-1">Solicita tu demo gratuita</p>
                <input type="text" placeholder="Nombre *" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                <input type="email" placeholder="Email *" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                <input type="text" placeholder="Empresa (gestoría / funeraria / despacho)" value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                <input type="tel" placeholder="Teléfono" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                <textarea placeholder="¿Cuántos expedientes gestionáis al mes?" rows={2} value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                <select value={form.preferredTime || ""}
                  onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                  <option value="">Horario preferido (opcional)</option>
                  <option value="manana">Mañana (9:00 - 12:00)</option>
                  <option value="mediodia">Mediodía (12:00 - 14:00)</option>
                  <option value="tarde">Tarde (16:00 - 19:00)</option>
                </select>
                {error && <p className="text-rose-600 text-sm">{error}</p>}
                <button type="submit" className="w-full py-3 bg-primary text-white rounded-lg font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all">
                  Solicitar demo gratuita
                </button>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <SiteFooter />
    </div>
  );
}
