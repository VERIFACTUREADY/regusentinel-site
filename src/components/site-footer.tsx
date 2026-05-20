import Link from "next/link";

/**
 * Pie de página público compartido — replica el dark footer premium de la
 * landing en el resto del sitio (calculadoras, comparadores, guías, etc.).
 */
export function SiteFooter() {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center">
                <span className="text-white font-bold">B</span>
              </span>
              <span className="text-lg font-bold text-white">BARITUR PRO</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              Software B2B que orquesta la gestión post-fallecimiento para gestorías, funerarias y despachos en España.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-3">Producto</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/precios" className="hover:text-white transition">Precios</Link></li>
              <li><Link href="/comparativa" className="hover:text-white transition">Comparativa</Link></li>
              <li><Link href="/casos-de-uso" className="hover:text-white transition">Casos de uso</Link></li>
              <li><Link href="/calculadora-roi" className="hover:text-white transition">Calculadora ROI</Link></li>
              <li><Link href="/seguridad" className="hover:text-white transition">Seguridad y RGPD</Link></li>
              <li><Link href="/integraciones" className="hover:text-white transition">Integraciones</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-3">Herramientas gratis</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/calculadora-isd" className="hover:text-white transition">Calculadora Sucesiones</Link></li>
              <li><Link href="/calculadora-donaciones" className="hover:text-white transition">Calculadora Donaciones</Link></li>
              <li><Link href="/calculadora-plusvalia" className="hover:text-white transition">Calculadora Plusvalía</Link></li>
              <li><Link href="/coste-herencia" className="hover:text-white transition">Coste de heredar</Link></li>
              <li><Link href="/comparador-isd" className="hover:text-white transition">Comparador CCAA</Link></li>
              <li><Link href="/borrador-modelo650" className="hover:text-white transition">Borrador Modelo 650</Link></li>
              <li><Link href="/plantillas-documentos" className="hover:text-white transition">Plantillas de documentos</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-3">Recursos</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/recursos" className="hover:text-white transition">Hub de recursos</Link></li>
              <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
              <li><Link href="/glosario" className="hover:text-white transition">Glosario ISD</Link></li>
              <li><Link href="/guia-fallecimiento" className="hover:text-white transition">Guía tras fallecimiento</Link></li>
              <li><Link href="/para-gestorias" className="hover:text-white transition">Para gestorías</Link></li>
              <li><Link href="/para-funerarias" className="hover:text-white transition">Para funerarias</Link></li>
              <li><Link href="/docs/api" className="hover:text-white transition">API pública</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-xs space-y-2">
          <p>BARITUR no presta asesoramiento jurídico ni fiscal. Orquestamos y documentamos; la decisión profesional es del gestor.</p>
          <p>Tratamiento de datos conforme al RGPD y la LOPDGDD (LO 3/2018). Marco post-mortem: art. 3.</p>
          <div className="flex flex-wrap items-center gap-4 pt-3">
            <Link href="/legal/privacidad" className="hover:text-white transition">Privacidad</Link>
            <Link href="/legal/terminos" className="hover:text-white transition">Términos</Link>
            <Link href="/legal/cookies" className="hover:text-white transition">Cookies</Link>
            <Link href="/changelog" className="hover:text-white transition">Changelog</Link>
            <span className="ml-auto text-slate-500">&copy; {new Date().getFullYear()} BARITUR PRO. Todos los derechos reservados.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
