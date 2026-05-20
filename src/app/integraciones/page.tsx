import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Integraciones — BARITUR PRO",
  description:
    "Con qué se conecta BARITUR PRO: Stripe, S3, email, autenticación, IA y mucho más. Plus una API pública v1 para tus propias integraciones y un roadmap claro de lo que viene.",
  alternates: { canonical: "https://bariturpro.com/integraciones" },
};

interface Integration {
  name: string;
  category: string;
  desc: string;
  status: "active" | "soon" | "planned";
  href?: string;
}

const INTEGRATIONS: Integration[] = [
  // Active
  { name: "Stripe Billing", category: "Pagos", desc: "Cobros recurrentes mensuales y anuales, gestión de upgrades/downgrades, dunning automático.", status: "active" },
  { name: "AWS S3 (eu-central-1)", category: "Almacenamiento", desc: "Documentos del expediente (DNIs, escrituras, certificados) en bucket privado UE con SSE-S3.", status: "active" },
  { name: "Resend", category: "Email", desc: "Emails transaccionales: bienvenida, recordatorios de plazo ISD, notificaciones del portal familia.", status: "active" },
  { name: "Anthropic Claude API", category: "IA", desc: "Análisis automático de expedientes, generación de resúmenes y chat asistido sobre normativa ISD.", status: "active" },
  { name: "NextAuth + bcrypt", category: "Autenticación", desc: "Email/password con hash bcrypt 12 rounds. Sesiones JWT con rotación. Login por enlace mágico opcional.", status: "active" },
  { name: "Sede del Catastro", category: "Datos públicos", desc: "Lookup del Valor de Referencia de un inmueble vía referencia catastral (consulta automática durante el cálculo del 650).", status: "soon" },
  { name: "Webhook API", category: "Eventos", desc: "Recibe eventos en tiempo real: case.created, task.completed, deadline.upcoming. Configurable desde Ajustes.", status: "soon" },
  { name: "Plantillas de documentos", category: "Workflow", desc: "6 modelos de carta (banco, prórroga, aseguradora, comunidad, suministros, tasación) generables en PDF.", status: "active", href: "/plantillas-documentos" },
  { name: "Exportación CSV / ZIP", category: "Workflow", desc: "Exporta todos los expedientes, tareas y documentos en cualquier momento. Sin lock-in.", status: "active" },
  { name: "API pública v1", category: "Plataforma", desc: "Endpoints REST para cálculo ISD, comparación CCAA, detección de riesgos y generación de borradores PDF.", status: "active", href: "/docs/api" },

  // Soon
  { name: "Google Drive", category: "Almacenamiento", desc: "Sincronización bidireccional con carpetas de Google Drive. Los documentos del portal familia se replican a tu Drive del despacho.", status: "soon" },
  { name: "Microsoft OneDrive", category: "Almacenamiento", desc: "Equivalente a Google Drive para despachos en ecosistema Microsoft.", status: "soon" },
  { name: "Calendar (Google + Outlook)", category: "Productividad", desc: "Los plazos del Modelo 650 y tareas con fecha aparecen automáticamente en tu agenda profesional.", status: "soon" },
  { name: "Slack", category: "Notificaciones", desc: "Notificaciones de eventos críticos (plazo en 7 días, nuevo mensaje del portal, expediente bloqueado) en canal Slack.", status: "soon" },
  { name: "Microsoft Teams", category: "Notificaciones", desc: "Equivalente a Slack para despachos que trabajan con Microsoft Teams.", status: "soon" },
  { name: "WhatsApp Business (deep link)", category: "Comunicación", desc: "Botón \"Enviar mensaje por WhatsApp\" en cada contacto del expediente, con el texto pre-rellenado.", status: "soon" },

  // Planned
  { name: "AEAT - Sede electrónica", category: "Hacienda", desc: "Envío directo del Modelo 650/651 a la Sede de la AEAT/CCAA con certificado digital del despacho.", status: "planned" },
  { name: "Sede CCAA - Comunidades Autonómicas", category: "Hacienda", desc: "Integración nativa con las sedes de tributos autonómicas (Madrid, Cataluña, Andalucía, Valencia).", status: "planned" },
  { name: "Bancos - Open Banking", category: "Bancos", desc: "Consulta de saldos a fecha de fallecimiento vía PSD2 (con autorización del heredero) para evitar la carta manual.", status: "planned" },
  { name: "Registro de la Propiedad", category: "Inmuebles", desc: "Solicitud automática de nota simple desde el expediente.", status: "planned" },
  { name: "Holded / Quaderno", category: "Contabilidad", desc: "Sincronización de facturas y movimientos contables del despacho.", status: "planned" },
  { name: "DocuSign / FirmaProfesional", category: "Firma", desc: "Firma electrónica avanzada de los documentos generados (escrituras, autorizaciones).", status: "planned" },
  { name: "Zapier / Make", category: "No-code", desc: "Conector universal para que los no-developers puedan conectar BARITUR PRO con cualquier app del ecosistema.", status: "planned" },
];

const STATUS_STYLES: Record<Integration["status"], { label: string; bg: string; text: string }> = {
  active: { label: "Activa", bg: "bg-emerald-100", text: "text-emerald-700" },
  soon: { label: "Próximamente", bg: "bg-blue-100", text: "text-blue-700" },
  planned: { label: "En roadmap", bg: "bg-gray-100", text: "text-gray-600" },
};

