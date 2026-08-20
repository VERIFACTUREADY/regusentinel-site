import { getVerifiedSession, getVerifiedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOnboardingState } from "@/lib/onboarding";
import { OnboardingPanel } from "@/components/dashboard/onboarding-panel";
import { DemoHighlights } from "@/components/dashboard/demo-highlights";
import { MyTasksWidget } from "@/components/dashboard/my-tasks-widget";
import { UsageWidget } from "@/components/dashboard/usage-widget";
import { DeadlineCalendar } from "@/components/dashboard/deadline-calendar";
import { DEMO_ORG_SLUG } from "@/lib/demo-data";
import { CASE_STATUS_COLORS } from "@/lib/constants";
import { getAiInsights } from "@/lib/ai-insights";
import { getOrgRiskOverview } from "@/lib/isd-risk-aggregator";
import { getOrgActionQueue } from "@/lib/action-queue";
import { BulkAnalyzeButton } from "@/components/dashboard/bulk-analyze-button";
import { RiskRadarWidget } from "@/components/dashboard/risk-radar-widget";
import { ActionQueueWidget } from "@/components/dashboard/action-queue-widget";
import { NoOrgSetup } from "@/components/no-org-setup";
import { redirect } from "next/navigation";
import Link from "next/link";

import { consultar, listaDe, datosDe, type Resultado } from "@/lib/consulta-segura";
import {
  BloqueFallido,
  Kpi,
  AvisoDatosIncompletos,
} from "@/components/dashboard/fallo-bloque";
import {
  partesCivilesES,
  inicioDelDiaES,
  inicioDelDiaDeES,
  sumarDiasES,
  diasCivilesEntreES,
} from "@/lib/fecha-es";

/**
 * Adapta las tareas de Prisma a lo que espera `MyTasksWidget`, que es un
 * componente de cliente y sólo admite datos serializables.
 *
 * Antes se hacía `initialTasks={myTasks as any}`, que apagaba la comprobación
 * entera: el widget declara `deadline: string | null` y le estaba llegando un
 * `Date`. Funcionaba de milagro porque Next lo serializa por el camino, pero
 * ni el tipo ni el componente lo decían.
 */
function aTareasDelWidget(
  tareas: {
    id: string;
    title: string;
    status: string;
    caseId: string;
    deadline: Date | null;
    case: { id: string; ref: string; isUrgent: boolean };
  }[],
) {
  return tareas.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    caseId: t.caseId,
    deadline: t.deadline ? t.deadline.toISOString() : null,
    case: t.case,
  }));
}

