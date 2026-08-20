"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ETIQUETA_ESTADO } from "@/lib/invitaciones";

/**
 * Panel de invitaciones.
 *
 * POR QUE EXISTE
 * --------------
 * El aviso de fallo de correo decia "usa Reenviar invitacion" y ese boton no
 * existia en ninguna parte. Mandar al usuario a pulsar algo inexistente es peor
 * que no decir nada: le hace buscar durante un rato antes de rendirse.
 *
 * Aqui estan de verdad: reenviar, revocar, y el estado de cada una.
 */

interface Invitacion {
  id: string;
  email: string;
  role: string;
  estado: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  resendCount: number;
  invitadaPor: string | null;
}

const COLOR_ESTADO: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-green-100 text-green-700",
  REVOKED: "bg-gray-200 text-gray-600",
  EXPIRED: "bg-red-100 text-red-700",
};

export function InvitacionesPanel() {
  const [invitaciones, setInvitaciones] = useState<Invitacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "warn" | "err"; texto: string } | null>(null);
  const [recarga, setRecarga] = useState(0);
  const router = useRouter();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/invitations");
      if (!res.ok) throw new Error(`El servidor ha respondido ${res.status}.`);
      setInvitaciones(await res.json());
    } catch (e) {
      // No se deja la lista vacia en silencio: una lista vacia y una lista que
      // no ha cargado se ven igual, y significan cosas opuestas.
      setInvitaciones(null);
      setError(e instanceof Error ? e.message : "No se han podido cargar las invitaciones.");
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar, recarga]);

  // El formulario de invitacion avisa al dar de alta a alguien. Sin esto, la
  // persona recien invitada no aparecia aqui hasta recargar la pagina.
  useEffect(() => {
    const alCambiar = () => setRecarga((n) => n + 1);
    window.addEventListener("heredia:invitaciones-cambiadas", alCambiar);
    return () => window.removeEventListener("heredia:invitaciones-cambiadas", alCambiar);
  }, []);

  async function reenviar(inv: Invitacion) {
    setOcupado(inv.id);
    setAviso(null);
    try {
      const res = await fetch(`/api/invitations/${inv.id}/resend`, { method: "POST" });
      // `.catch(() => null)`: si la respuesta no es JSON —un 500 con pagina de
      // error, un 502 del proxy— `res.json()` lanzaba y el usuario leia
      // "Unexpected token '<'" en vez de un motivo.
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `El servidor ha respondido ${res.status}.`);
      }

      setAviso(
        data.emailSent
          ? { tipo: "ok", texto: `Invitacion reenviada a ${inv.email}. El enlace anterior queda anulado.` }
          : {
              tipo: "warn",
              texto: `Se ha generado un enlace nuevo para ${inv.email}, pero NO se ha podido enviar el correo.`,
            },
      );
      setRecarga((n) => n + 1);
    } catch (e) {
      setAviso({
        tipo: "err",
        texto: `No se ha podido reenviar la invitacion de ${inv.email}: ${
          e instanceof Error && e.message ? e.message : "error de red"
        }`,
      });
    } finally {
      setOcupado(null);
    }
  }

  async function revocar(inv: Invitacion) {
    if (!confirm(`Revocar la invitacion de ${inv.email}? Perdera el acceso y su enlace dejara de servir.`)) {
      return;
    }
    setOcupado(inv.id);
    setAviso(null);
    try {
      const res = await fetch(`/api/invitations/${inv.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `El servidor ha respondido ${res.status}.`);
      }

      setAviso({ tipo: "ok", texto: `Invitacion de ${inv.email} revocada.` });
      setRecarga((n) => n + 1);
      router.refresh();
    } catch (e) {
      setAviso({
        tipo: "err",
        texto: `No se ha podido revocar la invitacion de ${inv.email}: ${
          e instanceof Error && e.message ? e.message : "error de red"
        }`,
      });
    } finally {
      setOcupado(null);
    }
  }

  if (error) {
    return (
      <div
        role="alert"
        data-testid="invitaciones-error"
        className="mb-6 bg-white border border-red-200 rounded-lg p-4 text-center"
      >
        <p className="text-sm font-medium text-gray-900">No se han podido cargar las invitaciones</p>
        <p className="text-xs text-gray-500 mt-1">{error}</p>
        <button
          onClick={() => setRecarga((n) => n + 1)}
          className="mt-3 text-sm bg-primary text-white rounded-md px-4 py-1.5 hover:opacity-90"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!invitaciones) {
    return (
      <p data-testid="invitaciones-cargando" className="mb-6 text-sm text-gray-400">
        Cargando invitaciones...
      </p>
    );
  }

  // Las aceptadas ya figuran en la lista de miembros: repetirlas aqui solo
  // alarga la pantalla.
  const vivas = invitaciones.filter((i) => i.estado !== "ACCEPTED");

  return (
    <div className="mb-6" data-testid="invitaciones-panel">
      <h3 className="font-semibold mb-3">Invitaciones</h3>

      {aviso && (
        <p
          role={aviso.tipo === "err" ? "alert" : "status"}
          data-testid={aviso.tipo === "err" ? "invitaciones-aviso-error" : "invitaciones-aviso"}
          className={`mb-3 text-sm ${
            aviso.tipo === "ok"
              ? "text-green-600"
              : aviso.tipo === "warn"
                ? "text-amber-700"
                : "text-red-600"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {vivas.length === 0 ? (
        <p
          data-testid="invitaciones-vacio"
          className="text-sm text-gray-500 bg-white border rounded-lg p-4"
        >
          No hay invitaciones pendientes.
        </p>
      ) : (
        <div className="bg-white border rounded-lg divide-y">
          {vivas.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{inv.email}</p>
                <p className="text-xs text-gray-500">
                  {inv.role}
                  {inv.resendCount > 0 && ` · reenviada ${inv.resendCount} vez/veces`}
                  {inv.estado === "PENDING" &&
                    ` · caduca el ${new Date(inv.expiresAt).toLocaleDateString("es-ES")}`}
                </p>
              </div>

              <span
                className={`text-xs px-2 py-0.5 rounded-full ${COLOR_ESTADO[inv.estado]}`}
                data-testid={`estado-${inv.email}`}
              >
                {ETIQUETA_ESTADO[inv.estado]}
              </span>

              {inv.estado !== "REVOKED" && (
                <div className="flex gap-2">
                  {/*
                    El nombre accesible lleva el correo: con varias invitaciones
                    en pantalla, "Reenviar invitacion" a secas se repite igual en
                    todas y no dice de cual.
                  */}
                  <button
                    onClick={() => reenviar(inv)}
                    disabled={ocupado === inv.id}
                    aria-label={`Reenviar invitacion a ${inv.email}`}
                    className="text-xs border border-gray-300 rounded px-2.5 py-1 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {ocupado === inv.id ? "..." : "Reenviar invitacion"}
                  </button>
                  <button
                    onClick={() => revocar(inv)}
                    disabled={ocupado === inv.id}
                    aria-label={`Revocar invitacion de ${inv.email}`}
                    className="text-xs border border-red-300 text-red-700 rounded px-2.5 py-1 hover:bg-red-50 disabled:opacity-50"
                  >
                    Revocar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
