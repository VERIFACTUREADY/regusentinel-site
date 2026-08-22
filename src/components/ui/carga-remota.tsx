"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carga de datos con los cuatro estados que una pantalla necesita.
 *
 * EL DEFECTO QUE ESTO CIERRA
 * ---------------------------
 * Catorce pantallas cargaban asi:
 *
 *     fetch(url).then(r => r.json()).then(setDatos).catch(() => {});
 *
 * Con la peticion caida —sesion caducada, 500, red— los datos se quedaban
 * vacios y la pantalla mostraba su estado vacio: "No hay expedientes", "Sin
 * tareas", una lista en blanco. Indistinguible de que de verdad no hubiera
 * nada, y significando lo contrario. El usuario cerraba tranquilo una pantalla
 * que le estaba ocultando su trabajo.
 *
 * Ademas `r.json()` sin mirar `r.ok`: un 401 o un 500 con cuerpo JSON pasaba
 * por bueno y dejaba la estructura sin definir, con el mismo resultado.
 *
 * Se centraliza porque el fallo era identico en las catorce: repetir la
 * correccion a mano garantiza que la proxima pantalla vuelva a nacer rota.
 */

export type EstadoCarga = "cargando" | "listo" | "error";

export interface CargaRemota<T> {
  datos: T | null;
  estado: EstadoCarga;
  error: string | null;
  /** Vuelve a pedir los datos. Es lo que engancha el boton Reintentar. */
  reintentar: () => void;
}

interface Opciones<T> {
  /** Se ejecuta sobre el cuerpo ya convertido; sirve para validar la forma. */
  validar?: (datos: unknown) => datos is T;
  /** Dependencias que obligan a recargar (filtros, pagina...). */
  deps?: unknown[];
}

export function useCargaRemota<T>(url: string, opciones: Opciones<T> = {}): CargaRemota<T> {
  const { validar } = opciones;
  const deps = opciones.deps ?? [];

  const [datos, setDatos] = useState<T | null>(null);
  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  // Se guarda en ref para no recrear el efecto cuando cambia la funcion.
  const validarRef = useRef(validar);
  validarRef.current = validar;

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setEstado("cargando");
    setError(null);

    fetch(url, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 401
              ? "Tu sesion ha caducado. Vuelve a entrar."
              : r.status === 403
                ? "No tienes permiso para ver esto."
                : `El servidor ha respondido ${r.status}.`,
          );
        }
        return r.json();
      })
      .then((cuerpo: unknown) => {
        if (validarRef.current && !validarRef.current(cuerpo)) {
          throw new Error("La respuesta del servidor no tiene el formato esperado.");
        }
        setDatos(cuerpo as T);
        setEstado("listo");
      })
      .catch((e: unknown) => {
        // Cambiar de filtro rapido aborta la peticion anterior: eso no es un
        // error que deba ensenarse al usuario.
        if (e instanceof DOMException && e.name === "AbortError") return;
        setDatos(null);
        setError(e instanceof Error ? e.message : "No se han podido cargar los datos.");
        setEstado("error");
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intento, ...deps]);

  return { datos, estado, error, reintentar };
}

/**
 * Aviso de fallo, con Reintentar.
 *
 * `data-testid="carga-error"` es el asidero de las pruebas: comprueban que
 * ESTO aparece, y que el estado vacio NO, porque confundirlos es justo el
 * defecto que se esta corrigiendo.
 */
export function AvisoError({
  mensaje,
  onReintentar,
  que = "los datos",
}: {
  mensaje: string;
  onReintentar: () => void;
  /** Que no se ha podido cargar, para que el aviso no sea generico. */
  que?: string;
}) {
  return (
    <div
      role="alert"
      data-testid="carga-error"
      className="border border-red-200 bg-white rounded-lg p-6 text-center"
    >
      <svg
        className="w-8 h-8 text-red-500 mx-auto mb-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.5 0l-7.1 12.25A2 2 0 004.99 19z"
        />
      </svg>
      <p className="text-sm font-medium text-gray-900">No se han podido cargar {que}</p>
      <p className="text-xs text-gray-500 mt-1">{mensaje}</p>
      <p className="text-xs text-gray-400 mt-1">
        Puede haber informacion que no se este mostrando.
      </p>
      <button
        onClick={onReintentar}
        className="mt-3 text-sm bg-primary text-white rounded-md px-4 py-1.5 hover:opacity-90 transition"
      >
        Reintentar
      </button>
    </div>
  );
}

/** Indicador de carga con asidero propio para las pruebas. */
export function Cargando({ que = "" }: { que?: string }) {
  return (
    <div data-testid="carga-cargando" className="py-10 text-center text-sm text-gray-400">
      Cargando{que ? ` ${que}` : ""}...
    </div>
  );
}

/**
 * Estado vacio.
 *
 * Solo debe pintarse cuando la carga ha ido BIEN y no hay nada. Nunca como
 * consecuencia de un fallo: esa confusion es el defecto original.
 */
export function EstadoVacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string;
  detalle?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div data-testid="carga-vacio" className="border bg-white rounded-lg p-8 text-center">
      <p className="text-sm text-gray-600">{titulo}</p>
      {detalle && <p className="text-xs text-gray-400 mt-1">{detalle}</p>}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}

/**
 * Convierte un error capturado en un mensaje que se le puede enseñar a una
 * persona.
 *
 * EL DEFECTO QUE CORRIGE
 * ----------------------
 * `e instanceof Error ? e.message : porDefecto` parece razonable hasta que el
 * error es de red: `fetch` rechaza entonces con un `TypeError` cuyo mensaje es
 * **«Failed to fetch»**. Eso acababa impreso en pantalla, en inglés y hablando
 * de una interioridad del navegador, dentro de una aplicación en español. Y no
 * en un sitio cualquiera: en la auditoría, donde quien lo lee necesita saber
 * si le falta información o si de verdad no hay nada.
 *
 * Cualquier otro `Error` sí trae un mensaje que hemos escrito nosotros —el del
 * código HTTP, el del formato inesperado—, y ése sí se muestra.
 */
export function mensajeDeError(e: unknown, porDefecto: string): string {
  if (e instanceof TypeError) return porDefecto;
  return e instanceof Error && e.message ? e.message : porDefecto;
}
