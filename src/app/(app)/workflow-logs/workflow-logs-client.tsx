"use client";

import { AvisoError, mensajeDeError } from "@/components/ui/carga-remota";
import { useState, useCallback, useEffect, useRef, useId } from "react";
import Link from "next/link";
import { fechaHoraCortaES } from "@/lib/fecha-es";

interface LogEntry {
  id: string;
  status: "PROCESSING" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  error: string | null;
  createdAt: string;
  rule: { id: string; name: string };
  case: { id: string; ref: string } | null;
  /** Entregas que siguen sin llegar a su destinatario. */
  pendingDeliveries?: number;
}

/** Resultado por destinatario que devuelve el reintento. */
interface Entrega {
  recipient: string;
  ok: boolean;
  skipped: boolean;
  error: string | null;
}

/** Lo que hay que enseñar tras pulsar «Reintentar fallidas». */
interface ResultadoReintento {
  tipo: "exito" | "aviso" | "error";
  texto: string;
  entregas: Entrega[];
}

const STATUS_STYLES: Record<string, string> = {
  PROCESSING: "bg-blue-100 text-blue-700",
  SUCCESS: "bg-green-100 text-green-700",
  // Parcial: ni exito ni fallo. Antes una ejecucion en la que fallaban nueve
  // de diez destinatarios se pintaba en verde.
  PARTIAL: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  PROCESSING: "En curso",
  SUCCESS: "Exitoso",
  PARTIAL: "Parcial",
  FAILED: "Error",
  SKIPPED: "Omitido",
};

const ESTADOS_FILTRO = ["", "SUCCESS", "PARTIAL", "FAILED", "PROCESSING", "SKIPPED"] as const;

async function leerCuerpo(res: Response): Promise<{ error?: string } | null> {
  try {
    return (await res.json()) as { error?: string };
  } catch {
    return null;
  }
}

