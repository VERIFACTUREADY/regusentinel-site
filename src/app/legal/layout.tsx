import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-primary">BARITUR PRO</Link>
          <div className="flex gap-4 items-center text-sm">
            <Link href="/legal/privacidad" className="text-gray-600 hover:text-primary">Privacidad</Link>
            <Link href="/legal/terminos" className="text-gray-600 hover:text-primary">Terminos</Link>
            <Link href="/legal/cookies" className="text-gray-600 hover:text-primary">Cookies</Link>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-12">
        {children}
      </main>
      <footer className="py-8 border-t bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500 space-y-2">
          <p>BARITUR no presta asesoramiento juridico ni fiscal individual.</p>
          <p>
            <Link href="/" className="text-primary hover:underline mr-4">Inicio</Link>
            <Link href="/precios" className="text-primary hover:underline mr-4">Precios</Link>
            <Link href="/login" className="text-primary hover:underline">Acceder</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
