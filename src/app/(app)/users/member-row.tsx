"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "MANAGER", label: "Manager" },
  { value: "OPERATOR", label: "Operador" },
  { value: "VIEWER", label: "Viewer" },
  { value: "MANAGED_OPS", label: "Managed Ops" },
];

const roleBadge: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  OPERATOR: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-600",
  MANAGED_OPS: "bg-orange-100 text-orange-700",
};

interface Props {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  roleLabel: string;
  joinedAt: string;
  isSelf: boolean;
  canManage: boolean;
  mobileActions?: boolean;
}

export function MemberRow({ userId, name, email, role, roleLabel, joinedAt, isSelf, canManage, mobileActions }: Props) {
  const [changing, setChanging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function changeRole(newRole: string) {
    setChanging(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChanging(false);
    }
  }

  async function removeMember() {
    if (!confirm(`Eliminar a ${name || email} del equipo?`)) return;
    setRemoving(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  if (mobileActions) {
    return (
      <div className="flex gap-2 mt-2">
        <select
          value={role}
          onChange={(e) => changeRole(e.target.value)}
          disabled={changing}
          className="text-xs border rounded px-2 py-1 flex-1"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
          onClick={removeMember}
          disabled={removing}
          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-200 rounded"
        >
          {removing ? "..." : "Eliminar"}
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-6 py-3 text-sm font-medium">{name || "—"}</td>
      <td className="px-6 py-3 text-sm text-gray-600">{email}</td>
      <td className="px-6 py-3">
        {canManage && !isSelf ? (
          <select
            value={role}
            onChange={(e) => changeRole(e.target.value)}
            disabled={changing}
            className={`text-xs px-2 py-1 rounded-full border-0 ${roleBadge[role] ?? "bg-gray-100"} cursor-pointer`}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        ) : (
          <span className={`text-xs px-2 py-1 rounded-full ${roleBadge[role] ?? "bg-gray-100"}`}>
            {roleLabel}{isSelf ? " (tu)" : ""}
          </span>
        )}
      </td>
      <td className="px-6 py-3 text-sm text-gray-500">{joinedAt}</td>
      {canManage && (
        <td className="px-6 py-3 text-right">
          {!isSelf && (
            <button
              onClick={removeMember}
              disabled={removing}
              className="text-xs text-red-600 hover:text-red-800 hover:underline"
            >
              {removing ? "Eliminando..." : "Eliminar"}
            </button>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </td>
      )}
    </tr>
  );
}
