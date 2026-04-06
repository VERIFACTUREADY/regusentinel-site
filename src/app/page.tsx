"use client";

import { useState } from "react";
import Link from "next/link";

const features = [
  { title: "Expedientes", desc: "Gestiona cada caso con pipeline completo de estados, desde intake hasta cierre." },
  { title: "Checklist automatico", desc: "Genera tareas automaticamente segun el tipo de gestiones: bancos, suministros, telecom..." },
  { title: "Portal familia", desc: "Link seguro para que la familia suba documentos y consulte el estado de su expediente." },
  { title: "Plantillas", desc: "Biblioteca de plantillas pre-aprobadas para comunicaciones con bancos, administraciones y mas." },
  { title: "Autopiloto IA", desc: "Genera borradores y checklists con IA. Siempre con aprobacion profesional antes de enviar." },
  { title: "Reporting y dossier", desc: "Exporta dossier final en PDF/ZIP con toda la documentacion y trazabilidad del expediente." },
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
      <header className="border-b">
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
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Gestion administrativa post-fallecimiento
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Software SaaS para gestorias y funerarias que automatiza y orquesta toda la gestion administrativa tras un fallecimiento.
          </p>
          <a href="#demo" className="inline-block px-8 py-3 bg-primary text-white text-lg rounded-md hover:bg-primary/90">
            Solicitar demo
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-2xl font-bold text-center mb-12">Funcionalidades principales</h3>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title} className="p-6 border rounded-lg hover:shadow-md transition-shadow">
                <h4 className="text-lg font-semibold mb-2">{f.title}</h4>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-2xl font-bold text-center mb-12">Planes</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-white border rounded-lg">
              <h4 className="text-lg font-bold">Starter</h4>
              <p className="text-3xl font-bold my-4">49EUR<span className="text-sm font-normal">/mes</span></p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>1-3 usuarios</li>
                <li>10 expedientes/mes incluidos</li>
                <li>Checklist + plantillas base</li>
                <li>Portal familia</li>
                <li>Export basico</li>
              </ul>
            </div>
            <div className="p-6 bg-white border-2 border-primary rounded-lg relative">
              <span className="absolute -top-3 left-4 bg-primary text-white text-xs px-2 py-1 rounded">Popular</span>
              <h4 className="text-lg font-bold">Pro</h4>
              <p className="text-3xl font-bold my-4">149EUR<span className="text-sm font-normal">/mes</span></p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>Hasta 10 usuarios</li>
                <li>Expedientes ilimitados</li>
                <li>Templates personalizados</li>
                <li>IA Autopilot completo</li>
                <li>Reporting avanzado</li>
              </ul>
            </div>
            <div className="p-6 bg-white border rounded-lg">
              <h4 className="text-lg font-bold">Enterprise</h4>
              <p className="text-3xl font-bold my-4">A medida</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>Usuarios ilimitados</li>
                <li>SLA personalizado</li>
                <li>Integraciones custom</li>
                <li>Soporte prioritario</li>
                <li>BARITUR Managed disponible</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Demo form */}
      <section id="demo" className="py-16">
        <div className="max-w-xl mx-auto px-4">
          <h3 className="text-2xl font-bold text-center mb-8">Solicitar demo</h3>
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
              <input type="text" placeholder="Empresa" value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-4 py-2 border rounded-md" />
              <input type="tel" placeholder="Telefono" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2 border rounded-md" />
              <textarea placeholder="Mensaje" rows={3} value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-4 py-2 border rounded-md" />
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button type="submit" className="w-full py-3 bg-primary text-white rounded-md hover:bg-primary/90 font-medium">
                Enviar solicitud
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 space-y-2">
          <p>BARITUR no presta asesoramiento juridico ni fiscal individual.</p>
          <p>Actuamos con autorizacion del familiar/heredero/representante.</p>
          <p>El autopiloto prepara acciones; el envio/ejecucion requiere aprobacion profesional.</p>
          <p className="mt-4">&copy; {new Date().getFullYear()} BARITUR PRO. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
