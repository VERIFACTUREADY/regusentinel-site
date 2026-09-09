/**
 * Piezas para representar un fallo de consulta SIN tumbar la pantalla entera.
 *
 * Son componentes de servidor: los dos paneles se renderizan en el servidor y
 * el fallo ya se conoce en ese momento, así que no hace falta ni estado ni
 * JavaScript en el cliente.
 *
 * Todas llevan `role="alert"` y un `data-testid` estable para que las pruebas
 * de navegador puedan afirmar dos cosas a la vez: que el aviso SÍ aparece y
 * que el falso cero o el falso estado vacío NO.
 */

/** Aviso de que un bloque entero no se ha podido cargar. */
export function BloqueFallido({
  que,
  id,
  detalle,
}: {
  /** Qué no se ha podido cargar, en palabras del usuario. */
  que: string;
  /** Sufijo del `data-testid`, para poder señalar el bloque concreto. */
  id: string;
  detalle?: string;
}) {
  return (
    <div
      role="alert"
      data-testid={`fallo-${id}`}
      className="bg-white border border-red-200 rounded-xl p-5"
    >
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.5 0l-7.1 12.25A2 2 0 004.99 19z"
          />
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">
            No se han podido cargar {que}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Esto no significa que no haya ninguno: la consulta ha fallado y el
            dato no se conoce.
          </p>
          {detalle && (
            <p className="text-xs text-gray-400 mt-1 break-words">{detalle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Indicador numérico que sabe decir «no lo sé».
 *
 * Cuando la consulta falla se pinta «—», nunca «0». El guion largo va
 * acompañado de texto para lectores de pantalla, porque un guion suelto no
 * dice nada al oído.
 */
export function Kpi({
  etiqueta,
  valor,
  color,
  id,
}: {
  etiqueta: string;
  /** `null` significa exactamente «la consulta ha fallado». */
  valor: number | null;
  color: string;
  id: string;
}) {
  const fallo = valor === null;
  return (
    <div
      data-testid={`kpi-${id}`}
      className={`bg-white p-4 rounded-lg border ${fallo ? "border-red-200" : ""}`}
    >
      <p className="text-xs text-gray-500">{etiqueta}</p>
      {fallo ? (
        <p
          role="alert"
          data-testid={`kpi-fallo-${id}`}
          className="text-2xl font-bold mt-1 text-gray-400"
          title="No se ha podido consultar"
        >
          <span aria-hidden="true">—</span>
          <span className="sr-only">No se ha podido consultar</span>
        </p>
      ) : (
        // Asidero propio para la cifra: permite afirmar el valor EXACTO. Con
        // `toContainText` sobre la tarjeta entera, un «9» tambien casaria con
        // «90» y un «1» con «10».
        <p data-testid={`kpi-valor-${id}`} className={`text-2xl font-bold mt-1 ${color}`}>
          {valor}
        </p>
      )}
    </div>
  );
}

/**
 * Franja que enumera los bloques caídos.
 *
 * Va arriba del todo para que nadie interprete el resto de la pantalla como
 * una foto completa de su despacho.
 */
export function AvisoDatosIncompletos({ bloques }: { bloques: string[] }) {
  if (bloques.length === 0) return null;
  const uno = bloques.length === 1;
  return (
    <div
      role="alert"
      data-testid="aviso-datos-incompletos"
      className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      <p className="text-sm font-semibold text-amber-900">
        Esta pantalla está incompleta
      </p>
      <p className="text-sm text-amber-800 mt-1">
        {uno ? "No se ha podido cargar: " : "No se han podido cargar: "}
        {bloques.join(", ")}. Lo que falta no aparece como cero ni como vacío;
        simplemente no se conoce. Vuelve a cargar la página para reintentarlo.
      </p>
    </div>
  );
}
