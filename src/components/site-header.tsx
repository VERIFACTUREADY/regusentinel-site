import Link from "next/link";
import { HerediaMark } from "./heredia-mark";

/**
 * Cabecera pública compartida — aspecto premium y consistente en todas
 * las páginas de marketing y herramientas (logo de marca, blur de fondo).
 */
export function SiteHeader({ cta = "Probar gratis" }: { cta?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <HerediaMark className="w-9 h-9" />
          <span className="text-lg font-semibold text-slate-900 tracking-tight">Heredia</span>
        </Link>
        <nav className="flex gap-1 sm:gap-2 items-center text-sm">
          <Link href="/asi-funciona" className="hidden md:inline px-3 py-2 font-medium text-slate-600 hover:text-primary transition">Cómo funciona</Link>
          <Link href="/recursos" className="hidden sm:inline px-3 py-2 font-medium text-slate-600 hover:text-primary transition">Recursos</Link>
          <Link href="/blog" className="hidden lg:inline px-3 py-2 font-medium text-slate-600 hover:text-primary transition">Blog</Link>
          <Link href="/precios" className="hidden sm:inline px-3 py-2 font-medium text-slate-600 hover:text-primary transition">Precios</Link>
          <Link
            href="/#demo"
            className="px-4 py-2 font-semibold bg-primary text-white rounded-lg shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
          >
            {cta}
          </Link>
        </nav>
      </div>
    </header>
  );
}
