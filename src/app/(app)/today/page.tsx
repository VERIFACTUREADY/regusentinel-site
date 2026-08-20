import { getVerifiedSession, getVerifiedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isdDeadlineFor } from "@/lib/deadline-engine";
import { consultar, listaDe, type Resultado } from "@/lib/consulta-segura";
import { BloqueFallido, AvisoDatosIncompletos } from "@/components/dashboard/fallo-bloque";
import {
  diaSemanaES,
  partesCivilesES,
  inicioDelDiaDeES,
  finDelDiaDeES,
  sumarDiasES,
  diasCivilesEntreES,
} from "@/lib/fecha-es";

export const metadata = {
  title: "Resumen del día — Heredia",
  robots: { index: false },
};

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * La fecha del encabezado se compone con el calendario español, no con la hora
 * local del servidor: en Vercel y en la CI el proceso corre en UTC y entre las
 * 00:00 y las 02:00 de Madrid el título mostraba el día de AYER.
 */
function formatDate(now: Date): string {
  const { anio, mes, dia } = partesCivilesES(now);
  return `${WEEKDAY_NAMES[diaSemanaES(now)]}, ${dia} de ${MONTH_NAMES[mes - 1]} de ${anio}`;
}

/** Días de calendario de retraso, contados por fecha civil española. */
function daysOverdue(deadline: Date, now: Date): number {
  return Math.max(0, diasCivilesEntreES(deadline, now));
}

/** Días de calendario que faltan, contados por fecha civil española. */
function daysUntil(deadline: Date, now: Date): number {
  return diasCivilesEntreES(now, deadline);
}

function isdDeadline(deathDate: Date): Date {
  return isdDeadlineFor(deathDate);
}

/**
 * Fecha de vencimiento efectiva de una tarea: el plazo legal si lo tiene y, si
 * no, la fecha prevista.
 *
 * Devuelve `null` cuando no hay ninguna de las dos. Antes se escribía
 * `new Date(task.deadline ?? task.dueDate)`, y con las dos a nulo eso da el
 * 1 de enero de 1970: la tarjeta anunciaba «hace 20.686d» con toda seriedad.
 * El fallo estaba tapado por un `as any[]` que apagaba la comprobación de
 * nulos; al quitarlo, TypeScript lo señaló solo.
 */
function fechaLimite(task: { deadline: Date | null; dueDate: Date | null }): Date | null {
  return task.deadline ?? task.dueDate ?? null;
}

