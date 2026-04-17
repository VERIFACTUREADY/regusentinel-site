"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
  { href: "/cases", label: "Expedientes", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { href: "/billing", label: "Facturacion", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { href: "/settings/users", label: "Usuarios", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" },
  { href: "/settings/branding", label: "Marca", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
  { href: "/settings/general", label: "Ajustes", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export interface TrialInfo {
  plan: string;
  daysLeft: number;
}

export function AppShell({
  session,
  isDemoOrg = false,
  trialInfo,
  children,
}: {
  session: Session;
  isDemoOrg?: boolean;
  trialInfo?: TrialInfo | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isOwner = session.user.role === "OWNER";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {isDemoOrg && <DemoBanner />}
      {trialInfo && <TrialBanner plan={trialInfo.plan} daysLeft={trialInfo.daysLeft} />}
      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="text-xl font-bold text-primary">BARITUR PRO</Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
                pathname?.startsWith(item.href) ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-100"
              }`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
          {isOwner && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
              </div>
              <Link
                href="/admin/demo-requests"
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
                  pathname?.startsWith("/admin/demo-requests") ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Leads demo
              </Link>
              <Link
                href="/admin/metrics"
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
                  pathname?.startsWith("/admin/metrics") ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Métricas
              </Link>
            </>
          )}
        </nav>
        <div className="p-4 border-t text-xs text-gray-400">
          <p>BARITUR no presta asesoramiento juridico ni fiscal individual.</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session.user.name || session.user.email}</span>
            <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-500">{session.user.role}</span>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-gray-500 hover:text-red-600">
              Cerrar sesion
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}

function TrialBanner({ plan, daysLeft }: { plan: string; daysLeft: number }) {
  const urgent = daysLeft <= 3;
  return (
    <div
      className={`px-4 py-2 text-sm flex flex-wrap items-center justify-center gap-x-4 gap-y-1 ${
        urgent
          ? "bg-red-500 text-white"
          : "bg-blue-500 text-white"
      }`}
    >
      <span className="font-semibold">
        Plan {plan} en prueba — {daysLeft <= 0 ? "expira hoy" : daysLeft === 1 ? "expira manana" : `quedan ${daysLeft} dias`}
      </span>
      <Link
        href="/billing"
        className="underline font-medium hover:opacity-80"
      >
        Activar suscripcion →
      </Link>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <span className="font-semibold">🎬 Estás en la demo de BARITUR PRO.</span>
      <span className="text-amber-900/80">Datos ficticios. Se reinician cada noche.</span>
      <Link
        href="/?source=demo_banner#demo"
        className="underline font-medium hover:text-amber-950/70"
      >
        Solicitar una reunión →
      </Link>
    </div>
  );
}
