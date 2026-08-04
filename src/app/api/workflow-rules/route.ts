import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { WorkflowTrigger, WorkflowAction } from "@prisma/client";
import { ruleConditionsSchema, actionConfigSchema } from "@/lib/workflow-engine";

/**
 * Antes se guardaba lo que llegase en `conditions` y `actionConfig` sin
 * validar: `newStatus` podia ser cualquier string y reventaba al ejecutarse.
 */
const workflowRuleSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  description: z.string().max(1000).nullish(),
  trigger: z.nativeEnum(WorkflowTrigger, { errorMap: () => ({ message: "Disparador no valido" }) }),
  action: z.nativeEnum(WorkflowAction, { errorMap: () => ({ message: "Accion no valida" }) }),
  conditions: ruleConditionsSchema.default({}),
  actionConfig: actionConfigSchema.default({}),
  isActive: z.boolean().optional(),
});

export async function GET(_req: NextRequest) {
  const auth = await requireOrgPermission("workflow.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

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
  const auth = await requireOrgPermission("workflow.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const parsed = workflowRuleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no validos", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { name, description, trigger, conditions, action, actionConfig, isActive } = parsed.data;

  const rule = await prisma.workflowRule.create({
    data: {
      orgId: session.user.orgId,
      name,
      description: description?.trim() || null,
      trigger,
      conditions,
      action,
      actionConfig,
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
