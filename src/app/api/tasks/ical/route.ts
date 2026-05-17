import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function icalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icalEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  const out: string[] = [];
  while (line.length > 75) {
    out.push(line.slice(0, 75));
    line = " " + line.slice(75);
  }
  out.push(line);
  return out.join("\r\n");
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.read")) {
    return new NextResponse("Sin permisos", { status: 403 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "me"; // "me" | "all"
  const userId = session.user.id;
  const orgId = session.user.orgId;

  const whereFilter = scope === "all" && hasPermission(session.user.role, "cases.read")
    ? { case: { orgId, deletedAt: null } }
    : { assigneeId: userId, case: { orgId, deletedAt: null } };

  const tasks = await prisma.task.findMany({
    where: {
      ...whereFilter,
      deadline: { not: null },
      status: { notIn: ["DONE", "SKIPPED"] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      deadline: true,
      category: true,
      case: { select: { ref: true, deceased: { select: { fullName: true } } } },
      assignee: { select: { name: true, email: true } },
    },
    orderBy: { deadline: "asc" },
    take: 500,
  });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//BARITUR PRO//Plazos ${org?.name ?? ""}//ES`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icalEscape(`Plazos BARITUR${org?.name ? " – " + org.name : ""}`)}`,
    "X-WR-TIMEZONE:Europe/Madrid",
    "X-WR-CALDESC:Plazos de tareas exportados desde BARITUR PRO",
  ];

  for (const task of tasks) {
    if (!task.deadline) continue;
    const deadline = new Date(task.deadline);
    const uid = `task-${task.id}@baritur.pro`;
    const summary = `[${task.case.ref}] ${task.title}`;
    const deceasedName = task.case.deceased?.fullName;
    const description = [
      `Expediente: ${task.case.ref}`,
      deceasedName ? `Fallecido: ${deceasedName}` : null,
      `Estado: ${task.status}`,
      task.assignee ? `Asignado a: ${task.assignee.name || task.assignee.email}` : null,
    ].filter(Boolean).join("\\n");

    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${uid}`));
    lines.push(foldLine(`DTSTAMP:${icalDate(now)}`));
    lines.push(foldLine(`DTSTART;VALUE=DATE:${deadline.toISOString().slice(0, 10).replace(/-/g, "")}`));
    lines.push(foldLine(`DTEND;VALUE=DATE:${deadline.toISOString().slice(0, 10).replace(/-/g, "")}`));
    lines.push(foldLine(`SUMMARY:${icalEscape(summary)}`));
    lines.push(foldLine(`DESCRIPTION:${description}`));
    lines.push(foldLine(`CATEGORIES:${icalEscape(task.category)}`));
    if (deadline < now) {
      lines.push("STATUS:NEEDS-ACTION");
      lines.push("PRIORITY:1");
    }
    lines.push("END:VEVENT");
  }

  // Also add ISD deadlines for open cases
  const isdCases = await prisma.case.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
      deceased: { deathDate: { not: null } },
    },
    select: {
      id: true,
      ref: true,
      deceased: { select: { fullName: true, deathDate: true } },
    },
    take: 200,
  });

  for (const c of isdCases) {
    if (!c.deceased?.deathDate) continue;
    const deathDate = new Date(c.deceased.deathDate);
    const isdDeadline = new Date(deathDate);
    isdDeadline.setMonth(isdDeadline.getMonth() + 6);

    if (isdDeadline < new Date(now.getTime() - 90 * 86400000)) continue;

    const uid = `isd-${c.id}@baritur.pro`;
    const summary = `ISD: ${c.deceased.fullName ?? c.ref} (${c.ref})`;
    const description = `Plazo 6 meses ISD (Modelo 650)\\nFallecido: ${c.deceased.fullName ?? "—"}\\nExpediente: ${c.ref}`;

    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${uid}`));
    lines.push(foldLine(`DTSTAMP:${icalDate(now)}`));
    lines.push(foldLine(`DTSTART;VALUE=DATE:${isdDeadline.toISOString().slice(0, 10).replace(/-/g, "")}`));
    lines.push(foldLine(`DTEND;VALUE=DATE:${isdDeadline.toISOString().slice(0, 10).replace(/-/g, "")}`));
    lines.push(foldLine(`SUMMARY:${icalEscape(summary)}`));
    lines.push(foldLine(`DESCRIPTION:${icalEscape(description)}`));
    lines.push("CATEGORIES:ISD,PLAZO FISCAL");
    lines.push("PRIORITY:1");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ics = lines.join("\r\n") + "\r\n";

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plazos-baritur.ics"',
      "Cache-Control": "no-cache, no-store",
    },
  });
}
