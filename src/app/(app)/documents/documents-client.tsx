"use client";

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
}: {
  initialDocs: DocEntry[];
  initialTotal: number;
  totalStorageLabel: string;
  portalCount: number;
  totalCount: number;
}) {
  const [docs, setDocs] = useState<DocEntry[]>(initialDocs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchDocs = useCallback(async (p: number, q: string, source: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (q) params.set("search", q);
    if (source) params.set("source", source);
    try {
      const res = await fetch(`/api/documents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents);
        setTotal(data.total);
      }
    } catch {}
    setLoading(false);
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

  useEffect(() => {
    if (page > 1) fetchDocs(page, search, filterSource);
  }, [page, search, filterSource, fetchDocs]);

  async function handleDelete(docId: string, fileName: string) {
    if (!confirm(`¿Eliminar "${fileName}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      setTotal((t) => t - 1);
    }
  }

  async function handleDownload(docId: string, fileName: string) {
    setDownloading(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (res.ok) {
        const { downloadUrl } = await res.json();
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = fileName;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.click();
      }
    } catch {}
    setDownloading(null);
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
        <input
          type="search"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="px-3 py-1.5 border rounded-md text-sm w-64"
        />
        <div className="flex gap-2">
          {[
            { value: "", label: "Todos" },
            { value: "admin", label: "Equipo" },
            { value: "portal", label: "Familia" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSourceFilter(opt.value)}
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
        <span className="ml-auto text-sm text-gray-400">{total.toLocaleString("es-ES")} resultado{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Cargando...</div>
        ) : docs.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
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
                            <p className="font-medium truncate max-w-[200px]" title={doc.fileName}>
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
                        {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownload(doc.id, doc.fileName)}
                            disabled={downloading === doc.id}
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
                          <button
                            onClick={() => handleDelete(doc.id, doc.fileName)}
                            title="Eliminar"
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
                <span>
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
