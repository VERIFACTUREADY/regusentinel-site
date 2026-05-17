"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BrandingState {
  brandDisplayName: string;
  brandLogoUrl: string;
  brandPrimaryColor: string;
  brandSupportEmail: string;
  brandFooterText: string;
}

const empty: BrandingState = {
  brandDisplayName: "",
  brandLogoUrl: "",
  brandPrimaryColor: "",
  brandSupportEmail: "",
  brandFooterText: "",
};

export default function BrandingPage() {
  const [form, setForm] = useState<BrandingState>(empty);
  const [orgName, setOrgName] = useState("");
  const [plan, setPlan] = useState<string>("INICIA");
  const [canHide, setCanHide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/branding")
      .then((r) => r.json())
      .then((data) => {
        setOrgName(data.org?.name ?? "");
        setPlan(data.plan ?? "INICIA");
        setCanHide(!!data.canHideAttribution);
        setForm({
          brandDisplayName: data.org?.brandDisplayName ?? "",
          brandLogoUrl: data.org?.brandLogoUrl ?? "",
          brandPrimaryColor: data.org?.brandPrimaryColor ?? "",
          brandSupportEmail: data.org?.brandSupportEmail ?? "",
          brandFooterText: data.org?.brandFooterText ?? "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function update<K extends keyof BrandingState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setFlash(null);
    const res = await fetch("/api/settings/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setFlash("Marca actualizada");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Error al guardar");
    }
    setSaving(false);
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;

  const displayName = form.brandDisplayName || orgName;
  const primary = form.brandPrimaryColor || "#6366f1";

  const settingsNav = [
    { href: "/settings/general", label: "General" },
    { href: "/settings/branding", label: "Marca" },
    { href: "/settings/users", label: "Usuarios" },
    { href: "/settings/notifications", label: "Notificaciones" },
  ];

  return (
    <div className="max-w-4xl">
      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b">
        {settingsNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              item.href === "/settings/branding"
                ? "bg-white border border-b-white text-indigo-600 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Marca del portal familia</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lo que ven las familias cuando acceden al portal de seguimiento.
          </p>
        </div>
        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-500">Plan: {plan}</span>
      </div>

      {!canHide && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Tu plan actual (<strong>{plan}</strong>) permite personalizar logo, colores y textos. El pie
          &quot;Powered by BARITUR PRO&quot; seguira apareciendo en el portal hasta que actives el plan
          <strong> Despacho</strong> o <strong>Firma</strong>.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre para mostrar
            </label>
            <input
              value={form.brandDisplayName}
              onChange={(e) => update("brandDisplayName", e.target.value)}
              placeholder={orgName}
              maxLength={80}
              className="w-full px-3 py-2 border rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              Texto que aparece en la cabecera. Por defecto, el nombre de tu organizacion.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL del logo</label>
            <input
              type="url"
              value={form.brandLogoUrl}
              onChange={(e) => update("brandLogoUrl", e.target.value)}
              placeholder="https://tu-dominio.com/logo.png"
              className="w-full px-3 py-2 border rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              PNG o SVG alojado publicamente. Recomendado 240x60px.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color principal</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.brandPrimaryColor || "#6366f1"}
                onChange={(e) => update("brandPrimaryColor", e.target.value)}
                className="w-12 h-10 border rounded cursor-pointer"
              />
              <input
                value={form.brandPrimaryColor}
                onChange={(e) => update("brandPrimaryColor", e.target.value)}
                placeholder="#1e40af"
                maxLength={7}
                className="flex-1 px-3 py-2 border rounded-md font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email de soporte para familias
            </label>
            <input
              type="email"
              value={form.brandSupportEmail}
              onChange={(e) => update("brandSupportEmail", e.target.value)}
              placeholder="contacto@tu-despacho.com"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Texto de pie de portal
            </label>
            <textarea
              value={form.brandFooterText}
              onChange={(e) => update("brandFooterText", e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Firma con tu aviso legal, despacho responsable, etc."
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar marca"}
            </button>
            {flash && <span className="text-sm text-green-600">{flash}</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Vista previa del portal
          </p>
          <div className="rounded-lg border overflow-hidden bg-gray-50">
            <div
              className="border-b px-4 py-3 bg-white flex items-center gap-3"
              style={{ borderBottomColor: primary }}
            >
              {form.brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.brandLogoUrl}
                  alt="logo"
                  className="h-8 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <div className="h-8 w-8 rounded" style={{ backgroundColor: primary }} />
              )}
              <div>
                <p className="font-semibold text-gray-900 text-sm">{displayName || "Tu despacho"}</p>
                <p className="text-xs text-gray-500">Portal de seguimiento</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-white p-3 rounded border">
                <p className="text-xs text-gray-500">Expediente</p>
                <p className="font-semibold">EXP-2026-0001</p>
              </div>
              <button
                className="w-full py-2 rounded text-sm font-medium text-white"
                style={{ backgroundColor: primary }}
              >
                Subir documento
              </button>
              <div className="pt-3 text-center text-xs text-gray-500 space-y-1">
                {form.brandFooterText ? (
                  <p>{form.brandFooterText}</p>
                ) : (
                  <p>Responsable del tratamiento: {displayName || "tu despacho"}.</p>
                )}
                {form.brandSupportEmail && (
                  <p>
                    Contacto:{" "}
                    <a style={{ color: primary }} className="underline">
                      {form.brandSupportEmail}
                    </a>
                  </p>
                )}
                {!canHide && <p className="text-gray-400">Powered by BARITUR PRO</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
