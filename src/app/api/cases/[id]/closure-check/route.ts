import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export interface ClosureCheckResult {
  safe: boolean; // true = ok to close without warnings
  warnings: { level: "error" | "warning"; message: string }[];
  stats: {
    totalTasks: number;
    doneTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    isdDaysRemaining: number | null;
    isdPassed: boolean;
    unreadPortalMessages: number;
    pendingApprovals: number;
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    include: {
      deceased: { select: { deathDate: true } },
      tasks: {
        select: {
          id: true, status: true, deadline: true, category: true, title: true,
        },
      },
    },
  });

  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const now = new Date();

  // Task stats
  const tasks = c.tasks;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
  const pendingTasks = tasks.filter((t) => !["DONE", "SKIPPED"].includes(t.status)).length;
  const overdueTasks = tasks.filter(
    (t) => t.deadline && new Date(t.deadline) < now && !["DONE", "SKIPPED"].includes(t.status)
  ).length;
  const blockedTasks = tasks.filter((t) => t.status === "BLOCKED").length;

  // ISD
  let isdDaysRemaining: number | null = null;
  let isdPassed = false;
  if (c.deceased?.deathDate) {
    const days = Math.floor((now.getTime() - new Date(c.deceased.deathDate).getTime()) / 86400000);
    isdDaysRemaining = 180 - days;
    isdPassed = isdDaysRemaining < 0;
  }

  // Unread portal messages
  const unreadPortalMessages = await prisma.portalMessage.count({
    where: { caseId: params.id, fromFamily: true, readAt: null },
  });

  // Pending approvals
  const pendingApprovals = await prisma.approval.count({
    where: { caseId: params.id, status: "PENDING" },
  });

  const warnings: ClosureCheckResult["warnings"] = [];

  // Blocking errors (prevent close)
  if (overdueTasks > 0) {
    warnings.push({
      level: "error",
      message: `Hay ${overdueTasks} tarea${overdueTasks !== 1 ? "s" : ""} con plazo vencido sin completar.`,
    });
  }
  if (blockedTasks > 0) {
    warnings.push({
      level: "error",
      message: `Hay ${blockedTasks} tarea${blockedTasks !== 1 ? "s" : ""} bloqueada${blockedTasks !== 1 ? "s" : ""} sin resolver.`,
    });
  }
  if (pendingApprovals > 0) {
    warnings.push({
      level: "error",
      message: `Hay ${pendingApprovals} aprobaci${pendingApprovals !== 1 ? "ones" : "ón"} pendiente${pendingApprovals !== 1 ? "s" : ""}.`,
    });
  }

  // Warnings (advise but not blocking)
  const pendingNonBlocked = tasks.filter(
    (t) => !["DONE", "SKIPPED", "BLOCKED"].includes(t.status)
  ).length;
  if (pendingNonBlocked > 0) {
    warnings.push({
      level: "warning",
      message: `Quedan ${pendingNonBlocked} tarea${pendingNonBlocked !== 1 ? "s" : ""} sin completar.`,
    });
  }
  if (isdPassed === false && isdDaysRemaining !== null && isdDaysRemaining > 0) {
    warnings.push({
      level: "warning",
      message: `El plazo ISD aún no ha vencido (${isdDaysRemaining} días restantes). Asegúrese de que el ISD ha sido presentado antes de cerrar.`,
    });
  }
  if (isdPassed) {
    warnings.push({
      level: "warning",
      message: `El plazo ISD ya ha vencido. Verifique que se presentó dentro del plazo o se solicitó prórroga.`,
    });
  }
  if (unreadPortalMessages > 0) {
    warnings.push({
      level: "warning",
      message: `Hay ${unreadPortalMessages} mensaje${unreadPortalMessages !== 1 ? "s" : ""} de la familia sin leer en el portal.`,
    });
  }
  if (totalTasks > 0 && doneTasks / totalTasks < 0.8) {
    warnings.push({
      level: "warning",
      message: `Solo el ${Math.round((doneTasks / totalTasks) * 100)}% de las tareas está completado.`,
    });
  }

  const hasErrors = warnings.some((w) => w.level === "error");

  return NextResponse.json({
    safe: !hasErrors && warnings.length === 0,
    warnings,
    stats: {
      totalTasks, doneTasks, pendingTasks, overdueTasks, blockedTasks,
      isdDaysRemaining, isdPassed, unreadPortalMessages, pendingApprovals,
    },
  } satisfies ClosureCheckResult);
}
