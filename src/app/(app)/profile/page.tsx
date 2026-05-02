"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  MANAGER: "Gestor",
  OPERATOR: "Operador",
  VIEWER: "Lector",
  MANAGED_OPS: "Operaciones gestionadas",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  OPERATOR: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-600",
  MANAGED_OPS: "bg-orange-100 text-orange-700",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setProfile(data);
          setName(data.name || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setNameSaving(true);
    setNameError(null);
    setNameSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setProfile((prev: any) => ({ ...prev, name: data.user.name }));
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    } catch (err: any) {
      setNameError(err.message);
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwError("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setPwSaving(true);
    setPwError(null);
    setPwSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar contraseña");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: any) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!profile) {
    return <p className="text-red-600 text-sm">Error al cargar el perfil.</p>;
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona tu nombre y contraseña de acceso</p>
      </div>

      {/* Account info */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Cuenta</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-900">{profile.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Miembro desde</span>
            <span className="text-gray-700">{new Date(profile.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
          {profile.memberships?.map((m: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-gray-500">{m.orgName}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"}`}>
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Display name */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Nombre de usuario</h2>
        <form onSubmit={handleNameSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre visible
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameSaved(false); }}
              placeholder="Tu nombre"
              maxLength={120}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-400 mt-1">Se muestra en tareas, comentarios y notificaciones.</p>
          </div>
          {nameError && <p className="text-sm text-red-600">{nameError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={nameSaving || !name.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {nameSaving ? "Guardando..." : "Guardar nombre"}
            </button>
            {nameSaved && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Guardado
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Password change */}
      {profile.hasPassword && (
        <div className="bg-white border rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Cambiar contraseña</h2>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setPwError(null); }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPwError(null); }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setPwError(null); }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoComplete="new-password"
              />
            </div>
            {pwError && <p className="text-sm text-red-600">{pwError}</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {pwSaving ? "Cambiando..." : "Cambiar contraseña"}
              </button>
              {pwSaved && (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Contraseña actualizada
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {!profile.hasPassword && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-700">
            Tu cuenta usa acceso por enlace mágico. No es necesario gestionar contraseña.
          </p>
        </div>
      )}

      {/* Notification preferences link */}
      <div className="bg-gray-50 border rounded-xl p-4">
        <p className="text-sm text-gray-600">
          Para gestionar tus preferencias de notificación, visita{" "}
          <Link href="/settings/notifications" className="text-indigo-600 hover:underline font-medium">
            Ajustes → Notificaciones
          </Link>.
        </p>
      </div>
    </div>
  );
}
