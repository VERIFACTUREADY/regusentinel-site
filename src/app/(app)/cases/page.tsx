"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const statusColors: Record<string, string> = {
  INTAKE: "bg-gray-100 text-gray-700",
  VALIDATION: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  PENDING_DOCS: "bg-orange-100 text-orange-700",
  READY_TO_SEND: "bg-purple-100 text-purple-700",
  SENT: "bg-indigo-100 text-indigo-700",
  FOLLOW_UP: "bg-cyan-100 text-cyan-700",
  CLOSED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "INTAKE", label: "Recepcion" },
  { value: "VALIDATION", label: "Validacion" },
  { value: "IN_PROGRESS", label: "En curso" },
  { value: "PENDING_DOCS", label: "Docs pendientes" },
  { value: "READY_TO_SEND", label: "Listo para enviar" },
  { value: "SENT", label: "Enviado" },
  { value: "FOLLOW_UP", label: "Seguimiento" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "ARCHIVED", label: "Archivado" },
];

interface CaseItem {
  id: string;
  ref: string;
  status: string;
  isUrgent: boolean;
  createdAt: string;
  deceased?: { fullName: string } | null;
  contact?: { fullName: string } | null;
}

const PAGE_SIZE = 25;

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);

    fetch(`/api/cases?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !controller.signal.aborted) {
          setCases(data.cases);
          setTotal(data.total);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, statusFilter, search]);

  function handleSearchInput(value: string) {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Expedientes</h1>
          <p className="text-sm text-gray-500 mt-1">{total} expediente{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/cases/import"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium text-center">
            Importar CSV
          </Link>
          <Link href="/cases/new"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm font-medium text-center">
            Nuevo expediente
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o referencia..."
          value={searchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-6 py-3 font-medium">Ref</th>
              <th className="px-6 py-3 font-medium">Fallecido</th>
              <th className="px-6 py-3 font-medium">Solicitante</th>
              <th className="px-6 py-3 font-medium">Estado</th>
              <th className="px-6 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Cargando...</td></tr>
            ) : cases.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No hay expedientes</td></tr>
            ) : cases.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-3">
                  <Link href={`/cases/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.ref}
                  </Link>
                  {c.isUrgent && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Urgente</span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm">{c.deceased?.fullName || "—"}</td>
                <td className="px-6 py-3 text-sm">{c.contact?.fullName || "—"}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[c.status] || ""}`}>
                    {STATUS_OPTIONS.find((s) => s.value === c.status)?.label || c.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString("es-ES")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400">Cargando...</div>
        ) : cases.length === 0 ? (
          <div className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400">No hay expedientes</div>
        ) : cases.map((c) => (
          <Link key={c.id} href={`/cases/${c.id}`} className="block bg-white rounded-lg border p-4 hover:bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary font-mono text-sm">{c.ref}</span>
                {c.isUrgent && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Urgente</span>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[c.status] || ""}`}>
                {STATUS_OPTIONS.find((s) => s.value === c.status)?.label || c.status}
              </span>
            </div>
            <p className="text-sm font-medium">{c.deceased?.fullName || "—"}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">{c.contact?.fullName || "—"}</p>
              <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString("es-ES")}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
