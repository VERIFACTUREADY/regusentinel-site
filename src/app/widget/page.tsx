import { Metadata } from "next";
import Link from "next/link";
import { WidgetSnippet } from "./widget-snippet";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Widget gratis: Calculadora del Impuesto de Sucesiones para tu web | Heredia",
  description:
    "Embebe gratis la calculadora del Impuesto de Sucesiones (Modelo 650) en la web de tu gestoría, funeraria o despacho. Datos oficiales, las 17 CCAAs, sin registro. Personalizable y responsive.",
  alternates: { canonical: "/widget" },
  openGraph: {
    title: "Widget gratuito de Calculadora ISD para gestorías y funerarias",
    description:
      "Captación pasiva: la calculadora ISD en tu web atrae familias buscando información sobre el Modelo 650. Gratis y embebible en 1 línea de HTML.",
    type: "website",
    locale: "es_ES",
  },
};

export default function WidgetPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="absolute inset-0 dot-grid-light opacity-30" />
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-indigo-500/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl animate-float" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-200 mb-5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
            Gratuito · Sin registro · Sin tracking de visitantes
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight tracking-tight">
            Añade la Calculadora del ISD
            <br className="hidden sm:block" />
            <span className="text-blue-300"> a tu web en 1 línea de código</span>
          </h1>
          <p className="text-lg text-blue-100 max-w-3xl">
            Si tu gestoría, funeraria o despacho atiende familias en duelo, el widget
            responde al "¿cuánto se paga por la herencia?" antes de que llamen.
            Captación pasiva, credibilidad reforzada, datos oficiales mantenidos por
            nosotros.
          </p>
        </div>
      </div>

      {/* Snippet + preview */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <WidgetSnippet />
      </section>

      {/* Por qué embeber */}
      <section className="bg-white border-y">
        <div className="max-w-5xl mx-auto px-4 py-14">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                num: "1",
                title: "Captación pasiva",
                body:
                  "Las familias buscan en Google 'cuánto se paga por herencia'. Si tu web tiene la respuesta, llegan a ti antes que a la competencia.",
              },
              {
                num: "2",
                title: "Datos siempre actualizados",
                body:
                  "Tarifa estatal y bonificaciones por CCAA mantenidas por nosotros. Cuando cambia la normativa, se actualiza automáticamente sin tocar tu web.",
              },
              {
                num: "3",
                title: "Credibilidad reforzada",
                body:
                  "Una calculadora seria dice 'sé de qué hablo'. Te diferencia de competidores con páginas estáticas y sin herramientas útiles.",
              },
            ].map((b) => (
              <div key={b.num} className="card-lift bg-white border rounded-2xl p-6">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/25 mb-4">
                  {b.num}
                </div>
                <h3 className="font-bold text-slate-900 mb-1.5">{b.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Personalización */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Parámetros del widget</h2>
        <p className="mt-2 text-sm text-slate-600">
          Personaliza la apariencia añadiendo parámetros a la URL del iframe.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3">Parámetro</th>
                <th className="px-4 py-3">Valores</th>
                <th className="px-4 py-3">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-3 font-mono text-blue-700">theme</td>
                <td className="px-4 py-3 font-mono text-slate-600">light · dark</td>
                <td className="px-4 py-3 text-slate-700">Tema visual del widget. Por defecto light.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-blue-700">primary</td>
                <td className="px-4 py-3 font-mono text-slate-600">2563eb (hex sin #)</td>
                <td className="px-4 py-3 text-slate-700">Color principal de botones y resultado.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-blue-700">ccaa</td>
                <td className="px-4 py-3 font-mono text-slate-600">MADRID · ANDALUCIA · …</td>
                <td className="px-4 py-3 text-slate-700">CCAA preseleccionada al cargar.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-blue-700">compare</td>
                <td className="px-4 py-3 font-mono text-slate-600">0 · 1</td>
                <td className="px-4 py-3 text-slate-700">Mostrar comparativa entre CCAAs (1 por defecto).</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-blue-700">utm_source</td>
                <td className="px-4 py-3 font-mono text-slate-600">tu-dominio</td>
                <td className="px-4 py-3 text-slate-700">Identificador para que sepamos de qué web vienen los clics.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Términos de uso */}
      <section className="max-w-3xl mx-auto px-4 pb-14">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Términos de uso</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li>· El widget se ofrece <strong>gratis y sin registro</strong>. No requiere cuenta en Heredia.</li>
          <li>· La atribución <em>"Powered by Heredia"</em> debe permanecer visible.</li>
          <li>· Los cálculos son orientativos basados en normativa vigente. No constituyen asesoramiento.</li>
          <li>· Nos reservamos el derecho a actualizar tarifas y bonificaciones según evolución legal.</li>
          <li>· Si quieres una versión sin atribución o personalizada, <Link href="/contacto" className="text-primary hover:underline">habla con nosotros</Link>.</li>
        </ul>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white p-8 sm:p-12">
          <div className="absolute -top-20 right-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-16 w-64 h-64 bg-emerald-400/15 rounded-full blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
              ¿Gestionas herencias profesionalmente?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base mb-6">
              El widget es solo el principio. Heredia automatiza todo el
              backoffice post-fallecimiento: ISD, certificados, bancos,
              Seguridad Social, prestaciones, portal familia.
            </p>
            <Link
              href="/?source=widget#demo"
              className="inline-block px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all text-sm"
            >
              Pedir demo →
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
