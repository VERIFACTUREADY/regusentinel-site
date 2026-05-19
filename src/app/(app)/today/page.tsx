import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Resumen del día — BARITUR PRO",
  robots: { index: false },
};

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function formatDate(now: Date): string {
  return `${WEEKDAY_NAMES[now.getDay()]}, ${now.getDate()} de ${MONTH_NAMES[now.getMonth()]} de ${now.getFullYear()}`;
}

function daysOverdue(deadline: Date, now: Date): number {
  return Math.floor((now.getTime() - deadline.getTime()) / 86400000);
}

function daysUntil(deadline: Date, now: Date): number {
  return Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
}

function isdDeadline(deathDate: Date): Date {
  const d = new Date(deathDate);
  d.setMonth(d.getMonth() + 6);
  return d;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export default async function TodayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  // Sesión válida sin organización: al dashboard (que ofrece crearla),
  // no a /login — eso parecía un cierre de sesión por error.
  if (!session.user.orgId || !session.user.role) redirect("/dashboard");

  const orgId = session.user.orgId;
  const userId = session.user.id;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
  const weekEnd = new Date(now.getTime() + 7 * 86400000);
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000);

  const [
    myOverdueTasks,
    myTasksToday,
    myTasksThisWeek,
    orgOverdueTasks,
    isdAtRiskCases,
    pendingApprovals,
    unreadMessages,
    blockedCases,
    readyToStartTasks,
  ] = await Promise.all([
    // My overdue tasks
    safe(() => prisma.task.findMany({
      where: {
        assigneeId: userId,
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        status: { notIn: ["DONE", "SKIPPED"] },
        OR: [{ deadline: { lt: now } }, { deadline: null, dueDate: { lt: now } }],
      },
      select: {
        id: true, title: true, status: true, deadline: true, dueDate: true,
        case: { select: { id: true, ref: true, isUrgent: true, deceased: { select: { fullName: true } } } },
      },
      orderBy: { deadline: "asc" },
      take: 20,
    }), [] as any[]),

    // My tasks due today
    safe(() => prisma.task.findMany({
      where: {
        assigneeId: userId,
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        status: { notIn: ["DONE", "SKIPPED"] },
        OR: [
          { deadline: { gte: todayStart, lte: todayEnd } },
          { deadline: null, dueDate: { gte: todayStart, lte: todayEnd } },
        ],
      },
      select: {
        id: true, title: true, status: true, deadline: true, dueDate: true,
        case: { select: { id: true, ref: true, isUrgent: true, deceased: { select: { fullName: true } } } },
      },
      orderBy: { deadline: "asc" },
      take: 20,
    }), [] as any[]),

    // My tasks due this week (excluding today)
    safe(() => prisma.task.findMany({
      where: {
        assigneeId: userId,
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        status: { notIn: ["DONE", "SKIPPED"] },
        OR: [
          { deadline: { gt: todayEnd, lte: weekEnd } },
          { deadline: null, dueDate: { gt: todayEnd, lte: weekEnd } },
        ],
      },
      select: {
        id: true, title: true, status: true, deadline: true, dueDate: true,
        case: { select: { id: true, ref: true, isUrgent: true, deceased: { select: { fullName: true } } } },
      },
      orderBy: { deadline: "asc" },
      take: 10,
    }), [] as any[]),

    // All org overdue tasks (not mine, for managers)
    safe(() => prisma.task.findMany({
      where: {
        assigneeId: { not: userId },
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        status: { notIn: ["DONE", "SKIPPED"] },
        OR: [{ deadline: { lt: now } }, { deadline: null, dueDate: { lt: now } }],
      },
      select: {
        id: true, title: true, deadline: true, dueDate: true,
        case: { select: { id: true, ref: true } },
        assignee: { select: { name: true, email: true } },
      },
      orderBy: { deadline: "asc" },
      take: 15,
    }), [] as any[]),

    // ISD at-risk cases (open, deadline within 30 days)
    safe(() => prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "ARCHIVED"] },
        deceased: {
          deathDate: {
            gte: new Date(now.getTime() - 180 * 86400000),
            lte: new Date(now.getTime() - 150 * 86400000),
          },
        },
      },
      select: {
        id: true, ref: true, status: true, isUrgent: true,
        deceased: { select: { fullName: true, deathDate: true } },
        contact: { select: { fullName: true } },
      },
      take: 20,
    }), [] as any[]),

    // Pending approvals
    safe(() => prisma.approval.findMany({
      where: { case: { orgId, deletedAt: null }, status: "PENDING" },
      select: {
        id: true, action: true, createdAt: true,
        case: { select: { id: true, ref: true, deceased: { select: { fullName: true } } } },
        reviewer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }), [] as any[]),

    // Unread portal messages
    safe(() => prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        portalMessages: { some: { fromFamily: true, readAt: null } },
      },
      select: {
        id: true, ref: true,
        deceased: { select: { fullName: true } },
        portalMessages: {
          where: { fromFamily: true, readAt: null },
          select: { id: true, authorName: true, content: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: 10,
    }), [] as any[]),

    // Cases with blocked tasks
    safe(() => prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "ARCHIVED"] },
        tasks: { some: { status: "BLOCKED" } },
      },
      select: {
        id: true, ref: true, isUrgent: true,
        deceased: { select: { fullName: true } },
        tasks: {
          where: { status: "BLOCKED" },
          select: { id: true, title: true, blockReason: true },
          take: 3,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }), [] as any[]),

    // My tasks whose dependency was just resolved (dependsOn is now DONE/SKIPPED)
    safe(() => prisma.task.findMany({
      where: {
        assigneeId: userId,
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        status: { in: ["PENDING", "BLOCKED"] },
        dependsOnId: { not: null },
        dependsOn: { status: { in: ["DONE", "SKIPPED"] } },
      },
      select: {
        id: true, title: true, status: true,
        case: { select: { id: true, ref: true } },
        dependsOn: { select: { title: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }), [] as any[]),
  ]);

  // Compute ISD days remaining for each at-risk case
  const isdCases = (isdAtRiskCases as any[])
    .map((c) => {
      if (!c.deceased?.deathDate) return null;
      const deadline = isdDeadline(new Date(c.deceased.deathDate));
      const days = daysUntil(deadline, now);
      return { ...c, isdDeadline: deadline, daysLeft: days };
    })
    .filter(Boolean)
    .sort((a, b) => a!.daysLeft - b!.daysLeft) as any[];

  const totalUrgent =
    (myOverdueTasks as any[]).length +
    isdCases.filter((c) => c.daysLeft <= 7).length +
    (pendingApprovals as any[]).length;

  const hasAnything =
    (myOverdueTasks as any[]).length > 0 ||
    (myTasksToday as any[]).length > 0 ||
    isdCases.length > 0 ||
    (pendingApprovals as any[]).length > 0 ||
    (unreadMessages as any[]).length > 0 ||
    (blockedCases as any[]).length > 0 ||
    (readyToStartTasks as any[]).length > 0;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Resumen del día</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{formatDate(now)}</p>
      </div>

      {/* Urgent alert strip */}
      {totalUrgent > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-semibold text-red-800">
              {totalUrgent} elemento{totalUrgent !== 1 ? "s" : ""} requiere{totalUrgent === 1 ? "" : "n"} acción inmediata
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              {(myOverdueTasks as any[]).length > 0 && `${(myOverdueTasks as any[]).length} tarea${(myOverdueTasks as any[]).length !== 1 ? "s" : ""} vencida${(myOverdueTasks as any[]).length !== 1 ? "s" : ""}`}
              {(myOverdueTasks as any[]).length > 0 && isdCases.filter((c) => c.daysLeft <= 7).length > 0 && " · "}
              {isdCases.filter((c) => c.daysLeft <= 7).length > 0 && `${isdCases.filter((c) => c.daysLeft <= 7).length} plazo${isdCases.filter((c) => c.daysLeft <= 7).length !== 1 ? "s" : ""} ISD crítico${isdCases.filter((c) => c.daysLeft <= 7).length !== 1 ? "s" : ""}`}
              {(pendingApprovals as any[]).length > 0 && ((myOverdueTasks as any[]).length > 0 || isdCases.filter((c) => c.daysLeft <= 7).length > 0) && " · "}
              {(pendingApprovals as any[]).length > 0 && `${(pendingApprovals as any[]).length} aprobación${(pendingApprovals as any[]).length !== 1 ? "es" : ""} pendiente${(pendingApprovals as any[]).length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      )}

      {!hasAnything && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold text-green-800">Todo al día</p>
          <p className="text-sm text-green-600 mt-1">No hay tareas vencidas, plazos críticos ni mensajes sin responder.</p>
        </div>
      )}

      <div className="space-y-6">
        {/* My overdue tasks */}
        {(myOverdueTasks as any[]).length > 0 && (
          <Section
            title="Mis tareas vencidas"
            count={(myOverdueTasks as any[]).length}
            color="red"
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          >
            <ul className="divide-y divide-gray-100">
              {(myOverdueTasks as any[]).map((task) => (
                <li key={task.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/cases/${task.case.id}`} className="font-medium text-sm hover:text-primary truncate block">
                      {task.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {task.case.ref}
                      {task.case.deceased?.fullName && ` · ${task.case.deceased.fullName}`}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                    hace {daysOverdue(new Date(task.deadline ?? task.dueDate), now)}d
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* My tasks today */}
        {(myTasksToday as any[]).length > 0 && (
          <Section
            title="Para hoy"
            count={(myTasksToday as any[]).length}
            color="amber"
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          >
            <ul className="divide-y divide-gray-100">
              {(myTasksToday as any[]).map((task) => (
                <li key={task.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/cases/${task.case.id}`} className="font-medium text-sm hover:text-primary truncate block">
                      {task.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {task.case.ref}
                      {task.case.deceased?.fullName && ` · ${task.case.deceased.fullName}`}
                    </p>
                  </div>
                  <StatusPill status={task.status} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ISD at risk */}
        {isdCases.length > 0 && (
          <Section
            title="Plazos ISD próximos"
            count={isdCases.length}
            color="orange"
            icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            action={{ href: "/reports/isd", label: "Ver informe ISD →" }}
          >
            <ul className="divide-y divide-gray-100">
              {isdCases.map((c) => (
                <li key={c.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/cases/${c.id}`} className="font-medium text-sm hover:text-primary truncate block">
                      {c.deceased?.fullName ?? c.ref}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.ref}
                      {c.contact?.fullName && ` · ${c.contact.fullName}`}
                      {" · ISD vence "}
                      {c.isdDeadline.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <IsdBadge daysLeft={c.daysLeft} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Pending approvals */}
        {(pendingApprovals as any[]).length > 0 && (
          <Section
            title="Aprobaciones pendientes"
            count={(pendingApprovals as any[]).length}
            color="purple"
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            action={{ href: "/approvals", label: "Ir a aprobaciones →" }}
          >
            <ul className="divide-y divide-gray-100">
              {(pendingApprovals as any[]).map((ap) => (
                <li key={ap.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/cases/${ap.case.id}`} className="font-medium text-sm hover:text-primary truncate block">
                      {ap.action.replace(/_/g, " ").toLowerCase()}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ap.case.ref}
                      {ap.case.deceased?.fullName && ` · ${ap.case.deceased.fullName}`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(ap.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Unread portal messages */}
        {(unreadMessages as any[]).length > 0 && (
          <Section
            title="Mensajes sin responder"
            count={(unreadMessages as any[]).length}
            color="blue"
            icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            action={{ href: "/messages", label: "Ir a mensajes →" }}
          >
            <ul className="divide-y divide-gray-100">
              {(unreadMessages as any[]).map((c) => {
                const lastMsg = c.portalMessages[0];
                return (
                  <li key={c.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/messages?case=${c.id}`} className="font-medium text-sm hover:text-primary truncate block">
                        {c.deceased?.fullName ?? c.ref}
                      </Link>
                      {lastMsg && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {lastMsg.authorName && <span className="font-medium">{lastMsg.authorName}: </span>}
                          {lastMsg.content}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium whitespace-nowrap shrink-0">
                      nuevo
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {/* Blocked cases */}
        {(blockedCases as any[]).length > 0 && (
          <Section
            title="Expedientes bloqueados"
            count={(blockedCases as any[]).length}
            color="gray"
            icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          >
            <ul className="divide-y divide-gray-100">
              {(blockedCases as any[]).map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/cases/${c.id}`} className="font-medium text-sm hover:text-primary">
                      {c.ref}{c.deceased?.fullName && ` · ${c.deceased.fullName}`}
                    </Link>
                    {c.isUrgent && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded shrink-0">urgente</span>
                    )}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {c.tasks.map((t: any) => (
                      <li key={t.id} className="text-xs text-gray-500">
                        🔒 {t.title}
                        {t.blockReason && <span className="text-gray-400"> — {t.blockReason}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Tasks whose dependency was just resolved */}
        {(readyToStartTasks as any[]).length > 0 && (
          <Section
            title="Listas para continuar"
            count={(readyToStartTasks as any[]).length}
            color="green"
            icon="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          >
            <ul className="divide-y divide-gray-100">
              {(readyToStartTasks as any[]).map((t: any) => (
                <li key={t.id} className="py-3">
                  <Link href={`/cases/${t.case.id}`} className="text-sm font-medium hover:text-primary">
                    {t.title}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.case.ref} · prerrequisito completado: {t.dependsOn?.title}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* My upcoming tasks this week */}
        {(myTasksThisWeek as any[]).length > 0 && (
          <Section
            title="Esta semana"
            count={(myTasksThisWeek as any[]).length}
            color="indigo"
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          >
            <ul className="divide-y divide-gray-100">
              {(myTasksThisWeek as any[]).map((task) => (
                <li key={task.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/cases/${task.case.id}`} className="font-medium text-sm hover:text-primary truncate block">
                      {task.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {task.case.ref}
                      {task.case.deceased?.fullName && ` · ${task.case.deceased.fullName}`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {new Date(task.deadline ?? task.dueDate).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Team overdue (for managers) */}
        {(orgOverdueTasks as any[]).length > 0 && (
          <Section
            title="Tareas del equipo vencidas"
            count={(orgOverdueTasks as any[]).length}
            color="pink"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            action={{ href: "/tasks", label: "Ver todas las tareas →" }}
          >
            <ul className="divide-y divide-gray-100">
              {(orgOverdueTasks as any[]).map((task) => (
                <li key={task.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/cases/${task.case.id}`} className="font-medium text-sm hover:text-primary truncate block">
                      {task.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {task.case.ref}
                      {task.assignee && ` · ${task.assignee.name || task.assignee.email}`}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                    hace {daysOverdue(new Date(task.deadline ?? task.dueDate), now)}d
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────

const COLOR_MAP: Record<string, { header: string; badge: string; icon: string }> = {
  red:    { header: "border-red-200 bg-red-50",    badge: "bg-red-600 text-white",    icon: "text-red-500" },
  amber:  { header: "border-amber-200 bg-amber-50", badge: "bg-amber-500 text-white",  icon: "text-amber-500" },
  orange: { header: "border-orange-200 bg-orange-50", badge: "bg-orange-500 text-white", icon: "text-orange-500" },
  purple: { header: "border-purple-200 bg-purple-50", badge: "bg-purple-600 text-white", icon: "text-purple-500" },
  blue:   { header: "border-blue-200 bg-blue-50",  badge: "bg-blue-600 text-white",   icon: "text-blue-500" },
  indigo: { header: "border-indigo-200 bg-indigo-50", badge: "bg-indigo-600 text-white", icon: "text-indigo-500" },
  gray:   { header: "border-gray-200 bg-gray-50",  badge: "bg-gray-500 text-white",   icon: "text-gray-400" },
  pink:   { header: "border-pink-200 bg-pink-50",  badge: "bg-pink-600 text-white",   icon: "text-pink-500" },
};

function Section({
  title, count, color, icon, action, children,
}: {
  title: string;
  count: number;
  color: string;
  icon: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.gray;
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3 border-b ${c.header}`}>
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 ${c.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
          <span className="font-semibold text-sm text-gray-800">{title}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>{count}</span>
        </div>
        {action && (
          <Link href={action.href} className="text-xs text-primary hover:underline font-medium">
            {action.label}
          </Link>
        )}
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    BLOCKED: "bg-red-100 text-red-700",
    READY: "bg-green-100 text-green-700",
    APPROVED: "bg-emerald-100 text-emerald-700",
  };
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    IN_PROGRESS: "En curso",
    BLOCKED: "Bloqueada",
    READY: "Lista",
    APPROVED: "Aprobada",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap shrink-0 ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function IsdBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0) return <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5 rounded">VENCIDO</span>;
  if (daysLeft === 0) return <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded">HOY</span>;
  if (daysLeft <= 7) return <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">{daysLeft}d</span>;
  if (daysLeft <= 30) return <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{daysLeft}d</span>;
  return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{daysLeft}d</span>;
}
