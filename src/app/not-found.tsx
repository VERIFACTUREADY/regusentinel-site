import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <p className="text-7xl font-bold text-primary mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagina no encontrada</h1>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          La pagina que buscas no existe o ha sido movida. Comprueba la URL o vuelve al inicio.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-2 bg-primary text-white font-medium rounded-md hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
