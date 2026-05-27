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
"Garcia Lopez, Maria","Perez Garcia, Antonio",antonio@example.com,+34612345678,Madrid,"BANCOS,SEGUROS",2026-04-01,12345678A,Hijo,false,"Caso estándar"
"Fernandez Ruiz, Jose","Fernandez Martin, Laura",laura@example.com,,Barcelona,SUMINISTROS,2026-03-15,87654321B,Hija,true,"Urgente por plazos"`;

type Payload =
  | { kind: "csv"; csv: string }
  | { kind: "xlsx"; base64: string };

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export default function ImportCasesPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [csvPreview, setCsvPreview] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [step, setStep] = useState<"input" | "validating" | "validated" | "importing" | "done">("input");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    setError(null);
    setFileName(file.name);
    setValidation(null);

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer | null;
        if (!buffer) {
          setError("No se pudo leer el archivo Excel.");
          return;
        }
        const base64 = arrayBufferToBase64(buffer);
        setPayload({ kind: "xlsx", base64 });
        setCsvPreview("");
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const csv = (ev.target?.result as string | null) ?? "";
        setPayload({ kind: "csv", csv });
        setCsvPreview(csv);
      };
      reader.readAsText(file, "utf-8");
    }
    e.target.value = "";
  }

  function handleTextarea(csv: string) {
    setCsvPreview(csv);
    setPayload(csv.trim() ? { kind: "csv", csv } : null);
    setFileName(null);
    setValidation(null);
  }

  function payloadBody(extra: object = {}): string {
    if (!payload) return JSON.stringify(extra);
    return JSON.stringify(
      payload.kind === "csv"
        ? { csv: payload.csv, ...extra }
        : { xlsx: payload.base64, ...extra },
    );
  }

  async function handleValidate() {
    setStep("validating");
    setError(null);
    setValidation(null);
    try {
      const res = await fetch("/api/cases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadBody({ validate: true }),
      });
      const data = await res.json();
      if (!res.ok && !data.errors) {
        setError(data.error || "Error de validación");
        setStep("input");
        return;
      }
      setValidation(data);
      setStep("validated");
    } catch {
      setError("Error de conexión");
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
        body: payloadBody(),
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
      setError("Error de conexión");
      setStep("validated");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-importacion-heredia.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  const canValidate = payload !== null && (payload.kind === "xlsx" || (payload.kind === "csv" && payload.csv.trim().length > 0));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Importar expedientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Importa expedientes en bloque desde un archivo Excel (.xlsx) o CSV
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
                onClick={() => {
                  setPayload(null);
                  setCsvPreview("");
                  setFileName(null);
                  setStep("input");
                  setResult(null);
                  setValidation(null);
                }}
                className="px-4 py-2 border text-sm rounded-md hover:bg-gray-50"
              >
                Importar más
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Instructions */}
          <div className="bg-white rounded-lg border p-6 mb-6">
            <h2 className="font-semibold mb-3">Formato del archivo</h2>
            <p className="text-sm text-gray-600 mb-3">
              Acepta <strong>.xlsx</strong>, <strong>.xls</strong> y <strong>.csv</strong>.
              La primera fila debe tener las cabeceras (separadas por coma o punto y coma si es CSV).
              Sólo se lee la primera hoja del Excel.
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
                    ["fallecido", "Sí", "García López, María"],
                    ["contacto", "Sí", "Pérez García, Antonio"],
                    ["email_contacto", "Email o tel.", "antonio@example.com"],
                    ["telefono_contacto", "Email o tel.", "+34612345678"],
                    ["provincia", "No", "Madrid"],
                    ["categorias", "No", "BANCOS,SEGUROS"],
                    ["fecha_fallecimiento", "No", "2026-04-01"],
                    ["dni_fallecido", "No", "12345678A"],
                    ["parentesco", "No", "Hijo"],
                    ["urgente", "No", "true / sí / 1"],
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
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <label className="inline-block px-4 py-2 bg-primary text-white rounded-md text-sm cursor-pointer hover:bg-primary/90">
                Seleccionar archivo
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <span className="text-sm text-gray-400">o pega el contenido CSV abajo</span>
              {fileName && (
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded inline-flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {fileName}
                </span>
              )}
            </div>
            {payload?.kind === "xlsx" ? (
              <div className="border rounded-md bg-slate-50 px-3 py-6 text-sm text-slate-500 text-center">
                Archivo Excel listo. <strong>Validar</strong> para revisar las filas que se importarán.
              </div>
            ) : (
              <textarea
                value={csvPreview}
                onChange={(e) => handleTextarea(e.target.value)}
                rows={10}
                placeholder={`fallecido,contacto,email_contacto,telefono_contacto,provincia,categorias\n"García López, María","Pérez García, Antonio",antonio@example.com,+34612345678,Madrid,"BANCOS,SEGUROS"`}
                className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Validation results */}
          {validation && (
            <div className="bg-white rounded-lg border p-6 mb-6">
              <h3 className="font-semibold mb-3">Resultado de validación</h3>
              <div className="flex gap-4 mb-4">
                <div className="px-4 py-2 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-500">Válidos</p>
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
                disabled={!canValidate}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                Validar archivo
              </button>
            )}
            {step === "validating" && (
              <button disabled className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md opacity-50">
                Validando…
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
                onClick={() => {
                  setStep("input");
                  setValidation(null);
                  setError(null);
                }}
                className="px-4 py-2 border text-sm rounded-md hover:bg-gray-50"
              >
                Editar
              </button>
            )}
            {step === "importing" && (
              <button disabled className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md opacity-50">
                Importando…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
