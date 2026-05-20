import type { Metadata } from "next";
import Link from "next/link";
import { GuiaClient } from "./guia-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Qué hacer tras un fallecimiento: guía de trámites paso a paso",
  description:
    "Guía interactiva de los trámites tras la muerte de un familiar: certificados, herencia, Impuesto de Sucesiones, plazos. Plan personalizado y gratuito.",
  keywords: [
    "que hacer cuando muere un familiar",
    "tramites tras fallecimiento",
    "tramites despues de una muerte",
    "papeleo herencia",
    "que hacer tras un fallecimiento",
    "tramites herencia paso a paso",
  ],
  alternates: { canonical: "https://bariturpro.com/guia-fallecimiento" },
  openGraph: {
    title: "Guía de trámites tras un fallecimiento",
    description: "Plan personalizado de trámites con plazos tras la muerte de un familiar.",
    type: "website",
  },
};

export default function GuiaFallecimientoPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Qué hacer tras el fallecimiento de un familiar",
    description:
      "Guía de los trámites administrativos, fiscales y bancarios tras la muerte de un familiar en España.",
    step: [
      { "@type": "HowToStep", name: "Solicitar el Certificado de Defunción", text: "Pide copias en el Registro Civil." },
      { "@type": "HowToStep", name: "Comunicar a bancos y solicitar saldos", text: "Los bancos bloquean las cuentas; pide el certificado de saldos a fecha de fallecimiento." },
      { "@type": "HowToStep", name: "Solicitar Últimas Voluntades y RCSV", text: "Modelo 790-006 tras 15 días hábiles." },
      { "@type": "HowToStep", name: "Aceptar la herencia ante notario", text: "Escritura de aceptación y partición." },
      { "@type": "HowToStep", name: "Presentar el Modelo 650", text: "Impuesto de Sucesiones, plazo de 6 meses." },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="max-w-3xl mx-auto px-4 py-12 sm:py-14">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              Gratis · Sin registro · Plan personalizado
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
              Qué hacer tras el fallecimiento de un familiar
            </h1>
            <p className="text-base sm:text-lg text-blue-100">
              Perder a alguien es duro y el papeleo abruma. Responde 6 preguntas sencillas y te
              generamos un plan personalizado de trámites, ordenado por urgencia y con los plazos legales.
            </p>
          </div>
        </div>

        {/* Interactive guide */}
        <div className="max-w-3xl mx-auto px-4 -mt-6 mb-10 relative z-0">
          <GuiaClient />
        </div>

        {/* Reassurance content */}
        <div className="max-w-3xl mx-auto px-4 pb-12 space-y-8">
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">No tienes que hacerlo todo de golpe</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Los trámites tras un fallecimiento se reparten en el tiempo. Las primeras 72 horas son
              para el certificado de defunción y el sepelio. El papeleo de la herencia y los impuestos
              tiene plazos de semanas y meses.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              El trámite con plazo más estricto es el <strong>Impuesto de Sucesiones (Modelo 650)</strong>:
              6 meses desde el fallecimiento. Es prorrogable otros 6 meses si lo solicitas a tiempo. La
              guía de arriba te dice exactamente cuándo vence cada cosa según la fecha que indiques.
            </p>
          </section>

          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">¿Necesito un gestor o abogado?</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              No es obligatorio, pero en herencias con inmuebles, varios herederos o un negocio,
              un gestor especializado evita errores caros (recargos por presentar fuera de plazo,
              pérdida de bonificaciones autonómicas, valoraciones incorrectas).
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              Para herencias sencillas entre familiares directos (un solo heredero, sin inmuebles complejos),
              muchas personas tramitan ellas mismas con la ayuda de las plantillas y calculadoras gratuitas.
            </p>
          </section>

          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Herramientas gratuitas que te pueden ayudar</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link href="/calculadora-isd" className="block border rounded-lg p-4 hover:border-primary/30 transition">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Calculadora del Impuesto de Sucesiones</h3>
                <p className="text-xs text-gray-600">Estima cuánto se paga según la CCAA y el parentesco.</p>
              </Link>
              <Link href="/borrador-modelo650" className="block border rounded-lg p-4 hover:border-primary/30 transition">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Borrador del Modelo 650</h3>
                <p className="text-xs text-gray-600">Genera un borrador en PDF con los plazos calculados.</p>
              </Link>
              <Link href="/plantillas-documentos" className="block border rounded-lg p-4 hover:border-primary/30 transition">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Plantillas de cartas</h3>
                <p className="text-xs text-gray-600">Carta al banco, a la aseguradora, prórroga del ISD.</p>
              </Link>
              <Link href="/glosario" className="block border rounded-lg p-4 hover:border-primary/30 transition">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Glosario de términos</h3>
                <p className="text-xs text-gray-600">Qué significa cada palabra del papeleo de herencia.</p>
              </Link>
            </div>
          </section>
        </div>

        {/* For professionals */}
        <div className="max-w-3xl mx-auto px-4 pb-16">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
            <h2 className="text-xl font-bold mb-2">¿Eres gestoría o funeraria?</h2>
            <p className="text-blue-200 text-sm mb-5">
              BARITUR PRO automatiza todos estos trámites para tu cartera de expedientes: plazos,
              documentación, portal familia y borradores del Modelo 650.
            </p>
            <Link
              href="/#demo"
              className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm transition"
            >
              Ver BARITUR PRO →
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <p className="text-xs text-gray-500 border-t pt-6">
            <strong>Aviso:</strong> Esta guía es orientativa y general. Los plazos y trámites concretos
            pueden variar según la comunidad autónoma y las circunstancias de cada herencia. No
            constituye asesoramiento jurídico ni fiscal. Para casos complejos consulta con un
            profesional colegiado.
          </p>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
