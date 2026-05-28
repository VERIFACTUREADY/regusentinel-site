import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Casos de uso ilustrativos — Cómo gestorías y funerarias usan Heredia",
  description:
    "6 escenarios con cifras orientativas: cómo despachos pueden pasar de 60 a 150 expedientes/año, evitar recargos del Modelo 650 y monetizar servicios post-mortem.",
  alternates: { canonical: "https://heredia.app/casos-de-uso" },
};

interface UseCase {
  id: string;
  vertical: "Gestoría" | "Funeraria" | "Abogados";
  title: string;
  before: string[];
  after: string[];
  metrics: { label: string; value: string; tone: "positive" | "neutral" }[];
  quote: string;
}

const CASES: UseCase[] = [
  {
    id: "gestoria-50-150-expedientes",
    vertical: "Gestoría",
    title: "Gestoría especializada: de 60 a 150 expedientes/año con el mismo equipo",
    before: [
      "60 expedientes anuales gestionados con Excel personal por gestor",
      "12-15 horas dedicadas a cada expediente entre comunicaciones, seguimiento y elaboración del Modelo 650",
      "2-3 expedientes/año con incidencias por plazos perdidos",
      "Reuniones presenciales con la familia para entrega de documentos",
    ],
    after: [
      "150 expedientes/año con el mismo equipo (4 gestores)",
      "7 horas medias por expediente: portal familia + plantillas precargadas + borrador 650 automático",
      "Cero plazos perdidos en 18 meses gracias al Radar ISD",
      "85% de la captura documental por portal familia (sin reuniones)",
    ],
    metrics: [
      { label: "Capacidad", value: "+150%", tone: "positive" },
      { label: "Tiempo/expediente", value: "-45%", tone: "positive" },
      { label: "Plazos perdidos", value: "0", tone: "positive" },
      { label: "Plan", value: "Despacho", tone: "neutral" },
    ],
    quote: "Pasamos de tramitar 60 herencias al año a 150 con el mismo equipo. La automatización del Modelo 650 y el portal familia son los dos ejes que cambiaron todo.",
  },

  {
    id: "funeraria-postmortem-cross-sell",
    vertical: "Funeraria",
    title: "Funeraria que monetiza el servicio post-mortem que antes regalaba",
    before: [
      "Los familiares preguntaban sobre trámites post-sepelio sin que hubiera respuestas formales",
      "Pérdida de la relación con la familia tras el servicio funerario",
      "Cero ingresos derivados del post-mortem; derivación a gestoría externa",
      "Equipo administrativo dedicaba 4-6 horas semanales a 'consultas' no facturadas",
    ],
    after: [
      "Servicio post-mortem facturado a 350-450 € por expediente",
      "Portal familia con marca propia mantiene la relación durante 6-9 meses",
      "Gestiones complejas se derivan a gestoría socia con comisión",
      "El equipo administrativo se centra en el servicio facturado, no en regalarlo",
    ],
    metrics: [
      { label: "Ingreso medio/expediente", value: "+ 380 €", tone: "positive" },
      { label: "Conversión a servicio", value: "62%", tone: "positive" },
      { label: "Tiempo dedicado", value: "Constante", tone: "neutral" },
      { label: "Plan", value: "Despacho", tone: "neutral" },
    ],
    quote: "Pasamos de ser la funeraria que organiza el sepelio a ser el referente que la familia recomienda durante años. El servicio post-mortem ha sido nuestra mejor inversión.",
  },

  {
    id: "evitar-recargo-isd",
    vertical: "Gestoría",
    title: "Gestoría evita 12.400 € de recargos en el primer año",
    before: [
      "Una asistente administrativa controlaba los plazos del Modelo 650 a mano",
      "5 expedientes con presentación tardía (2 a 3 meses) en un año",
      "Recargos del 5% al 10% más intereses de demora pagados por el cliente o asumidos por el despacho",
      "Coste asumido por errores: 12.400 € repartidos en sanciones y bonus a clientes",
    ],
    after: [
      "Radar ISD agregado avisa 30 días antes con email + alerta en dashboard",
      "Cero presentaciones fuera de plazo en los 12 meses siguientes",
      "Ahorro neto: 12.400 € en recargos no pagados",
      "Relación con clientes: percepción de profesionalidad reforzada",
    ],
    metrics: [
      { label: "Recargos evitados", value: "12.400 €", tone: "positive" },
      { label: "Plazos perdidos", value: "0", tone: "positive" },
      { label: "Coste Heredia/año", value: "4.188 €", tone: "neutral" },
      { label: "Plan", value: "Despacho", tone: "neutral" },
    ],
    quote: "Lo que costaba el plan se cubrió con un solo recargo evitado. El año entero ha sido beneficio puro.",
  },

  {
    id: "abogado-trazabilidad-litigio",
    vertical: "Abogados",
    title: "Despacho de derecho sucesorio cierra litigio gracias al audit trail",
    before: [
      "Heredero descontento amenaza con demandar alegando falta de información sobre el cálculo del ISD",
      "Riesgo de responsabilidad profesional ante el ICAB",
      "Trazabilidad de comunicaciones dispersa en email, WhatsApp y notas manuscritas",
      "Cliente cuestiona la valoración de la vivienda declarada",
    ],
    after: [
      "Audit trail muestra timestamp de cada comunicación al heredero",
      "Portal con confirmación de lectura del cálculo del ISD por el cliente",
      "Histórico de versiones del cálculo conservado con todos los inputs",
      "Caso archivado sin demanda; cliente acepta la documentación aportada",
    ],
    metrics: [
      { label: "Tiempo invertido", value: "8 h", tone: "neutral" },
      { label: "Riesgo profesional", value: "Eliminado", tone: "positive" },
      { label: "Honorarios facturados", value: "+ 1.800 €", tone: "positive" },
      { label: "Plan", value: "Firma", tone: "neutral" },
    ],
    quote: "El audit trail nos sacó de un proceso disciplinario. Pudimos demostrar al colegio que cada paso del expediente estaba registrado.",
  },

  {
    id: "donaciones-especializacion",
    vertical: "Gestoría",
    title: "Despacho fiscal abre vertical de donaciones con el Modelo 651",
    before: [
      "Solo tramitaban herencias (Modelo 650); las donaciones las derivaban a colegas",
      "Clientes con planificación patrimonial recurrente perdidos por falta de servicio",
      "Conocimiento limitado de las bonificaciones autonómicas en donaciones (distintas a sucesiones)",
      "Borrador del Modelo 651 redactado a mano cada vez",
    ],
    after: [
      "30 expedientes de donación añadidos al primer año (vivienda hijos, empresa familiar)",
      "Cálculo automático de bonificaciones por CCAA en donaciones",
      "Borrador del Modelo 651 generado en PDF en 30 segundos",
      "Cross-sell: clientes de planificación patrimonial → herencia futura",
    ],
    metrics: [
      { label: "Expedientes añadidos", value: "+ 30/año", tone: "positive" },
      { label: "Facturación adicional", value: "+ 18.000 €", tone: "positive" },
      { label: "Tiempo/donación", value: "2,5 h", tone: "neutral" },
      { label: "Plan", value: "Despacho", tone: "neutral" },
    ],
    quote: "Antes derivábamos las donaciones; con Heredia ya no hay diferencia entre 650 y 651. Es el mismo flujo y abrimos un vertical entero.",
  },

  {
    id: "funeraria-portal-familia-marca",
    vertical: "Funeraria",
    title: "Funeraria con marca regional refuerza posicionamiento con portal blanco",
    before: [
      "Portal de comunicación con familia inexistente o usando WhatsApp y email del gestor",
      "Imposible diferenciar el servicio post-mortem del competidor",
      "Sin presencia digital tras el sepelio; relación se diluye en semanas",
      "Reseñas y referencias dependen de la memoria del cliente",
    ],
    after: [
      "Portal personalizado con el logo, los colores y el email de soporte de la funeraria",
      "Cada familia recibe URL única durante 6-12 meses con seguimiento de su expediente",
      "Reviews/recomendaciones triplican gracias al recordatorio constante",
      "Equipo comercial puede demostrar el portal en cada nuevo servicio",
    ],
    metrics: [
      { label: "Reseñas Google/año", value: "× 3", tone: "positive" },
      { label: "Cross-sell servicios", value: "+ 28%", tone: "positive" },
      { label: "Inversión inicial", value: "0 €", tone: "neutral" },
      { label: "Plan", value: "Firma", tone: "neutral" },
    ],
    quote: "El portal con nuestro dominio es la mejor herramienta de marca que hemos tenido. La familia ve nuestro logo durante meses, no el del software.",
  },
];

