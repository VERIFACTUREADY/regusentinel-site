"use client";

import { useState, useEffect } from "react";
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

const statuses = ["", "INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS", "READY_TO_SEND", "SENT", "FOLLOW_UP", "CLOSED", "ARCHIVED"];

interface CaseItem {
  id: string;
  ref: string;
  status: string;
  isUrgent: boolean;
  createdAt: string;
  deceased?: { fullName: string } | null;
  contact?: { fullName: string } | null;
}

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases();
  }, [statusFilter, search]);

  async function fetchCases() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);

    const res = await fetch(`/api/cases?${params}`);
    if (res.ok) {
      setCases(await res.json());
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Expedientes</h1>
        <Link href="/cases/new"
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm font-medium">
          Nuevo expediente
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input type="text" placeholder="Buscar por nombre o referencia..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-md text-sm" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm">
          <option value="">Todos los estados</option>
          {statuses.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-6 py-3">Ref</th>
              <th className="px-6 py-3">Fallecido</th>
              <th className="px-6 py-3">Solicitante</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3">Urgente</th>
              <th className="px-6 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : cases.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No hay expedientes</td></tr>
            ) : cases.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => window.location.href = `/cases/${c.id}`}>
                <td className="px-6 py-3 font-medium text-primary">{c.ref}</td>
                <td className="px-6 py-3 text-sm">{c.deceased?.fullName || "-"}</td>
                <td className="px-6 py-3 text-sm">{c.contact?.fullName || "-"}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[c.status] || ""}`}>
                    {c.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-6 py-3">
                  {c.isUrgent && <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">Urgente</span>}
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString("es-ES")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
