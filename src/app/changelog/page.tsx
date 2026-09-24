import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Changelog — Heredia",
  description: "Novedades y actualizaciones de Heredia. Software de gestion de herencias para gestorias.",
  alternates: { canonical: "https://heredia.app/changelog" },
};

const entries = [
  {
    date: "2026-05-24",
    version: "1.5",
    title: "Radar ISD completo + integraciones outbound (plan Firma)",
    changes: [
      "Radar ISD: 6/6 alertas del mockup operativas — plazo Modelo 650, ventana de prórroga, plusvalía municipal (IIVTNU) con detección de no-sujeción (RDL 26/2021), tramos del coeficiente multiplicador del art. 22, cambio de residencia <5 años (art. 28 Ley 22/2009) y mantenimiento de reducciones del art. 20 con aniversarios",
      "Importación nativa de Excel (.xlsx) en el endpoint /api/cases/import. SheetJS lee la primera hoja, soporta hasta 200 filas, mantiene la validación CSV existente",
      "Slack notifications (plan Firma) — mensaje en bloques con urgencia coloreada y botón al expediente",
      "Microsoft Teams (plan Firma) — MessageCard con themeColor por urgencia y OpenUri al expediente",
      "Webhook genérico (plan Firma) — POST JSON con firma HMAC-SHA256 en X-HEREDIA-Signature. Helper verifyWebhookSignature para clientes",
      "Google Workspace SSO (plan Firma) — provider NextAuth opt-in via env. Restricción opcional por dominio Workspace (hd)",
      "Calendar deep links — botones \"+ Google\" y \"+ Outlook / .ics\" en cada plazo del expediente",
      "WhatsApp deep link en el contacto del expediente con texto pre-rellenado (ref + causante)",
      "Sede del Catastro — campo Referencia Catastral + deep links a la ficha y al visor cartográfico",
      "Drag-and-drop real en la subida de documentos del Portal Familia",
      "Enforcement de maxUsers por plan al invitar miembros (Inicia 2 · Despacho 5 · Firma 20)",
      "Trial seeded con datos fiscales que disparan 6 alertas Radar desde el día 1 — el moat se ve sin esperar 2 semanas",
    ],
    tag: "nuevo",
  },
  {
    date: "2026-04-17",
    version: "1.4",
    title: "Gestion de trials y paginas legales",
    changes: [
      "Activacion de trials desde el panel de administracion (7/14/30 dias)",
      "Banner de trial con cuenta atras en la app",
      "Cron de aviso de expiracion de trials (3 dias antes)",
      "Paginas legales: Politica de Privacidad, Terminos de Servicio, Politica de Cookies",
      "Pagina de facturacion con UX adaptada a trials",
      "Paginas de error personalizadas (404, 500)",
      "Skeleton de carga para rutas de la app",
      "Pagina de ajustes generales de organizacion",
    ],
    tag: "nuevo",
  },
  {
    date: "2026-04-16",
    version: "1.3",
    title: "SEO, metricas y precios",
    changes: [
      "Pagina de precios con comparativa detallada y FAQ",
      "Dashboard de metricas para el owner (KPIs, tendencia, distribucion de planes)",
      "SEO: metadata, JSON-LD, sitemap.xml, robots.txt",
      "Cron de recordatorio de leads sin contactar (stale-leads)",
    ],
    tag: "nuevo",
  },
  {
    date: "2026-04-15",
    version: "1.2",
    title: "CRM de leads y notificaciones",
    changes: [
      "Mini-CRM de leads con pipeline de 6 estados (NEW → CUSTOMER | LOST)",
      "Notas internas por lead con actualizacion inline",
      "Notificacion por email al equipo de ventas cuando entra un nuevo lead",
      "Atribucion de fuente (landing, demo banner, demo dashboard, precios)",
      "Leads calientes desde la demo con badge especial en el email",
    ],
    tag: "nuevo",
  },
  {
    date: "2026-04-14",
    version: "1.1",
    title: "Entorno demo y onboarding",
    changes: [
      "Entorno demo con datos ficticios y acceso auto con un click",
      "Banner de demo en la app con CTA a reunion",
      "Panel de wow-moments en el dashboard demo (caso urgente, portal, pack banco)",
      "Formulario de contacto con atribucion de fuente",
      "Reset diario del entorno demo (cron a las 03:00)",
    ],
    tag: "nuevo",
  },
  {
    date: "2026-04-10",
    version: "1.0",
    title: "Lanzamiento MVP",
    changes: [
      "Gestion de expedientes con pipeline de 9 estados",
      "Motor de plazos ISD (Modelo 650) con alertas automaticas",
      "Checklist inteligente por categoria (bancos, suministros, seguros...)",
      "Portal familia con enlace seguro y subida de documentos",
      "Pack banco unificado (PDF + ZIP) con checklist BdE",
      "Plantillas versionadas con aprobacion",
      "Roles y permisos (OWNER, MANAGER, OPERATOR, VIEWER, MANAGED_OPS)",
      "White-label del portal familia (Despacho/Firma)",
      "Audit trail inmutable",
      "Autopiloto IA para generacion de checklists y borradores",
      "Facturacion con Stripe (3 planes: Inicia, Despacho, Firma)",
    ],
    tag: "lanzamiento",
  },
];

const TAG_STYLES: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-700",
  mejora: "bg-green-100 text-green-700",
  fix: "bg-orange-100 text-orange-700",
  lanzamiento: "bg-primary/10 text-primary",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Changelog</h1>
        <p className="text-gray-500 mb-10">
          Novedades, mejoras y correcciones en Heredia. Publicamos actualizaciones cada semana.
        </p>

        <div className="space-y-0">
          {entries.map((entry, i) => (
            <div key={i} className="relative pl-8 pb-10 border-l-2 border-gray-200 last:border-transparent">
              <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-white border-2 border-primary" />
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <time className="text-sm text-gray-400 font-mono">
                  {new Date(entry.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                </time>
                <span className="text-xs font-mono text-gray-400">v{entry.version}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_STYLES[entry.tag] ?? "bg-gray-100"}`}>
                  {entry.tag}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{entry.title}</h2>
              <ul className="space-y-1">
                {entry.changes.map((change, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-primary mt-1 shrink-0">+</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
