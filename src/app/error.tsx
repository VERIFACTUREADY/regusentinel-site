"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <p className="text-7xl font-bold text-red-500 mb-4">500</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Algo ha ido mal</h1>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Se ha producido un error inesperado. Nuestro equipo ha sido notificado.
          Puedes intentar de nuevo o volver al inicio.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">Ref: {error.digest}</p>
        )}
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-primary text-white font-medium rounded-md hover:bg-primary/90"
          >
            Intentar de nuevo
          </button>
          <a
            href="/"
            className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
