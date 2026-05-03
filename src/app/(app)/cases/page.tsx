"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { CASE_STATUS_COLORS, ALL_CATEGORIES } from "@/lib/constants";

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

const BATCH_STATUS_OPTIONS = STATUS_OPTIONS.filter((s) => s.value);

const CATEGORY_OPTIONS = [
  { value: "", label: "Todas las categorias" },
  ...ALL_CATEGORIES,
];

interface CaseItem {
  id: string;
  ref: string;
  status: string;
  isUrgent: boolean;
  categories: string[];
  createdAt: string;
  province?: string | null;
  deceased?: { fullName: string; deathDate?: string | null } | null;
  contact?: { fullName: string } | null;
  healthScore?: number | null;
}

const PAGE_SIZE = 25;

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [urgentFilter, setUrgentFilter] = useState(false);
  const [provinceFilter, setProvinceFilter] = useState("");
  const [isdExpiringFilter, setIsdExpiringFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const presets = [
    { id: "urgent", label: "Urgentes", apply: () => { setUrgentFilter(true); setStatusFilter(""); setCategoryFilter(""); setIsdExpiringFilter(""); } },
    { id: "isd30", label: "ISD < 30d", apply: () => { setIsdExpiringFilter("30"); setUrgentFilter(false); setStatusFilter(""); setCategoryFilter(""); }, className: "border-red-300 text-red-700" },
    { id: "isd60", label: "ISD < 60d", apply: () => { setIsdExpiringFilter("60"); setUrgentFilter(false); setStatusFilter(""); setCategoryFilter(""); }, className: "border-orange-300 text-orange-700" },
    { id: "pending_docs", label: "Docs pendientes", apply: () => { setStatusFilter("PENDING_DOCS"); setUrgentFilter(false); setCategoryFilter(""); setIsdExpiringFilter(""); } },
    { id: "active", label: "En curso", apply: () => { setStatusFilter("IN_PROGRESS"); setUrgentFilter(false); setCategoryFilter(""); setIsdExpiringFilter(""); } },
    { id: "intake", label: "Nuevos", apply: () => { setStatusFilter("INTAKE"); setUrgentFilter(false); setCategoryFilter(""); setIsdExpiringFilter(""); } },
    { id: "ready", label: "Listos para enviar", apply: () => { setStatusFilter("READY_TO_SEND"); setUrgentFilter(false); setCategoryFilter(""); setIsdExpiringFilter(""); } },
    { id: "closed", label: "Cerrados", apply: () => { setStatusFilter("CLOSED"); setUrgentFilter(false); setCategoryFilter(""); setIsdExpiringFilter(""); } },
  ];

  function applyPreset(id: string) {
    if (activePreset === id) {
      setActivePreset(null);
      setStatusFilter("");
      setUrgentFilter(false);
      setCategoryFilter("");
      setIsdExpiringFilter("");
    } else {
      setActivePreset(id);
      presets.find((p) => p.id === id)?.apply();
    }
    setPage(1);
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (search) params.set("search", search);
    if (urgentFilter) params.set("urgent", "true");
    if (provinceFilter) params.set("province", provinceFilter);
    if (isdExpiringFilter) params.set("isdExpiring", isdExpiringFilter);

    fetch(`/api/cases?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !controller.signal.aborted) {
          setCases(data.cases);
          setTotal(data.total);
          setSelected(new Set());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, statusFilter, categoryFilter, search, urgentFilter, provinceFilter, isdExpiringFilter, refreshKey]);

  function handleSearchInput(value: string) {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === cases.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cases.map((c) => c.id)));
    }
  }

  async function updateCaseStatus(caseId: string, newStatus: string) {
    setUpdatingStatus(caseId);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCases((prev) => prev.map((c) => c.id === caseId ? { ...c, status: newStatus } : c));
      }
    } catch {}
    setUpdatingStatus(null);
  }

  async function batchChangeStatus(newStatus: string) {
    setBatchLoading(true);
    const res = await fetch("/api/cases/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), action: "status", status: newStatus }),
    });
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    }
    setBatchLoading(false);
  }

  async function batchDelete() {
    if (!confirm(`Eliminar ${selected.size} expediente(s)? Esta accion es reversible desde la base de datos.`)) return;
    setBatchLoading(true);
    const res = await fetch("/api/cases/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), action: "delete" }),
    });
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    }
    setBatchLoading(false);
  }

  function exportCSV() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (provinceFilter) params.set("province", provinceFilter);
    if (urgentFilter) params.set("urgent", "true");
    if (isdExpiringFilter) params.set("isdExpiring", isdExpiringFilter);
    if (search) params.set("search", search);
    window.open(`/api/cases/export-csv?${params}`, "_blank");
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
          <Link href="/cases/kanban"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium text-center">
            Kanban
          </Link>
          <button
            onClick={exportCSV}
            disabled={cases.length === 0}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
          >
            Exportar CSV
          </button>
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

      {/* Quick filter presets */}
      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
              activePreset === p.id
                ? "bg-primary text-white border-primary"
                : `bg-white border-gray-200 hover:border-gray-400 ${(p as any).className || "text-gray-600"}`
            }`}
          >
            {p.label}
          </button>
        ))}
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
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setActivePreset(null); setUrgentFilter(false); }}
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); setActivePreset(null); }}
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={provinceFilter}
          onChange={(e) => { setProvinceFilter(e.target.value); setPage(1); setActivePreset(null); }}
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Todas las provincias</option>
          {["Álava","Albacete","Alicante","Almería","Asturias","Ávila","Badajoz","Baleares","Barcelona","Burgos","Cáceres","Cádiz","Cantabria","Castellón","Ciudad Real","Córdoba","Cuenca","Girona","Granada","Guadalajara","Guipúzcoa","Huelva","Huesca","Jaén","La Coruña","La Rioja","Las Palmas","León","Lleida","Lugo","Madrid","Málaga","Murcia","Navarra","Ourense","Palencia","Pontevedra","Salamanca","Santa Cruz de Tenerife","Segovia","Sevilla","Soria","Tarragona","Teruel","Toledo","Valencia","Valladolid","Vizcaya","Zamora","Zaragoza"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-700">
            {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          </span>
          <select
            onChange={(e) => { if (e.target.value) batchChangeStatus(e.target.value); e.target.value = ""; }}
            disabled={batchLoading}
            className="px-2 py-1 border rounded text-sm"
            defaultValue=""
          >
            <option value="" disabled>Cambiar estado...</option>
            {BATCH_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={batchDelete}
            disabled={batchLoading}
            className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={cases.length > 0 && selected.size === cases.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 font-medium">Ref</th>
              <th className="px-4 py-3 font-medium">Fallecido</th>
              <th className="px-4 py-3 font-medium">Solicitante</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Salud</th>
              <th className="px-4 py-3 font-medium">ISD</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">Cargando...</td></tr>
            ) : cases.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">No hay expedientes</td></tr>
            ) : cases.map((c) => {
              const isdDays = c.deceased?.deathDate
                ? 180 - Math.floor((Date.now() - new Date(c.deceased.deathDate).getTime()) / (1000 * 60 * 60 * 24))
                : null;
              return (
              <tr key={c.id} className={`border-b hover:bg-gray-50 ${selected.has(c.id) ? "bg-blue-50" : ""}`}>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/cases/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.ref}
                  </Link>
                  {c.isUrgent && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Urgente</span>
                  )}
                  {c.province && <span className="ml-1 text-xs text-gray-400">{c.province}</span>}
                </td>
                <td className="px-4 py-3 text-sm">{c.deceased?.fullName || "—"}</td>
                <td className="px-4 py-3 text-sm">{c.contact?.fullName || "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={c.status}
                    onChange={(e) => updateCaseStatus(c.id, e.target.value)}
                    disabled={updatingStatus === c.id}
                    className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer appearance-none ${CASE_STATUS_COLORS[c.status] || ""} ${updatingStatus === c.id ? "opacity-50" : ""}`}
                  >
                    {BATCH_STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {c.healthScore != null ? (
                    <Link href={`/cases/${c.id}`}
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold text-white ${
                        c.healthScore >= 75 ? "bg-green-500" :
                        c.healthScore >= 50 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      title={`Salud: ${c.healthScore}/100`}
                    >
                      {c.healthScore}
                    </Link>
                  ) : (
                    <span className="text-gray-300 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {isdDays !== null && c.status !== "CLOSED" && c.status !== "ARCHIVED" ? (
                    <span className={`font-mono font-medium ${
                      isdDays <= 0 ? "text-red-700 font-bold" :
                      isdDays <= 30 ? "text-red-600" :
                      isdDays <= 60 ? "text-orange-600" : "text-gray-500"
                    }`}>
                      {isdDays <= 0 ? "VENCIDO" : `${isdDays}d`}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString("es-ES")}
                </td>
              </tr>
              );
            })}
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
          <div key={c.id} className={`bg-white rounded-lg border p-4 ${selected.has(c.id) ? "ring-2 ring-blue-300" : ""}`}>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggleSelect(c.id)}
                className="mt-1 rounded border-gray-300"
              />
              <Link href={`/cases/${c.id}`} className="flex-1 block hover:bg-gray-50 -m-1 p-1 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary font-mono text-sm">{c.ref}</span>
                    {c.isUrgent && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Urgente</span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CASE_STATUS_COLORS[c.status] || ""}`}>
                    {STATUS_OPTIONS.find((s) => s.value === c.status)?.label || c.status}
                  </span>
                </div>
                <p className="text-sm font-medium">{c.deceased?.fullName || "—"}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">{c.contact?.fullName || "—"}</p>
                  <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString("es-ES")}</p>
                </div>
              </Link>
            </div>
          </div>
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
