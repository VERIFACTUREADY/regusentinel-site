"use client";

import { useState } from "react";

interface BulkAnalyzeResult {
  analyzed: number;
  failed: number;
  skipped: number;
  total: number;
}

export function BulkAnalyzeButton({ openCaseCount }: { openCaseCount: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkAnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/cases/bulk-analyze", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al analizar");
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e.message || "Error de red");
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
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={run}
        disabled={loading || openCaseCount === 0}
        className="px-4 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        title={openCaseCount === 0 ? "No hay expedientes abiertos" : `Analizar todos los expedientes abiertos (${openCaseCount})`}
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
            Analizar todos ({openCaseCount})
          </>
        )}
      </button>
    </div>
  );
}
