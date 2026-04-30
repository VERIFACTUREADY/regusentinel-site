import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXTAUTH_URL || "https://app.baritur.pro";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secretParam = req.nextUrl.searchParams.get("secret");
  const provided = authHeader?.replace("Bearer ", "") || secretParam;

  if (CRON_SECRET && provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);

  // Get all active memberships with user emails
  const memberships = await prisma.membership.findMany({
    where: { role: { in: ["OWNER", "MANAGER"] } },
    select: {
      orgId: true,
      userId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const results: { userId: string; email: string; sent: boolean; items: number; error?: string }[] = [];

  for (const m of memberships) {
    const user = m.user;
    if (!user.email) continue;

    try {
      const [overdueTasksRaw, dueTodayRaw, dueTomorrowRaw, isdCriticalRaw, pendingApprovalsRaw, unreadPortalRaw, myAssignedRaw] = await Promise.all([
        // Overdue tasks (any case in org, not just assigned)
        prisma.task.findMany({
          where: {
            case: { orgId: m.orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
            deadline: { lt: now },
            status: { notIn: ["DONE", "SKIPPED"] },
          },
          select: {
            id: true, title: true, deadline: true,
            case: { select: { id: true, ref: true } },
            assignee: { select: { id: true } },
          },
          orderBy: { deadline: "asc" },
          take: 10,
        }),
        // Tasks due today
        prisma.task.findMany({
          where: {
            case: { orgId: m.orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
            deadline: { gte: now, lte: todayEnd },
            status: { notIn: ["DONE", "SKIPPED"] },
          },
          select: {
            id: true, title: true, deadline: true,
            case: { select: { id: true, ref: true } },
            assignee: { select: { id: true } },
          },
          orderBy: { deadline: "asc" },
          take: 10,
        }),
        // Tasks due tomorrow
        prisma.task.findMany({
          where: {
            case: { orgId: m.orgId, deletedAt: null, status: { notIn: ["CLOSED", "ARCHIVED"] } },
            deadline: { gt: todayEnd, lte: tomorrowEnd },
            status: { notIn: ["DONE", "SKIPPED"] },
          },
          select: {
            id: true, title: true, deadline: true,
            case: { select: { id: true, ref: true } },
            assignee: { select: { id: true } },
          },
          orderBy: { deadline: "asc" },
          take: 8,
        }),
        // ISD critical: expires in ≤30 days
        prisma.case.findMany({
          where: {
            orgId: m.orgId,
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
        // Pending approvals
        prisma.approval.count({
          where: { case: { orgId: m.orgId }, status: "PENDING" },
        }),
        // Unread portal messages
        prisma.portalMessage.count({
          where: {
            case: { orgId: m.orgId, deletedAt: null },
            fromFamily: true,
            readAt: null,
          },
        }),
        // My assigned tasks (any status active)
        prisma.task.count({
          where: {
            assigneeId: user.id,
            status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED", "READY"] },
            case: { orgId: m.orgId, deletedAt: null },
          },
        }),
      ]);

      const totalItems =
        overdueTasksRaw.length +
        dueTodayRaw.length +
        isdCriticalRaw.length +
        pendingApprovalsRaw +
        unreadPortalRaw;

      // Skip if nothing to report
      if (totalItems === 0 && dueTomorrowRaw.length === 0) {
        results.push({ userId: user.id, email: user.email, sent: false, items: 0 });
        continue;
      }

      const html = buildBriefingHtml({
        userName: user.name || user.email.split("@")[0],
        now,
        overdueTasks: overdueTasksRaw,
        dueToday: dueTodayRaw,
        dueTomorrow: dueTomorrowRaw,
        isdCritical: isdCriticalRaw,
        pendingApprovals: pendingApprovalsRaw,
        unreadPortal: unreadPortalRaw,
        myAssigned: myAssignedRaw,
        appUrl: APP_URL,
      });

      const subject = buildSubject(overdueTasksRaw.length, isdCriticalRaw.length, dueTodayRaw.length);

      if (!dryRun) {
        await sendEmail({ to: user.email, subject, html });
      }

      results.push({ userId: user.id, email: user.email, sent: !dryRun, items: totalItems });
    } catch (err: any) {
      results.push({ userId: user.id, email: user.email, sent: false, items: 0, error: String(err?.message ?? err) });
    }
  }

  const sent = results.filter((r) => r.sent).length;
  console.log(`[cron/daily-briefing] users=${memberships.length} sent=${sent} dryRun=${dryRun}`);
  return NextResponse.json({ dryRun, sent, total: memberships.length, results });
}

export const POST = GET;

function buildSubject(overdue: number, isdCritical: number, dueToday: number): string {
  if (overdue > 0 || isdCritical > 0) {
    const parts = [];
    if (overdue > 0) parts.push(`${overdue} tarea${overdue !== 1 ? "s" : ""} vencida${overdue !== 1 ? "s" : ""}`);
    if (isdCritical > 0) parts.push(`${isdCritical} ISD urgente${isdCritical !== 1 ? "s" : ""}`);
    return `⚠️ Agenda hoy: ${parts.join(", ")} — BARITUR PRO`;
  }
  if (dueToday > 0) {
    return `📋 Agenda del día: ${dueToday} tarea${dueToday !== 1 ? "s" : ""} para hoy — BARITUR PRO`;
  }
  return `📋 Tu agenda de hoy — BARITUR PRO`;
}

interface BriefingData {
  userName: string;
  now: Date;
  overdueTasks: { id: string; title: string; deadline: Date | null; case: { id: string; ref: string }; assignee: { id: string } | null }[];
  dueToday: { id: string; title: string; deadline: Date | null; case: { id: string; ref: string }; assignee: { id: string } | null }[];
  dueTomorrow: { id: string; title: string; deadline: Date | null; case: { id: string; ref: string }; assignee: { id: string } | null }[];
  isdCritical: { id: string; ref: string; deceased: { fullName: string; deathDate: Date | null } | null }[];
  pendingApprovals: number;
  unreadPortal: number;
  myAssigned: number;
  appUrl: string;
}

function taskRow(t: { title: string; deadline: Date | null; case: { id: string; ref: string } }, appUrl: string, urgent = false): string {
  return `
    <tr>
      <td style="padding:8px 16px;font-size:13px;border-bottom:1px solid #f3f4f6">
        <a href="${appUrl}/cases/${t.case.id}" style="color:${urgent ? "#991b1b" : "#4338ca"};text-decoration:none;font-weight:${urgent ? "600" : "500"}">${t.title}</a>
      </td>
      <td style="padding:8px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;font-family:monospace">
        <a href="${appUrl}/cases/${t.case.id}" style="color:#4338ca;text-decoration:none">${t.case.ref}</a>
      </td>
      <td style="padding:8px 16px;font-size:12px;border-bottom:1px solid #f3f4f6;${urgent ? "color:#991b1b;font-weight:600" : "color:#6b7280"}">
        ${t.deadline ? new Date(t.deadline).toLocaleDateString("es-ES") : "—"}
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

function buildBriefingHtml(data: BriefingData): string {
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
    <p style="margin:10px 0 0;font-size:13px;opacity:0.9">Tu agenda y prioridades del día en BARITUR PRO</p>
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
    BARITUR PRO · Gestión de herencias y sucesiones en España<br>
    Generado automáticamente el ${now.toLocaleString("es-ES")}
  </p>
</body>
</html>`;
}