export default async function DashboardPage() {
  // Sesion verificada contra base de datos: un usuario expulsado dejaba de
  // pasar los controles de la API pero SEGUIA viendo aqui los datos de su
  // antigua organizacion, porque el orgId salia del JWT. Lo detecto el smoke
  // test de expulsion.
  const verified = await getVerifiedSession();
  const identidad = verified ?? (await (async () => {
    const u = await getVerifiedUser();
    return u ? { user: { id: u.id, email: u.email, name: u.name, orgId: null } } : null;
  })());
  if (!identidad) redirect("/login");
  const session = identidad;
  const orgId = verified?.orgId ?? null;
  // Usuario autenticado pero sin organización: le ofrecemos crearla
  // en lugar de mostrar un callejón sin salida.
  if (!orgId) return <NoOrgSetup userName={session.user.name} />;

  const now = new Date();
  const userId = session.user.id;

  /*
   * El mes que se pinta y sus limites, en el calendario ESPANOL.
   *
   * Con `now.getMonth()` —hora local del proceso, que va en UTC— el dia 1 de
   * cada mes, entre las 00:00 y las 02:00 de Madrid, el panel seguia
   * ensenando el mes ANTERIOR y contaba los expedientes cerrados del mes que
   * ya habia terminado.
   */
  const { anio: calYear, mes: mesES } = partesCivilesES(now);
  const calMonth = mesES - 1; // `DeadlineCalendar` cuenta los meses desde 0
  const calFrom = inicioDelDiaES(calYear, mesES, 1);
  // Comienzo del mes siguiente menos 1 ms: vale igual para meses de 28 y de 31.
  const calTo = new Date(
    (mesES === 12
      ? inicioDelDiaES(calYear + 1, 1, 1)
      : inicioDelDiaES(calYear, mesES + 1, 1)
    ).getTime() - 1,
  );
  const startOfMonth = calFrom;
  // `weekEnd` e `isdAlertThreshold` se calculaban aqui y no los leia nadie:
  // el corte de la semana lo hace ahora `sumarDiasES` con el calendario
  // espanol, y el umbral ISD va escrito dentro de su propia consulta.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Comienzo del dia ESPANOL: es el corte de «vencida» y el que separa los
  // plazos pasados de los futuros en el calendario del panel.
  const hoyES = inicioDelDiaDeES(now);
  const finDeSemanaES = sumarDiasES(now, 7);

  const [activeCases, pendingTasks, blockedTasks, readyTasks, closedThisMonth, pendingApprovals, recentCases, recentLogs, upcomingDeadlines, onboarding, org, myTasks, calendarTasks, criticalBlockedTasks, teamWorkload, members, overdueTasksAll, isdCriticalCases, unreadPortalCount] = await Promise.all([
    consultar("expedientesActivos", () => prisma.case.count({
      where: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
    })),
    consultar("tareasPendientes", () => prisma.task.count({
      where: { case: { orgId, deletedAt: null }, status: { in: ["PENDING", "IN_PROGRESS"] } },
    })),
    consultar("tareasBloqueadas", () => prisma.task.count({
      where: { case: { orgId, deletedAt: null }, status: "BLOCKED" },
    })),
    consultar("tareasListas", () => prisma.task.count({
      where: { case: { orgId, deletedAt: null }, status: "READY" },
    })),
    consultar("cerradosEsteMes", () => prisma.case.count({
      where: { orgId, deletedAt: null, status: "CLOSED", closedAt: { gte: startOfMonth } },
    })),
    consultar("aprobacionesPendientes", () => prisma.approval.count({
      // `deletedAt: null` faltaba: el indicador contaba tambien las
      // aprobaciones de expedientes ya borrados, asi que no cuadraba con la
      // lista de /today —que si las excluye— sin ninguna explicacion visible.
      where: { case: { orgId, deletedAt: null }, status: "PENDING" },
    })),
    consultar("expedientesRecientes", () => prisma.case.findMany({
      where: { orgId, deletedAt: null },
      include: {
        deceased: { select: { fullName: true } },
        contact: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    })),
    consultar("actividadReciente", () => prisma.auditLog.findMany({
      where: { orgId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    })),
    consultar("proximosPlazos", () => prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null },
        deadline: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), gte: now },
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      include: { case: { select: { ref: true } } },
      orderBy: { deadline: "asc" },
      take: 8,
    })),
    consultar("onboarding", () => getOnboardingState(orgId)),
    consultar("organizacion", () => prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true },
    })),
    consultar("misTareas", () => prisma.task.findMany({
      where: {
        assigneeId: userId,
        case: { orgId, deletedAt: null },
        status: { in: ["PENDING", "IN_PROGRESS", "READY"] },
      },
      include: { case: { select: { id: true, ref: true, isUrgent: true } } },
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
      take: 8,
    })),
    consultar("calendarioPlazos", () => prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null },
        OR: [
          { deadline: { gte: calFrom, lte: calTo } },
          { dueDate: { gte: calFrom, lte: calTo } },
        ],
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      select: { deadline: true, dueDate: true },
    })),
    // Blocked tasks stuck for > 7 days — need immediate attention
    consultar("bloqueadasCriticas", () => prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null },
        status: "BLOCKED",
        updatedAt: { lte: sevenDaysAgo },
      },
      include: {
        case: { select: { id: true, ref: true, isUrgent: true, deceased: { select: { fullName: true } } } },
      },
      orderBy: { updatedAt: "asc" },
      take: 5,
    })),
    // Team workload: tasks grouped by assignee and status
    consultar("cargaDelEquipo", () => prisma.task.groupBy({
      by: ["assigneeId", "status"],
      where: { case: { orgId, deletedAt: null }, assigneeId: { not: null } },
      _count: true,
    })),
    // Org members for name lookup
    consultar("miembros", () => prisma.membership.findMany({
      where: { orgId },
      select: { userId: true, user: { select: { name: true, email: true } } },
    })),
    // Overdue tasks (deadline in the past, not done/skipped)
    consultar("tareasVencidas", () => prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        /*
         * VENCIDA = de un dia ya pasado, el mismo criterio que usa /today.
         *
         * Con `lt: now` las dos pantallas contaban cosas distintas llamandolas
         * igual: una tarea con plazo hoy a las 14:00 salia como vencida en el
         * panel a las 14:01 mientras el resumen del dia seguia —con razon—
         * poniendola en «Para hoy». El gestor veia dos cifras que no cuadraban
         * sin ninguna explicacion.
         */
        deadline: { lt: hoyES },
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      select: {
        id: true, title: true, deadline: true,
        case: { select: { id: true, ref: true } },
        assignee: { select: { name: true, email: true } },
      },
      orderBy: { deadline: "asc" },
      take: 8,
    })),
    // ISD critical: cases expiring in ≤30 days
    consultar("isdCritico", () => prisma.case.findMany({
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
        id: true, ref: true,
        deceased: { select: { fullName: true, deathDate: true } },
      },
      orderBy: { deceased: { deathDate: "asc" } },
      take: 5,
    })),
    // Unread portal messages from families
    consultar("mensajesSinLeer", () => prisma.portalMessage.count({
      where: {
        case: { orgId, deletedAt: null },
        fromFamily: true,
        readAt: null,
      },
    })),
  ]);

  /*
   * Estos tres respaldos eran los más peligrosos de toda la pantalla.
   *
   * `getOrgRiskOverview` caía a `totalActiveAlerts: 0`, y `RiskRadarWidget`
   * pinta con ese cero un mensaje en verde: «Todos los expedientes en orden».
   * `getOrgActionQueue` caía a `items: []`, y `ActionQueueWidget` responde con
   * «Nada pendiente de acción inmediata». Es decir: cuando el motor de riesgos
   * o el de prioridades reventaba, el panel felicitaba al usuario.
   *
   * Ahora el fallo llega hasta el widget y se dice.
   */
  const aiInsights = await consultar("insightsIA", () => getAiInsights(orgId));
  const riskOverview = await consultar("radarISD", () => getOrgRiskOverview(orgId, 6));
  const actionQueue = await consultar("planDeAcciones", () => getOrgActionQueue(orgId, 8));

  // In the public demo org surface 3 "try this" shortcuts so prospects
  // get to the wow-moments (urgente case, portal familia, pack banco)
  // in under 30 seconds.
  const isDemo =
    process.env.DEMO_ENABLED === "true" &&
    datosDe(org)?.slug === DEMO_ORG_SLUG;
  let demoHighlights: {
    urgentCaseId: string | null;
    urgentCaseRef: string | null;
    portalToken: string | null;
    portalCaseRef: string | null;
    bankPackCaseId: string | null;
    bankPackCaseRef: string | null;
  } | null = null;
  if (isDemo) {
    const [urgent, portalCase, bankCase] = await Promise.all([
      consultar("demoUrgente", () => prisma.case.findFirst({
        where: { orgId, ref: "EXP-DEMO-0004" },
        select: { id: true, ref: true },
      })),
      consultar("demoPortal", () => prisma.case.findFirst({
        where: { orgId, ref: "EXP-DEMO-0003" },
        select: { portalToken: true, ref: true },
      })),
      consultar("demoPackBanco", () => prisma.case.findFirst({
        where: { orgId, ref: "EXP-DEMO-0002" },
        select: { id: true, ref: true },
      })),
    ]);
    // Los atajos de la demo son adornos comerciales: si su consulta falla se
    // omite el atajo, sin alarmar a nadie. Aqui `null` no miente sobre ningun
    // dato del despacho, sólo significa "no pongo este enlace".
    const urgente = datosDe(urgent);
    const portal = datosDe(portalCase);
    const banco = datosDe(bankCase);
    demoHighlights = {
      urgentCaseId: urgente?.id ?? null,
      urgentCaseRef: urgente?.ref ?? null,
      portalToken: portal?.portalToken ?? null,
      portalCaseRef: portal?.ref ?? null,
      bankPackCaseId: banco?.id ?? null,
      bankPackCaseRef: banco?.ref ?? null,
    };
  }

  /*
   * Los seis indicadores. `valor: null` significa «no se ha podido consultar»,
   * y `<Kpi>` lo pinta como «—», nunca como 0.
   */
  const kpis = [
    { id: "expedientes-activos", label: "Expedientes activos", res: activeCases, color: "text-blue-600" },
    { id: "tareas-pendientes", label: "Tareas pendientes", res: pendingTasks, color: "text-orange-600" },
    { id: "tareas-bloqueadas", label: "Tareas bloqueadas", res: blockedTasks, color: "text-red-600" },
    { id: "tareas-listas", label: "Listas para accion", res: readyTasks, color: "text-yellow-600" },
    { id: "aprobaciones-pendientes", label: "Aprobaciones pend.", res: pendingApprovals, color: "text-amber-600" },
    { id: "cerrados-este-mes", label: "Cerrados este mes", res: closedThisMonth, color: "text-green-600" },
  ];

  /*
   * Casillas del calendario del panel, agrupadas por DÍA ESPAÑOL.
   *
   * Antes se hacía `d.setHours(0,0,0,0); const day = d.getDate();`, que usa la
   * hora local del proceso. El servidor va en UTC: una tarea con plazo el 21 a
   * las 00:30 de Madrid se guarda como las 22:30 del 20 en UTC y se pintaba en
   * la casilla del día 20 —el día anterior al que pone el expediente—.
   */
  const calByDay: Record<number, { overdue: number; soon: number; future: number }> = {};
  for (const t of listaDe(calendarTasks)) {
    const fecha = t.deadline ?? t.dueDate;
    if (!fecha) continue;
    const { anio, mes, dia } = partesCivilesES(fecha);
    // Sólo cuentan los días del mes que se está pintando.
    if (anio !== calYear || mes !== calMonth + 1) continue;
    const inicioDelDia = inicioDelDiaES(anio, mes, dia);
    const bucket = (calByDay[dia] ??= { overdue: 0, soon: 0, future: 0 });
    if (inicioDelDia < hoyES) bucket.overdue++;
    else if (inicioDelDia <= finDeSemanaES) bucket.soon++;
    else bucket.future++;
  }
  const calendarDays = Object.entries(calByDay).map(([day, counts]) => ({
    date: `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ...counts,
  }));

  /** Días de calendario que faltan, contados en el calendario español. */
  function daysUntil(date: Date): number {
    return diasCivilesEntreES(now, date);
  }

  const memberMap = Object.fromEntries(
    listaDe(members).map((m) => [m.userId, m.user.name || m.user.email]),
  );
  const workloadByUser: Record<string, { name: string; active: number; blocked: number; done: number; total: number }> = {};
  for (const row of listaDe(teamWorkload)) {
    if (!row.assigneeId) continue;
    if (!workloadByUser[row.assigneeId]) {
      workloadByUser[row.assigneeId] = { name: memberMap[row.assigneeId] || row.assigneeId, active: 0, blocked: 0, done: 0, total: 0 };
    }
    const entry = workloadByUser[row.assigneeId];
    entry.total += row._count;
    if (row.status === "DONE" || row.status === "SKIPPED") entry.done += row._count;
    else if (row.status === "BLOCKED") entry.blocked += row._count;
    else entry.active += row._count;
  }
  const workloadEntries = Object.values(workloadByUser).sort((a, b) => b.active - a.active).slice(0, 6);

  /*
   * Listas ya desenvueltas. Cada bloque comprueba ANTES su propio
   * `Resultado.ok`; el array vacío es sólo para poder recorrerlo.
   */
  const vencidas = listaDe(overdueTasksAll);
  const isdCriticos = listaDe(isdCriticalCases);
  const mensajesSinLeer = datosDe(unreadPortalCount);
  const plazosProximos = listaDe(upcomingDeadlines);
  const bloqueadasCriticas = listaDe(criticalBlockedTasks);
  const recientes = listaDe(recentCases);
  const registros = listaDe(recentLogs);
  const estadoOnboarding = datosDe(onboarding);
  const ia = datosDe(aiInsights);

  /*
   * Inventario de lo que no se ha podido cargar, para avisar arriba del todo.
   * Se nombra en las palabras del usuario, no con el identificador interno.
   */
  const bloquesCaidos = (
    [
      [activeCases, "los expedientes activos"],
      [pendingTasks, "las tareas pendientes"],
      [blockedTasks, "las tareas bloqueadas"],
      [readyTasks, "las tareas listas"],
      [closedThisMonth, "los expedientes cerrados este mes"],
      [pendingApprovals, "las aprobaciones pendientes"],
      [recentCases, "los expedientes recientes"],
      [recentLogs, "la actividad reciente"],
      [upcomingDeadlines, "los próximos plazos"],
      [myTasks, "mis tareas asignadas"],
      [calendarTasks, "el calendario de plazos"],
      [criticalBlockedTasks, "las tareas bloqueadas +7 días"],
      [teamWorkload, "la carga del equipo"],
      [overdueTasksAll, "las tareas vencidas"],
      [isdCriticalCases, "los plazos ISD críticos"],
      [unreadPortalCount, "los mensajes de las familias"],
      [riskOverview, "el Radar ISD"],
      [actionQueue, "el Plan de acciones"],
      [aiInsights, "los insights de IA"],
    ] as [Resultado<unknown>, string][]
  )
    .filter(([r]) => !r.ok)
    .map(([, nombre]) => nombre);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {demoHighlights && <DemoHighlights {...demoHighlights} />}

      <AvisoDatosIncompletos bloques={bloquesCaidos} />

      {estadoOnboarding?.show && !isDemo && (
        <OnboardingPanel
          steps={estadoOnboarding.steps}
          completed={estadoOnboarding.completed}
          total={estadoOnboarding.total}
        />
      )}

      {/* Top urgencies banner */}
      {(vencidas.length > 0 || isdCriticos.length > 0 || (mensajesSinLeer ?? 0) > 0) && (
        <div data-testid="bloque-accion-inmediata" className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="font-semibold text-red-900">Requiere acción inmediata</h2>
            </div>
            <Link href="/today" className="text-xs text-red-700 underline hover:text-red-900 shrink-0">
              Ver resumen del día →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {vencidas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                  {vencidas.length} tarea{vencidas.length !== 1 ? "s" : ""} vencida{vencidas.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-1.5">
                  {vencidas.slice(0, 5).map((t: any) => {
                    const daysAgo = t.deadline ? diasCivilesEntreES(t.deadline, now) : 0;
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-2">
                        <Link href={`/cases/${t.case.id}`} className="text-xs text-red-800 hover:underline truncate flex-1">
                          <span className="font-mono mr-1">{t.case.ref}</span>{t.title}
                        </Link>
                        <span className="text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-medium shrink-0">+{daysAgo}d</span>
                      </div>
                    );
                  })}
                  {vencidas.length > 5 && (
                    <Link href="/tasks" className="text-xs text-red-600 hover:underline">+{vencidas.length - 5} más →</Link>
                  )}
                </div>
              </div>
            )}
            {isdCriticos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                  {isdCriticos.length} ISD crítico{isdCriticos.length !== 1 ? "s" : ""} (&lt;30 días)
                </p>
                <div className="space-y-1.5">
                  {isdCriticos.map((c: any) => {
                    const days = c.deceased?.deathDate
                      ? 180 - diasCivilesEntreES(c.deceased.deathDate, now)
                      : null;
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2">
                        <Link href={`/cases/${c.id}`} className="text-xs text-red-800 hover:underline truncate flex-1">
                          <span className="font-mono mr-1">{c.ref}</span>{c.deceased?.fullName || "—"}
                        </Link>
                        {days !== null && (
                          <span className="text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-bold shrink-0">{days}d</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {mensajesSinLeer !== null && mensajesSinLeer > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                  {mensajesSinLeer} mensaje{mensajesSinLeer !== 1 ? "s" : ""} de familia sin leer
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Las familias están esperando respuesta.{" "}
                  <Link href="/cases?urgent=true" className="underline">Ver expedientes →</Link>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map((kpi) => (
          <Kpi
            key={kpi.id}
            id={kpi.id}
            etiqueta={kpi.label}
            valor={datosDe(kpi.res)}
            color={kpi.color}
          />
        ))}
      </div>

      {/* Plan de acciones + Radar ISD */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {actionQueue.ok ? (
          <ActionQueueWidget queue={actionQueue.datos} />
        ) : (
          <BloqueFallido que="el plan de acciones" id="plan-de-acciones" />
        )}
        {riskOverview.ok ? (
          <RiskRadarWidget overview={riskOverview.datos} />
        ) : (
          <BloqueFallido que="el Radar ISD" id="radar-isd" />
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3">
          {myTasks.ok ? (
            <MyTasksWidget initialTasks={aTareasDelWidget(myTasks.datos)} />
          ) : (
            <BloqueFallido que="mis tareas asignadas" id="mis-tareas" />
          )}
        </div>
        <div className="space-y-4">
          {calendarTasks.ok ? (
            <DeadlineCalendar days={calendarDays} year={calYear} month={calMonth} />
          ) : (
            <BloqueFallido que="el calendario de plazos" id="calendario-plazos" />
          )}
          <UsageWidget />
        </div>
      </div>

      {/* Critical attention panel */}
      {(!upcomingDeadlines.ok || !criticalBlockedTasks.ok) && (
        <div className="mb-8 grid md:grid-cols-2 gap-4">
          {!upcomingDeadlines.ok && (
            <BloqueFallido que="los próximos plazos (30 días)" id="proximos-plazos" />
          )}
          {!criticalBlockedTasks.ok && (
            <BloqueFallido que="las tareas bloqueadas +7 días" id="bloqueadas-criticas" />
          )}
        </div>
      )}
      {(plazosProximos.length > 0 || bloqueadasCriticas.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Requiere atencion inmediata
            </h2>
            <a
              href="/api/digest/deadline?format=html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Digest ISD
            </a>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {plazosProximos.length > 0 && (
              <div data-testid="bloque-proximos-plazos" className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Plazos proximos (30 dias)
                </h3>
                <div className="space-y-2">
                  {plazosProximos.map((task: any) => {
                    const days = daysUntil(task.deadline!);
                    const urgent = days <= 7;
                    return (
                      <div key={task.id} className="flex items-center justify-between text-sm">
                        <Link href={`/cases/${task.caseId}`} className={`hover:underline ${urgent ? "text-red-800 font-medium" : "text-red-700"}`}>
                          <span className="font-mono text-xs mr-2">{task.case.ref}</span>
                          {task.title}
                        </Link>
                        <span className={`px-2 py-0.5 rounded text-xs shrink-0 ml-2 ${urgent ? "bg-red-200 text-red-800 font-medium" : "bg-red-100 text-red-700"}`}>
                          {days <= 0 ? "VENCIDO" : `${days}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {bloqueadasCriticas.length > 0 && (
              <div data-testid="bloque-bloqueadas-criticas" className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Tareas bloqueadas +7 dias
                </h3>
                <div className="space-y-2">
                  {bloqueadasCriticas.map((task: any) => {
                    const daysSince = diasCivilesEntreES(task.updatedAt, now);
                    return (
                      <div key={task.id} className="flex items-start justify-between text-sm gap-2">
                        <div className="flex-1 min-w-0">
                          <Link href={`/cases/${task.case.id}`} className="text-orange-800 font-medium hover:underline">
                            <span className="font-mono text-xs mr-1">{task.case.ref}</span>
                          </Link>
                          <p className="text-orange-700 text-xs truncate">{task.title}</p>
                          {task.blockReason && <p className="text-xs text-orange-500 truncate">{task.blockReason}</p>}
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded font-medium shrink-0">{daysSince}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team workload */}
      {(!teamWorkload.ok || !members.ok) && (
        <div className="mb-8">
          <BloqueFallido que="la carga de trabajo del equipo" id="carga-equipo" />
        </div>
      )}
      {teamWorkload.ok && members.ok && workloadEntries.length > 0 && (
        <div data-testid="bloque-carga-equipo" className="bg-white rounded-lg border mb-8">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="font-semibold">Carga de trabajo del equipo</h2>
            <Link href="/reports" className="text-sm text-primary hover:underline">Ver informes</Link>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {workloadEntries.map((entry) => {
                const completionPct = entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0;
                return (
                  <div key={entry.name} className="flex items-center gap-4">
                    <div className="w-32 shrink-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.name}</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 gap-px">
                        {entry.blocked > 0 && (
                          <div
                            className="bg-red-400 h-full"
                            style={{ width: `${(entry.blocked / entry.total) * 100}%` }}
                            title={`${entry.blocked} bloqueadas`}
                          />
                        )}
                        {entry.active > 0 && (
                          <div
                            className="bg-blue-400 h-full"
                            style={{ width: `${(entry.active / entry.total) * 100}%` }}
                            title={`${entry.active} activas`}
                          />
                        )}
                        {entry.done > 0 && (
                          <div
                            className="bg-green-400 h-full"
                            style={{ width: `${(entry.done / entry.total) * 100}%` }}
                            title={`${entry.done} completadas`}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500 w-36 justify-end">
                      {entry.blocked > 0 && <span className="text-red-600 font-medium">{entry.blocked} bloq.</span>}
                      <span className="text-blue-600">{entry.active} activas</span>
                      <span className="text-gray-400">{completionPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Bloqueadas</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> Activas</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Completadas</span>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights widget */}
      <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-lg border border-purple-200 mb-8">
          <div className="px-6 py-4 border-b border-purple-100 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="font-semibold">Insights IA del despacho</h2>
              <span className="text-xs px-2 py-0.5 bg-white border border-purple-200 rounded-full text-purple-700">ultimos 30 dias</span>
            </div>
            <div className="flex items-center gap-4">
              {ia && ia.averageScore !== null && (
                <div className="text-right">
                  <span className="text-xs text-gray-500">Score medio </span>
                  <span className={`font-bold ${
                    ia.averageScore >= 70 ? "text-green-600" :
                    ia.averageScore >= 40 ? "text-orange-600" : "text-red-600"
                  }`}>
                    {ia.averageScore}/100
                  </span>
                  <span className="text-xs text-gray-400 ml-1">({ia.totalCasesAnalyzed} casos)</span>
                </div>
              )}
              <BulkAnalyzeButton openCaseCount={datosDe(activeCases)} />
            </div>
          </div>
          <div className="p-6 grid md:grid-cols-4 gap-4 mb-2">
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Casos analizados</p>
              <p className="text-2xl font-bold text-purple-700 mt-1">{ia ? ia.thirtyDays.casesAnalyzed : "—"}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Calculos ISD</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{ia ? ia.thirtyDays.isdCalculations : "—"}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Mensajes chat IA</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{ia ? ia.thirtyDays.chatMessages : "—"}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Horas ahorradas (est.)</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{ia ? ia.thirtyDays.estimatedHoursSaved : "—"}h</p>
            </div>
          </div>
          {ia && ia.riskiestCases.length > 0 && (
            <div className="px-6 pb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Expedientes con menor score</h3>
              <div className="space-y-2">
                {ia.riskiestCases.map((c) => (
                  <Link
                    key={c.caseId}
                    href={`/cases/${c.caseId}`}
                    className="flex items-center gap-3 bg-white border border-purple-100 rounded-lg p-3 hover:border-purple-300 transition"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 ${
                      c.healthScore >= 70 ? "bg-green-500" :
                      c.healthScore >= 40 ? "bg-orange-500" : "bg-red-500"
                    }`}>
                      {c.healthScore}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-purple-700 font-medium">{c.ref}</span>
                        {c.deceasedName && <span className="text-sm text-gray-700">· {c.deceasedName}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{c.summary}</p>
                    </div>
                    <span className="text-xs text-purple-600 shrink-0">Ver →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Recent cases */}
      <div data-testid="bloque-expedientes-recientes" className="bg-white rounded-lg border mb-8">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Expedientes recientes</h2>
          <Link href="/cases" className="text-sm text-primary hover:underline">Ver todos</Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-6 py-3">Ref</th>
              <th className="px-6 py-3">Fallecido</th>
              <th className="px-6 py-3">Solicitante</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {recientes.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-3">
                  <Link href={`/cases/${c.id}`} className="text-primary hover:underline font-medium">{c.ref}</Link>
                </td>
                <td className="px-6 py-3 text-sm">{c.deceased?.fullName || "-"}</td>
                <td className="px-6 py-3 text-sm">{c.contact?.fullName || "-"}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${CASE_STATUS_COLORS[c.status] || ""}`}>
                    {c.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {c.createdAt.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}
                </td>
              </tr>
            ))}
            {recientes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  {recentCases.ok ? (
                    <span className="text-gray-400" data-testid="vacio-expedientes-recientes">
                      No hay expedientes
                    </span>
                  ) : (
                    /* «No hay expedientes» era la misma frase para «hay cero» y
                       para «no he podido consultarlo». Ya no. */
                    <span role="alert" data-testid="fallo-expedientes-recientes" className="text-red-700">
                      No se han podido cargar los expedientes recientes. Esto no
                      significa que no haya ninguno.
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent audit */}
      <div data-testid="bloque-actividad" className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Actividad reciente</h2>
          <Link href="/audit" className="text-sm text-primary hover:underline">Ver todo</Link>
        </div>
        <div className="divide-y">
          {registros.map((log) => (
            <div key={log.id} className="px-6 py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{log.user?.name || log.user?.email || "Sistema"}</span>
                <span className="text-gray-500 ml-2">{log.action}</span>
                {log.details && <span className="text-gray-400 ml-2">- {log.details}</span>}
              </div>
              <span className="text-gray-400 text-xs">
                {log.createdAt.toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}
              </span>
            </div>
          ))}
          {registros.length === 0 &&
            (recentLogs.ok ? (
              <p className="px-6 py-8 text-center text-gray-400" data-testid="vacio-actividad">
                Sin actividad
              </p>
            ) : (
              <p role="alert" data-testid="fallo-actividad" className="px-6 py-8 text-center text-red-700">
                No se ha podido cargar la actividad reciente.
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}
