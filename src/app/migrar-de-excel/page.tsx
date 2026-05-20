import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Migrar de Excel a BARITUR PRO — Plan de 5 días sin perder un expediente",
  description:
    "Tu Excel de control de herencias funciona, hasta que un día te falla. Cómo migrar la cartera a BARITUR PRO en 5 días: las 5 grietas del Excel, el plan de migración y qué conservas del proceso.",
  keywords: [
    "alternativa excel gestoria",
    "migrar de excel software herencias",
    "excel gestion herencias",
    "control expedientes herencia software",
    "sustituir excel gestoria",
  ],
  alternates: { canonical: "https://bariturpro.com/migrar-de-excel" },
  openGraph: {
    title: "Migrar de Excel a BARITUR PRO en 5 días",
    description:
      "Las 5 grietas que se abren bajo el Excel y cómo migrar tu cartera sin perder un expediente.",
    type: "article",
  },
};

const CRACKS = [
  {
    title: "1. Nadie sabe quién metió ese dato — y cuándo",
    body:
      "Tu Excel no guarda autoría ni momento. Si un heredero reclama que la valoración del piso era distinta, no hay forma de demostrar quién, cuándo ni desde dónde se introdujo. En un proceso disciplinario, esto es exactamente lo que el colegio profesional pide.",
    cost: "Sin audit trail",
  },
  {
    title: "2. Una baja del equipo destruye el conocimiento",
    body:
      "Mar, que llevaba 8 años con la pestaña 'Plazos', se va. Las celdas pintadas en amarillo nadie las entiende. Los recordatorios estaban en su calendario personal. La nueva persona necesita 3 meses para reconstruir el orden — y mientras, se cuelan recargos.",
    cost: "3 meses de productividad perdidos",
  },
  {
    title: "3. Los plazos los vigila una persona, no un sistema",
    body:
      "Cada lunes alguien abre el Excel y filtra las fechas que se acercan. Si esa persona está enferma, de vacaciones o pasa por encima un puente festivo, un plazo se pierde. Recargos del 5-20% sobre la cuota, que asume la gestoría o el cliente — siempre mal.",
    cost: "Recargo medio: 2.700 € por error",
  },
  {
    title: "4. El cliente no ve nada, pero llama",
    body:
      "El heredero no tiene visibilidad del expediente. Cada novedad pasa por llamada o email. Tres llamadas al expediente por año × 40 expedientes × 12 minutos cada una = 24 horas anuales del gestor sólo respondiendo '¿cómo va?'. Eso es media semana de trabajo facturable.",
    cost: "~24 h/año por gestor en consultas",
  },
  {
    title: "5. Cuando el Excel se rompe, la cartera se para",
    body:
      "Filas borradas por error, fórmulas que dejan de funcionar, versiones que se sobrescriben en OneDrive. Cuando pasa, no hay vuelta atrás. Las gestorías con Excel suelen tener una persona dedicada únicamente a 'mantener el Excel funcionando'. Ese rol cuesta 30K€/año.",
    cost: "Coste oculto: ~30K€/año en mantenimiento",
  },
];

const MIGRATION_PLAN = [
  {
    day: "Día 1",
    title: "Importamos tu Excel",
    body: "Nos envías el Excel actual (o nos lo enseñas en una llamada de 30 min). Mapeamos columnas a campos de BARITUR PRO. Si tu Excel tiene 200 expedientes, los tienes cargados al día siguiente.",
  },
  {
    day: "Día 2",
    title: "Configuramos plantillas y plazos",
    body: "Activamos las plantillas de tareas según tu mix (mortis causa simple, con inmueble, empresa familiar). Radar empieza a calcular automáticamente los plazos de cada expediente importado.",
  },
  {
    day: "Día 3",
    title: "Onboarding del equipo",
    body: "Sesión de 90 minutos en vivo con tu equipo. Cada persona crea su primer expediente real, recibe sus primeras alertas y aprende a navegar el caso. Sin tutoriales largos.",
  },
  {
    day: "Día 4",
    title: "Activamos el Portal Familia",
    body: "Personalizamos el portal con tu logo y dominio (heredamos.tunombre.com). Generamos enlaces para las primeras 3-5 familias activas. La transición del email al portal es inmediata.",
  },
  {
    day: "Día 5",
    title: "Excel pasa a histórico",
    body: "Tu Excel se archiva como respaldo de los últimos 6 meses. Todo nuevo entra a BARITUR. El equipo deja de tocar el Excel sin notarlo. Una semana después nadie lo echa de menos.",
  },
];

