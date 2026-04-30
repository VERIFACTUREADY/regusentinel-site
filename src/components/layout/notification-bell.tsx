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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fetchUnread() {
      fetch("/api/notifications/unread")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setCount(data.unreadCount ?? 0);
          setAlerts(data.alerts ?? []);
        })
        .catch(() => {});
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const dismiss = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDismissed((prev) => new Set([...Array.from(prev), id]));
    setCount((c) => Math.max(0, c - 1));
    // Fire-and-forget — if it's a synthetic id the server handles it gracefully
    fetch("/api/notifications/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, []);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));
  const urgentCount = visibleAlerts.filter((a) => HIGH_URGENCY.has(a.kind)).length;
  const displayCount = Math.max(0, count - dismissed.size);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-gray-400 hover:text-gray-600 transition"
        title="Notificaciones"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {displayCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 ${urgentCount > 0 ? "bg-red-500" : "bg-blue-500"}`}>
            {displayCount > 99 ? "99+" : displayCount}
          </span>
        )}
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

          <div className="max-h-96 overflow-y-auto divide-y">
            {visibleAlerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Sin notificaciones pendientes</p>
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
                      <button
                        onClick={(e) => dismiss(alert.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-200 shrink-0 mt-0.5"
                        title="Descartar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
