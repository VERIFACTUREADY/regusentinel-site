"use client";

import { useState, useEffect } from "react";

const roles = ["OWNER", "MANAGER", "OPERATOR", "VIEWER", "MANAGED_OPS"];
const roleColors: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  OPERATOR: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-700",
  MANAGED_OPS: "bg-orange-100 text-orange-700",
};

export default function UsersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "OPERATOR", name: "" });
  const [error, setError] = useState("");

  useEffect(() => { fetchMembers(); }, []);

  async function fetchMembers() {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    });
    if (res.ok) {
      setShowInvite(false);
      setInvite({ email: "", role: "OPERATOR", name: "" });
      fetchMembers();
    } else {
      const data = await res.json();
      setError(data.error || "Error");
    }
  }

  async function changeRole(userId: string, role: string) {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    fetchMembers();
  }

  async function removeMember(userId: string) {
    if (!confirm("Eliminar este usuario de la organizacion?")) return;
    await fetch(`/api/users/${userId}`, { method: "DELETE" });
    fetchMembers();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90">
          Invitar usuario
        </button>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Invitar usuario</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input type="email" required value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input type="text" value={invite.name}
                  onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rol</label>
                <select value={invite.role}
                  onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md">
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="flex-1 py-2 border rounded-md">Cancelar</button>
                <button type="submit"
                  className="flex-1 py-2 bg-primary text-white rounded-md">Invitar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members table */}
      <div className="bg-white rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-6 py-3">Nombre</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Rol</th>
              <th className="px-6 py-3">Desde</th>
              <th className="px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : members.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="px-6 py-3 text-sm">{m.user.name || "-"}</td>
                <td className="px-6 py-3 text-sm">{m.user.email}</td>
                <td className="px-6 py-3">
                  <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)}
                    className={`text-xs px-2 py-1 rounded ${roleColors[m.role] || ""}`}>
                    {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {new Date(m.createdAt).toLocaleDateString("es-ES")}
                </td>
                <td className="px-6 py-3">
                  <button onClick={() => removeMember(m.userId)}
                    className="text-sm text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