export function WorkflowLogsClient({
  initialLogs,
  initialTotal,
  rules,
  statMap,
  puedeReintentar,
}: {
  initialLogs: LogEntry[];
  initialTotal: number;
  rules: { id: string; name: string }[];
  statMap: Record<string, number>;
  /** `workflow.manage`: sólo OWNER y MANAGER pueden reintentar envíos. */
  puedeReintentar: boolean;
}) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  // Los contadores dejan de ser una prop congelada del render inicial: se
  // refrescan con cada respuesta del API, así que un reintento que arregla una
  // ejecución también corrige la tarjeta «Con error».
  const [stats, setStats] = useState<Record<string, number>>(statMap);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState<string | null>(null);
  const [resultadoReintento, setResultadoReintento] = useState<ResultadoReintento | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRule, setFilterRule] = useState("");
  // Se incrementa para forzar una recarga con los mismos filtros (botón
  // «Reintentar» del aviso de error, y refresco tras un reintento de envío).
  const [recarga, setRecarga] = useState(0);

  const idRegla = useId();
  const LIMIT = 30;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchLogs = useCallback(
    async (p: number, status: string, ruleId: string, signal?: AbortSignal) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (status) params.set("status", status);
      if (ruleId) params.set("ruleId", ruleId);
      setErrorCarga(null);
      try {
        const res = await fetch(`/api/workflow-logs?${params}`, { signal });
        if (!res.ok) {
          const cuerpo = await leerCuerpo(res);
          throw new Error(
            cuerpo?.error ??
              (res.status === 401
                ? "Tu sesion ha caducado. Vuelve a entrar."
                : res.status === 403
                  ? "No tienes permiso para ver el registro de automatizaciones."
                  : `El servidor ha respondido ${res.status}.`),
          );
        }
        const data: unknown = await res.json();
        const cuerpo = data as { logs?: unknown; total?: unknown; stats?: unknown };
        if (!cuerpo || !Array.isArray(cuerpo.logs) || typeof cuerpo.total !== "number") {
          throw new Error("La respuesta del servidor no tiene el formato esperado.");
        }
        if (signal?.aborted) return;
        setLogs(cuerpo.logs as LogEntry[]);
        setTotal(cuerpo.total);
        if (cuerpo.stats && typeof cuerpo.stats === "object") {
          setStats(cuerpo.stats as Record<string, number>);
        }
      } catch (e) {
        if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        // Vaciar la tabla SIN marcar el error dejaría «Sin ejecuciones», que
        // en un registro de automatizaciones significa «tus reglas no se han
        // disparado nunca». Es la lectura contraria a la verdadera.
        setLogs([]);
        setTotal(0);
        setErrorCarga(mensajeDeError(e, "No se han podido cargar las ejecuciones."));
      } finally {
        // En `finally`: antes un fallo de red dejaba `setLoading(false)` sin
        // ejecutar y la pantalla cargando para siempre.
        if (!signal?.aborted) setLoading(false);
      }
    },
    [],
  );

  /*
   * Una sola vía de recarga.
   *
   * LOS DOS DEFECTOS QUE CORRIGE
   * ----------------------------
   *   1. `handleFilter` llamaba a `fetchLogs` Y cambiaba el estado que
   *      disparaba este efecto, así que cada clic en un filtro lanzaba DOS
   *      peticiones idénticas; con la segunda llegando antes o después, la
   *      tabla podía quedarse con la respuesta de la petición vieja.
   *   2. El efecto sólo recargaba `if (page !== 1 || filterStatus ||
   *      filterRule)`. Volver de la página 2 a la 1 sin filtros no cumplía la
   *      condición: la tabla seguía enseñando las filas de la página 2
   *      mientras el pie decía «1–30 de N».
   *
   * Ahora todo cambio pasa por aquí, y sólo se salta el primer render porque
   * esos datos ya vienen del servidor.
   */
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const controlador = new AbortController();
    void fetchLogs(page, filterStatus, filterRule, controlador.signal);
    return () => controlador.abort();
  }, [page, filterStatus, filterRule, recarga, fetchLogs]);

  /**
   * Reintenta las entregas pendientes de una ejecucion.
   *
   * No se envia ningun contenido: el servidor reconstruye asunto, cuerpo y
   * destinatarios desde la regla y el expediente. Si el cliente los mandara,
   * el endpoint seria un rele de correo autenticado.
   */
  async function reintentar(logId: string) {
    // Guarda contra el doble clic: mientras haya un reintento en vuelo no se
    // lanza otro. Cada uno provoca envíos reales.
    if (reintentando) return;
    setReintentando(logId);
    setResultadoReintento(null);
    try {
      const res = await fetch(`/api/workflow-logs/${logId}/retry`, { method: "POST" });
      const cuerpo = (await leerCuerpo(res)) as
        | ({
            retried?: number;
            recovered?: number;
            status?: string;
            unrecoverable?: number;
            deliveries?: Entrega[];
          } & { error?: string })
        | null;

      if (!res.ok) {
        setResultadoReintento({
          tipo: "error",
          texto:
            cuerpo?.error ??
            (res.status === 403
              ? "No tienes permiso para reintentar ejecuciones."
              : res.status === 404
                ? "La ejecución ya no existe."
                : res.status === 429
                  ? "Demasiados reintentos seguidos. Espera un minuto."
                  : `No se pudo reintentar la ejecución (error ${res.status}).`),
          entregas: [],
        });
        return;
      }
      if (!cuerpo) {
        setResultadoReintento({
          tipo: "error",
          texto: "La respuesta del servidor no tiene el formato esperado.",
          entregas: [],
        });
        return;
      }

      const entregas = Array.isArray(cuerpo.deliveries) ? cuerpo.deliveries : [];
      const estado = STATUS_LABELS[cuerpo.status ?? ""] ?? cuerpo.status ?? "desconocido";

      if ((cuerpo.unrecoverable ?? 0) > 0) {
        // NO es «no quedaba nada pendiente»: quedan entregas sin entregar y ya
        // no se pueden reenviar.
        setResultadoReintento({
          tipo: "error",
          texto:
            `Quedan ${cuerpo.unrecoverable} entrega(s) sin enviar que ya no se pueden ` +
            `reintentar: la regla ya no envía correo o el expediente no está disponible.`,
          entregas: [],
        });
      } else if ((cuerpo.retried ?? 0) === 0) {
        setResultadoReintento({
          tipo: "aviso",
          texto: "No quedaban entregas pendientes de reintentar.",
          entregas,
        });
      } else if ((cuerpo.recovered ?? 0) < (cuerpo.retried ?? 0)) {
        // Recuperar 1 de 3 no es un éxito. Antes se anunciaba con el mismo
        // color y el mismo tono que recuperarlas todas.
        setResultadoReintento({
          tipo: "aviso",
          texto:
            `${cuerpo.recovered} de ${cuerpo.retried} entrega(s) recuperada(s). ` +
            `Estado: ${estado}.`,
          entregas,
        });
      } else {
        setResultadoReintento({
          tipo: "exito",
          texto:
            `${cuerpo.recovered} de ${cuerpo.retried} entrega(s) recuperada(s). ` +
            `Estado: ${estado}.`,
          entregas,
        });
      }
    } catch (e) {
      setResultadoReintento({
        tipo: "error",
        texto: mensajeDeError(e, "Error de conexion al reintentar."),
        entregas: [],
      });
    } finally {
      setReintentando(null);
      // Refresca filas y contadores pase lo que pase: si el envío se hizo y
      // la respuesta se perdió, la tabla debe reflejar el estado real.
      setRecarga((n) => n + 1);
    }
  }

  function handleFilter(status: string, ruleId: string) {
    setFilterStatus(status);
    setFilterRule(ruleId);
    setPage(1);
  }

  const successCount = stats["SUCCESS"] ?? 0;
  const partialCount = stats["PARTIAL"] ?? 0;
  const failedCount = stats["FAILED"] ?? 0;
  const skippedCount = stats["SKIPPED"] ?? 0;
  const processingCount = stats["PROCESSING"] ?? 0;
  /*
   * «Total ejecuciones» cuenta TODAS las ejecuciones registradas, las que
   * siguen en curso incluidas: antes las PROCESSING se quedaban fuera del
   * total mientras el filtro de al lado las contaba, así que la suma de los
   * botones podía superar al total que había justo encima.
   */
  const totalCount = successCount + partialCount + failedCount + skippedCount + processingCount;
  /*
   * La tasa de éxito se mide sobre las ejecuciones TERMINADAS. Las que siguen
   * en curso no son ni éxito ni fallo: meterlas en el denominador hace bajar
   * la tasa por el mero hecho de estar mirando la pantalla mientras corren.
   * Las parciales sí cuentan, y cuentan como no-éxito: si nueve de diez
   * destinatarios no lo recibieron, la ejecución no fue exitosa.
   */
  const terminadas = successCount + partialCount + failedCount + skippedCount;
  const successRate = terminadas > 0 ? Math.round((successCount / terminadas) * 100) : 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Registro de automatizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Historial de ejecuciones de todas las reglas
          </p>
        </div>
        <Link
          href="/workflow-rules"
          className="text-sm text-primary hover:underline"
        >
          &larr; Gestionar reglas
        </Link>
      </div>

      {/*
        Un fallo del reintento ya no se pinta igual que un acierto. Antes los
        tres desenlaces —recuperadas, nada que hacer y no se pudo— salían en la
        misma caja gris con `role="status"`, así que «No se pudo reintentar la
        ejecución» tenía exactamente el mismo aspecto que «3 de 3
        recuperada(s)» y un lector de pantalla lo anunciaba con la misma
        cortesía.
      */}
      {resultadoReintento && (
        <div
          role={resultadoReintento.tipo === "error" ? "alert" : "status"}
          data-testid={`reintento-${resultadoReintento.tipo}`}
          className={`mb-4 rounded-lg border px-3.5 py-3 text-sm ${
            resultadoReintento.tipo === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : resultadoReintento.tipo === "aviso"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          <p>{resultadoReintento.texto}</p>
          {/*
            El detalle por destinatario que devuelve el servidor ya no se tira:
            saber A QUIÉN sigue sin llegarle es justo el motivo de entrar aquí.
          */}
          {resultadoReintento.tipo !== "error" && resultadoReintento.entregas.length > 0 && (
            <ul className="mt-2 space-y-0.5" data-testid="entregas-reintento">
              {resultadoReintento.entregas.map((e) => (
                <li key={e.recipient} className="text-xs">
                  <span className="font-medium">{e.recipient}</span>{" "}
                  {e.skipped
                    ? "— ya estaba entregada"
                    : e.ok
                      ? "— entregada"
                      : `— sigue fallando${e.error ? `: ${e.error}` : ""}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Total ejecuciones</p>
          <p className="text-2xl font-bold" data-testid="total-ejecuciones">
            {totalCount.toLocaleString("es-ES")}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Exitosas</p>
          <p className="text-2xl font-bold text-green-600" data-testid="total-exitosas">
            {successCount.toLocaleString("es-ES")}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Parciales</p>
          <p className="text-2xl font-bold text-amber-600" data-testid="total-parciales">
            {partialCount.toLocaleString("es-ES")}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Con error</p>
          <p className="text-2xl font-bold text-red-600" data-testid="total-fallidas">
            {failedCount.toLocaleString("es-ES")}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Tasa de exito</p>
          <p className="text-2xl font-bold" data-testid="tasa-exito">{successRate}%</p>
          <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-center">
        {/*
          `aria-pressed` en cada botón: son un grupo de alternancia y sólo uno
          está activo. Sin él, el color de fondo era la única pista de cuál
          estaba aplicado, y un lector de pantalla leía seis botones idénticos.
        */}
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar por estado">
          {ESTADOS_FILTRO.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleFilter(s, filterRule)}
              aria-pressed={filterStatus === s}
              data-testid={`filtro-estado-${s || "todos"}`}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                filterStatus === s
                  ? "bg-primary text-white border-primary"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "" ? "Todos" : STATUS_LABELS[s]}
              {s !== "" && (
                <span className="ml-1 text-xs opacity-75">
                  {(stats[s] ?? 0).toLocaleString("es-ES")}
                </span>
              )}
            </button>
          ))}
        </div>
        {/*
          El selector de regla no tenía rótulo de ningún tipo. Se veía como una
          lista con «Todas las reglas» dentro y había que deducir para qué era.
        */}
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor={idRegla} className="text-sm text-gray-600">
            Regla
          </label>
          <select
            id={idRegla}
            value={filterRule}
            onChange={(e) => handleFilter(filterStatus, e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm"
          >
            <option value="">Todas las reglas</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {errorCarga ? (
          <AvisoError
            mensaje={errorCarga}
            que="las ejecuciones"
            onReintentar={() => setRecarga((n) => n + 1)}
          />
        ) : loading ? (
          <div className="py-12 text-center text-gray-400" data-testid="cargando-ejecuciones">
            Cargando...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-400" data-testid="vacio-ejecuciones">
            <p className="text-lg mb-1">Sin ejecuciones</p>
            <p className="text-sm">
              {filterStatus || filterRule
                ? "No hay registros con los filtros seleccionados."
                : "Las ejecuciones aparecerán aquí cuando se disparen reglas de automatización."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Ejecuciones de reglas de automatización, de la más reciente a la más antigua
                </caption>
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th scope="col" className="px-4 py-3 text-left">Estado</th>
                    <th scope="col" className="px-4 py-3 text-left">Regla</th>
                    <th scope="col" className="px-4 py-3 text-left">Expediente</th>
                    <th scope="col" className="px-4 py-3 text-left">Fecha</th>
                    <th scope="col" className="px-4 py-3 text-left">Error</th>
                    <th scope="col" className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 transition-colors"
                      data-testid={`ejecucion-${log.id}`}
                    >
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[log.status]}`}>
                          {STATUS_LABELS[log.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {/*
                          Filtra por ESTA regla, que es lo que se espera al
                          pulsar su nombre desde una fila. Antes iba a
                          `/workflow-rules` sin decir cuál, así que había que
                          buscarla otra vez en la lista.
                        */}
                        <button
                          type="button"
                          onClick={() => handleFilter(filterStatus, log.rule.id)}
                          className="text-primary hover:underline font-medium text-left"
                          aria-label={`Ver solo las ejecuciones de ${log.rule.name}`}
                        >
                          {log.rule.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {log.case ? (
                          <Link
                            href={`/cases/${log.case.id}`}
                            className="text-primary hover:underline font-mono text-xs"
                          >
                            {log.case.ref}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/*
                        Zona española fijada. Sin ella el servidor pintaba la
                        hora en UTC y el navegador en Madrid: dos horas de
                        diferencia en verano, y una hidratación rota que hacía
                        que React redibujara la pantalla entera.
                      */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {fechaHoraCortaES(log.createdAt)}
                      </td>
                      {/*
                        El mensaje de error se lee entero. Estaba en una línea
                        con `truncate` y el texto completo sólo en `title`: en
                        un móvil o con teclado no había ninguna forma de verlo,
                        y es justo el dato por el que se entra en esta pantalla.
                      */}
                      <td className="px-4 py-3 max-w-xs">
                        {log.error ? (
                          <span className="text-red-600 text-xs block break-words">
                            {log.error}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {/*
                          Sólo aparece cuando hay algo que reintentar y quien
                          mira puede hacerlo. Un botón que no puede hacer nada
                          enseña a ignorar el botón.

                          `pendingDeliveries` viene del servidor: una ejecución
                          PARTIAL cuyas entregas ya se recuperaron conserva el
                          estado histórico, y antes seguía ofreciendo el botón
                          para no hacer nada.
                        */}
                        {puedeReintentar &&
                          (log.status === "PARTIAL" || log.status === "FAILED") &&
                          (log.pendingDeliveries ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => void reintentar(log.id)}
                              disabled={reintentando !== null}
                              data-testid={`reintentar-${log.id}`}
                              aria-label={`Reintentar las ${log.pendingDeliveries} entrega(s) pendientes de ${log.rule.name}`}
                              className="text-xs px-2.5 py-1 rounded-md border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              {reintentando === log.id ? "Reintentando…" : "Reintentar fallidas"}
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
                <span data-testid="rango-ejecuciones">
                  {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de {total.toLocaleString("es-ES")}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
