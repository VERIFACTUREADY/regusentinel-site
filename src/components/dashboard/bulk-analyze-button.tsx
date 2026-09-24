"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BulkAnalyzeResult {
  analyzed: number;
  failed: number;
  skipped: number;
  total: number;
}

/**
 * `openCaseCount` es `null` cuando la consulta del contador ha fallado: no se
 * sabe cuántos expedientes abiertos hay. El botón se inhabilita, igual que con
 * cero, pero el rótulo lo dice en vez de anunciar «Analizar todos (0)».
 */
export function BulkAnalyzeButton({ openCaseCount }: { openCaseCount: number | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkAnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const desconocido = openCaseCount === null;
  const sinExpedientes = openCaseCount === 0;

  async function run() {
    if (loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/cases/bulk-analyze", { method: "POST" });
      /*
       * EL DEFECTO QUE CORRIGE
       * ----------------------
       * Antes era `const data = await res.json()` ANTES de mirar `res.ok`. Con
       * una respuesta que no fuera JSON —un 502 del proxy con HTML, un 401 que
       * redirige al login— `res.json()` lanzaba y el usuario veía como aviso
       * «Unexpected token '<', "<!DOCTYPE"... is not valid JSON», que no
       * significa nada para nadie. Ahora se mira el estado primero y el cuerpo
       * se lee con red de seguridad.
       */
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          cuerpo?.error ??
            (res.status === 403
              ? "No tienes permiso para lanzar el analisis."
              : `El servidor ha respondido ${res.status}.`),
        );
        return;
      }
      if (!cuerpo || typeof cuerpo.analyzed !== "number") {
        setError("La respuesta del servidor no tiene el formato esperado.");
        return;
      }
      setResult(cuerpo);
      /*
       * Sin esto, los contadores de «Insights IA» y el score medio se quedaban
       * con los valores de antes del analisis: el boton decia «12 analizados»
       * y el panel de al lado seguia marcando 0. `refresh()` vuelve a pedir el
       * componente de servidor y los numeros cuadran.
       */
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>
            {result.analyzed} analizados
            {result.failed > 0 && <span className="text-orange-600 ml-2">{result.failed} errores</span>}
            {result.skipped > 0 && <span className="text-gray-400 ml-2">{result.skipped} recientes (omitidos)</span>}
          </span>
        </div>
        <button
          onClick={() => setResult(null)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Ejecutar de nuevo
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {error && (
        <span role="alert" data-testid="error-analisis-masivo" className="text-xs text-red-600">
          {error}
        </span>
      )}
      <button
        onClick={run}
        disabled={loading || sinExpedientes || desconocido}
        data-testid="boton-analisis-masivo"
        className="px-4 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        title={
          desconocido
            ? "No se ha podido consultar cuantos expedientes abiertos hay"
            : sinExpedientes
              ? "No hay expedientes abiertos"
              : `Analizar todos los expedientes abiertos (${openCaseCount})`
        }
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analizando...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {desconocido ? "Analizar todos (—)" : `Analizar todos (${openCaseCount})`}
          </>
        )}
      </button>
    </div>
  );
}
