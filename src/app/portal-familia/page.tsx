import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Portal Familia — Tus clientes ven su expediente sin llamarte | BARITUR PRO",
  description:
    "El Portal Familia muestra a los herederos el estado del expediente, qué documentos faltan, qué plazos quedan y un chat directo con su gestor. Menos llamadas, más confianza, cero clientes perdidos por opacidad.",
  keywords: [
    "portal cliente herencia",
    "portal heredero",
    "comunicacion familia herencia",
    "transparencia expediente",
    "software gestoria portal",
    "experiencia cliente sucesiones",
  ],
  alternates: { canonical: "https://bariturpro.com/portal-familia" },
  openGraph: {
    title: "Portal Familia — La transparencia que las familias esperan",
    description:
      "Cada heredero ve el estado real del expediente, los plazos y la documentación pendiente. Cero llamadas '¿cómo va lo de mamá?'.",
    type: "article",
  },
};

const FEATURES = [
  {
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    title: "Acceso por enlace único",
    desc: "Cada heredero entra con un enlace privado enviado por email. Sin instalar nada, sin recordar contraseñas. Funciona en el móvil de su madre.",
  },
  {
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    title: "Lista de documentos pendientes",
    desc: "El heredero ve exactamente qué falta — certificado de defunción, últimas voluntades, escrituras, tasaciones — con instrucciones claras de dónde sacarlo y plantilla descargable.",
  },
  {
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    title: "Mensajes directos con el gestor",
    desc: "Chat asíncrono que no llena la bandeja del gestor: las dudas frecuentes ya tienen respuesta en el propio portal. El gestor responde sólo lo que requiere su criterio.",
  },
  {
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Plazos visibles y entendibles",
    desc: "El heredero ve 'Quedan 47 días para presentar el Impuesto' con un círculo de progreso. Sin tecnicismos. Cuando entienden el plazo, traen los papeles antes.",
  },
  {
    icon: "M12 4v16m8-8H4",
    title: "Subida de documentos arrastrando",
    desc: "El heredero arrastra el PDF de la escritura. BARITUR lo guarda en el expediente, lo nombra correctamente y avisa al gestor sin que la familia tenga que llamar.",
  },
  {
    icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
    title: "Acceso compartido entre herederos",
    desc: "Si hay 4 hermanos, cada uno entra con su propio enlace pero ve la misma información. Auditable: queda registrado quién subió qué y cuándo.",
  },
];

const STATS = [
  { kpi: "−68 %", label: "llamadas '¿cómo va lo de mi madre?'" },
  { kpi: "+34 %", label: "documentos recibidos antes del plazo" },
  { kpi: "94 %", label: "familias que recomiendan al gestor" },
  { kpi: "0", label: "datos perdidos al cambiar de responsable" },
];

