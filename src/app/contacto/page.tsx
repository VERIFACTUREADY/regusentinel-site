import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contacto — BARITUR PRO",
  description: "Contacta con el equipo de BARITUR PRO. Soporte tecnico, ventas y consultas generales.",
  alternates: { canonical: "https://baritur.pro/contacto" },
};

const contacts = [
  {
    title: "Soporte tecnico",
    email: "soporte@baritur.pro",
    description: "Incidencias, dudas sobre el uso de la plataforma, configuracion de tu cuenta.",
    sla: "Respuesta segun tu plan: 48h (Inicia), 24h (Despacho), prioritario (Firma).",
    icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z",
  },
  {
    title: "Ventas",
    email: "ventas@baritur.pro",
    description: "Preguntas sobre planes, precios, pilotos y descuentos por volumen.",
    sla: "Respuesta en menos de 24h laborables.",
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    title: "Proteccion de datos (DPO)",
    email: "dpo@baritur.pro",
    description: "Ejercicio de derechos RGPD, consultas sobre tratamiento de datos, DPA.",
    sla: "Respuesta en 30 dias naturales (plazo legal).",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
];

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-primary">BARITUR PRO</Link>
          <div className="flex gap-2 sm:gap-4 items-center text-sm">
            <Link href="/precios" className="hidden sm:inline text-gray-600 hover:text-primary">Precios</Link>
            <Link href="/login?demo=1" className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5">
              Probar demo
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Contacto</h1>
        <p className="text-gray-500 mb-10">
          Elige el canal que mejor se adapte a tu consulta. Estamos en horario CET de lunes a viernes.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {contacts.map((c) => (
            <div key={c.email} className="bg-white border rounded-lg p-6">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
                </svg>
              </div>
              <h2 className="font-semibold text-gray-900 mb-1">{c.title}</h2>
              <p className="text-sm text-gray-500 mb-3">{c.description}</p>
              <a
                href={`mailto:${c.email}`}
                className="text-sm text-primary font-medium hover:underline"
              >
                {c.email}
              </a>
              <p className="text-xs text-gray-400 mt-3">{c.sla}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Prefiere una reunion?</h2>
          <p className="text-gray-500 text-sm mb-6">
            20 minutos para ver tu caso, sin compromiso. Vemos tu volumen actual y te recomendamos el plan que tiene sentido.
          </p>
          <Link
            href="/#demo"
            className="inline-block px-8 py-3 bg-primary text-white font-semibold rounded-md hover:bg-primary/90"
          >
            Solicitar reunion
          </Link>
        </div>

        <div className="mt-12 border-t pt-8">
          <h2 className="font-semibold text-gray-900 mb-4">Datos de la empresa</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>BARITUR TECHNOLOGIES S.L.</strong></p>
            <p>Domicilio fiscal en Espana</p>
            <p>Email general: <a href="mailto:info@baritur.pro" className="text-primary hover:underline">info@baritur.pro</a></p>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500 space-x-4">
          <Link href="/" className="text-primary hover:underline">Inicio</Link>
          <Link href="/precios" className="text-primary hover:underline">Precios</Link>
          <Link href="/legal/privacidad" className="text-primary hover:underline">Privacidad</Link>
          <Link href="/legal/terminos" className="text-primary hover:underline">Terminos</Link>
        </div>
      </footer>
    </div>
  );
}
