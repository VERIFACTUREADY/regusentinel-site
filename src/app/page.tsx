"use client";

import { useState } from "react";
import Link from "next/link";

const features = [
  {
    title: "Motor de plazos y dependencias",
    desc: "Control automatico de los 15 dias habiles para certificados y 6 meses del ISD. Alertas antes de vencimiento y bloqueos por dependencia documental.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Expedientes con pipeline",
    desc: "Cada caso avanza por fases (Intake, Validacion, En proceso, Pendiente docs, Listo para enviar, Enviado, Seguimiento, Cierre). Trazabilidad completa.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  {
    title: "Paquetes 'listos para banco'",
    desc: "Checklist verificable con requisitos por entidad (certificado de defuncion, ultimas voluntades, aceptacion de herencia). Basado en guias del Banco de Espana.",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    title: "Checklist inteligente por categoria",
    desc: "Tareas auto-generadas por IA: bancos, suministros, telecom, suscripciones, seguros, vida digital, fiscal, Seguridad Social y prestaciones.",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Portal familia con ingesta documental",
    desc: "Link seguro para que la familia suba documentos clasificados automaticamente. Vinculacion automatica documento-tarea y actualizacion de estado.",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    title: "Audit trail y aprobaciones",
    desc: "Registro inmutable de quien aprobo que y cuando. Export del expediente completo (PDF/ZIP) con evidencias para cumplimiento y confianza B2B.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    title: "Reporting operativo y KPIs",
    desc: "Lead time por fase, tareas bloqueadas, tasa de re-trabajo, cumplimiento de plazos criticos (15d/6m). Mide ROI real por expediente.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    title: "Compliance RGPD y LOPDGDD",
    desc: "RAT mantenido, tratamiento post-mortem (art. 3 LO 3/2018), minimizacion de datos, cifrado, DPA con clientes y politica de retencion configurable.",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  },
];

