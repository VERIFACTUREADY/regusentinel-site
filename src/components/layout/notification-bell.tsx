"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Alert {
  id: string;
  kind: string;
  recipient: string;
  createdAt: string;
  case: { id: string; ref: string } | null;
}

const KIND_LABELS: Record<string, string> = {
  ISD_60D: "Plazo ISD — 60 dias",
  ISD_30D: "Plazo ISD — 30 dias",
  ISD_7D: "Plazo ISD — 7 dias",
  ISD_1D: "Plazo ISD — manana",
  ISD_PASSED: "Plazo ISD vencido",
  FAMILY_DOCS_REMINDER: "Recordatorio docs familia",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fetchUnread() {
      fetch("/api/notifications/unread")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setCount((prev) => (prev !== data.unreadCount ? data.unreadCount : prev));
          setAlerts(data.alerts);
        })
        .catch(() => {});
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
            {count > 0 && (
              <span className="text-xs text-gray-400">{count} esta semana</span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Sin notificaciones recientes</p>
            ) : (
              alerts.map((alert) => {
                const isUrgent = alert.kind.includes("1D") || alert.kind === "ISD_PASSED";
                return (
                  <div
                    key={alert.id}
                    className={`px-4 py-3 border-b last:border-0 hover:bg-gray-50 ${isUrgent ? "bg-red-50/50" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${isUrgent ? "bg-red-500" : "bg-blue-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {KIND_LABELS[alert.kind] || alert.kind}
                        </p>
                        {alert.case && (
                          <Link
                            href={`/cases/${alert.case.id}`}
                            className="text-xs text-primary hover:underline"
                            onClick={() => setOpen(false)}
                          >
                            {alert.case.ref}
                          </Link>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(alert.createdAt).toLocaleString("es-ES")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center text-sm text-primary hover:bg-gray-50 border-t font-medium"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </div>
  );
}
