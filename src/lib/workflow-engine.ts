import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { logAudit } from "./audit";
import type {
  CaseStatus,
  TaskCategory,
  TaskStatus,
  WorkflowTrigger,
  WorkflowAction,
  Prisma,
} from "@prisma/client";

export interface WorkflowEvent {
  type: WorkflowTrigger;
  orgId: string;
  caseId: string;
  userId?: string;
  fromStatus?: CaseStatus;
  toStatus?: CaseStatus;
  taskId?: string;
  taskStatus?: TaskStatus;
  taskCategory?: TaskCategory;
}

interface RuleConditions {
  toStatus?: string;
  fromStatus?: string;
  taskStatus?: string;
  taskCategory?: string;
}

interface ActionConfig {
  subject?: string;
  body?: string;
  comment?: string;
  newStatus?: string;
}

type CaseWithRelations = Prisma.CaseGetPayload<{
  include: { deceased: true; contact: true; org: true };
}>;

export async function triggerWorkflow(event: WorkflowEvent): Promise<void> {
  const rules = await prisma.workflowRule.findMany({
    where: { orgId: event.orgId, isActive: true, trigger: event.type },
  });
  if (rules.length === 0) return;

  const caseData = await prisma.case.findUnique({
    where: { id: event.caseId },
    include: { deceased: true, contact: true, org: true },
  });
  if (!caseData) return;

  await Promise.allSettled(
    rules.map(async (rule) => {
      if (!evaluateConditions(rule.conditions as RuleConditions, event)) return;

      try {
        await executeAction(rule.action, rule.actionConfig as ActionConfig, event, caseData);
        await Promise.all([
          prisma.workflowRule.update({
            where: { id: rule.id },
            data: { execCount: { increment: 1 }, lastRunAt: new Date() },
          }),
          prisma.workflowLog.create({
            data: {
              ruleId: rule.id,
              caseId: event.caseId,
              status: "SUCCESS",
              details: { action: rule.action, ruleName: rule.name },
            },
          }),
        ]);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await prisma.workflowLog
          .create({ data: { ruleId: rule.id, caseId: event.caseId, status: "FAILED", error } })
          .catch(console.error);
      }
    })
  );
}

function evaluateConditions(conditions: RuleConditions, event: WorkflowEvent): boolean {
  if (conditions.toStatus && event.toStatus !== conditions.toStatus) return false;
  if (conditions.fromStatus && event.fromStatus !== conditions.fromStatus) return false;
  if (conditions.taskStatus && event.taskStatus !== conditions.taskStatus) return false;
  if (conditions.taskCategory && event.taskCategory !== conditions.taskCategory) return false;
  return true;
}

async function executeAction(
  action: WorkflowAction,
  config: ActionConfig,
  event: WorkflowEvent,
  caseData: CaseWithRelations
): Promise<void> {
  switch (action) {
    case "SEND_EMAIL_CONTACT": {
      if (!caseData.contact?.email) return;
      const subject = interpolate(config.subject || "Actualización de su expediente", caseData);
      const body = interpolate(config.body || "", caseData);
      await sendEmail({ to: caseData.contact.email, subject, html: buildHtml(subject, body) });
      break;
    }

    case "SEND_EMAIL_TEAM": {
      const members = await prisma.membership.findMany({
        where: { orgId: event.orgId, role: { in: ["OWNER", "MANAGER"] } },
        include: { user: { select: { email: true } } },
      });
      const subject = interpolate(config.subject || "Actualización de expediente", caseData);
      const body = interpolate(config.body || "", caseData);
      await Promise.all(
        members.map((m) =>
          sendEmail({ to: m.user.email, subject, html: buildHtml(subject, body) }).catch(console.error)
        )
      );
      break;
    }

    case "ADD_CASE_COMMENT": {
      const comment = interpolate(config.comment || "Automatización ejecutada", caseData);
      await logAudit({
        orgId: event.orgId,
        caseId: event.caseId,
        action: "case.comment",
        details: `[Automatización] ${comment}`,
      });
      break;
    }

    case "CHANGE_CASE_STATUS": {
      if (!config.newStatus) return;
      const newStatus = config.newStatus as CaseStatus;
      await prisma.case.update({
        where: { id: event.caseId },
        data: { status: newStatus, ...(newStatus === "CLOSED" && { closedAt: new Date() }) },
      });
      await logAudit({
        orgId: event.orgId,
        caseId: event.caseId,
        action: "case.status_changed",
        details: `[Auto] -> ${newStatus}`,
      });
      break;
    }
  }
}

function interpolate(template: string, caseData: CaseWithRelations): string {
  return template
    .replace(/\{\{deceased\.fullName\}\}/g, caseData.deceased?.fullName ?? "")
    .replace(/\{\{contact\.fullName\}\}/g, caseData.contact?.fullName ?? "")
    .replace(/\{\{case\.ref\}\}/g, caseData.ref)
    .replace(/\{\{case\.status\}\}/g, caseData.status)
    .replace(/\{\{org\.name\}\}/g, caseData.org?.name ?? "");
}

function buildHtml(subject: string, body: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">${subject}</h2>
      <div style="color:#333;line-height:1.6;">${body.replace(/\n/g, "<br>")}</div>
      <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
      <p style="color:#999;font-size:12px;">BARITUR PRO — Aviso automático generado por una regla de automatización.</p>
    </div>
  `;
}
