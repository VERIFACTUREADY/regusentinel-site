import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Actividad del portal — BARITUR PRO",
  robots: { index: false },
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return "< 1 min";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

interface CaseEngagement {
  caseId: string;
  ref: string;
  deceasedName: string | null;
  familyMessages: number;
  lastFamilyAt: Date | null;
}

export default async function PortalActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "cases.read")) redirect("/dashboard");

  const orgId = session.user.orgId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [
    msgs30d,
    msgs7d,
    unreadFamily,
    portalDocs30d,
    portalDocsTotal,
    openCasesWithMsgs,
    msgsForResponseTime,
    openCasesAll,
    activePortalsCount,
  ] = await Promise.all([
    safe(() => prisma.portalMessage.findMany({
      where: { case: { orgId, deletedAt: null }, createdAt: { gte: thirtyDaysAgo } },
      select: { caseId: true, fromFamily: true, createdAt: true },
      take: 5000,
    }), [] as { caseId: string; fromFamily: boolean; createdAt: Date }[]),

    safe(() => prisma.portalMessage.count({
      where: { case: { orgId, deletedAt: null }, createdAt: { gte: sevenDaysAgo } },
    }), 0),

    safe(() => prisma.portalMessage.count({
      where: { case: { orgId, deletedAt: null }, fromFamily: true, readAt: null },
    }), 0),

    safe(() => prisma.document.count({
      where: { case: { orgId, deletedAt: null }, isPortalUpload: true, createdAt: { gte: thirtyDaysAgo } },
    }), 0),

    safe(() => prisma.document.count({
      where: { case: { orgId, deletedAt: null }, isPortalUpload: true },
    }), 0),

    safe(() => prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "ARCHIVED"] },
        portalMessages: { some: { createdAt: { gte: thirtyDaysAgo }, fromFamily: true } },
      },
      select: {
        id: true,
        ref: true,
        deceased: { select: { fullName: true } },
        portalMessages: {
          where: { createdAt: { gte: thirtyDaysAgo }, fromFamily: true },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      take: 200,
    }), [] as any[]),

    safe(() => prisma.portalMessage.findMany({
      where: { case: { orgId, deletedAt: null }, createdAt: { gte: thirtyDaysAgo } },
      select: { caseId: true, fromFamily: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }), [] as { caseId: string; fromFamily: boolean; createdAt: Date }[]),

    safe(() => prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "ARCHIVED"] },
        portalEnabled: true,
      },
      select: {
        id: true,
        ref: true,
        deceased: { select: { fullName: true } },
        portalMessages: {
          select: { createdAt: true, fromFamily: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: 500,
    }), [] as any[]),

    safe(() => prisma.case.count({
      where: { orgId, deletedAt: null, portalEnabled: true },
    }), 0),
  ]);

  // KPIs
  const familyMsgs30d = msgs30d.filter((m) => m.fromFamily).length;
  const teamMsgs30d = msgs30d.length - familyMsgs30d;

  // Compute median admin response time within each case
  const responseTimes: number[] = [];
  const messagesByCaseId = new Map<string, typeof msgsForResponseTime>();
  for (const m of msgsForResponseTime) {
    const arr = messagesByCaseId.get(m.caseId) ?? [];
    arr.push(m);
    messagesByCaseId.set(m.caseId, arr);
  }
  messagesByCaseId.forEach((msgs) => {
    for (let i = 0; i < msgs.length - 1; i++) {
      if (msgs[i].fromFamily && !msgs[i + 1].fromFamily) {
        const diff = msgs[i + 1].createdAt.getTime() - msgs[i].createdAt.getTime();
        responseTimes.push(diff);
      }
    }
  });
  const medianResponseMs = median(responseTimes);

  // Top engaged cases (30d)
  const engagedCases: CaseEngagement[] = (openCasesWithMsgs as any[])
    .map((c) => ({
      caseId: c.id,
      ref: c.ref,
      deceasedName: c.deceased?.fullName ?? null,
      familyMessages: c.portalMessages.length,
      lastFamilyAt: c.portalMessages[0]?.createdAt ?? null,
    }))
    .sort((a, b) => b.familyMessages - a.familyMessages)
    .slice(0, 10);

  // Silent cases: portal enabled, no family message in 30d+
  const silentCases = (openCasesAll as any[])
    .map((c) => {
      const last = c.portalMessages[0];
      const lastFamilyAt = last?.fromFamily ? last.createdAt : null;
      const lastAnyAt = last?.createdAt ?? null;
      return {
        caseId: c.id,
        ref: c.ref,
        deceasedName: c.deceased?.fullName ?? null,
        lastFamilyAt: lastFamilyAt as Date | null,
        lastAnyAt: lastAnyAt as Date | null,
      };
    })
    .filter((c) => !c.lastFamilyAt || c.lastFamilyAt < thirtyDaysAgo)
    .sort((a, b) => {
      const aTime = a.lastAnyAt?.getTime() ?? 0;
      const bTime = b.lastAnyAt?.getTime() ?? 0;
      return aTime - bTime;
    })
    .slice(0, 10);

  // 7-day mini histogram of family messages (last 7 days)
  const dayBuckets: { date: Date; label: string; family: number; team: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    dayBuckets.push({
      date: d,
      label: d.toLocaleDateString("es-ES", { weekday: "short" }),
      family: 0,
      team: 0,
    });
  }
  const sevenDayCutoff = new Date(now);
  sevenDayCutoff.setHours(0, 0, 0, 0);
  sevenDayCutoff.setDate(sevenDayCutoff.getDate() - 6);
  for (const m of msgs30d) {
    if (m.createdAt < sevenDayCutoff) continue;
    const created = new Date(m.createdAt);
    created.setHours(0, 0, 0, 0);
    const bucket = dayBuckets.find((b) => b.date.getTime() === created.getTime());
    if (bucket) {
      if (m.fromFamily) bucket.family++;
      else bucket.team++;
    }
  }
  const maxBucket = Math.max(...dayBuckets.map((b) => b.family + b.team), 1);

  const kpis = [
    { label: "Mensajes (30 días)", value: msgs30d.length, sub: `${msgs7d} esta semana` },
    { label: "Mensajes de familia", value: familyMsgs30d, sub: "últimos 30 días" },
    { label: "Sin leer", value: unreadFamily, sub: "respuestas pendientes", emphasis: unreadFamily > 0 ? "warn" : "ok" },
    { label: "Documentos del portal", value: portalDocs30d, sub: `${portalDocsTotal} totales` },
    { label: "Tiempo medio respuesta", value: medianResponseMs !== null ? formatDuration(medianResponseMs) : "—", sub: "mediana 30 días" },
    { label: "Portales activos", value: activePortalsCount, sub: "expedientes con acceso" },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Actividad del portal familiar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Engagement de las familias y tiempos de respuesta del equipo
          </p>
        </div>
        <Link
          href="/messages"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Ir a la bandeja →
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`bg-white p-4 rounded-lg border ${kpi.emphasis === "warn" ? "border-red-200 bg-red-50" : ""}`}
          >
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.emphasis === "warn" ? "text-red-700" : ""}`}>{kpi.value}</p>
            {kpi.sub && <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* 7-day activity */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Actividad de los últimos 7 días</h2>
          {msgs7d === 0 ? (
            <p className="text-sm text-gray-400">Sin mensajes esta semana.</p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-2" style={{ height: 160 }}>
                {dayBuckets.map((b, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-1" style={{ height: 120 }}>
                      <div
                        className="w-4 bg-amber-400 rounded-t"
                        style={{ height: `${(b.family / maxBucket) * 100}%`, minHeight: b.family > 0 ? 4 : 0 }}
                        title={`Familia: ${b.family}`}
                      />
                      <div
                        className="w-4 bg-blue-400 rounded-t"
                        style={{ height: `${(b.team / maxBucket) * 100}%`, minHeight: b.team > 0 ? 4 : 0 }}
                        title={`Equipo: ${b.team}`}
                      />
                    </div>
                    <span className="text-xs text-gray-500 capitalize">{b.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-400 rounded" /> Familia</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" /> Equipo</span>
              </div>
            </>
          )}
        </div>

        {/* Conversation balance */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Equilibrio de la conversación (30 días)</h2>
          {msgs30d.length === 0 ? (
            <p className="text-sm text-gray-400">Sin mensajes en los últimos 30 días.</p>
          ) : (
            <>
              <div className="flex h-6 rounded-full overflow-hidden mb-4">
                <div
                  className="bg-amber-400"
                  style={{ width: `${(familyMsgs30d / msgs30d.length) * 100}%` }}
                  title={`Familia: ${familyMsgs30d}`}
                />
                <div
                  className="bg-blue-400"
                  style={{ width: `${(teamMsgs30d / msgs30d.length) * 100}%` }}
                  title={`Equipo: ${teamMsgs30d}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-amber-400 rounded" />
                    <span className="text-gray-600">Familia</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{familyMsgs30d}</p>
                  <p className="text-xs text-gray-400">{Math.round((familyMsgs30d / msgs30d.length) * 100)}% del total</p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-400 rounded" />
                    <span className="text-gray-600">Equipo</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{teamMsgs30d}</p>
                  <p className="text-xs text-gray-400">{Math.round((teamMsgs30d / msgs30d.length) * 100)}% del total</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Most engaged cases */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Familias más activas (30 días)</h2>
          {engagedCases.length === 0 ? (
            <p className="text-sm text-gray-400">Ninguna familia ha enviado mensajes en los últimos 30 días.</p>
          ) : (
            <ul className="divide-y">
              {engagedCases.map((c) => (
                <li key={c.caseId} className="py-2.5 flex items-center justify-between gap-3">
                  <Link href={`/cases/${c.caseId}`} className="flex-1 min-w-0 hover:underline">
                    <p className="font-medium text-gray-900 truncate">{c.deceasedName ?? c.ref}</p>
                    <p className="text-xs text-gray-500 truncate">{c.ref}</p>
                  </Link>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center justify-center w-8 h-6 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                      {c.familyMessages}
                    </span>
                    {c.lastFamilyAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(c.lastFamilyAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Silent cases */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Familias en silencio</h2>
            <span className="text-xs text-gray-400">sin mensajes hace 30+ días</span>
          </div>
          {silentCases.length === 0 ? (
            <p className="text-sm text-gray-400">Todas las familias activas están comunicándose.</p>
          ) : (
            <ul className="divide-y">
              {silentCases.map((c) => {
                const lastDate = c.lastFamilyAt ?? c.lastAnyAt;
                const daysSilent = lastDate
                  ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000)
                  : null;
                return (
                  <li key={c.caseId} className="py-2.5 flex items-center justify-between gap-3">
                    <Link href={`/cases/${c.caseId}`} className="flex-1 min-w-0 hover:underline">
                      <p className="font-medium text-gray-900 truncate">{c.deceasedName ?? c.ref}</p>
                      <p className="text-xs text-gray-500 truncate">{c.ref}</p>
                    </Link>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-gray-500">
                        {daysSilent === null ? "Nunca" : `${daysSilent}d`}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