export default function LandingPage() {
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">BARITUR PRO</h1>
          <div className="flex gap-4">
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary">
              Iniciar sesion
            </Link>
            <Link href="/onboarding" className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90">
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">SaaS B2B para gestorias y funerarias</p>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Orquesta la gestion post-fallecimiento tardia
          </h2>
          <p className="text-xl text-gray-600 mb-4 max-w-3xl mx-auto">
            Automatiza el backoffice desde los 15 dias habiles (certificados) hasta los 6 meses (ISD): bancos, prestaciones, activos digitales, suministros y fiscal. Con trazabilidad, aprobaciones y compliance.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            +436.000 defunciones/ano en Espana. Cada una genera decenas de tramites administrativos ante multiples entidades.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#demo" className="inline-block px-8 py-3 bg-primary text-white text-lg rounded-md hover:bg-primary/90">
              Solicitar demo
            </a>
            <a href="#plans" className="inline-block px-8 py-3 border-2 border-primary text-primary text-lg rounded-md hover:bg-blue-50">
              Ver planes
            </a>
          </div>
        </div>
      </section>

      {/* Problem statement */}
      <section className="py-12 bg-amber-50 border-y border-amber-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-lg font-bold text-amber-900 mb-4">El problema que resolvemos</h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-amber-800">
            <div>
              <p className="text-2xl font-bold text-amber-900 mb-1">15 dias habiles</p>
              <p>Espera minima para certificados de ultimas voluntades y seguros de fallecimiento</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-900 mb-1">6 meses</p>
              <p>Plazo para presentar el Impuesto de Sucesiones (Modelo 650), prorrogable bajo condiciones</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-900 mb-1">+20 entidades</p>
              <p>Bancos, SS, AEAT, suministros, telecom, seguros, plataformas digitales por expediente</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-2xl font-bold text-center mb-3">Funcionalidades</h3>
          <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
            Disenado para el backoffice profesional: reglas, plazos, aprobaciones y evidencias. No somos asesoria; somos orquestacion.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-5 border rounded-lg hover:shadow-md transition-shadow">
                <svg className="w-8 h-8 text-primary mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.icon} />
                </svg>
                <h4 className="text-sm font-semibold mb-2">{f.title}</h4>
                <p className="text-gray-600 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-2xl font-bold text-center mb-3">Planes BARITUR PRO</h3>
          <p className="text-center text-gray-500 mb-12">Precio hibrido: base mensual + por expediente. Alineado con tu volumen real.</p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* PRO Starter */}
            <div className="p-6 bg-white border rounded-lg">
              <h4 className="text-lg font-bold">PRO Starter</h4>
              <div className="my-4">
                <p className="text-3xl font-bold">149<span className="text-lg">EUR</span><span className="text-sm font-normal text-gray-500">/mes</span></p>
                <p className="text-sm text-primary font-medium">+ 12EUR/expediente</p>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>2 usuarios</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>15 expedientes/mes incluidos</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Motor de checklist + plazos</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Plantillas base</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Portal familia basico</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Export PDF/ZIP</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Audit trail basico</li>
              </ul>
            </div>

            {/* PRO Growth */}
            <div className="p-6 bg-white border-2 border-primary rounded-lg relative">
              <span className="absolute -top-3 left-4 bg-primary text-white text-xs px-2 py-1 rounded">Recomendado</span>
              <h4 className="text-lg font-bold">PRO Growth</h4>
              <div className="my-4">
                <p className="text-3xl font-bold">399<span className="text-lg">EUR</span><span className="text-sm font-normal text-gray-500">/mes</span></p>
                <p className="text-sm text-primary font-medium">+ 9EUR/expediente</p>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>5 usuarios</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>50 expedientes/mes incluidos</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Reglas avanzadas (bloqueos/dependencias)</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Plantillas versionadas + aprobacion</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Reporting (lead time, bloqueos)</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Roles/permisos completos</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>API/webhooks basicos</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>SLA soporte 24h</li>
              </ul>
            </div>

            {/* PRO Enterprise */}
            <div className="p-6 bg-white border rounded-lg">
              <h4 className="text-lg font-bold">PRO Enterprise</h4>
              <div className="my-4">
                <p className="text-3xl font-bold">A medida</p>
                <p className="text-sm text-gray-500 font-medium">Contactar</p>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Usuarios ilimitados</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>SSO, SCIM, entornos segregados</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>DPA extendido + auditorias</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>SLAs enterprise + soporte prioritario</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Integraciones custom (ERP, firma-e)</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Data residency y retencion a medida</li>
              </ul>
            </div>
          </div>

          {/* MANAGED service */}
          <div className="bg-white border-2 border-gray-800 rounded-lg p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-800 uppercase tracking-wider mb-1">Servicio gestionado</p>
                <h4 className="text-xl font-bold mb-2">BARITUR MANAGED</h4>
                <p className="text-sm text-gray-600 max-w-xl">
                  Operacion administrativa coordinada por expediente: intake guiado, recopilacion documental, preparacion de paquetes (banca/prestaciones), coordinacion de plazos, comunicacion con familia y registro completo de evidencias. Sin asesoria legal/fiscal; derivacion cuando aplique.
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm text-gray-500">Desde</p>
                <p className="text-3xl font-bold">490EUR<span className="text-sm font-normal">/expediente</span></p>
                <p className="text-xs text-gray-500 mt-1">330EUR/exp con 30+/mes</p>
                <a href="#demo" className="inline-block mt-3 px-6 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-700">
                  Solicitar info
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="py-12 border-b">
        <div className="max-w-4xl mx-auto px-4">
          <h3 className="text-lg font-bold text-center mb-8">Pack de fiabilidad para tu empresa</h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <p className="font-semibold mb-1">Cumplimiento RGPD</p>
              <p className="text-xs">RAT mantenido, DPA con clientes, minimizacion de datos, cifrado en transito y reposo</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <p className="font-semibold mb-1">LOPDGDD art. 3</p>
              <p className="text-xs">Marco post-mortem: tratamiento y derechos de datos de personas fallecidas (LO 3/2018)</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="font-semibold mb-1">Evidencias exportables</p>
              <p className="text-xs">Export PDF/ZIP del expediente con trazabilidad: quien aprobo que y cuando. Informe de SLAs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo form */}
      <section id="demo" className="py-16">
        <div className="max-w-xl mx-auto px-4">
          <h3 className="text-2xl font-bold text-center mb-2">Solicitar demo</h3>
          <p className="text-center text-gray-500 mb-8 text-sm">Piloto con 5-10 expedientes reales. Medimos before/after: tiempo, re-trabajo y satisfaccion.</p>
          {sent ? (
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-green-800 font-medium">Solicitud recibida. Nos pondremos en contacto contigo pronto.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Nombre *" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-md" />
              <input type="email" placeholder="Email *" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2 border rounded-md" />
              <input type="text" placeholder="Empresa (gestoria/funeraria/aseguradora)" value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-4 py-2 border rounded-md" />
              <input type="tel" placeholder="Telefono" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2 border rounded-md" />
              <textarea placeholder="Cuantos expedientes post-fallecimiento gestionais al mes?" rows={3} value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-4 py-2 border rounded-md" />
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button type="submit" className="w-full py-3 bg-primary text-white rounded-md hover:bg-primary/90 font-medium">
                Solicitar demo gratuita
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 space-y-2">
          <p className="font-medium text-gray-700">BARITUR no presta asesoramiento juridico ni fiscal. Orquestamos y documentamos; la decision profesional es del gestor.</p>
          <p>Actuamos exclusivamente con autorizacion del familiar/heredero/representante legal.</p>
          <p>El autopiloto prepara acciones; el envio/ejecucion requiere aprobacion profesional.</p>
          <p>Tratamiento de datos conforme al RGPD y la LOPDGDD (LO 3/2018). Marco post-mortem: art. 3.</p>
          <p className="mt-4">&copy; {new Date().getFullYear()} BARITUR PRO. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
