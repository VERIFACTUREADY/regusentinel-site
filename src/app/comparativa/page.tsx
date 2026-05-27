import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Heredia vs Excel, CRM genérico y software jurídico — Comparativa",
  description:
    "Cómo se compara Heredia con Excel, CRMs genéricos (HubSpot, Pipedrive) y software jurídico-fiscal tradicional para la gestión de herencias y el ISD.",
  alternates: { canonical: "https://heredia.app/comparativa" },
};

interface FeatureRow {
  feature: string;
  detail: string;
  excel: "yes" | "partial" | "no";
  crm: "yes" | "partial" | "no";
  juridico: "yes" | "partial" | "no";
  heredia: "yes" | "partial" | "no";
}

const FEATURES: FeatureRow[] = [
  {
    feature: "Cálculo automático del ISD por CCAA",
    detail: "Tarifa estatal + reducciones + bonificación autonómica con tramos progresivos",
    excel: "no",
    crm: "no",
    juridico: "partial",
    heredia: "yes",
  },
  {
    feature: "Borrador del Modelo 650 en PDF",
    detail: "PDF profesional pre-rellenado con datos del causante, plazos y cuota estimada",
    excel: "no",
    crm: "no",
    juridico: "partial",
    heredia: "yes",
  },
  {
    feature: "Radar ISD — vigilancia de los 17 calendarios autonómicos",
    detail: "Avisos antes de vencer el Modelo 650, ventana de prórroga, tramos de patrimonio, bonificaciones con caducidad y cambios de residencia",
    excel: "no",
    crm: "no",
    juridico: "partial",
    heredia: "yes",
  },
  {
    feature: "Plantillas de tareas precargadas",
    detail: "27 tareas reales con plazos legales (defunción estándar, seguros, vivienda)",
    excel: "no",
    crm: "no",
    juridico: "partial",
    heredia: "yes",
  },
  {
    feature: "Portal Familia con tu marca",
    detail: "URL única por expediente. Cada heredero ve plazos, documentos pendientes y chat con el gestor. Reduce 68% las consultas",
    excel: "no",
    crm: "no",
    juridico: "no",
    heredia: "yes",
  },
  {
    feature: "Pack para banco automático",
    detail: "ZIP con todos los certificados, escrituras y autoliquidaciones unificados",
    excel: "no",
    crm: "no",
    juridico: "no",
    heredia: "yes",
  },
  {
    feature: "Cumplimiento RGPD post-mortem específico",
    detail: "Tratamiento de datos de personas fallecidas (art. 3 LOPDGDD), retención configurable",
    excel: "no",
    crm: "partial",
    juridico: "partial",
    heredia: "yes",
  },
  {
    feature: "Audit trail completo",
    detail: "Registro inmutable de cada acción, autor y momento — válido en juicio",
    excel: "no",
    crm: "partial",
    juridico: "yes",
    heredia: "yes",
  },
  {
    feature: "Búsqueda global y dashboard de cartera",
    detail: "Vista del estado de todos los expedientes con KPIs y radar de riesgos",
    excel: "no",
    crm: "yes",
    juridico: "partial",
    heredia: "yes",
  },
  {
    feature: "Especialización en herencias y post-mortem",
    detail: "Diseñado desde cero para el sector funerario y gestoría de sucesiones",
    excel: "no",
    crm: "no",
    juridico: "partial",
    heredia: "yes",
  },
  {
    feature: "Coste mensual",
    detail: "Para un despacho con 50 expedientes/mes",
    excel: "yes",
    crm: "no",
    juridico: "no",
    heredia: "yes",
  },
];

const Cell = ({ v }: { v: "yes" | "partial" | "no" }) => {
  if (v === "yes") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100">
        <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (v === "partial") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100">
        <svg className="w-3 h-3 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-100">
      <svg className="w-3 h-3 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
};

