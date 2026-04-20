"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90"
    >
      Imprimir / Guardar PDF
    </button>
  );
}
