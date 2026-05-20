import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Seguridad y privacidad — BARITUR PRO",
  description:
    "Cómo BARITUR PRO protege los datos de tus expedientes: cifrado en tránsito y reposo, hosting en UE, RGPD compliant, audit trail inmutable y retención configurable.",
  alternates: { canonical: "https://bariturpro.com/seguridad" },
  openGraph: {
    title: "Seguridad y privacidad - BARITUR PRO",
    description: "Cifrado, RGPD, hosting UE, audit trail. Cómo protegemos los datos de tus expedientes.",
    type: "website",
  },
};

interface MeasureCard {
  icon: string;
  title: string;
  desc: string;
}

const MEASURES: MeasureCard[] = [
  {
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    title: "Cifrado en tránsito",
    desc: "Todas las comunicaciones (web, API, portal familia) usan TLS 1.3. Certificados validados por Let's Encrypt y rotados automáticamente.",
  },
  {
    icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
    title: "Cifrado en reposo",
    desc: "Base de datos con cifrado AES-256 a nivel de almacenamiento. Documentos en S3 con SSE-S3. Backups diarios cifrados con retención de 30 días.",
  },
  {
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Hosting en Unión Europea",
    desc: "Toda la infraestructura (compute, base de datos, storage, backups) reside en datacenters de la UE. Nunca se transfieren datos personales fuera del EEE.",
  },
  {
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    title: "Audit trail inmutable",
    desc: "Cada acción (lectura, escritura, exportación) queda registrada con autor, IP, timestamp y diff. El log es append-only y no editable. Válido para procesos disciplinarios o judiciales.",
  },
  {
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Retención configurable",
    desc: "Tu organización define cuánto se conservan los datos tras el cierre de cada expediente. Borrado lógico con tombstone, plazo configurable de purga definitiva.",
  },
  {
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
    title: "Aislamiento por organización",
    desc: "Cada despacho ve solo sus propios datos. Aislamiento por orgId en cada query SQL, RBAC con 5 roles (OWNER, MANAGER, OPERATOR, VIEWER, MANAGED_OPS).",
  },
  {
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    title: "Recuperación ante desastres",
    desc: "RPO 1 hora (backup más reciente), RTO 4 horas (tiempo de recuperación). Procedimiento documentado y testado mensualmente. Plan de continuidad de negocio.",
  },
  {
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    title: "Detección de intrusiones",
    desc: "Monitorización 24/7 de logs de acceso. Alertas automáticas ante patrones anómalos (login fallidos repetidos, picos de exportación, accesos fuera de horario).",
  },
];

interface RGPDPoint {
  q: string;
  a: string;
}

