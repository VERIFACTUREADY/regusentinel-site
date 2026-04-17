import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog — BARITUR PRO",
  description: "Novedades y actualizaciones de BARITUR PRO. Software de gestion de herencias para gestorias.",
  alternates: { canonical: "https://baritur.pro/changelog" },
};

const entries = [
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
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-primary">BARITUR PRO</Link>
          <div className="flex gap-4 items-center text-sm">
            <Link href="/precios" className="text-gray-600 hover:text-primary">Precios</Link>
            <Link href="/login?demo=1" className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5">
              Probar demo
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Changelog</h1>
        <p className="text-gray-500 mb-10">
          Novedades, mejoras y correcciones en BARITUR PRO. Publicamos actualizaciones cada semana.
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

      <footer className="py-8 border-t bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-gray-500 space-y-2">
          <p>
            <Link href="/" className="text-primary hover:underline mr-4">Inicio</Link>
            <Link href="/precios" className="text-primary hover:underline mr-4">Precios</Link>
            <Link href="/legal/privacidad" className="text-primary hover:underline mr-4">Privacidad</Link>
            <Link href="/legal/terminos" className="text-primary hover:underline">Terminos</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
