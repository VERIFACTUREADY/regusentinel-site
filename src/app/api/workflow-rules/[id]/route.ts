import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "workflow.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const rule = await prisma.workflowRule.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    include: {
      logs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { case: { select: { id: true, ref: true } } },
      },
    },
  });

  if (!rule) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(rule);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "workflow.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const rule = await prisma.workflowRule.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
  });
  if (!rule) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const { name, description, trigger, conditions, action, actionConfig, isActive } = body;

  const updated = await prisma.workflowRule.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(trigger !== undefined && { trigger }),
      ...(conditions !== undefined && { conditions }),
      ...(action !== undefined && { action }),
      ...(actionConfig !== undefined && { actionConfig }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "workflow.rule_updated",
    details: `Regla "${updated.name}" actualizada`,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "workflow.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const rule = await prisma.workflowRule.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
  });
  if (!rule) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.workflowRule.delete({ where: { id: params.id } });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "workflow.rule_deleted",
    details: `Regla "${rule.name}" eliminada`,
  });

  return NextResponse.json({ success: true });
}
