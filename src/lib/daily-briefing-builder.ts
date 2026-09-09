import { prisma } from "@/lib/prisma";

export interface BriefingTask {
  id: string;
  title: string;
  deadline: Date | null;
  dueDate: Date | null;
  case: { id: string; ref: string };
  assignee: { id: string } | null;
}

export interface BriefingIsdCase {
  id: string;
  ref: string;
  deceased: { fullName: string; deathDate: Date | null } | null;
}

export interface BriefingData {
  userName: string;
  now: Date;
  overdueTasks: BriefingTask[];
  dueToday: BriefingTask[];
  dueTomorrow: BriefingTask[];
  isdCritical: BriefingIsdCase[];
  pendingApprovals: number;
  unreadPortal: number;
  myAssigned: number;
  appUrl: string;
}

export interface BriefingFetchInput {
  orgId: string;
  userId: string;
  userName: string;
  now: Date;
  appUrl: string;
}

export async function fetchBriefingData(input: BriefingFetchInput): Promise<BriefingData> {
  const { orgId, userId, userName, now, appUrl } = input;

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const [overdueTasks, dueToday, dueTomorrow, isdCritical, pendingApprovals, unreadPortal, myAssigned] = await Promise.all([
    prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        OR: [{ deadline: { lt: now } }, { deadline: null, dueDate: { lt: now } }],
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      select: {
        id: true, title: true, deadline: true, dueDate: true,
        case: { select: { id: true, ref: true } },
        assignee: { select: { id: true } },
      },
      orderBy: { deadline: "asc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        OR: [
          { deadline: { gte: now, lte: todayEnd } },
          { deadline: null, dueDate: { gte: now, lte: todayEnd } },
        ],
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      select: {
        id: true, title: true, deadline: true, dueDate: true,
        case: { select: { id: true, ref: true } },
        assignee: { select: { id: true } },
      },
      orderBy: { deadline: "asc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        OR: [
          { deadline: { gt: todayEnd, lte: tomorrowEnd } },
          { deadline: null, dueDate: { gt: todayEnd, lte: tomorrowEnd } },
        ],
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      select: {
        id: true, title: true, deadline: true, dueDate: true,
        case: { select: { id: true, ref: true } },
        assignee: { select: { id: true } },
      },
      orderBy: { deadline: "asc" },
      take: 8,
    }),
    prisma.case.findMany({
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
    }),
    prisma.approval.count({
      where: { case: { orgId }, status: "PENDING" },
    }),
    prisma.portalMessage.count({
      where: {
        case: { orgId, deletedAt: null },
        fromFamily: true,
        readAt: null,
      },
    }),
    prisma.task.count({
      where: {
        assigneeId: userId,
        status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED", "READY"] },
        case: { orgId, deletedAt: null },
      },
    }),
  ]);

  return {
    userName, now, appUrl,
    overdueTasks, dueToday, dueTomorrow, isdCritical,
    pendingApprovals, unreadPortal, myAssigned,
  };
}

export function briefingTotalItems(data: BriefingData): number {
  return (
    data.overdueTasks.length +
    data.dueToday.length +
    data.isdCritical.length +
    data.pendingApprovals +
    data.unreadPortal
  );
}

export function buildBriefingSubject(overdue: number, isdCritical: number, dueToday: number): string {
  if (overdue > 0 || isdCritical > 0) {
    const parts = [];
    if (overdue > 0) parts.push(`${overdue} tarea${overdue !== 1 ? "s" : ""} vencida${overdue !== 1 ? "s" : ""}`);
    if (isdCritical > 0) parts.push(`${isdCritical} ISD urgente${isdCritical !== 1 ? "s" : ""}`);
    return `⚠️ Agenda hoy: ${parts.join(", ")} — Heredia`;
  }
  if (dueToday > 0) {
    return `📋 Agenda del día: ${dueToday} tarea${dueToday !== 1 ? "s" : ""} para hoy — Heredia`;
  }
  return `📋 Tu agenda de hoy — Heredia`;
}