export default async function TodayPage() {
  const verified = await getVerifiedSession();
  const session = verified ?? { user: { id: "", email: "", name: null, orgId: null, role: null } };
  if (!verified) {
    const u = await getVerifiedUser();
    if (!u) redirect("/login");
  }
  // Sesión válida sin organización: al dashboard (que ofrece crearla),
  // no a /login — eso parecía un cierre de sesión por error.
  if (!session.user.orgId || !session.user.role) redirect("/dashboard");

  const orgId = session.user.orgId;
  const userId = session.user.id;
  const now = new Date();
  // Cortes del día y de la semana en el calendario ESPAÑOL. Con la hora local
  // del servidor (UTC) «hoy» empezaba a las 02:00 de Madrid en verano: durante
  // esas dos horas «Para hoy» enseñaba las tareas de ayer.
  const todayStart = inicioDelDiaDeES(now);
  const todayEnd = finDelDiaDeES(now);
  /*
   * «Esta semana» llega hasta el FINAL del septimo dia, no hasta su medianoche.
   *
   * `sumarDiasES(now, 7)` devuelve las 00:00 del dia +7, y con ese corte una
   * tarea que vencia ese mismo dia a las dos de la tarde quedaba fuera de la
   * seccion: desaparecia de «Esta semana» sin aparecer en ninguna otra.
   */
  const weekEnd = finDelDiaDeES(sumarDiasES(now, 7));

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
    consultar("misTareasVencidas", () => prisma.task.findMany({
      where: {
        assigneeId: userId,
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        status: { notIn: ["DONE", "SKIPPED"] },
        /*
         * VENCIDA = de un dia YA PASADO, no «anterior a este instante».
         *
         * Con `lt: now`, una tarea con plazo hoy a las 14:00 pasaba a contarse
         * como vencida a las 14:01 y aparecia A LA VEZ en «Mis tareas
         * vencidas» y en «Para hoy», que usa el dia entero. Las tres secciones
         * de tareas propias —vencidas, hoy y esta semana— se presentan como
         * tramos distintos, asi que no pueden solaparse. Ademas el corte
         * dependia de la hora a la que se mirase la pantalla.
         */
        OR: [
          { deadline: { lt: todayStart } },
          { deadline: null, dueDate: { lt: todayStart } },
        ],
      },
      select: {
        id: true, title: true, status: true, deadline: true, dueDate: true,
        case: { select: { id: true, ref: true, isUrgent: true, deceased: { select: { fullName: true } } } },
      },
      orderBy: { deadline: "asc" },
      take: 20,
    })),

    // My tasks due today
    consultar("misTareasDeHoy", () => prisma.task.findMany({
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
    })),

    // My tasks due this week (excluding today)
    consultar("misTareasDeLaSemana", () => prisma.task.findMany({
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
    })),

    // All org overdue tasks (not mine, for managers)
    consultar("tareasVencidasDelEquipo", () => prisma.task.findMany({
      where: {
        assigneeId: { not: userId },
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        status: { notIn: ["DONE", "SKIPPED"] },
        // Mismo criterio de «vencida» que en las tareas propias: un dia ya
        // pasado. Si no, las dos secciones contarian cosas distintas con la
        // misma palabra.
        OR: [
          { deadline: { lt: todayStart } },
          { deadline: null, dueDate: { lt: todayStart } },
        ],
      },
      select: {
        id: true, title: true, deadline: true, dueDate: true,
        case: { select: { id: true, ref: true } },
        assignee: { select: { name: true, email: true } },
      },
      orderBy: { deadline: "asc" },
      take: 15,
    })),

    // ISD at-risk cases (open, deadline within 30 days)
    consultar("isdEnRiesgo", () => prisma.case.findMany({
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
    })),

    // Pending approvals
    consultar("aprobacionesPendientes", () => prisma.approval.findMany({
      where: { case: { orgId, deletedAt: null }, status: "PENDING" },
      select: {
        id: true, action: true, createdAt: true,
        case: { select: { id: true, ref: true, deceased: { select: { fullName: true } } } },
        reviewer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    })),

    // Unread portal messages
    consultar("mensajesSinLeer", () => prisma.case.findMany({
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
    })),

    // Cases with blocked tasks
    consultar("expedientesBloqueados", () => prisma.case.findMany({
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
    })),

    // My tasks whose dependency was just resolved (dependsOn is now DONE/SKIPPED)
    consultar("listasParaContinuar", () => prisma.task.findMany({
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
    })),
  ]);

  /*
   * Listas ya desenvueltas para pintar.
   *
   * `listaDe` devuelve `[]` cuando la consulta falló, pero eso NO se usa nunca
   * como si fuera un resultado: cada bloque comprueba antes su propio
   * `Resultado.ok` y, si falló, pinta el aviso en vez de la lista. El array
   * vacío existe sólo para que el `.map` de más abajo no tenga que
   * comprobarlo.
   */
  const vencidas = listaDe(myOverdueTasks);
  const deHoy = listaDe(myTasksToday);
  const deLaSemana = listaDe(myTasksThisWeek);
  const vencidasEquipo = listaDe(orgOverdueTasks);
  const aprobaciones = listaDe(pendingApprovals);
  const mensajes = listaDe(unreadMessages);
  const bloqueados = listaDe(blockedCases);
  const listas = listaDe(readyToStartTasks);

  /*
   * Plazo ISD de cada expediente en riesgo.
   *
   * `flatMap` en lugar de `.map().filter(Boolean)`: `filter(Boolean)` no
   * estrecha el tipo, y para compensarlo el código anterior remataba con
   * `as any[]`, que apagaba la comprobación de toda la lista. Con `flatMap`
   * los expedientes sin fecha de fallecimiento se descartan y lo que queda
   * está tipado de verdad.
   */
  const isdCases = listaDe(isdAtRiskCases)
    .flatMap((c) => {
      const fallecimiento = c.deceased?.deathDate;
      if (!fallecimiento) return [];
      const deadline = isdDeadline(new Date(fallecimiento));
      return [{ ...c, isdDeadline: deadline, daysLeft: daysUntil(deadline, now) }];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const isdCriticos = isdCases.filter((c) => c.daysLeft <= 7);

  const totalUrgent = vencidas.length + isdCriticos.length + aprobaciones.length;

  /*
   * «TODO AL DÍA» SÓLO SI DE VERDAD SE SABE QUE NO HAY NADA.
   * --------------------------------------------------------
   * Antes `hasAnything` se calculaba sobre listas que `safe()` devolvía vacías
   * TAMBIÉN cuando la consulta había reventado. Con PostgreSQL caído, esta
   * pantalla enseñaba un tranquilizador «Todo al día» con un tic verde: el
   * peor mensaje posible, porque invita a cerrar el portátil.
   *
   * Ahora hay tres estados distintos, y el orden importa:
   *   1. alguna fuente ha fallado  -> aviso de pantalla incompleta, y el tic
   *      verde NO se pinta bajo ningún concepto;
   *   2. todo cargó y hay trabajo  -> las secciones;
   *   3. todo cargó y no hay nada  -> «Todo al día», que ahora sí significa
   *      lo que dice.
   */
  const consultas: Record<string, Resultado<unknown>> = {
    "mis tareas vencidas": myOverdueTasks,
    "las tareas de hoy": myTasksToday,
    "las tareas de esta semana": myTasksThisWeek,
    "las tareas vencidas del equipo": orgOverdueTasks,
    "los plazos ISD": isdAtRiskCases,
    "las aprobaciones pendientes": pendingApprovals,
    "los mensajes de las familias": unreadMessages,
    "los expedientes bloqueados": blockedCases,
    "las tareas listas para continuar": readyToStartTasks,
  };
  const bloquesCaidos = Object.entries(consultas)
    .filter(([, r]) => !r.ok)
    .map(([nombre]) => nombre);
  const hayFallos = bloquesCaidos.length > 0;

  const hayContenido =
    vencidas.length > 0 ||
    deHoy.length > 0 ||
    isdCases.length > 0 ||
    aprobaciones.length > 0 ||
    mensajes.length > 0 ||
    bloqueados.length > 0 ||
    listas.length > 0;

  // La condición es «no hay fallos Y no hay nada», nunca sólo lo segundo.
  const todoAlDia = !hayFallos && !hayContenido;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Resumen del día</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{formatDate(now)}</p>
      </div>

      {/* Lo que no se ha podido consultar, antes que nada */}
      <AvisoDatosIncompletos bloques={bloquesCaidos} />

      {/* Urgent alert strip */}
      {totalUrgent > 0 && (
        <div
          role="alert"
          data-testid="franja-accion-inmediata"
          className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3"
        >
          <span className="text-2xl" aria-hidden="true">🚨</span>
          <div>
            <p className="font-semibold text-red-800" data-testid="contador-accion-inmediata">
              {totalUrgent} elemento{totalUrgent !== 1 ? "s" : ""} requiere{totalUrgent === 1 ? "" : "n"} acción inmediata
            </p>
            <p className="text-sm text-red-600 mt-0.5" data-testid="desglose-accion-inmediata">
              {[
                vencidas.length > 0
                  ? `${vencidas.length} tarea${vencidas.length !== 1 ? "s" : ""} vencida${vencidas.length !== 1 ? "s" : ""}`
                  : null,
                isdCriticos.length > 0
                  ? `${isdCriticos.length} plazo${isdCriticos.length !== 1 ? "s" : ""} ISD crítico${isdCriticos.length !== 1 ? "s" : ""}`
                  : null,
                aprobaciones.length > 0
                  ? `${aprobaciones.length} ${aprobaciones.length === 1 ? "aprobación pendiente" : "aprobaciones pendientes"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      {todoAlDia && (
        <div
          data-testid="todo-al-dia"
          className="bg-green-50 border border-green-200 rounded-xl p-6 text-center"
        >
          <p className="text-3xl mb-2" aria-hidden="true">✅</p>
          <p className="font-semibold text-green-800">Todo al día</p>
          <p className="text-sm text-green-600 mt-1">No hay tareas vencidas, plazos críticos ni mensajes sin responder.</p>
        </div>
      )}

      {/* Un bloque de aviso por cada consulta caída, en su sitio de la página */}
      {hayFallos && (
        <div className="space-y-3 mb-6" data-testid="bloques-fallidos">
          {bloquesCaidos.map((nombre) => (
            <BloqueFallido
              key={nombre}
              que={nombre}
              id={nombre.replace(/\s+/g, "-")}
            />
          ))}
        </div>
      )}

      <div className="space-y-6">
        {/* My overdue tasks */}
        {vencidas.length > 0 && (
          <Section
            title="Mis tareas vencidas"
            count={vencidas.length}
            color="red"
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          >
            <ul className="divide-y divide-gray-100">
              {vencidas.map((task) => (
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
                  <VencimientoPill fecha={fechaLimite(task)} ahora={now} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* My tasks today */}
        {deHoy.length > 0 && (
          <Section
            title="Para hoy"
            count={deHoy.length}
            color="amber"
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          >
            <ul className="divide-y divide-gray-100">
              {deHoy.map((task) => (
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
                      {c.isdDeadline.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" })}
                    </p>
                  </div>
                  <IsdBadge daysLeft={c.daysLeft} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Pending approvals */}
        {aprobaciones.length > 0 && (
          <Section
            title="Aprobaciones pendientes"
            count={aprobaciones.length}
            color="purple"
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            action={{ href: "/approvals", label: "Ir a aprobaciones →" }}
          >
            <ul className="divide-y divide-gray-100">
              {aprobaciones.map((ap) => (
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
                    {new Date(ap.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" })}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Unread portal messages */}
        {mensajes.length > 0 && (
          <Section
            title="Mensajes sin responder"
            count={mensajes.length}
            color="blue"
            icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            action={{ href: "/messages", label: "Ir a mensajes →" }}
          >
            <ul className="divide-y divide-gray-100">
              {mensajes.map((c) => {
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
        {bloqueados.length > 0 && (
          <Section
            title="Expedientes bloqueados"
            count={bloqueados.length}
            color="gray"
            icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          >
            <ul className="divide-y divide-gray-100">
              {bloqueados.map((c) => (
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
        {listas.length > 0 && (
          <Section
            title="Listas para continuar"
            count={listas.length}
            color="green"
            icon="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          >
            <ul className="divide-y divide-gray-100">
              {listas.map((t: any) => (
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
        {deLaSemana.length > 0 && (
          <Section
            title="Esta semana"
            count={deLaSemana.length}
            color="indigo"
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          >
            <ul className="divide-y divide-gray-100">
              {deLaSemana.map((task) => (
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
                  <FechaCorta fecha={fechaLimite(task)} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Team overdue (for managers) */}
        {vencidasEquipo.length > 0 && (
          <Section
            title="Tareas del equipo vencidas"
            count={vencidasEquipo.length}
            color="pink"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            action={{ href: "/tasks", label: "Ver todas las tareas →" }}
          >
            <ul className="divide-y divide-gray-100">
              {vencidasEquipo.map((task) => (
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
                  <VencimientoPill fecha={fechaLimite(task)} ahora={now} />
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

/**
 * Antigüedad del vencimiento. Si la tarea no tiene ni plazo ni fecha prevista
 * se dice, en lugar de inventar un «hace 20.686d» contando desde 1970.
 */
function VencimientoPill({ fecha, ahora }: { fecha: Date | null; ahora: Date }) {
  if (!fecha) {
    return (
      <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">sin fecha</span>
    );
  }
  return (
    <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
      hace {daysOverdue(fecha, ahora)}d
    </span>
  );
}

/** Día y día de la semana, en el calendario español. */
function FechaCorta({ fecha }: { fecha: Date | null }) {
  if (!fecha) {
    return <span className="text-xs text-gray-400 shrink-0">sin fecha</span>;
  }
  return (
    <span className="text-xs text-gray-500 shrink-0">
      {fecha.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        // Sin esto el servidor formatea en UTC y una tarea de las 00:30 de
        // Madrid aparece con el día —y el nombre del día— de la víspera.
        timeZone: "Europe/Madrid",
      })}
    </span>
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