export default function MigrarDeExcelPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Migrar de Excel a BARITUR PRO en 5 días",
    description:
      "Plan de migración para gestorías que llevan herencias en Excel: importación, configuración de plazos, onboarding de equipo, activación del portal familia y archivado del Excel.",
    step: MIGRATION_PLAN.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.body,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="absolute inset-0 dot-grid-light opacity-30" />
          <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-amber-500/25 rounded-full blur-3xl animate-float-slow" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-indigo-500/30 rounded-full blur-3xl animate-float" />
          <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-full px-3 py-1 text-xs text-amber-200 mb-5">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
              Para gestorías que aún llevan el control en Excel
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight tracking-tight">
              Tu Excel funciona —
              <br className="hidden sm:block" />
              <span className="text-amber-300"> hasta que un día te falla</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 max-w-3xl mb-7">
              No es un problema de orden, es un problema de <strong className="text-white">arquitectura</strong>:
              el Excel se diseñó para hojas de cálculo, no para vigilar 17 calendarios
              autonómicos, dar acceso a 4 herederos a la vez y guardar quién hizo qué.
            </p>
            <p className="text-sm text-blue-200 mb-7 max-w-3xl">
              Esta página es para ti si: llevas más de 20 herencias al año, tu Excel
              tiene ya 12+ columnas, y al menos una vez se te ha pasado un plazo. Sigue
              leyendo: el coste real está abajo y el plan de migración dura 5 días.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#plan"
                className="px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all text-sm"
              >
                Ver el plan de migración →
              </Link>
              <Link
                href="/#demo"
                className="px-6 py-3 bg-white/10 border border-white/15 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm"
              >
                Hablar con alguien que migró
              </Link>
            </div>
          </div>
        </div>

        {/* 5 grietas */}
        <Reveal>
          <div className="max-w-5xl mx-auto px-4 py-16">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                Las 5 grietas que se abren bajo el Excel
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Lo que no se ve hasta que ya ha pasado
              </h2>
            </div>
            <div className="space-y-4">
              {CRACKS.map((c, i) => (
                <Reveal key={c.title} delay={i * 80}>
                  <div className="bg-white border rounded-2xl p-6 sm:p-7 card-lift">
                    <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                      <h3 className="font-bold text-gray-900 text-base sm:text-lg flex-1">{c.title}</h3>
                      <span className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-full px-3 py-1 flex-shrink-0">
                        {c.cost}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{c.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Comparativa side-by-side */}
        <div className="bg-white border-y">
          <div className="max-w-5xl mx-auto px-4 py-16">
            <Reveal>
              <div className="text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  El mismo expediente, dos sistemas
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  Excel vs BARITUR PRO en una herencia real
                </h2>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-gradient-to-br from-amber-50/50 to-white border border-amber-200 rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3">El método actual · Excel</p>
                <ul className="space-y-3 text-sm text-gray-700">
                  {[
                    "Una pestaña por año, una fila por expediente, 17 columnas",
                    "Plazos calculados a mano y pintados en amarillo",
                    "Documentos en una carpeta de OneDrive que nadie organiza igual",
                    "Comunicación con la familia por email y llamada",
                    "Para saber el estado, hay que abrir el Excel y filtrar",
                    "Si Mar se va de vacaciones, nadie sabe qué expedientes urgen",
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

              <div className="bg-gradient-to-br from-indigo-50/40 to-emerald-50/30 border border-indigo-200 rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">El método nuevo · BARITUR PRO</p>
                <ul className="space-y-3 text-sm text-gray-700">
                  {[
                    "Un expediente = una página con todo: causante, herederos, bienes, plazos, alertas",
                    "Radar ISD calcula y vigila los 17 calendarios autonómicos por ti",
                    "Documentos clasificados automáticamente al subirlos al expediente",
                    "Portal Familia: cada heredero ve plazos y docs sin llamarte",
                    "Cola de Acciones: cada mañana sabes qué hacer y en qué orden",
                    "Si alguien se ausenta, las alertas se reasignan; nada se pierde",
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

        {/* Plan de migración 5 días */}
        <div id="plan" className="max-w-5xl mx-auto px-4 py-16 scroll-mt-20">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                El plan de migración
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                5 días desde el Excel a BARITUR PRO operativo
              </h2>
              <p className="mt-3 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
                No es una migración técnica: es un cambio de método. Te acompañamos
                cada día. La cartera no se para.
              </p>
            </div>
          </Reveal>
          <div className="space-y-4">
            {MIGRATION_PLAN.map((s, i) => (
              <Reveal key={s.day} delay={i * 100}>
                <div className="bg-white border rounded-2xl p-6 sm:p-7 grid sm:grid-cols-[120px_1fr] gap-4 items-start card-lift">
                  <div className="flex sm:flex-col items-center sm:items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/25 flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">{s.day}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-1.5">{s.title}</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Qué conservas / qué dejas */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-t">
          <div className="max-w-5xl mx-auto px-4 py-16">
            <Reveal>
              <div className="text-center mb-10">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  Qué conservas. Qué dejas atrás.
                </h2>
                <p className="mt-3 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
                  Migrar no es perder lo que ya sabes hacer. Es liberar tu tiempo de
                  las tareas que no requieren tu criterio profesional.
                </p>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white border rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3">Conservas</p>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  {[
                    "Tu manera de hablar a la familia y abordar el duelo",
                    "Tus criterios fiscales y juicio profesional del caso",
                    "Tus tarifas y tu modelo de facturación",
                    "El histórico completo de tus expedientes (importado)",
                    "Tu marca: el Portal Familia lleva tu logo y tu dominio",
                  ].map((x) => (
                    <li key={x} className="flex gap-2.5">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white border rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-3">Dejas atrás</p>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  {[
                    "Calcular plazos a mano cada lunes",
                    "Buscar el documento '_final_v3' en OneDrive",
                    "Recordar quién tenía qué columna pintada de qué color",
                    "El miedo a que un puente festivo se lleve un plazo por delante",
                    "La sensación de que el equipo dedica más tiempo a llevar el Excel que al cliente",
                  ].map((x) => (
                    <li key={x} className="flex gap-2.5">
                      <svg className="w-4 h-4 text-rose-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* CTA final */}
        <Reveal>
          <div className="max-w-5xl mx-auto px-4 pb-16 pt-4">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white p-8 sm:p-12">
              <div className="absolute -top-20 right-0 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl" />
              <div className="absolute bottom-0 -left-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
              <div className="relative max-w-2xl">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
                  Envíanos tu Excel. Te lo devolvemos en BARITUR PRO el lunes.
                </h2>
                <p className="text-slate-300 text-sm sm:text-base mb-6">
                  Sin compromiso. Vemos tu Excel actual en una llamada de 30 minutos
                  y te decimos exactamente cuánto tarda la migración con tu caso real.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/#demo"
                    className="px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all text-sm"
                  >
                    Reservar llamada de 30 min →
                  </Link>
                  <Link
                    href="/asi-funciona"
                    className="px-6 py-3 bg-white/10 border border-white/15 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm"
                  >
                    Ver el producto primero
                  </Link>
                </div>
                <p className="text-xs text-slate-400 mt-3">Sin tarjeta · sin permanencia · 14 días gratis</p>
              </div>
            </div>
          </div>
        </Reveal>

        <SiteFooter />
      </div>
    </>
  );
}