const RGPD_POINTS: RGPDPoint[] = [
  {
    q: "¿BARITUR PRO actúa como Encargado del tratamiento?",
    a: "Sí. Tu organización es Responsable del tratamiento de los datos de los expedientes (causantes, herederos, contactos). BARITUR PRO actúa como Encargado del tratamiento conforme al art. 28 RGPD. Te firmamos un Contrato de Encargo (DPA) en la activación.",
  },
  {
    q: "¿Cómo se tratan los datos de personas fallecidas?",
    a: "Conforme al art. 3 LO 3/2018 (LOPDGDD), los datos de personas fallecidas no son datos personales en sentido estricto, pero los herederos pueden ejercer derechos sobre ellos. Aplicamos las mismas medidas de seguridad que a datos vivos y permitimos que los herederos consulten/eliminen información a través del portal familia.",
  },
  {
    q: "¿Qué pasa con los datos si dejo de pagar?",
    a: "Suspensión: 30 días de gracia con datos accesibles solo en lectura. Cancelación: 90 días para exportar todo (CSV + ZIP de documentos) antes de la purga definitiva. La purga es irreversible y queda registrada en el audit trail.",
  },
  {
    q: "¿Se usa la información de mis expedientes para entrenar modelos de IA?",
    a: "No. Los datos de tu organización nunca se usan para entrenar modelos. Cuando usamos APIs de IA (Anthropic Claude para resúmenes), los datos enviados son temporales, no se almacenan en el proveedor y van con cabecera de no-training. Las llamadas se hacen con cuenta empresarial bajo DPA.",
  },
  {
    q: "¿Puedo exportar todos mis datos?",
    a: "Sí, en cualquier momento. Exportación CSV de expedientes, tareas y contactos. ZIP con todos los documentos asociados. Las exportaciones quedan registradas en el audit trail.",
  },
  {
    q: "¿Hacéis transferencias internacionales de datos?",
    a: "No. Toda la infraestructura está en datacenters de la UE (Frankfurt, Dublin). Las únicas API externas son Stripe (UE), Anthropic (con SCC firmadas), Resend (UE). En ningún caso datos personales identificables se transfieren a terceros países.",
  },
  {
    q: "¿Qué medidas habéis tomado tras el incidente X o ante Y vulnerabilidad?",
    a: "Política de divulgación responsable: cualquier vulnerabilidad reportada a security@bariturpro.com se tritra en 48h. Si afecta a tus datos, te notificamos en menos de 72h conforme exige el art. 33 RGPD.",
  },
  {
    q: "¿Cumplís con ENS (Esquema Nacional de Seguridad)?",
    a: "Aún no certificados; estamos trabajando en alcanzar ENS Categoría Media. Nuestras medidas técnicas y organizativas se diseñaron alineadas con dicho marco para facilitar futura certificación.",
  },
];

