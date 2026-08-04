import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { logAudit } from "./audit";
import { z } from "zod";
import {
  CaseStatus as CaseStatusEnum,
  TaskStatus as TaskStatusEnum,
  TaskCategory as TaskCategoryEnum,
} from "@prisma/client";
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
  /** Profundidad de encadenamiento; ver MAX_WORKFLOW_DEPTH. */
  depth?: number;
}

/**
 * `conditions` y `actionConfig` son columnas JSON: lo que hay dentro puede ser
 * cualquier cosa. Antes se casteaban con `as` y `newStatus` llegaba como
 * string arbitrario hasta `prisma.case.update`, que fallaba en tiempo de
 * ejecucion con un valor fuera del enum.
 */
const ruleConditionsSchema = z
  .object({
    toStatus: z.nativeEnum(CaseStatusEnum).optional(),
    fromStatus: z.nativeEnum(CaseStatusEnum).optional(),
    taskStatus: z.nativeEnum(TaskStatusEnum).optional(),
    taskCategory: z.nativeEnum(TaskCategoryEnum).optional(),
  })
  .strict();

const actionConfigSchema = z
  .object({
    subject: z.string().max(300).optional(),
    body: z.string().max(20000).optional(),
    comment: z.string().max(2000).optional(),
    newStatus: z.nativeEnum(CaseStatusEnum).optional(),
  })
  .strict();

export type RuleConditions = z.infer<typeof ruleConditionsSchema>;
export type ActionConfig = z.infer<typeof actionConfigSchema>;

export { ruleConditionsSchema, actionConfigSchema };

/**
 * Profundidad maxima de encadenamiento. Hoy `CHANGE_CASE_STATUS` escribe
 * directamente y NO vuelve a disparar workflows, asi que no hay cascada; el
 * contador esta para que, si alguna vez se anade, un par de reglas A->B / B->A
 * no pueda girar indefinidamente.
 */
const MAX_WORKFLOW_DEPTH = 3;

type CaseWithRelations = Prisma.CaseGetPayload<{
  include: { deceased: true; contact: true; org: true };
}>;

export async function triggerWorkflow(event: WorkflowEvent): Promise<void> {
  if ((event.depth ?? 0) >= MAX_WORKFLOW_DEPTH) {
    console.warn(`Workflow detenido por profundidad maxima en el caso ${event.caseId}`);
    return;
  }

  const rules = await prisma.workflowRule.findMany({
    where: { orgId: event.orgId, isActive: true, trigger: event.type },
  });
  if (rules.length === 0) return;

  // El expediente se carga filtrando por la organizacion DEL EVENTO. Antes era
  // `findUnique({ id: event.caseId })` sin mas: una regla podia actuar sobre
  // un expediente de otra organizacion si el caseId no correspondia.
  const caseData = await prisma.case.findFirst({
    where: { id: event.caseId, orgId: event.orgId, deletedAt: null },
    include: { deceased: true, contact: true, org: true },
  });
  if (!caseData) return;

  await Promise.allSettled(
    rules.map(async (rule) => {
      // Configuracion invalida: se registra el motivo en vez de fallar en
      // tiempo de ejecucion dentro del handler.
      const conditions = ruleConditionsSchema.safeParse(rule.conditions ?? {});
      const config = actionConfigSchema.safeParse(rule.actionConfig ?? {});

      if (!conditions.success || !config.success) {
        await prisma.workflowLog.create({
          data: {
            ruleId: rule.id,
            caseId: event.caseId,
            status: "SKIPPED",
            error: "Configuracion de la regla no valida",
            details: {
              reason: "invalid_config",
              conditions: conditions.success ? null : conditions.error.issues.map((i) => i.message),
              actionConfig: config.success ? null : config.error.issues.map((i) => i.message),
            },
          },
        }).catch(console.error);
        return;
      }

      if (!evaluateConditions(conditions.data, event)) {
        return;
      }

      try {
        const outcome = await executeAction(rule.action, config.data, event, caseData);

        if (outcome?.skipped) {
          await prisma.workflowLog.create({
            data: {
              ruleId: rule.id,
              caseId: event.caseId,
              status: "SKIPPED",
              details: { action: rule.action, ruleName: rule.name, reason: outcome.reason },
            },
          }).catch(console.error);
          return;
        }
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

/** Resultado de una accion: `skipped` marca una ejecucion omitida con motivo. */
interface ActionOutcome {
  skipped?: boolean;
  reason?: string;
}

async function executeAction(
  action: WorkflowAction,
  config: ActionConfig,
  event: WorkflowEvent,
  caseData: CaseWithRelations
): Promise<ActionOutcome | void> {
  switch (action) {
    case "SEND_EMAIL_CONTACT": {
      if (!caseData.contact?.email) {
        return { skipped: true, reason: "el expediente no tiene email de contacto" };
      }
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
      if (members.length === 0) {
        return { skipped: true, reason: "la organizacion no tiene destinatarios internos" };
      }

      const subject = interpolate(config.subject || "Actualización de expediente", caseData);
      const body = interpolate(config.body || "", caseData);

      // Antes cada envio llevaba `.catch(console.error)`: si fallaban TODOS,
      // el workflow se registraba igualmente como SUCCESS y nadie se enteraba.
      const results = await Promise.allSettled(
        members.map((m) => sendEmail({ to: m.user.email, subject, html: buildHtml(subject, body) })),
      );
      const enviados = results.filter((r) => r.status === "fulfilled").length;

      if (enviados === 0) {
        const primero = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        const motivo = primero?.reason instanceof Error ? primero.reason.message : "error de envio";
        throw new Error(`No se pudo enviar a ningun destinatario del equipo: ${motivo}`);
      }
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
      // `newStatus` ya viene validado contra el enum por actionConfigSchema.
      if (!config.newStatus) {
        return { skipped: true, reason: "la regla no define newStatus" };
      }
      const newStatus = config.newStatus;

      // No-op: si el expediente ya esta en ese estado no se escribe nada. Es
      // la primera barrera contra un par de reglas A->B / B->A girando entre si.
      if (caseData.status === newStatus) {
        return { skipped: true, reason: `el expediente ya esta en ${newStatus}` };
      }

      // Escritura condicional al estado leido: si otra ejecucion lo cambio
      // entretanto, no lo pisamos.
      const changed = await prisma.case.updateMany({
        where: { id: event.caseId, orgId: event.orgId, status: caseData.status },
        data: { status: newStatus, ...(newStatus === "CLOSED" && { closedAt: new Date() }) },
      });
      if (changed.count === 0) {
        return { skipped: true, reason: "el estado del expediente cambio mientras se ejecutaba" };
      }
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
      <p style="color:#999;font-size:12px;">Heredia — Aviso automático generado por una regla de automatización.</p>
    </div>
  `;
}
