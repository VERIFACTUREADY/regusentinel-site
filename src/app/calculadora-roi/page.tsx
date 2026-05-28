import type { Metadata } from "next";
import Link from "next/link";
import { ROICalculatorClient } from "./roi-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Calculadora ROI: cuánto ahorra tu gestoría con Heredia",
  description:
    "Calcula en 30 segundos cuánto ahorra tu despacho automatizando la gestión de herencias y el ISD. Estimación basada en horas, errores evitados y capacidad recuperada.",
  alternates: { canonical: "https://heredia.app/calculadora-roi" },
  openGraph: {
    title: "Calculadora ROI Heredia",
    description: "Cuánto ahorra tu gestoría automatizando expedientes de herencia",
    type: "website",
  },
};

export default function ROIPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="absolute inset-0 dot-grid-light opacity-30" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-400/25 rounded-full blur-3xl animate-float" />
        <div className="relative max-w-4xl mx-auto px-4 py-12 sm:py-14">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 mb-4">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
            Estimación instantánea · Sin registro
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Cuánto ahorra tu gestoría con Heredia
          </h1>
          <p className="text-base text-blue-100 max-w-2xl">
            Introduce tus datos reales y estima en segundos las horas, los errores y los recargos
            que te ahorrarías al automatizar la tramitación post-mortem.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 mb-10 relative z-0">
        <ROICalculatorClient />
      </div>

      {/* Methodology */}
      <div className="max-w-3xl mx-auto px-4 pb-12 space-y-8">
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Metodología del cálculo</h2>
          <p className="text-sm text-gray-700 mb-4">
            La estimación se basa en tres ejes de ahorro, todos con cifras conservadoras:
          </p>
          <ol className="space-y-3 text-sm text-gray-700 list-decimal pl-5">
            <li>
              <strong>Horas administrativas evitadas:</strong> el 30% del tiempo dedicado a tareas repetitivas
              (recordatorios, plazos, redacción de mails, seguimiento documental, generación de borradores)
              se elimina al automatizarlas. El resto del expediente sigue siendo trabajo interpretativo
              legal/fiscal. Aplicamos el coste/hora declarado.
            </li>
            <li>
              <strong>Errores evitados:</strong> 1 error costoso por cada 50 expedientes (recargos del 5-20%
              por presentación tardía, pérdida de bonificación autonómica, reclamaciones del cliente),
              con coste medio de 1.200 € (≈10% sobre una cuota ISD típica de 12.000 € + intereses).
            </li>
            <li>
              <strong>Capacidad recuperada:</strong> las horas liberadas se convierten en expedientes
              adicionales que tu equipo puede facturar con la misma plantilla.
            </li>
          </ol>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-amber-900 mb-3">Cuidado con las estimaciones</h2>
          <p className="text-sm text-amber-900">
            Esta calculadora es orientativa. El ROI real depende de la complejidad de tus
            expedientes, la madurez de tus procesos previos y el grado de adopción de tu equipo.
            Despachos que partían de hojas de cálculo suelen ver ahorros mayores; despachos con
            sistema dedicado previo, menores. La cifra de errores asume despachos con buenas
            prácticas; los datos de errores graves no son públicos.
          </p>
        </section>

        <section className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 text-white text-center">
          <h2 className="text-xl font-bold mb-2">Convéncete con tus datos</h2>
          <p className="text-blue-200 mb-5 text-sm">
            14 días gratis. Crea tu primer expediente en 60 segundos y mide tú mismo.
          </p>
          <Link
            href="/#demo"
            className="inline-block px-7 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition"
          >
            Probar Heredia →
          </Link>
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}
