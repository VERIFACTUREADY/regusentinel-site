import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "workflow.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const rules = await prisma.workflowRule.findMany({
    where: { orgId: session.user.orgId },
    include: {
      logs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, status: true, error: true, createdAt: true, caseId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "workflow.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, trigger, conditions, action, actionConfig, isActive } = body;

  if (!name?.trim() || !trigger || !action) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const rule = await prisma.workflowRule.create({
    data: {
      orgId: session.user.orgId,
      name: name.trim(),
      description: description?.trim() || null,
      trigger,
      conditions: conditions ?? {},
      action,
      actionConfig: actionConfig ?? {},
      isActive: isActive ?? true,
    },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "workflow.rule_created",
    details: `Regla "${rule.name}" creada`,
  });

  return NextResponse.json(rule, { status: 201 });
}
