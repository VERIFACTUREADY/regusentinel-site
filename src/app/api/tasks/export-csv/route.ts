import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { CATEGORY_LABELS } from "@/lib/constants";

function escapeCsv(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  BLOCKED: "Bloqueada",
  READY: "Lista",
  APPROVED: "Aprobada",
  DONE: "Completada",
  SKIPPED: "Omitida",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const orgId = session.user.orgId;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const assignee = url.searchParams.get("assignee");
  const category = url.searchParams.get("category");

  const conditions: Record<string, unknown>[] = [
    { case: { orgId, deletedAt: null } },
  ];

  if (assignee === "me") {
    conditions.push({ assigneeId: session.user.id });
  } else if (assignee === "unassigned") {
    conditions.push({ assigneeId: null });
  } else if (assignee) {
    conditions.push({ assigneeId: assignee });
  }

  if (status) {
    const statuses = status.split(",");
    conditions.push(statuses.length === 1 ? { status: statuses[0] } : { status: { in: statuses } });
  }

  if (category) conditions.push({ category });

  const tasks = await prisma.task.findMany({
    where: { AND: conditions } as any,
    include: {
      case: { select: { ref: true, isUrgent: true } },
      assignee: { select: { name: true, email: true } },
      dependsOn: { select: { title: true, status: true } },
    },
    orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
    take: 5000,
  });

  const now = new Date();
  const headers = [
    "Expediente",
    "Urgente",
    "Categoria",
    "Titulo",
    "Estado",
    "Asignado a",
    "Plazo",
    "Dias restantes",
    "Bloqueada hasta",
    "Motivo bloqueo",
    "Tarea bloqueante",
  ];

  const rows = tasks.map((t) => {
    const effectiveDate = t.deadline ?? t.dueDate;
    const daysLeft = effectiveDate
      ? Math.ceil((new Date(effectiveDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return [
      escapeCsv(t.case.ref),
      t.case.isUrgent ? "Si" : "No",
      escapeCsv(CATEGORY_LABELS[t.category] || t.category),
      escapeCsv(t.title),
      escapeCsv(TASK_STATUS_LABELS[t.status] || t.status),
      escapeCsv(t.assignee?.name || t.assignee?.email),
      effectiveDate ? new Date(effectiveDate).toLocaleDateString("es-ES") : "",
      daysLeft !== null ? String(daysLeft) : "",
      t.blockedUntil ? new Date(t.blockedUntil).toLocaleDateString("es-ES") : "",
      escapeCsv(t.blockReason),
      escapeCsv(
        (t as any).dependsOn &&
        (t as any).dependsOn.status !== "DONE" &&
        (t as any).dependsOn.status !== "SKIPPED"
          ? (t as any).dependsOn.title
          : ""
      ),
    ];
  });

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tareas_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