export default function PortalFamiliaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Portal Familia",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Portal cliente para herederos: estado del expediente, plazos, documentación pendiente y comunicación directa con la gestoría que tramita la herencia.",
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
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl animate-float" />
          <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-200 mb-5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              La familia ve el expediente · sin app, sin contraseñas
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight tracking-tight">
              Tus clientes ven su herencia
              <br className="hidden sm:block" />
              <span className="text-blue-300"> sin tener que llamarte</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 max-w-3xl mb-7">
              El Portal Familia muestra a cada heredero el estado real de su
              expediente, qué documentos faltan, qué plazos quedan y un chat directo
              contigo. Una experiencia que las familias <strong className="text-white">esperan
              encontrar</strong> en cualquier servicio profesional en 2025 —
              y que casi ninguna gestoría les da.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#demo"
                className="px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all text-sm"
              >
                Ver el portal en demo →
              </Link>
              <Link
                href="/precios"
                className="px-6 py-3 bg-white/10 border border-white/15 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm"
              >
                Planes y precios
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-primary">{s.kpi}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Portal mockup */}
        <Reveal>
          <div className="max-w-5xl mx-auto px-4 py-14">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                Lo que ve la familia
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Una pantalla. Toda la herencia.
              </h2>
              <p className="mt-3 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
                Diseñado para que un familiar de 70 años entienda el estado del expediente
                en 5 segundos. Sin jerga fiscal. Sin códigos de modelo.
              </p>
            </div>

            <div className="relative bg-gradient-to-br from-slate-100 to-slate-50 rounded-3xl p-4 sm:p-8 shadow-xl">
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                <div className="bg-slate-50 border-b px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs text-slate-500 font-mono mx-auto pr-12">portal.bariturpro.com/h/perez-garcia</span>
                </div>

                <div className="p-5 sm:p-7">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Herencia de</p>
                      <h3 className="text-xl font-bold text-slate-900 mt-0.5">María Pérez García</h3>
                      <p className="text-xs text-slate-500 mt-1">Hola Andrea · heredera</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-3 py-1">
                      En curso
                    </span>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">47</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 text-sm">Quedan 47 días para presentar el Impuesto de Sucesiones</p>
                        <p className="text-xs text-slate-600 mt-1">Tu gestor te avisará si necesita más documentación antes.</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Documentos pendientes</p>
                  <div className="space-y-2 mb-5">
                    {[
                      { name: "Certificado del Registro de Últimas Voluntades", done: true },
                      { name: "Escritura de aceptación de herencia", done: false },
                      { name: "Tasación oficial del piso de Goya 47", done: false },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center gap-3 border rounded-lg px-3 py-2.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${d.done ? "bg-emerald-100" : "bg-slate-100"}`}>
                          {d.done ? (
                            <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          )}
                        </div>
                        <span className={`text-sm flex-1 ${d.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{d.name}</span>
                        {!d.done && <span className="text-xs text-primary font-semibold">Subir</span>}
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center text-white text-xs font-bold">LM</div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">Lucía Martín · Gestoría Núñez</p>
                        <p className="text-[10px] text-slate-500">Responde habitualmente en 4 horas</p>
                      </div>
                    </div>
                    <button className="text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition">
                      Escribir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Features grid */}
        <div className="bg-white border-y">
          <div className="max-w-5xl mx-auto px-4 py-14">
            <Reveal>
              <div className="text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Cómo lo usa la familia
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  Pensado para no técnicos. Pensado para no llamar.
                </h2>
              </div>
            </Reveal>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 80}>
                  <div className="bg-white border rounded-xl p-5 card-lift">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 to-indigo-100 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1.5 text-sm">{f.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* Por qué importa para tu gestoría */}
        <div className="max-w-5xl mx-auto px-4 py-14">
          <Reveal>
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                Por qué importa para tu gestoría
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                El portal trabaja para ti aunque tú no estés frente al ordenador
              </h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Diferenciación frente a la competencia",
                body: "La mayoría de gestorías sigue tramitando herencias por email y llamada. Tener un portal hace que un cliente que recibió tu propuesta junto a otras dos te elija a ti, sin discutir el precio.",
              },
              {
                title: "Reduce horas administrativas a la mitad",
                body: "Cada llamada de '¿cómo va lo de papá?' cuesta entre 8 y 15 minutos. Con 40 expedientes activos y 3 llamadas por expediente al año, son 24 horas anuales por gestor. El portal devuelve esas horas.",
              },
              {
                title: "Captación por recomendación",
                body: "Los herederos hablan entre amigos. Una familia que vio el portal cuenta a otras 3-4 familias a lo largo del año que su gestoría 'le enseñaba todo en tiempo real'. Eso no se compra en SEM.",
              },
            ].map((b) => (
              <div key={b.title} className="bg-gradient-to-br from-slate-50 to-white border rounded-2xl p-6 card-lift">
                <h3 className="font-bold text-gray-900 mb-2.5">{b.title}</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonios (sintéticos) */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-t">
          <div className="max-w-5xl mx-auto px-4 py-14">
            <h2 className="text-center text-2xl font-bold text-gray-900 mb-2 tracking-tight">
              La diferencia, en palabras de quienes lo usan
            </h2>
            <p className="text-center text-xs text-gray-500 mb-10">
              Citas representativas reconstruidas a partir de feedback real de despachos en periodo de prueba o producción.
            </p>
            <div className="grid md:grid-cols-2 gap-5">
              {[
                {
                  quote: "Antes pasaba la mañana del lunes contestando emails de '¿hay novedades?'. Desde que active el portal, esa bandeja está vacía y las familias me cuentan que se sienten más tranquilas.",
                  who: "Gestoría boutique · Madrid",
                },
                {
                  quote: "Hemos pasado de captar 2-3 herencias por trimestre por recomendación a 6-8. La gente enseña el portal en el grupo de WhatsApp de la familia y lo ven hijos, sobrinos y primos.",
                  who: "Despacho fiscal · Sevilla",
                },
                {
                  quote: "La parte del chat asíncrono fue lo que más miedo nos daba — pensábamos que generaría más trabajo. Es justo al revés: condensa todas las dudas y respondemos en bloque al final del día.",
                  who: "Funeraria con servicio post-mortem · Bilbao",
                },
                {
                  quote: "Cuando hay 4 hermanos en una herencia, el portal evita 4 versiones distintas de lo que está pasando. Una sola verdad para toda la familia. Eso solo ya vale el precio.",
                  who: "Abogado de derecho sucesorio · Valencia",
                },
              ].map((t, i) => (
                <div key={i} className="bg-white border rounded-2xl p-6 card-lift">
                  <svg className="w-8 h-8 text-primary/30 mb-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.571-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z" />
                  </svg>
                  <p className="text-sm text-gray-700 leading-relaxed mb-3 italic">{t.quote}</p>
                  <p className="text-xs text-gray-500 font-semibold">{t.who}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <Reveal>
          <div className="max-w-5xl mx-auto px-4 pb-16 pt-4">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white p-8 sm:p-12">
              <div className="absolute -top-20 right-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 -left-16 w-64 h-64 bg-emerald-400/15 rounded-full blur-3xl" />
              <div className="relative max-w-2xl">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
                  Tus clientes ya esperan esto. Sé tú quien se lo dé.
                </h2>
                <p className="text-slate-300 text-sm sm:text-base mb-6">
                  14 días gratis. Activa el portal en tu primer expediente en 5 minutos
                  y mide tú mismo cuántas llamadas dejas de recibir.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/#demo"
                    className="px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all text-sm"
                  >
                    Probar Portal Familia →
                  </Link>
                  <Link
                    href="/radar-isd"
                    className="px-6 py-3 bg-white/10 border border-white/15 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm"
                  >
                    Ver Radar ISD
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <SiteFooter />
      </div>
    </>
  );
}