export default function SeguridadPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: RGPD_POINTS.map((p) => ({
      "@type": "Question",
      name: p.q,
      acceptedAnswer: { "@type": "Answer", text: p.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-5xl mx-auto px-4 py-14 sm:py-16">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
              RGPD + LOPDGDD compliant - Hosting UE
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Seguridad y privacidad</h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-3xl">
              Tus expedientes contienen información sensible (datos médicos, patrimoniales, familiares).
              BARITUR PRO se construyó con privacidad por diseño y seguridad por defecto.
            </p>
          </div>
        </div>

        {/* Trust badges */}
        <div className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">UE</p>
              <p className="text-xs text-gray-500 mt-0.5">Datos solo en datacenters UE</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">TLS 1.3</p>
              <p className="text-xs text-gray-500 mt-0.5">Cifrado en tránsito</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">AES-256</p>
              <p className="text-xs text-gray-500 mt-0.5">Cifrado en reposo</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">&lt;72h</p>
              <p className="text-xs text-gray-500 mt-0.5">Notificación de brechas (art. 33)</p>
            </div>
          </div>
        </div>

        {/* Measures grid */}
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Medidas técnicas y organizativas</h2>
          <p className="text-sm text-gray-600 mb-8">Alineadas con el RGPD, la LOPDGDD y el Esquema Nacional de Seguridad.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MEASURES.map((m, i) => (
              <div key={i} className="bg-white border rounded-xl p-5">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">{m.title}</h3>
                <p className="text-sm text-gray-600">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Subprocesores */}
        <div className="bg-white border-t border-b">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Subencargados del tratamiento</h2>
            <p className="text-sm text-gray-600 mb-6">
              Lista completa de proveedores que procesan datos personales en nuestro nombre. Todos con DPA firmado y ubicación UE.
            </p>
            <div className="overflow-x-auto bg-gray-50 rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Subencargado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Servicio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ubicación</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo de datos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr><td className="px-4 py-3 font-medium">Vercel Inc.</td><td className="px-4 py-3 text-gray-600">Hosting aplicación web</td><td className="px-4 py-3 text-gray-600">UE (Frankfurt)</td><td className="px-4 py-3 text-gray-600">Logs de acceso, no datos de expedientes</td></tr>
                  <tr><td className="px-4 py-3 font-medium">PostgreSQL gestionado UE</td><td className="px-4 py-3 text-gray-600">Base de datos</td><td className="px-4 py-3 text-gray-600">UE (Dublin)</td><td className="px-4 py-3 text-gray-600">Todos los datos de expedientes</td></tr>
                  <tr><td className="px-4 py-3 font-medium">AWS S3 (eu-central-1)</td><td className="px-4 py-3 text-gray-600">Almacenamiento documentos</td><td className="px-4 py-3 text-gray-600">UE (Frankfurt)</td><td className="px-4 py-3 text-gray-600">Documentos subidos por familia/gestor</td></tr>
                  <tr><td className="px-4 py-3 font-medium">Stripe Payments Europe</td><td className="px-4 py-3 text-gray-600">Cobros recurrentes</td><td className="px-4 py-3 text-gray-600">UE (Dublin)</td><td className="px-4 py-3 text-gray-600">Datos de facturación únicamente</td></tr>
                  <tr><td className="px-4 py-3 font-medium">Resend</td><td className="px-4 py-3 text-gray-600">Email transaccional</td><td className="px-4 py-3 text-gray-600">UE</td><td className="px-4 py-3 text-gray-600">Email de gestor y familia (no contenido sensible)</td></tr>
                  <tr><td className="px-4 py-3 font-medium">Anthropic PBC</td><td className="px-4 py-3 text-gray-600">Análisis IA bajo demanda</td><td className="px-4 py-3 text-gray-600">EEUU (con SCC + DPA)</td><td className="px-4 py-3 text-gray-600">Texto del expediente; opt-in del cliente; cabecera no-training</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Lista actualizada {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.
              Notificamos cualquier cambio con 30 días de antelación a través del email de la cuenta OWNER.
            </p>
          </div>
        </div>

        {/* Derechos RGPD */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Tus derechos como Responsable del tratamiento</h2>
          <p className="text-sm text-gray-600 mb-6">Y los derechos que las personas físicas pueden ejercer ante ti.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { letra: "A", title: "Acceso", desc: "Exporta todos los datos de un expediente o de toda tu organización en cualquier momento, en formato CSV + ZIP." },
              { letra: "R", title: "Rectificación", desc: "Edita cualquier dato del expediente. Cada cambio queda en el audit trail con autor y fecha." },
              { letra: "S", title: "Supresión", desc: "Borrado lógico inmediato + purga definitiva tras el periodo de retención configurado por tu organización." },
              { letra: "L", title: "Limitación", desc: "Marca un expediente como 'limitado' cuando hay disputa: solo lectura, sin modificaciones ni exportaciones." },
              { letra: "P", title: "Portabilidad", desc: "Formato CSV estándar, compatible con cualquier otro CRM o software jurídico." },
              { letra: "O", title: "Oposición", desc: "El portal familia permite a los herederos oponerse a tratamientos específicos (notificaciones, marketing)." },
            ].map((d, i) => (
              <div key={i} className="bg-white border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-primary rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                    {d.letra}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">Derecho de {d.title}</h3>
                    <p className="text-sm text-gray-600">{d.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RGPD FAQ */}
        <div className="bg-white border-t">
          <div className="max-w-4xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Preguntas frecuentes sobre privacidad</h2>
            <div className="space-y-4">
              {RGPD_POINTS.map((f, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-2">{f.q}</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white">
            <h2 className="text-xl font-bold mb-3">Contacto del Delegado de Protección de Datos</h2>
            <p className="text-blue-200 text-sm mb-4">
              Para ejercer derechos, reportar un incidente de seguridad o solicitar el DPA firmado, contacta directamente con nuestro DPO.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="mailto:dpo@bariturpro.com" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition">
                dpo@bariturpro.com
              </a>
              <a href="mailto:security@bariturpro.com" className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition">
                Reportar vulnerabilidad
              </a>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-4xl mx-auto px-4 pb-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            Esta página resume nuestras medidas de seguridad y compromisos en materia de privacidad. Los detalles
            jurídicos vinculantes están en el Contrato de Encargo de Tratamiento (DPA) que firmamos con cada cliente
            y en nuestra <Link href="/legal/privacidad" className="text-primary hover:underline">Política de Privacidad</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