const CATEGORIES = [
  "Pagos",
  "Almacenamiento",
  "Email",
  "IA",
  "Autenticación",
  "Datos públicos",
  "Eventos",
  "Workflow",
  "Plataforma",
  "Productividad",
  "Notificaciones",
  "Comunicación",
  "Hacienda",
  "Bancos",
  "Inmuebles",
  "Contabilidad",
  "Firma",
  "No-code",
];

export default function IntegracionesPage() {
  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: INTEGRATIONS.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  const totalActive = INTEGRATIONS.filter((i) => i.status === "active").length;
  const totalSoon = INTEGRATIONS.filter((i) => i.status === "soon").length;
  const totalPlanned = INTEGRATIONS.filter((i) => i.status === "planned").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="absolute inset-0 dot-grid-light opacity-30" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-400/25 rounded-full blur-3xl animate-float" />
        <div className="relative max-w-5xl mx-auto px-4 py-14 sm:py-16">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 text-xs text-blue-300 mb-4">
            {totalActive} activas · {totalSoon} próximas · {totalPlanned} en roadmap
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Integraciones y plataforma</h1>
          <p className="text-base sm:text-lg text-blue-100 max-w-3xl mb-6">
            Con qué se conecta BARITUR PRO hoy y qué llega en los próximos meses. Más una API pública v1
            para tus propias integraciones — porque tus expedientes deben ser tuyos, no rehén de un proveedor.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs/api"
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-lg text-sm transition"
            >
              Documentación API →
            </Link>
            <a
              href="mailto:partners@bariturpro.com"
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition"
            >
              Solicitar integración custom
            </a>
          </div>
        </div>
      </div>

      {/* Stats band */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-600">{totalActive}</p>
            <p className="text-xs text-gray-500 mt-0.5">Integraciones activas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{totalSoon}</p>
            <p className="text-xs text-gray-500 mt-0.5">Próximamente (90 días)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-700">{totalPlanned}</p>
            <p className="text-xs text-gray-500 mt-0.5">En roadmap</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">API v1</p>
            <p className="text-xs text-gray-500 mt-0.5">REST pública gratuita</p>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
        {grouped.map(({ category, items }) => (
          <section key={category}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{category}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {items.map((i, idx) => {
                const s = STATUS_STYLES[i.status];
                const card = (
                  <div className="bg-white border rounded-xl p-5 hover:shadow-md transition h-full flex flex-col">
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <h3 className="font-bold text-gray-900 text-sm">{i.name}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${s.bg} ${s.text} flex-shrink-0`}>
                        {s.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 flex-1">{i.desc}</p>
                    {i.href && (
                      <p className="mt-3 text-xs font-medium text-primary group-hover:underline">Ver →</p>
                    )}
                  </div>
                );
                return i.href ? (
                  <Link key={idx} href={i.href} className="group">{card}</Link>
                ) : (
                  <div key={idx}>{card}</div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* API CTA */}
      <div className="bg-white border-t border-b">
        <div className="max-w-4xl mx-auto px-4 py-14">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">¿Necesitas algo que no está aquí?</h2>
              <p className="text-sm text-gray-700 mb-4">
                La API pública v1 cubre cálculo ISD, comparación entre CCAA, detección de riesgos y generación de borradores Modelo 650/651.
                Suficiente para que cualquier software de gestoría integre BARITUR PRO en su propio flujo.
              </p>
              <p className="text-sm text-gray-700">
                Para integraciones empresariales con webhooks bidireccionales, SLA y soporte dedicado, escríbenos a partners@bariturpro.com.
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5 text-gray-100 font-mono text-xs overflow-x-auto">
              <pre>{`# Calcular ISD para Madrid, grupo II
curl -X POST https://bariturpro.com/api/public/isd-calc \\
  -H "Content-Type: application/json" \\
  -d '{
    "group": "II",
    "baseImponible": 200000,
    "ccaa": "MADRID"
  }'

# Comparar 17 CCAA para una herencia
curl "https://bariturpro.com/api/public/isd-compare?\\
  group=II&baseImponible=300000"`}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* Roadmap explanation */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Cómo decidimos el roadmap</h2>
        <p className="text-sm text-gray-700 mb-6">
          Las integraciones se priorizan por (1) volumen de despachos que la pedirían, (2) viabilidad técnica
          y (3) impacto en el ahorro de tiempo del expediente. Si echas en falta una integración crítica para
          tu operativa, dínoslo y la pasamos por delante del roadmap actual.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-sm text-amber-900">
            <strong>Tu opinión cuenta:</strong> los 3 clientes que más pidan una integración concreta la
            obtienen prioridad de desarrollo. Es nuestra forma de evitar construir features que nadie usa.
          </p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-3">Empieza ya y conecta cuando lo necesites</h2>
          <p className="text-blue-200 mb-6 max-w-lg mx-auto">
            14 días gratis, sin tarjeta. Si necesitas una integración custom, la analizamos durante el período de prueba.
          </p>
          <Link
            href="/#demo"
            className="inline-block px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition"
          >
            Probar BARITUR PRO →
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