const TONE_STYLES = {
  positive: "text-emerald-600",
  neutral: "text-gray-700",
};

const VERTICAL_COLORS: Record<UseCase["vertical"], string> = {
  Gestoría: "bg-blue-100 text-blue-700",
  Funeraria: "bg-purple-100 text-purple-700",
  Abogados: "bg-amber-100 text-amber-700",
};

export default function CasosDeUsoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="absolute inset-0 dot-grid-light opacity-30" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-400/25 rounded-full blur-3xl animate-float" />
        <div className="relative max-w-4xl mx-auto px-4 py-14 sm:py-16">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Casos de uso ilustrativos</h1>
          <p className="text-base sm:text-lg text-blue-100 max-w-2xl mb-2">
            Cómo gestorías, funerarias y despachos de derecho sucesorio pueden usar Heredia para
            multiplicar su capacidad, evitar recargos y monetizar servicios post-mortem.
          </p>
          <p className="text-sm text-blue-300">
            Casos modelo basados en supuestos del sector. Las cifras ilustran el potencial; el ROI
            real depende del despacho, su volumen y su madurez operativa.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
        {CASES.map((c) => (
          <article key={c.id} className="bg-white border rounded-xl overflow-hidden">
            <header className="px-6 py-4 border-b flex items-center gap-3 flex-wrap">
              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${VERTICAL_COLORS[c.vertical]}`}>
                {c.vertical}
              </span>
              <h2 className="text-lg font-bold text-gray-900 flex-1">{c.title}</h2>
            </header>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 border-b">
              {c.metrics.map((m, i) => (
                <div key={i} className="px-4 py-4 text-center">
                  <p className={`text-xl font-bold ${TONE_STYLES[m.tone]}`}>{m.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Before / After */}
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
              <div className="p-6">
                <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-3">Antes</p>
                <ul className="space-y-2 text-sm text-gray-700">
                  {c.before.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-rose-400 flex-shrink-0">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 bg-emerald-50/40">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3">Con Heredia</p>
                <ul className="space-y-2 text-sm text-gray-700">
                  {c.after.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-500 flex-shrink-0">✓</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Quote */}
            <div className="p-6 bg-gray-50 border-t">
              <p className="text-sm text-gray-700 italic">"{c.quote}"</p>
            </div>
          </article>
        ))}
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-4 pb-14">
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-3">Calcula tu propio caso</h2>
          <p className="text-blue-200 mb-6 max-w-lg mx-auto">
            Introduce tu volumen, horas y coste/hora reales en la calculadora ROI y obtén una
            estimación de ahorro neto anual personalizada.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/calculadora-roi"
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition"
            >
              Calculadora ROI →
            </Link>
            <Link
              href="/#demo"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition"
            >
              Probar 14 días gratis
            </Link>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="max-w-4xl mx-auto px-4 pb-10">
        <p className="text-xs text-gray-500 border-t pt-6">
          <strong>Nota metodológica:</strong> los casos de uso reflejan patrones observados en
          despachos en período de prueba o producción. Las cifras concretas son proyecciones
          razonables basadas en los inputs declarados (volumen, hora, errores típicos del sector).
          Tu caso real puede variar según madurez de procesos previos y adopción del equipo.
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}
