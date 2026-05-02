"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import type { NotifPrefs } from "@/lib/notif-prefs";

const PREFS_CONFIG: {
  key: keyof NotifPrefs;
  label: string;
  description: string;
  icon: string;
  color: string;
}[] = [
  {
    key: "dailyBriefing",
    label: "Resumen diario",
    description: "Email de bienvenida cada mañana (lunes–viernes) con tareas vencidas, agenda del día e ISD urgente.",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    color: "text-indigo-600",
  },
  {
    key: "weeklyDigest",
    label: "Digest semanal de plazos ISD",
    description: "Email semanal (lunes) con expedientes cuyos plazos ISD están próximos a vencer.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    color: "text-blue-600",
  },
  {
    key: "isdAlerts",
    label: "Alertas de plazo ISD",
    description: "Notificaciones individuales cuando un plazo ISD vence en 60, 30, 7 o 1 día, y cuando ya ha vencido.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "text-amber-600",
  },
  {
    key: "taskOverdue",
    label: "Tareas vencidas",
    description: "Alertas en el panel de notificaciones cuando una tarea supera su plazo sin completar.",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    color: "text-red-600",
  },
  {
    key: "portalMessage",
    label: "Mensajes del portal familiar",
    description: "Alertas cuando una familia envía un mensaje a través del portal de seguimiento.",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    color: "text-blue-600",
  },
];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        checked ? "bg-indigo-600" : "bg-gray-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

interface BriefingPreview {
  subject: string;
  html: string;
  totalItems: number;
  wouldSend: boolean;
}

function PreviewModal({ preview, onClose }: { preview: BriefingPreview; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Asunto</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{preview.subject}</p>
            {!preview.wouldSend && (
              <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                Hoy no se enviaría: sin urgencias ni tareas próximas.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <iframe
          srcDoc={preview.html}
          sandbox=""
          title="Vista previa del email"
          className="flex-1 w-full bg-gray-50 rounded-b-xl"
        />
      </div>
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BriefingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((data) => {
        setPrefs(data.prefs);
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudieron cargar las preferencias.");
        setLoading(false);
      });
  }, []);

  function toggle(key: keyof NotifPrefs) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
    setSaved(false);
  }

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/notifications/preview?type=daily-briefing");
      if (!res.ok) throw new Error("preview failed");
      const data = (await res.json()) as BriefingPreview;
      setPreview(data);
    } catch {
      setError("No se pudo generar la vista previa.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const data = await res.json();
      setPrefs(data.prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("No se pudieron guardar las preferencias.");
    } finally {
      setSaving(false);
    }
  }

  const settingsNav = [
    { href: "/settings/general", label: "General" },
    { href: "/settings/branding", label: "Marca" },
    { href: "/settings/users", label: "Usuarios" },
    { href: "/settings/notifications", label: "Notificaciones" },
  ];

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b">
        {settingsNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              item.href === "/settings/notifications"
                ? "bg-white border border-b-white text-indigo-600 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <h1 className="text-2xl font-bold mb-2">Preferencias de notificaciones</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configura qué alertas y resúmenes deseas recibir por email. Estos ajustes son individuales y no afectan a otros miembros del equipo.
      </p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error && !prefs ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      ) : prefs ? (
        <>
          <div className="bg-white border rounded-lg divide-y">
            {PREFS_CONFIG.map((cfg) => (
              <div key={cfg.key} className="flex items-center gap-4 px-6 py-4">
                <div className={`shrink-0 ${cfg.color}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={cfg.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{cfg.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{cfg.description}</p>
                </div>
                {cfg.key === "dailyBriefing" && (
                  <button
                    type="button"
                    onClick={loadPreview}
                    disabled={previewLoading}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium shrink-0 disabled:opacity-50"
                  >
                    {previewLoading ? "Cargando…" : "Vista previa"}
                  </button>
                )}
                <Toggle
                  checked={prefs[cfg.key]}
                  onChange={() => toggle(cfg.key)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>

          {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Guardado
              </span>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Nota:</strong> Las alertas de tareas vencidas y mensajes del portal también aparecen en el panel de notificaciones dentro de la aplicación, independientemente de estas preferencias de email.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