export default function ComparativaPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="absolute inset-0 dot-grid-light opacity-30" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-400/25 rounded-full blur-3xl animate-float" />
        <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Heredia vs alternativas
          </h1>
          <p className="text-base sm:text-lg text-blue-100 max-w-3xl">
            Por qué un software especializado en herencias y post-mortem supera a las hojas de cálculo,
            los CRMs genéricos y los programas jurídico-fiscales tradicionales.
          </p>
        </div>
      </div>

      {/* Comparison table */}
      <div className="max-w-5xl mx-auto px-4 -mt-6 mb-10 relative z-0">
        <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50">
                    Característica
                  </th>
                  <th className="px-3 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Excel /<br />Drive
                  </th>
                  <th className="px-3 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                    CRM<br />genérico
                  </th>
                  <th className="px-3 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Software<br />jurídico
                  </th>
                  <th className="px-3 py-4 text-center text-xs font-bold text-primary uppercase tracking-wider bg-blue-50">
                    Heredia
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 sticky left-0 bg-white">
                      <p className="font-semibold text-gray-900 text-sm">{f.feature}</p>
                      <p className="text-xs text-gray-500 mt-0.5 max-w-md">{f.detail}</p>
                    </td>
                    <td className="px-3 py-3 text-center"><Cell v={f.excel} /></td>
                    <td className="px-3 py-3 text-center"><Cell v={f.crm} /></td>
                    <td className="px-3 py-3 text-center"><Cell v={f.juridico} /></td>
                    <td className="px-3 py-3 text-center bg-blue-50/50"><Cell v={f.heredia} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-end gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-100 inline-block" /> Sí</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-100 inline-block" /> Parcial / con esfuerzo</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-100 inline-block" /> No</span>
          </div>
        </div>
      </div>

      {/* Detail per alternative */}
      <div className="max-w-5xl mx-auto px-4 pb-10 grid md:grid-cols-3 gap-5">
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📊</span>
            <h3 className="font-bold text-gray-900">Excel / Google Drive</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            La opción inicial de muchos despachos. Funciona hasta que crece el volumen.
          </p>
          <p className="text-xs font-semibold text-gray-700 mb-1">Limitaciones reales:</p>
          <ul className="text-xs text-gray-600 space-y-1 mb-3">
            <li>• Sin alertas automáticas de plazos del Modelo 650</li>
            <li>• Sin cálculo de cuota ISD por CCAA</li>
            <li>• Imposible compartir con la familia sin riesgo</li>
            <li>• No hay audit trail si surgen reclamaciones</li>
            <li>• Cada error es manual y silencioso</li>
          </ul>
        </div>

        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🌐</span>
            <h3 className="font-bold text-gray-900">CRM genérico</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            HubSpot, Pipedrive, Zoho... pensados para ventas, no para gestión post-mortem.
          </p>
          <p className="text-xs font-semibold text-gray-700 mb-1">Limitaciones reales:</p>
          <ul className="text-xs text-gray-600 space-y-1 mb-3">
            <li>• No saben qué es un Modelo 650 ni un certificado de últimas voluntades</li>
            <li>• Hay que diseñar pipelines y flujos desde cero</li>
            <li>• Sin lógica fiscal específica (CCAA, parentesco, plazos)</li>
            <li>• Coste/usuario crece linealmente al ampliar equipo</li>
            <li>• Portal cliente genérico, no adaptado a duelo</li>
          </ul>
        </div>

        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⚖️</span>
            <h3 className="font-bold text-gray-900">Software jurídico</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Aranzadi, Wolters Kluwer A3 y similares. Potentes pero pesados.
          </p>
          <p className="text-xs font-semibold text-gray-700 mb-1">Limitaciones reales:</p>
          <ul className="text-xs text-gray-600 space-y-1 mb-3">
            <li>• Diseñados para asesoría fiscal/jurídica clásica, no post-mortem</li>
            <li>• Curva de aprendizaje larga, formación obligatoria</li>
            <li>• Coste alto + permanencia + IT consulting</li>
            <li>• Sin portal familia o pack banco como módulos nativos</li>
            <li>• Ciclos de actualización lentos ante cambios autonómicos</li>
          </ul>
        </div>
      </div>

      {/* Why we win */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-white rounded-2xl border p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Por qué Heredia es distinto</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                title: "Especialización vertical",
                desc: "Desde el primer día construido para herencias y post-mortem. No es un CRM con plantillas: es lógica fiscal, plazos legales y portal familia integrados.",
              },
              {
                title: "Datos públicos siempre actualizados",
                desc: "Las 17 CCAA, las bonificaciones, los tramos progresivos y los plazos están en código testeado. Cada cambio normativo lo absorbemos sin que tengas que actualizar nada.",
              },
              {
                title: "Sin permanencia ni cuota de IT",
                desc: "Setup remoto en 30 minutos. Plantillas precargadas. Sin consultor que te facture la implementación a 200 €/h.",
              },
              {
                title: "El portal familia y el pack banco son nativos",
                desc: "No hay que integrar herramientas externas. Cada expediente trae portal con URL única, alertas y exportación a un ZIP unificado para banca.",
              },
            ].map((b, i) => (
              <div key={i}>
                <h3 className="font-semibold text-gray-900 mb-1">{b.title}</h3>
                <p className="text-sm text-gray-600">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h2 className="text-2xl font-bold mb-3">¿Estás migrando desde Excel u otro sistema?</h2>
              <p className="text-blue-200 text-sm mb-3">
                Plan de migración en 5 días, plantillas precargadas, importación de tu Excel actual.
                14 días gratis para que pruebes con tu cartera real.
              </p>
              <Link
                href="/migrar-de-excel"
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-200 hover:text-white transition-all"
              >
                Ver el plan de migración detallado
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
            <div className="flex flex-col gap-3 items-stretch">
              <Link
                href="/calculadora-roi"
                className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm text-center transition"
              >
                Calcular cuánto ahorrarías →
              </Link>
              <Link
                href="/#demo"
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm text-center transition"
              >
                Probar Heredia 14 días
              </Link>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
