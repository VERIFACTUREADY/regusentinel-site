"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Alert {
  id: string;
  kind: string;
  recipient: string;
  createdAt: string;
  case: { id: string; ref: string } | null;
}

const KIND_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  TASK_OVERDUE:        { label: "Tarea vencida",         color: "bg-red-50",    dot: "bg-red-500"   },
  ISD_7D:             { label: "ISD — vence en 7d",      color: "bg-red-50",    dot: "bg-red-500"   },
  TASK_STUCK:         { label: "Tarea bloqueada +7d",    color: "bg-orange-50", dot: "bg-orange-500" },
  PORTAL_MESSAGE:     { label: "Mensaje de familia",     color: "bg-blue-50",   dot: "bg-blue-500"  },
  ISD_30D:            { label: "ISD — vence en 30d",     color: "bg-amber-50",  dot: "bg-amber-500" },
  ISD_60D:            { label: "ISD — vence en 60d",     color: "",             dot: "bg-blue-400"  },
  ISD_1D:             { label: "ISD — mañana",           color: "bg-red-50",    dot: "bg-red-600"   },
  ISD_PASSED:         { label: "ISD vencido",            color: "bg-red-50",    dot: "bg-red-700"   },
  FAMILY_DOCS_REMINDER: { label: "Recordatorio docs",   color: "",             dot: "bg-blue-500"  },
};

