import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getCaseDeadlines } from "@/lib/deadline-engine";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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
      deceased: true,
      contact: true,
      tasks: {
        orderBy: { sortOrder: "asc" },
        include: {
          documents: { select: { id: true, fileName: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      },
      documents: { include: { task: { select: { id: true, title: true, category: true } } } },
      approvals: true,
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  // Auto-unblock tasks whose blockedUntil date has passed
  const now = new Date();
  const tasksToUnblock = c.tasks.filter(
    (t) => t.status === "BLOCKED" && t.blockedUntil && new Date(t.blockedUntil) <= now
  );
  if (tasksToUnblock.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: tasksToUnblock.map((t) => t.id) } },
      data: { status: "PENDING", blockReason: null },
    });
    // Re-fetch with updated statuses
    const updated = await prisma.case.findFirst({
      where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
      include: {
        deceased: true,
        contact: true,
        tasks: {
          orderBy: { sortOrder: "asc" },
          include: {
            documents: { select: { id: true, fileName: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
        documents: { include: { task: { select: { id: true, title: true, category: true } } } },
        approvals: true,
        auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      },
      },
    });
    // Add case-level deadlines
    const deathDate = updated?.deceased?.deathDate;
    const caseDeadlines = deathDate ? getCaseDeadlines(new Date(deathDate)) : null;
    return NextResponse.json({ ...updated, caseDeadlines });
  }

  // Add case-level deadlines
  const deathDate = c.deceased?.deathDate;
  const caseDeadlines = deathDate ? getCaseDeadlines(new Date(deathDate)) : null;
  return NextResponse.json({ ...c, caseDeadlines });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.update")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json();
  const { status, notes, isUrgent } = body;

  const updated = await prisma.case.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(isUrgent !== undefined && { isUrgent }),
      ...(status === "CLOSED" && { closedAt: new Date() }),
    },
    include: { deceased: true, contact: true },
  });

  if (status && status !== c.status) {
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: "case.status_changed",
      details: `${c.status} -> ${status}`,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.delete")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  await prisma.case.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: params.id,
    action: "case.deleted",
    details: `Expediente ${c.ref} eliminado (borrado logico)`,
  });

  return NextResponse.json({ success: true });
}
