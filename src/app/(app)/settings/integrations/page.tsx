"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface IntegrationsState {
  slackWebhookUrl: string | null;
  teamsWebhookUrl: string | null;
  customWebhookUrl: string | null;
  customWebhookSecretConfigured: boolean;
  tier: string | null;
}

interface DispatchResult {
  ok: boolean;
  status?: number;
  error?: string;
}

const SETTINGS_NAV = [
  { href: "/settings/general", label: "General" },
  { href: "/settings/branding", label: "Marca" },
  { href: "/settings/users", label: "Usuarios" },
  { href: "/settings/notifications", label: "Notificaciones" },
  { href: "/settings/integrations", label: "Integraciones" },
];

export default function IntegrationsSettingsPage() {
  const [data, setData] = useState<IntegrationsState | null>(null);
  const [slack, setSlack] = useState("");
  const [teams, setTeams] = useState("");
  const [webhook, setWebhook] = useState("");
  const [secret, setSecret] = useState("");
  const [secretTouched, setSecretTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<"slack" | "teams" | "webhook" | null>(null);
  const [testResults, setTestResults] = useState<{ slack?: DispatchResult; teams?: DispatchResult; webhook?: DispatchResult }>({});

  useEffect(() => {
    fetch("/api/settings/integrations")
      .then((r) => r.json())
      .then((d: IntegrationsState) => {
        setData(d);
        setSlack(d.slackWebhookUrl ?? "");
        setTeams(d.teamsWebhookUrl ?? "");
        setWebhook(d.customWebhookUrl ?? "");
      })
      .catch(() => setError("No se pudieron cargar las integraciones"));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const body: Record<string, string | null> = {
        slackWebhookUrl: slack.trim() || "",
        teamsWebhookUrl: teams.trim() || "",
        customWebhookUrl: webhook.trim() || "",
      };
      if (secretTouched) body.customWebhookSecret = secret.trim();
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Error al guardar");
      } else {
        setData((prev) => prev && { ...prev, ...d });
        setSavedMessage("Cambios guardados");
        setSecretTouched(false);
        setSecret("");
        setTimeout(() => setSavedMessage(null), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function runTest(target: "slack" | "teams" | "webhook") {
    setTesting(target);
    setError(null);
    try {
      const res = await fetch("/api/settings/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const d = await res.json();
      setTestResults((prev) => ({ ...prev, [target]: d.results?.[target] }));
    } catch {
      setTestResults((prev) => ({ ...prev, [target]: { ok: false, error: "Error de conexión" } }));
    } finally {
      setTesting(null);
    }
  }

  const isFirma = data?.tier === "FIRMA";

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b">
        {SETTINGS_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              item.href === "/settings/integrations"
                ? "bg-white border border-b-white text-indigo-600 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <h1 className="text-2xl font-bold mb-2">Integraciones</h1>
      <p className="text-sm text-gray-500 mb-6">
        Conecta Radar ISD a tu Slack o a un webhook para recibir los plazos críticos del
        Modelo 650 fuera de Heredia.
      </p>

      {!data ? (
        <div className="bg-white rounded-lg border p-6 text-sm text-gray-500">Cargando…</div>
      ) : !isFirma ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <p className="text-sm text-amber-900 font-semibold mb-1">
            Disponible a partir del plan Firma
          </p>
          <p className="text-sm text-amber-800">
            Slack y los webhooks son parte del plan Firma. Tu plan actual:{" "}
            <strong>{data.tier ?? "ninguno"}</strong>.{" "}
            <Link href="/settings/general" className="text-amber-900 underline hover:no-underline">
              Cambiar plan →
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Slack */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Slack</h2>
                <p className="text-sm text-gray-500">
                  Pega un incoming webhook de Slack. Cada alerta de Radar ISD se publica como un mensaje formateado.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Incoming Webhook URL
              </label>
              <input
                type="text"
                value={slack}
                onChange={(e) => setSlack(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                ¿Cómo obtener uno?{" "}
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Slack: incoming webhooks
                </a>
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => runTest("slack")}
                disabled={!data.slackWebhookUrl || testing !== null}
                className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {testing === "slack" ? "Enviando…" : "Enviar evento de prueba"}
              </button>
              {testResults.slack && <DispatchPill result={testResults.slack} />}
            </div>
          </div>

          {/* Microsoft Teams */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Microsoft Teams</h2>
              <p className="text-sm text-gray-500">
                Pega un incoming webhook de un canal de Teams. Cada alerta del Radar ISD se publica como una MessageCard formateada.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Incoming Webhook URL
              </label>
              <input
                type="text"
                value={teams}
                onChange={(e) => setTeams(e.target.value)}
                placeholder="https://outlook.office.com/webhook/..."
                className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                ¿Cómo obtener uno?{" "}
                <a
                  href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Microsoft Learn: Incoming Webhooks
                </a>
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => runTest("teams")}
                disabled={!data.teamsWebhookUrl || testing !== null}
                className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {testing === "teams" ? "Enviando…" : "Enviar evento de prueba"}
              </button>
              {testResults.teams && <DispatchPill result={testResults.teams} />}
            </div>
          </div>

          {/* Custom webhook */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Webhook genérico</h2>
              <p className="text-sm text-gray-500">
                POST JSON con el evento serializado al endpoint que indiques. Si añades un secreto,
                firmamos cada request con HMAC-SHA256 en <code className="text-xs font-mono">X-HEREDIA-Signature</code>.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                URL del endpoint
              </label>
              <input
                type="text"
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://api.tuempresa.es/heredia/eventos"
                className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Secreto (HMAC-SHA256)
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => {
                  setSecret(e.target.value);
                  setSecretTouched(true);
                }}
                placeholder={
                  data.customWebhookSecretConfigured
                    ? "Configurado — deja vacío para no cambiar"
                    : "Mínimo 16 caracteres"
                }
                className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                El header llega como <code className="font-mono">sha256=&lt;hex&gt;</code>. En tu endpoint,
                verifícalo con el mismo secreto antes de procesar el payload.
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => runTest("webhook")}
                disabled={!data.customWebhookUrl || testing !== null}
                className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {testing === "webhook" ? "Enviando…" : "Enviar evento de prueba"}
              </button>
              {testResults.webhook && <DispatchPill result={testResults.webhook} />}
            </div>
          </div>

          {/* Save bar */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {savedMessage ? <span className="text-emerald-600">{savedMessage}</span> : null}
              {error ? <span className="text-red-600">{error}</span> : null}
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DispatchPill({ result }: { result: DispatchResult }) {
  if (result.ok) {
    return (
      <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded inline-flex items-center gap-1">
        ✓ {result.status} OK
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded inline-flex items-center gap-1" title={result.error}>
      ✕ {result.status ? `${result.status} · ` : ""}{(result.error ?? "error").slice(0, 50)}
    </span>
  );
}
