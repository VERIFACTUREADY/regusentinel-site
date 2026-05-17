"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface ValidationResult {
  valid: number;
  errors: { row: number; field: string; message: string }[];
  total: number;
}

interface ImportResult {
  created: number;
  refs: string[];
}

const TEMPLATE_CSV = `fallecido,contacto,email_contacto,telefono_contacto,provincia,categorias,fecha_fallecimiento,dni_fallecido,parentesco,urgente,notas
"Garcia Lopez, Maria","Perez Garcia, Antonio",antonio@example.com,+34612345678,Madrid,"BANCOS,SEGUROS",2026-04-01,12345678A,Hijo,false,"Caso estandar"
"Fernandez Ruiz, Jose","Fernandez Martin, Laura",laura@example.com,,Barcelona,SUMINISTROS,2026-03-15,87654321B,Hija,true,"Urgente por plazos"`;

export default function ImportCasesPage() {
  const [csv, setCsv] = useState("");
  const [step, setStep] = useState<"input" | "validating" | "validated" | "importing" | "done">("input");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsv(ev.target?.result as string);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  async function handleValidate() {
    setStep("validating");
    setError(null);
    setValidation(null);
    try {
      const res = await fetch("/api/cases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, validate: true }),
      });
      const data = await res.json();
      if (!res.ok && !data.errors) {
        setError(data.error || "Error de validacion");
        setStep("input");
        return;
      }
      setValidation(data);
      setStep("validated");
    } catch {
      setError("Error de conexion");
      setStep("input");
    }
  }

  async function handleImport() {
    setStep("importing");
    setError(null);
    try {
      const res = await fetch("/api/cases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          setValidation(data);
          setStep("validated");
        } else {
          setError(data.error || "Error al importar");
          setStep("validated");
        }
        return;
      }
      setResult(data);
      setStep("done");
    } catch {
      setError("Error de conexion");
      setStep("validated");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-importacion-baritur.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Importar expedientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Importa expedientes en bloque desde un archivo CSV
          </p>
        </div>
        <Link href="/cases" className="text-sm text-primary hover:underline">
          Volver a expedientes
        </Link>
      </div>

      {step === "done" && result ? (
        <div className="bg-white rounded-lg border p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {result.created} expediente{result.created !== 1 ? "s" : ""} importado{result.created !== 1 ? "s" : ""}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Referencias generadas: {result.refs.join(", ")}
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/cases" className="px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90">
                Ver expedientes
              </Link>
              <button
                onClick={() => { setCsv(""); setStep("input"); setResult(null); setValidation(null); }}
                className="px-4 py-2 border text-sm rounded-md hover:bg-gray-50"
              >
                Importar mas
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Instructions */}
          <div className="bg-white rounded-lg border p-6 mb-6">
            <h2 className="font-semibold mb-3">Formato del CSV</h2>
            <p className="text-sm text-gray-600 mb-3">
              El archivo debe tener las siguientes columnas (separadas por coma o punto y coma):
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 pr-3 font-medium text-gray-700">Columna</th>
                    <th className="text-left py-1.5 pr-3 font-medium text-gray-700">Obligatorio</th>
                    <th className="text-left py-1.5 font-medium text-gray-700">Ejemplo</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  {[
                    ["fallecido", "Si", "Garcia Lopez, Maria"],
                    ["contacto", "Si", "Perez Garcia, Antonio"],
                    ["email_contacto", "Email o tel.", "antonio@example.com"],
                    ["telefono_contacto", "Email o tel.", "+34612345678"],
                    ["provincia", "No", "Madrid"],
                    ["categorias", "No", "BANCOS,SEGUROS"],
                    ["fecha_fallecimiento", "No", "2026-04-01"],
                    ["dni_fallecido", "No", "12345678A"],
                    ["parentesco", "No", "Hijo"],
                    ["urgente", "No", "true / si / 1"],
                    ["notas", "No", "Texto libre"],
                  ].map(([col, req, ex]) => (
                    <tr key={col} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-mono">{col}</td>
                      <td className="py-1.5 pr-3">{req}</td>
                      <td className="py-1.5 text-gray-400">{ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={downloadTemplate} className="mt-4 text-sm text-primary hover:underline">
              Descargar plantilla CSV
            </button>
          </div>

          {/* Input area */}
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <label className="inline-block px-4 py-2 bg-primary text-white rounded-md text-sm cursor-pointer hover:bg-primary/90">
                Seleccionar archivo CSV
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
              <span className="text-sm text-gray-400">o pega el contenido directamente</span>
            </div>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={10}
              placeholder={`fallecido,contacto,email_contacto,telefono_contacto,provincia,categorias\n"Garcia Lopez, Maria","Perez Garcia, Antonio",antonio@example.com,+34612345678,Madrid,"BANCOS,SEGUROS"`}
              className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Validation results */}
          {validation && (
            <div className="bg-white rounded-lg border p-6 mb-6">
              <h3 className="font-semibold mb-3">Resultado de validacion</h3>
              <div className="flex gap-4 mb-4">
                <div className="px-4 py-2 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-500">Validos</p>
                  <p className="text-xl font-bold text-green-600">{validation.valid}</p>
                </div>
                <div className="px-4 py-2 bg-red-50 rounded-lg">
                  <p className="text-xs text-gray-500">Con errores</p>
                  <p className="text-xl font-bold text-red-600">{validation.errors.length}</p>
                </div>
                <div className="px-4 py-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Total filas</p>
                  <p className="text-xl font-bold text-gray-600">{validation.total}</p>
                </div>
              </div>
              {validation.errors.length > 0 && (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {validation.errors.map((err, i) => (
                    <div key={i} className="px-4 py-2 text-sm flex gap-3">
                      <span className="text-gray-400 shrink-0">Fila {err.row}</span>
                      <span className="font-mono text-xs text-gray-500 shrink-0">{err.field}</span>
                      <span className="text-red-600">{err.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {step === "input" && (
              <button
                onClick={handleValidate}
                disabled={!csv.trim()}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                Validar CSV
              </button>
            )}
            {step === "validating" && (
              <button disabled className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md opacity-50">
                Validando...
              </button>
            )}
            {step === "validated" && validation && validation.valid > 0 && validation.errors.length === 0 && (
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
              >
                Importar {validation.valid} expediente{validation.valid !== 1 ? "s" : ""}
              </button>
            )}
            {step === "validated" && (
              <button
                onClick={() => { setStep("input"); setValidation(null); setError(null); }}
                className="px-4 py-2 border text-sm rounded-md hover:bg-gray-50"
              >
                Editar CSV
              </button>
            )}
            {step === "importing" && (
              <button disabled className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md opacity-50">
                Importando...
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