function taskRow(t: BriefingTask, appUrl: string, urgent = false): string {
  return `
    <tr>
      <td style="padding:8px 16px;font-size:13px;border-bottom:1px solid #f3f4f6">
        <a href="${appUrl}/cases/${t.case.id}" style="color:${urgent ? "#991b1b" : "#4338ca"};text-decoration:none;font-weight:${urgent ? "600" : "500"}">${t.title}</a>
      </td>
      <td style="padding:8px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;font-family:monospace">
        <a href="${appUrl}/cases/${t.case.id}" style="color:#4338ca;text-decoration:none">${t.case.ref}</a>
      </td>
      <td style="padding:8px 16px;font-size:12px;border-bottom:1px solid #f3f4f6;${urgent ? "color:#991b1b;font-weight:600" : "color:#6b7280"}">
        ${(t.deadline ?? t.dueDate) ? new Date((t.deadline ?? t.dueDate)!).toLocaleDateString("es-ES") : "—"}
      </td>
    </tr>`;
}

function taskTable(rows: string, title: string, color: string): string {
  if (!rows) return "";
  return `
    <h3 style="color:${color};font-size:14px;margin:20px 0 6px;font-weight:600">${title}</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:4px">
      <thead><tr style="background:#f9fafb">
        <th style="padding:6px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Tarea</th>
        <th style="padding:6px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Expediente</th>
        <th style="padding:6px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Plazo</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildBriefingHtml(data: BriefingData): string {
  const { userName, now, overdueTasks, dueToday, dueTomorrow, isdCritical, pendingApprovals, unreadPortal, myAssigned, appUrl } = data;
  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const overdueRows = overdueTasks.map((t) => taskRow(t, appUrl, true)).join("");
  const todayRows = dueToday.map((t) => taskRow(t, appUrl)).join("");
  const tomorrowRows = dueTomorrow.map((t) => taskRow(t, appUrl)).join("");

  const isdSection = isdCritical.length ? `
    <h3 style="color:#991b1b;font-size:14px;margin:20px 0 6px;font-weight:600">ISD Urgente — menos de 30 días</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #fecaca;border-radius:8px;overflow:hidden;margin-bottom:4px;background:#fff5f5">
      <thead><tr style="background:#fee2e2">
        <th style="padding:6px 16px;text-align:left;font-size:11px;color:#991b1b;text-transform:uppercase">Expediente</th>
        <th style="padding:6px 16px;text-align:left;font-size:11px;color:#991b1b;text-transform:uppercase">Fallecido</th>
        <th style="padding:6px 16px;text-align:left;font-size:11px;color:#991b1b;text-transform:uppercase">Días restantes</th>
      </tr></thead>
      <tbody>
        ${isdCritical.map((c) => {
          const days = c.deceased?.deathDate
            ? 180 - Math.floor((now.getTime() - new Date(c.deceased.deathDate).getTime()) / 86400000)
            : null;
          return `<tr>
            <td style="padding:8px 16px;font-size:13px;font-family:monospace;border-bottom:1px solid #fecaca">
              <a href="${appUrl}/cases/${c.id}" style="color:#991b1b;text-decoration:none;font-weight:600">${c.ref}</a>
            </td>
            <td style="padding:8px 16px;font-size:13px;border-bottom:1px solid #fecaca">${c.deceased?.fullName || "—"}</td>
            <td style="padding:8px 16px;font-size:13px;font-weight:700;color:#991b1b;border-bottom:1px solid #fecaca">${days !== null ? `${days}d` : "—"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>` : "";

  const countersHtml = `
    <div style="display:flex;gap:12px;margin:20px 0;flex-wrap:wrap">
      ${overdueTasks.length ? `<div style="background:#fee2e2;color:#991b1b;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600">${overdueTasks.length} vencida${overdueTasks.length !== 1 ? "s" : ""}</div>` : ""}
      ${dueToday.length ? `<div style="background:#fef3c7;color:#92400e;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600">${dueToday.length} para hoy</div>` : ""}
      ${isdCritical.length ? `<div style="background:#fee2e2;color:#991b1b;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600">${isdCritical.length} ISD urgente${isdCritical.length !== 1 ? "s" : ""}</div>` : ""}
      ${pendingApprovals ? `<div style="background:#ede9fe;color:#5b21b6;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600">${pendingApprovals} aprobaci${pendingApprovals !== 1 ? "ones" : "ón"} pendiente${pendingApprovals !== 1 ? "s" : ""}</div>` : ""}
      ${unreadPortal ? `<div style="background:#dbeafe;color:#1e40af;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600">${unreadPortal} mensaje${unreadPortal !== 1 ? "s" : ""} de familia</div>` : ""}
      ${myAssigned ? `<div style="background:#f0fdf4;color:#166534;padding:8px 14px;border-radius:8px;font-size:13px">${myAssigned} tarea${myAssigned !== 1 ? "s" : ""} asignada${myAssigned !== 1 ? "s" : ""}</div>` : ""}
    </div>`;

  const nothingUrgent = !overdueTasks.length && !dueToday.length && !isdCritical.length;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Agenda del día</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#111827">
  <div style="background:linear-gradient(135deg,#6366f1,#2563eb);padding:24px;border-radius:12px;color:white;margin-bottom:24px">
    <h1 style="margin:0;font-size:20px">Buenos días, ${userName} 👋</h1>
    <p style="margin:6px 0 0;opacity:0.85;font-size:14px">${dateStr}</p>
    <p style="margin:10px 0 0;font-size:13px;opacity:0.9">Tu agenda y prioridades del día en Heredia</p>
  </div>

  ${nothingUrgent ? `
    <div style="text-align:center;padding:32px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px">
      <div style="font-size:32px;margin-bottom:8px">✅</div>
      <p style="color:#166534;font-weight:600;margin:0">Sin urgencias para hoy</p>
      <p style="color:#4ade80;font-size:13px;margin:4px 0 0">Todo en orden. ¡Buen trabajo!</p>
    </div>` : countersHtml}

  ${taskTable(overdueRows, "⚠️ Tareas vencidas — requieren atención inmediata", "#991b1b")}
  ${taskTable(todayRows, "📅 Vencen hoy", "#92400e")}
  ${isdSection}
  ${taskTable(tomorrowRows, "🔜 Vencen mañana", "#1d4ed8")}

  ${pendingApprovals > 0 ? `
    <div style="margin-top:20px;padding:12px 16px;background:#ede9fe;border-radius:8px;border-left:4px solid #7c3aed">
      <p style="margin:0;font-size:13px;color:#5b21b6;font-weight:600">
        ${pendingApprovals} aprobaci${pendingApprovals !== 1 ? "ones" : "ón"} pendiente${pendingApprovals !== 1 ? "s" : ""}
        — <a href="${appUrl}/approvals" style="color:#5b21b6">Revisar →</a>
      </p>
    </div>` : ""}

  ${unreadPortal > 0 ? `
    <div style="margin-top:12px;padding:12px 16px;background:#dbeafe;border-radius:8px;border-left:4px solid #2563eb">
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600">
        ${unreadPortal} mensaje${unreadPortal !== 1 ? "s" : ""} sin leer de famili${unreadPortal !== 1 ? "as" : "a"}
        — <a href="${appUrl}/cases" style="color:#1e40af">Ver expedientes →</a>
      </p>
    </div>` : ""}

  <div style="margin-top:28px;text-align:center">
    <a href="${appUrl}/dashboard" style="background:#4338ca;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
      Ir al panel →
    </a>
  </div>

  <p style="margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;text-align:center">
    Heredia · Gestión de herencias y sucesiones en España<br>
    Generado automáticamente el ${now.toLocaleString("es-ES")}
  </p>
</body>
</html>`;
}