const HIGH_URGENCY = new Set(["TASK_OVERDUE", "ISD_7D", "ISD_1D", "ISD_PASSED"]);

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [descartando, setDescartando] = useState<Set<string>>(new Set());
  const [errorDescarte, setErrorDescarte] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fetchUnread() {
      fetch("/api/notifications/unread")
        .then(async (r) => {
          if (!r.ok) throw new Error(`El servidor ha respondido ${r.status}.`);
          return r.json();
        })
        .then((data) => {
          if (!data) throw new Error("Respuesta inesperada del servidor.");
          setErrorCarga(null);
          setCount(data.unreadCount ?? 0);
          setAlerts(data.alerts ?? []);
        })
        .catch((e: unknown) => {
          /*
           * La campana no puede seguir mostrando el contador anterior como si
           * fuera actual. Se vacia y se marca el fallo, y —esto es lo que
           * faltaba— el desplegable PINTA ese fallo: antes lo guardaba en el
           * estado y no lo enseñaba en ninguna parte, asi que al abrirlo decia
           * «Sin notificaciones pendientes» con la peticion caida.
           */
          setCount(0);
          setAlerts([]);
          setErrorCarga(e instanceof Error ? e.message : "Error de red.");
        });
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, [reintento]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /**
   * Descarta una alerta y sólo la da por descartada si el servidor lo confirma.
   *
   * DOS DEFECTOS QUE CORRIGE
   * ------------------------
   * 1. EL CONTADOR BAJABA DOS VECES. Antes hacía `setCount(c => c - 1)` y
   *    además el contador visible se calculaba como `count - dismissed.size`,
   *    que ya descuenta lo descartado. Con tres alertas, descartar una dejaba
   *    el contador en 1 en vez de 2. Ahora `count` no se toca: la única resta
   *    es la de `dismissed`, que es la que corresponde a lo que se ve.
   *
   * 2. ERA UN DISPARO AL AIRE. El POST terminaba en `.catch(() => {})`: con un
   *    403, un 500 o la red caída la alerta desaparecía de la pantalla
   *    igualmente y volvía en la siguiente recarga, sin que nadie supiera por
   *    qué. Ahora, si el servidor no confirma, se deshace el descarte —la
   *    alerta vuelve a su sitio— y se dice.
   *
   * El descarte sigue siendo optimista a propósito: la alerta se va en el acto
   * y sólo vuelve si falla. Esperar a la respuesta para ocultarla haría la
   * campana lenta sin ganar nada.
   */
  const dismiss = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Doble clic: si ya está en marcha, no se repite.
    if (descartando.has(id)) return;

    setDescartando((prev) => new Set(prev).add(id));
    setDismissed((prev) => new Set(prev).add(id));
    setErrorDescarte(null);

    const deshacer = () => {
      setDismissed((prev) => {
        const copia = new Set(prev);
        copia.delete(id);
        return copia;
      });
    };

    try {
      const res = await fetch("/api/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        deshacer();
        setErrorDescarte(
          cuerpo?.error ??
            (res.status === 403
              ? "No tienes permiso para descartar avisos."
              : res.status === 404
                ? "El aviso ya no existe."
                : `No se ha podido descartar (${res.status}).`),
        );
      }
    } catch {
      deshacer();
      setErrorDescarte("No se ha podido descartar: error de red.");
    } finally {
      setDescartando((prev) => {
        const copia = new Set(prev);
        copia.delete(id);
        return copia;
      });
    }
  }, [descartando]);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));
  const urgentCount = visibleAlerts.filter((a) => HIGH_URGENCY.has(a.kind)).length;
  // Una sola resta: `count` viene del servidor y `dismissed` es lo que el
  // usuario ha quitado en esta sesión.
  const displayCount = Math.max(0, count - dismissed.size);
  // Con la consulta caída no hay contador que enseñar: un 0 ahí sería un dato
  // inventado. Se marca el fallo en el botón y se explica al abrirlo.
  const hayFallo = errorCarga !== null;

  return (
    <div className="relative" ref={ref}>
      {/*
        `title` NO es un nombre accesible fiable: es una ayuda emergente. El
        boton solo contenia un SVG, asi que su nombre dependia de esa ayuda.
        Ahora lo lleva en `aria-label`, y ademas dice CUANTAS hay o que la
        consulta ha fallado, que es la informacion que el contador da
        visualmente y el lector de pantalla no recibia.
      */}
      <button
        onClick={() => setOpen(!open)}
        data-testid="campana-notificaciones"
        aria-label={
          hayFallo
            ? "Notificaciones: no se han podido consultar"
            : displayCount > 0
              ? `Notificaciones: ${displayCount} sin leer`
              : "Notificaciones: ninguna pendiente"
        }
        aria-expanded={open}
        className="relative p-1.5 text-gray-400 hover:text-gray-600 transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {hayFallo ? (
          /* Un «!» en vez de un cero: el cero seria un dato que no se tiene. */
          <span
            data-testid="campana-fallo"
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
          >
            !
          </span>
        ) : displayCount > 0 ? (
          <span
            data-testid="campana-contador"
            aria-hidden="true"
            className={`absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 ${urgentCount > 0 ? "bg-red-500" : "bg-blue-500"}`}
          >
            {displayCount > 99 ? "99+" : displayCount}
          </span>
        ) : null}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border z-50" style={{ width: "22rem" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {urgentCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">{urgentCount} urgente{urgentCount !== 1 ? "s" : ""}</span>
              )}
              {displayCount > 0 && <span className="text-xs text-gray-400">{displayCount} total</span>}
            </div>
          </div>

          {errorDescarte && (
            <p
              role="alert"
              data-testid="error-descartar-aviso"
              className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900"
            >
              {errorDescarte} El aviso sigue ahi.
            </p>
          )}

          <div className="max-h-96 overflow-y-auto divide-y">
            {hayFallo ? (
              /*
                EL DEFECTO QUE CORRIGE: `errorCarga` se guardaba y no se
                pintaba en ningun sitio, asi que al abrir la campana con la
                peticion caida se leia «Sin notificaciones pendientes». Cero
                avisos y «no he podido preguntar» son cosas distintas.
              */
              <div role="alert" data-testid="fallo-campana" className="px-4 py-6 text-center">
                <p className="text-sm font-medium text-gray-900">
                  No se han podido cargar las notificaciones
                </p>
                <p className="text-xs text-gray-500 mt-1">{errorCarga}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Puede haber avisos que no se esten mostrando.
                </p>
                <button
                  onClick={() => setReintento((n) => n + 1)}
                  className="mt-3 text-sm bg-primary text-white rounded-md px-4 py-1.5 hover:opacity-90 transition"
                >
                  Reintentar
                </button>
              </div>
            ) : visibleAlerts.length === 0 ? (
              <p data-testid="campana-vacia" className="px-4 py-8 text-center text-sm text-gray-400">
                Sin notificaciones pendientes
              </p>
            ) : (
              visibleAlerts.map((alert) => {
                const cfg = KIND_CONFIG[alert.kind] || { label: alert.kind, color: "", dot: "bg-gray-400" };
                const urgent = HIGH_URGENCY.has(alert.kind);
                return (
                  <div key={alert.id} className={`group px-4 py-3 hover:bg-gray-50 transition-colors ${cfg.color}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${urgent ? "text-red-800" : "text-gray-800"}`}>
                          {cfg.label}
                        </p>
                        {alert.recipient && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{alert.recipient}</p>
                        )}
                        {alert.case && (
                          <Link
                            href={`/cases/${alert.case.id}`}
                            className="text-xs text-primary hover:underline font-mono"
                            onClick={() => setOpen(false)}
                          >
                            {alert.case.ref} →
                          </Link>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(alert.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {/*
                        `aria-label` con la alerta concreta: con «Descartar» a
                        secas, todos los botones del desplegable tenian el
                        mismo nombre y no habia forma de saber cual se estaba
                        pulsando. `focus:opacity-100` tampoco es un adorno: con
                        `opacity-0` el boton se podia enfocar con el teclado
                        pero seguia siendo invisible.
                      */}
                      <button
                        onClick={(e) => void dismiss(alert.id, e)}
                        disabled={descartando.has(alert.id)}
                        data-testid={`descartar-${alert.id}`}
                        aria-label={`Descartar: ${cfg.label}${alert.case ? ` (${alert.case.ref})` : ""}`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-200 shrink-0 mt-0.5 disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center text-sm text-primary hover:bg-gray-50 border-t font-medium rounded-b-xl"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </div>
  );
}
