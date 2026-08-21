"use client";

import { AvisoError } from "@/components/ui/carga-remota";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Approval {
  id: string;
  action: string;
  status: string;
  details: string | null;
  createdAt: string;
  reviewedAt: string | null;
  caseId: string;
  case: { ref: string; deceased: { fullName: string } | null } | null;
  task: { title: string } | null;
  reviewer: { name: string | null; email: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  send_draft: "Enviar borrador",
  send_email: "Enviar email",
  mark_sent: "Marcar como enviado",
  generate_checklist: "Generar checklist",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Aprobada", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rechazada", color: "bg-red-100 text-red-700" },
};

const PAGE_SIZE = 30;

export function ApprovalsQueue() {
  const router = useRouter();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [refresco, setRefresco] = useState(0);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [acting, setActing] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrorCarga(null);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/approvals?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "Tu sesion ha caducado. Vuelve a entrar."
              : `El servidor ha respondido ${res.status}.`,
          );
        }
        return res.json();
      })
      .then((data) => {
        if (data && !controller.signal.aborted) {
          setApprovals(data.approvals);
          setTotal(data.total);
        }
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErrorCarga(e instanceof Error ? e.message : "No se han podido cargar los datos.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, statusFilter, refresco]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  /**
   * Aprueba o rechaza, y sólo lo da por hecho si el servidor lo confirma.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Antes era un `fetch` a pelo, sin `try`, sin mensaje de error y sin
   * `finally`:
   *
   *   - con un 403, un 404 o un 500, el `if (res.ok)` no entraba y **no
   *     pasaba absolutamente nada**: el usuario pulsaba «Aprobar», el botón
   *     volvía a su sitio y la aprobación seguía pendiente, sin una palabra;
   *   - con la red caída, `fetch` rechazaba, la línea `setActing(null)` no
   *     llegaba a ejecutarse y el botón se quedaba **bloqueado en «...»** para
   *     siempre, con una promesa sin capturar en la consola.
   *
   * Aprobar o rechazar es una decisión con consecuencias —se envían correos a
   * las familias—, así que no puede fallar en silencio ni aparentar éxito.
   */
  async function handleAction(id: string, status: "APPROVED" | "REJECTED") {
    // Doble clic: la segunda pulsación no entra mientras la primera vuela.
    if (acting) return;
    setActing(id);
    setErrorAccion(null);
    setExito(null);
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      // Con red de seguridad: un 502 del proxy devuelve HTML y `res.json()` a
      // secas soltaria «Unexpected token '<'» como mensaje al usuario.
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorAccion(
          cuerpo?.error ??
            (res.status === 403
              ? "No tienes permiso para revisar aprobaciones."
              : res.status === 404
                ? "La aprobacion ya no existe. Actualiza la lista."
                : res.status === 409
                  ? "Esta aprobacion ya ha sido revisada por otra persona."
                  : `El servidor ha respondido ${res.status}.`),
        );
        return;
      }
      // Sólo aquí cambia el estado en pantalla.
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status, reviewedAt: new Date().toISOString() } : a
        )
      );
      setExito(status === "APPROVED" ? "Aprobacion registrada." : "Rechazo registrado.");
      // Refresca el contador del encabezado, que lo pinta el servidor.
      router.refresh();
    } catch {
      setErrorAccion("No se ha podido completar: error de red. Nada ha cambiado.");
    } finally {
      // En `finally`: si no, un rechazo de `fetch` dejaba el boton inutilizable.
      setActing(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { value: "PENDING", label: "Pendientes" },
          { value: "APPROVED", label: "Aprobadas" },
          { value: "REJECTED", label: "Rechazadas" },
          { value: "", label: "Todas" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            data-testid={`pestana-${tab.value || "todas"}`}
            aria-pressed={statusFilter === tab.value}
            className={`px-4 py-1.5 text-sm rounded-md transition ${
              statusFilter === tab.value
                ? "bg-white shadow font-medium"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <div className="text-sm text-gray-500" data-testid="recuento-aprobaciones">
        {total} aprobacion{total !== 1 ? "es" : ""}
      </div>

      {/* Resultado de la ultima accion */}
      {errorAccion && (
        <p
          role="alert"
          data-testid="error-accion-aprobacion"
          className="text-sm rounded-md px-3 py-2 bg-red-50 text-red-700 border border-red-200"
        >
          {errorAccion}
        </p>
      )}
      {exito && (
        <p
          role="status"
          data-testid="exito-accion-aprobacion"
          className="text-sm rounded-md px-3 py-2 bg-green-50 text-green-700 border border-green-200"
        >
          {exito}
        </p>
      )}

      {/* Queue */}
      <div className="space-y-3">
        {errorCarga ? (
          <AvisoError
            mensaje={errorCarga}
            que="las aprobaciones"
            onReintentar={() => setRefresco((n) => n + 1)}
          />
        ) : loading ? (
          <div className="bg-white rounded-lg border px-6 py-12 text-center text-gray-400">
            Cargando...
          </div>
        ) : approvals.length === 0 ? (
          <div className="bg-white rounded-lg border px-6 py-12 text-center text-gray-400">
            {statusFilter === "PENDING"
              ? "No hay acciones pendientes de aprobacion"
              : "No hay aprobaciones con este filtro"}
          </div>
        ) : (
          approvals.map((a) => {
            const config = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PENDING;
            const isExpanded = expandedId === a.id;
            return (
              <div key={a.id} className="bg-white rounded-lg border overflow-hidden">
                <div className="px-4 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-sm font-medium">
                          {ACTION_LABELS[a.action] ?? a.action}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        {a.case && (
                          <Link href={`/cases/${a.caseId}`} className="text-primary hover:underline font-mono text-xs">
                            {a.case.ref}
                          </Link>
                        )}
                        {a.case?.deceased && (
                          <span>{a.case.deceased.fullName}</span>
                        )}
                        {a.task && (
                          <span className="truncate">{a.task.title}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(a.createdAt).toLocaleString("es-ES")}
                        {a.reviewer && a.reviewedAt && (
                          <span>
                            {" "}— revisada por {a.reviewer.name || a.reviewer.email}
                            {" el "}
                            {new Date(a.reviewedAt).toLocaleString("es-ES")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {a.details && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : a.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Ocultar" : "Ver"} detalle de ${ACTION_LABELS[a.action] ?? a.action}${a.case ? ` (${a.case.ref})` : ""}`}
                          className="px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50"
                        >
                          {isExpanded ? "Ocultar" : "Ver detalle"}
                        </button>
                      )}
                      {a.status === "PENDING" && (
                        <>
                          {/*
                            Con «Aprobar» a secas los botones de todas las
                            filas tenian el mismo nombre accesible y no habia
                            forma de saber sobre cual se estaba actuando.
                          */}
                          <button
                            onClick={() => handleAction(a.id, "APPROVED")}
                            disabled={acting !== null}
                            aria-label={`Aprobar: ${ACTION_LABELS[a.action] ?? a.action}${a.case ? ` (${a.case.ref})` : ""}`}
                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            {acting === a.id ? "..." : "Aprobar"}
                          </button>
                          <button
                            onClick={() => handleAction(a.id, "REJECTED")}
                            disabled={acting !== null}
                            aria-label={`Rechazar: ${ACTION_LABELS[a.action] ?? a.action}${a.case ? ` (${a.case.ref})` : ""}`}
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && a.details && (
                  <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t">
                    {/*
                      `<pre>` con el texto como hijo de React: el contenido se
                      escapa siempre. Nada de `dangerouslySetInnerHTML`, que es
                      lo unico que podria ejecutar lo que venga en `details`.
                    */}
                    <pre data-testid={`detalle-${a.id}`} className="whitespace-pre-wrap text-sm font-mono text-gray-700 leading-relaxed max-h-96 overflow-y-auto">
                      {a.details}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
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
