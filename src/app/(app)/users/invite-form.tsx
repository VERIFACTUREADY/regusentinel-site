"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INVITABLE_ROLES } from "@/lib/constants";

export function InviteForm() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("OPERATOR");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "warn" | "err"; text: string } | null>(null);
  const router = useRouter();

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al invitar");

      /*
       * No se anuncia "Invitacion enviada" sin saber si ha salido.
       *
       * El endpoint devuelve `emailSent`. Cuando el correo falla, el alta ES
       * correcta —la persona ya es miembro— pero no se ha enterado, y decirle
       * al administrador que se envio le deja esperando a alguien que nunca va
       * a recibir nada. Se distingue un caso del otro.
       */
      if (data.emailSent === false) {
        setMessage({
          type: "warn",
          text:
            `${email} ya es miembro, pero NO se ha podido enviar el correo. ` +
            (data.needsPasswordSetup
              ? "Necesita el enlace para crear su contrasena: usa \u201cReenviar invitacion\u201d cuando el correo vuelva a funcionar."
              : "Avisale de que ya puede entrar con su cuenta habitual."),
        });
      } else {
        setMessage({ type: "ok", text: `Invitacion enviada a ${email}` });
      }
      setEmail("");
      setRole("OPERATOR");
      /*
       * `router.refresh()` refresca los componentes de servidor, pero el panel
       * de invitaciones es de cliente y trae su lista por su cuenta: sin este
       * aviso, invitabas a alguien y no aparecia en la lista hasta recargar la
       * pagina a mano.
       */
      window.dispatchEvent(new CustomEvent("heredia:invitaciones-cambiadas"));
      router.refresh();
    } catch (err: any) {
      setMessage({ type: "err", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Invitar miembro
      </button>
    );
  }

  return (
    <div className="mb-6 bg-white border rounded-lg p-6">
      <h3 className="font-semibold mb-4">Invitar nuevo miembro</h3>
      {/*
        Los dos campos no tenian NINGUNA etiqueta: solo un `placeholder`, que no
        lo es —desaparece al escribir— y un `<select>` mudo. Un lector de
        pantalla anunciaba "cuadro de edicion" y "lista" sin decir de que.
      */}
      <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <label htmlFor="invitarEmail" className="sr-only">
            Email de la persona invitada
          </label>
          <input
            id="invitarEmail"
            type="email"
            required
            placeholder="email@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
        <label htmlFor="invitarRol" className="sr-only">
          Rol de la persona invitada
        </label>
        <select
          id="invitarRol"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          {INVITABLE_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar invitacion"}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setMessage(null); }}
            className="px-4 py-2 border text-sm rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </form>
      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === "ok"
              ? "text-green-600"
              : message.type === "warn"
                ? "text-amber-700"
                : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
