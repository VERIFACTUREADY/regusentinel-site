"use client";

import { AvisoError } from "@/components/ui/carga-remota";
import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";

interface DocEntry {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  isPortalUpload: boolean;
  uploadedBy: string | null;
  createdAt: string;
  case: { id: string; ref: string; deceasedName: string | null } | null;
  task: { id: string; title: string } | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string | null): string {
  if (!mimeType) return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📕";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "🗜️";
  return "📄";
}

const LIMIT = 30;

export function DocumentsClient({
  initialDocs,
  initialTotal,
  totalStorageLabel,
  portalCount,
  totalCount,
  puedeBorrar,
}: {
  initialDocs: DocEntry[];
  initialTotal: number;
  totalStorageLabel: string;
  portalCount: number;
  totalCount: number;
  /**
   * `documents.delete` de verdad, resuelto en el servidor.
   *
   * Un VIEWER tiene solo los permisos `.read`: el servidor le devuelve 403 al
   * borrar. Antes se le pintaba igualmente la papelera, así que la única forma
   * de descubrir que no podía era pulsarla. Ocultarla NO sustituye a la
   * autorización del backend —que sigue ahí y se prueba aparte—, pero deja de
   * ofrecer algo que no se puede hacer.
   */
  puedeBorrar: boolean;
}) {
  const [docs, setDocs] = useState<DocEntry[]>(initialDocs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchDocs = useCallback(async (p: number, q: string, source: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (q) params.set("search", q);
    if (source) params.set("source", source);
    setErrorCarga(null);
    try {
      const res = await fetch(`/api/documents?${params}`);
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Tu sesion ha caducado. Vuelve a entrar."
            : `El servidor ha respondido ${res.status}.`,
        );
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.documents)) {
        throw new Error("La respuesta del servidor no tiene el formato esperado.");
      }
      setDocs(data.documents);
      setTotal(data.total);
    } catch (e) {
      // Lista vacia por fallo = "no hay documentos", que es justo lo contrario
      // de lo que puede estar pasando.
      setDocs([]);
      setTotal(0);
      setErrorCarga(e instanceof Error ? e.message : "Error de red. Comprueba tu conexion.");
    } finally {
      // En `finally`: antes un fallo de red dejaba la pantalla cargando.
      setLoading(false);
    }
  }, []);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchDocs(1, value, filterSource), 300);
  }

  function handleSourceFilter(source: string) {
    setFilterSource(source);
    setPage(1);
    fetchDocs(1, search, source);
  }

  /*
   * Recarga SIEMPRE que cambie la página, incluida la vuelta a la 1.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Era `if (page > 1) fetchDocs(...)`. Al pulsar "Anterior" desde la página 2
   * el estado volvía a 1 pero no se pedía nada, así que la tabla se quedaba
   * mostrando los documentos de la página 2 mientras el pie decía "1–30 de N".
   * El usuario veía una página que no existía y los documentos reales de la
   * primera página eran inalcanzables sin recargar el navegador entero.
   *
   * La primera carga no repite la petición: `paginaCargada` arranca en 1, que
   * es justo lo que el servidor ya pintó.
   */
  const paginaCargada = useRef(1);
  useEffect(() => {
    if (paginaCargada.current === page) return;
    paginaCargada.current = page;
    fetchDocs(page, search, filterSource);
  }, [page, search, filterSource, fetchDocs]);

  /** Motivo legible de una respuesta que no ha ido bien. */
  async function motivo(res: Response): Promise<string> {
    const cuerpo = await res.json().catch(() => null);
    if (cuerpo?.error) return cuerpo.error;
    if (res.status === 401) return "Tu sesion ha caducado. Vuelve a entrar.";
    if (res.status === 403) return "No tienes permiso para esta accion.";
    if (res.status === 404) return "El documento ya no existe.";
    return `El servidor ha respondido ${res.status}.`;
  }

  /**
   * Elimina un documento y sólo lo quita de la lista si de verdad se ha
   * borrado.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Era `if (res.ok) { quitarlo de la lista }` y nada más. Con un 403 (VIEWER),
   * un 404, un 500 o un 502 de S3 —el caso en que el archivo sigue en el
   * bucket— el usuario pulsaba Eliminar y no ocurría absolutamente nada: ni
   * desaparecía ni se explicaba por qué. Y si la red se caía, `fetch` lanzaba y
   * el error moría sin capturar.
   */
  async function handleDelete(docId: string, fileName: string) {
    if (!confirm(`¿Eliminar "${fileName}"? Esta acción no se puede deshacer.`)) return;
    setAviso(null);
    setBorrando(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await motivo(res));
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      setTotal((t) => Math.max(0, t - 1));
      setAviso({ tipo: "ok", texto: `"${fileName}" se ha eliminado.` });
    } catch (e) {
      setAviso({
        tipo: "err",
        texto: `No se ha podido eliminar "${fileName}": ${
          e instanceof Error ? e.message : "error de red"
        }`,
      });
    } finally {
      setBorrando(null);
    }
  }

  /**
   * Descarga un documento.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Tenía un `catch {}` vacío: con la red caída no pasaba nada y el usuario se
   * quedaba mirando el botón. Y el `if (res.ok)` sin `else` hacía lo mismo con
   * un 403, un 404 o un 500. Además `setDownloading(null)` estaba fuera de
   * `finally`, así que una excepción dejaba el botón apagado para siempre y ni
   * siquiera se podía reintentar.
   */
  async function handleDownload(docId: string, fileName: string) {
    setAviso(null);
    setDownloading(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (!res.ok) throw new Error(await motivo(res));
      const datos = await res.json().catch(() => null);
      if (!datos?.downloadUrl) {
        throw new Error("El servidor no ha devuelto un enlace de descarga.");
      }
      const a = document.createElement("a");
      a.href = datos.downloadUrl;
      a.download = fileName;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setAviso({
        tipo: "err",
        texto: `No se ha podido descargar "${fileName}": ${
          e instanceof Error ? e.message : "error de red"
        }`,
      });
    } finally {
      setDownloading(null);
    }
  }

  const adminCount = totalCount - portalCount;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Documentos</h1>
          <p className="text-sm text-gray-500 mt-1">Biblioteca centralizada de todos los expedientes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Total documentos</p>
          <p className="text-2xl font-bold">{totalCount.toLocaleString("es-ES")}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Subidos por familias</p>
          <p className="text-2xl font-bold text-blue-600">{portalCount.toLocaleString("es-ES")}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Subidos por equipo</p>
          <p className="text-2xl font-bold text-gray-700">{adminCount.toLocaleString("es-ES")}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">Almacenamiento</p>
          <p className="text-2xl font-bold">{totalStorageLabel}</p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-center">
        {/*
          El `placeholder` no es una etiqueta: desaparece al escribir y un lector
          de pantalla anuncia "cuadro de busqueda" sin decir de que. La etiqueta
          va oculta a la vista pero presente en el arbol de accesibilidad.
        */}
        <label htmlFor="buscarDocumentos" className="sr-only">
          Buscar documentos por nombre
        </label>
        <input
          id="buscarDocumentos"
          type="search"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="px-3 py-1.5 border rounded-md text-sm w-64"
        />
        {/*
          Grupo de filtros con estado anunciado: sin `aria-pressed` los tres
          botones se leen igual y no hay forma de saber cual esta aplicado.
        */}
        <div className="flex gap-2" role="group" aria-label="Filtrar por origen">
          {[
            { value: "", label: "Todos" },
            { value: "admin", label: "Equipo" },
            { value: "portal", label: "Familia" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSourceFilter(opt.value)}
              aria-pressed={filterSource === opt.value}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                filterSource === opt.value
                  ? "bg-primary text-white border-primary"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span data-testid="total-documentos" className="ml-auto text-sm text-gray-400">
          {total.toLocaleString("es-ES")} resultado{total !== 1 ? "s" : ""}
        </span>
      </div>

      {aviso && (
        <p
          role={aviso.tipo === "err" ? "alert" : "status"}
          data-testid={aviso.tipo === "err" ? "aviso-documentos-error" : "aviso-documentos-ok"}
          className={`mb-4 text-sm rounded-md px-3 py-2 border ${
            aviso.tipo === "err"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-green-50 text-green-700 border-green-200"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {errorCarga ? (
          <AvisoError mensaje={errorCarga} que="los documentos" onReintentar={() => fetchDocs(page, search, filterSource)} />
        ) : loading ? (
          <div className="py-12 text-center text-gray-400">Cargando...</div>
        ) : docs.length === 0 ? (
          <div data-testid="carga-vacio" className="py-12 text-center text-gray-400">
            <p className="text-lg mb-1">Sin documentos</p>
            <p className="text-sm">
              {search || filterSource
                ? "No hay documentos con los filtros aplicados."
                : "Los documentos subidos a los expedientes aparecerán aquí."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Archivo</th>
                    <th className="px-4 py-3 text-left">Expediente</th>
                    <th className="px-4 py-3 text-left">Tarea vinculada</th>
                    <th className="px-4 py-3 text-left">Origen</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {docs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base" aria-hidden>{fileIcon(doc.mimeType)}</span>
                          <div>
                            <p data-testid="doc-nombre" className="font-medium truncate max-w-[200px]" title={doc.fileName}>
                              {doc.fileName}
                            </p>
                            {doc.fileSize != null && (
                              <p className="text-xs text-gray-400">{formatBytes(doc.fileSize)}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {doc.case ? (
                          <Link href={`/cases/${doc.case.id}`} className="text-primary hover:underline font-mono text-xs">
                            {doc.case.ref}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        {doc.case?.deceasedName && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[140px]">{doc.case.deceasedName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {doc.task ? (
                          <span className="text-xs text-gray-600 truncate max-w-[140px] block">{doc.task.title}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {doc.isPortalUpload ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Familia</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Equipo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {/*
                          `timeZone` explicito, y no es un adorno: este es un
                          componente de cliente que Next tambien renderiza en el
                          servidor. El servidor corre en UTC y el navegador del
                          usuario en Europe/Madrid, asi que la misma fecha se
                          formateaba distinta en cada lado —un dia de diferencia
                          en las horas de la tarde— y React fallaba al hidratar
                          (errores #418/#422/#425). Fijando la zona, ambos lados
                          producen el mismo texto.
                        */}
                        {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          timeZone: "Europe/Madrid",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/*
                            El nombre accesible lleva el archivo: con treinta
                            filas, "Descargar" a secas no dice cual, ni para
                            quien navega con lector de pantalla ni para una
                            prueba que tenga que pulsar uno concreto.
                          */}
                          <button
                            onClick={() => handleDownload(doc.id, doc.fileName)}
                            disabled={downloading === doc.id}
                            aria-label={`Descargar ${doc.fileName}`}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                            title="Descargar"
                          >
                            {downloading === doc.id ? (
                              <span className="text-gray-400">...</span>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Descargar
                              </>
                            )}
                          </button>
                          {puedeBorrar && (
                            <button
                              onClick={() => handleDelete(doc.id, doc.fileName)}
                              disabled={borrando === doc.id}
                              aria-label={`Eliminar ${doc.fileName}`}
                              title="Eliminar"
                              className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
                <span data-testid="rango-documentos">
                  {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de {total.toLocaleString("es-ES")}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
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
