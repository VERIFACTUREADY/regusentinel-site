import { Metadata } from "next";
import Link from "next/link";
import { WidgetSnippet } from "./widget-snippet";

export const metadata: Metadata = {
  title: "Widget gratis: Calculadora del Impuesto de Sucesiones para tu web | BARITUR PRO",
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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ─── Header ───────────────────────────────────────── */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold text-slate-900">
            BARITUR PRO
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/calculadora-isd" className="text-slate-600 hover:text-slate-900">Calculadora</Link>
            <Link href="/precios" className="text-slate-600 hover:text-slate-900">Precios</Link>
            <Link href="/contacto" className="text-slate-600 hover:text-slate-900">Contacto</Link>
            <Link
              href="/login"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800"
            >
              Acceder
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pt-12 pb-6">
        <div className="text-center">
          <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Gratuito · Sin registro · Sin tracking de visitantes
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Añade la Calculadora del ISD a tu web en 1 línea
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Si tu gestoría, funeraria o despacho atiende familias en duelo, el
            widget responde al &quot;¿cuánto se paga por la herencia?&quot; antes
            de que llamen. Captación pasiva, credibilidad reforzada, datos
            oficiales mantenidos por nosotros.
          </p>
        </div>
      </section>

      {/* ─── Snippet + preview ───────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <WidgetSnippet />
      </section>

      {/* ─── Por qué embeber ────────────────────────────────── */}
      <section className="bg-white border-y">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold">1</div>
              <h3 className="mt-3 font-semibold text-slate-900">Captación pasiva</h3>
              <p className="mt-1 text-sm text-slate-600">
                Las familias buscan en Google &quot;cuánto se paga por
                herencia&quot;. Si tu web tiene la respuesta, llegan a ti antes
                que a la competencia.
              </p>
            </div>
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold">2</div>
              <h3 className="mt-3 font-semibold text-slate-900">Datos siempre actualizados</h3>
              <p className="mt-1 text-sm text-slate-600">
                Tarifa estatal y bonificaciones por CCAA mantenidas por nosotros.
                Cuando cambia la normativa, se actualiza automáticamente sin
                tocar tu web.
              </p>
            </div>
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold">3</div>
              <h3 className="mt-3 font-semibold text-slate-900">Credibilidad reforzada</h3>
              <p className="mt-1 text-sm text-slate-600">
                Una calculadora seria dice &quot;sé de qué hablo&quot;. Te
                diferencia de competidores con páginas estáticas y sin
                herramientas útiles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Personalización ─────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold text-slate-900">Parámetros del widget</h2>
        <p className="mt-2 text-sm text-slate-600">
          Personaliza la apariencia añadiendo parámetros a la URL del iframe.
        </p>
        <div className="mt-6 overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Parámetro</th>
                <th className="px-4 py-2">Valores</th>
                <th className="px-4 py-2">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2 font-mono text-blue-700">theme</td>
                <td className="px-4 py-2 font-mono text-slate-600">light · dark</td>
                <td className="px-4 py-2 text-slate-700">Tema visual del widget. Por defecto light.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-blue-700">primary</td>
                <td className="px-4 py-2 font-mono text-slate-600">2563eb (hex sin #)</td>
                <td className="px-4 py-2 text-slate-700">Color principal de botones y resultado.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-blue-700">ccaa</td>
                <td className="px-4 py-2 font-mono text-slate-600">MADRID · ANDALUCIA · ...</td>
                <td className="px-4 py-2 text-slate-700">CCAA preseleccionada al cargar.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-blue-700">compare</td>
                <td className="px-4 py-2 font-mono text-slate-600">0 · 1</td>
                <td className="px-4 py-2 text-slate-700">Mostrar comparativa entre CCAAs (1 por defecto).</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-blue-700">utm_source</td>
                <td className="px-4 py-2 font-mono text-slate-600">tu-dominio</td>
                <td className="px-4 py-2 text-slate-700">Identificador para que sepamos de qué web vienen los clics.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Términos de uso ─────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <h2 className="text-xl font-bold text-slate-900">Términos de uso</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li>· El widget se ofrece <strong>gratis y sin registro</strong>. No requiere cuenta en BARITUR PRO.</li>
          <li>· La atribución <em>&quot;Powered by BARITUR PRO&quot;</em> debe permanecer visible.</li>
          <li>· Los cálculos son orientativos basados en normativa vigente. No constituyen asesoramiento.</li>
          <li>· Nos reservamos el derecho a actualizar tarifas y bonificaciones según evolución legal.</li>
          <li>· Si quieres una versión sin atribución o personalizada, <Link href="/contacto" className="text-blue-600 hover:underline">habla con nosotros</Link>.</li>
        </ul>
      </section>

      {/* ─── CTA ──────────────────────────────────────────── */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold">¿Gestionas herencias profesionalmente?</h2>
          <p className="mt-4 text-slate-300">
            El widget es solo el principio. BARITUR PRO automatiza todo el
            backoffice post-fallecimiento: ISD, certificados, bancos,
            Seguridad Social, prestaciones, portal familia.
          </p>
          <Link
            href="/?source=widget#demo"
            className="mt-8 inline-block rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-500"
          >
            Pedir demo
          </Link>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────── */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>© BARITUR PRO</span>
            <div className="flex gap-4">
              <Link href="/calculadora-isd" className="hover:text-slate-700">Calculadora</Link>
              <Link href="/legal/terminos" className="hover:text-slate-700">Términos</Link>
              <Link href="/legal/privacidad" className="hover:text-slate-700">Privacidad</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
