"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_ROLES, ROLE_BADGE_COLORS } from "@/lib/constants";

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

/**
 * Motivo legible de una respuesta que no ha ido bien.
 *
 * EL DEFECTO QUE CORRIGE
 * ----------------------
 * Antes era `const data = await res.json(); throw new Error(data.error)`. Dos
 * fallos en una línea: si la respuesta no era JSON —un 500 con página de error,
 * un 502 del proxy— `res.json()` lanzaba y al usuario le aparecía
 * "Unexpected token '<'"; y si el cuerpo era JSON pero sin `error`, se lanzaba
 * `new Error(undefined)`, cuyo `message` es la cadena vacía: el párrafo de error
 * se pintaba VACÍO y la acción fallaba en silencio absoluto.
 */
async function motivo(res: Response): Promise<string> {
  const cuerpo = await res.json().catch(() => null);
  if (cuerpo?.error) return cuerpo.error;
  if (res.status === 401) return "Tu sesion ha caducado. Vuelve a entrar.";
  if (res.status === 403) return "No tienes permiso para esta accion.";
  if (res.status === 404) return "Este miembro ya no esta en la organizacion.";
  return `El servidor ha respondido ${res.status}.`;
}

export function MemberRow({ userId, name, email, role, roleLabel, joinedAt, isSelf, canManage, mobileActions }: Props) {
  const [changing, setChanging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const router = useRouter();

  const quien = name || email;

  async function changeRole(newRole: string) {
    setChanging(true);
    setError("");
    setExito("");
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error(await motivo(res));
      const etiqueta = ALL_ROLES.find((r) => r.value === newRole)?.label ?? newRole;
      setExito(`${quien} ahora es ${etiqueta}.`);
      router.refresh();
    } catch (err) {
      setError(
        `No se ha podido cambiar el rol de ${quien}: ${
          err instanceof Error && err.message ? err.message : "error de red"
        }`,
      );
    } finally {
      setChanging(false);
    }
  }

  async function removeMember() {
    if (!confirm(`Eliminar a ${quien} del equipo?`)) return;
    setRemoving(true);
    setError("");
    setExito("");
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await motivo(res));
      setExito(`${quien} ha salido del equipo.`);
      router.refresh();
    } catch (err) {
      setError(
        `No se ha podido eliminar a ${quien}: ${
          err instanceof Error && err.message ? err.message : "error de red"
        }`,
      );
    } finally {
      setRemoving(false);
    }
  }

  /*
   * Los nombres accesibles llevan el correo del miembro.
   *
   * Con varias filas, "Rol" y "Eliminar" a secas se repiten idénticos: ni quien
   * navega con lector de pantalla ni una prueba pueden saber sobre quién actúan.
   */
  const nombreSelect = `Cambiar rol de ${email}`;
  const nombreBorrar = `Eliminar del equipo a ${email}`;

  const avisos = (
    <>
      {error && (
        <p role="alert" data-testid={`error-miembro-${email}`} className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
      {exito && (
        <p role="status" data-testid={`exito-miembro-${email}`} className="text-xs text-green-700 mt-1">
          {exito}
        </p>
      )}
    </>
  );

  if (mobileActions) {
    return (
      <div className="mt-2">
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => changeRole(e.target.value)}
            disabled={changing}
            aria-label={nombreSelect}
            className="text-xs border rounded px-2 py-1 flex-1 min-w-0"
          >
            {ALL_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={removeMember}
            disabled={removing}
            aria-label={nombreBorrar}
            className="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-200 rounded shrink-0 disabled:opacity-50"
          >
            {removing ? "..." : "Eliminar"}
          </button>
        </div>
        {avisos}
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
            aria-label={nombreSelect}
            className={`text-xs px-2 py-1 rounded-full border-0 ${ROLE_BADGE_COLORS[role] ?? "bg-gray-100"} cursor-pointer`}
          >
            {ALL_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        ) : (
          <span className={`text-xs px-2 py-1 rounded-full ${ROLE_BADGE_COLORS[role] ?? "bg-gray-100"}`}>
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
              aria-label={nombreBorrar}
              className="text-xs text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
            >
              {removing ? "Eliminando..." : "Eliminar"}
            </button>
          )}
          {avisos}
        </td>
      )}
    </tr>
  );
}
