import Link from "next/link";
import { Reveal } from "@/components/reveal";

/**
 * Bloque reutilizable que separa con nitidez la herramienta GRATUITA del
 * producto de pago. Aparece al pie de cada herramienta pública: capta al
 * visitante y deja clarísimo qué se obtiene pagando.
 */
export function ProUpsell({
  freeToolName = "Esta herramienta gratuita",
  freeToolDesc = "responde una pregunta puntual y hay que introducir los datos a mano cada vez.",
}: {
  freeToolName?: string;
  freeToolDesc?: string;
}) {
  return (
    <Reveal>
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="absolute -top-20 right-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 -left-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-10">
          <span className="inline-block rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-blue-200 px-3 py-1 mb-3">
            Para gestorías, funerarias y despachos
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            ¿Tramitas herencias profesionalmente?
          </h2>
          <p className="mt-3 text-slate-300 max-w-xl mx-auto">
            Las herramientas gratuitas son una probada. El trabajo real lo hace Heredia.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Gratis */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Herramienta gratuita</p>
            <p className="text-sm text-slate-300 mb-4">
              {freeToolName} {freeToolDesc}
            </p>
            <ul className="space-y-2">
              {[
                "Cálculo puntual, sin guardar nada",
                "Datos introducidos a mano cada vez",
                "Sin expediente, sin plazos, sin equipo",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                  </svg>
                  {x}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border border-indigo-400/30 bg-gradient-to-b from-indigo-500/15 to-transparent p-6 ring-1 ring-inset ring-white/5">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-3">Heredia · el producto</p>
            <p className="text-sm text-slate-200 mb-4">
              Toda la operación de cada herencia, automatizada y bajo control.
            </p>
            <ul className="space-y-2">
              {[
                "Cálculo automático desde cada expediente",
                "Radar ISD: ningún plazo se escapa",
                "Borradores y cartas autocompletados",
                "Portal familia, equipo y audit trail",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2 text-sm text-slate-100">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/#demo"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-primary text-base font-bold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Probar Heredia · 14 días gratis
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="/precios"
            className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 border border-white/15 text-white text-base font-semibold rounded-xl hover:bg-white/20 transition-all"
          >
            Ver planes y precios
          </Link>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">Sin tarjeta · sin permanencia · setup en 30 minutos</p>
      </div>
    </section>
    </Reveal>
  );
}
