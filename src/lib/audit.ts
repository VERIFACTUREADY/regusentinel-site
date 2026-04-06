import { prisma } from "./prisma";

interface AuditLogInput {
  orgId: string;
  userId?: string;
  caseId?: string;
  action: string;
  details?: string;
  ip?: string;
}

/**
 * Create an audit log entry.
 */
export async function logAudit({
  orgId,
  userId,
  caseId,
  action,
  details,
  ip,
}: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      orgId,
      userId,
      caseId,
      action,
      details,
      ip,
    },
  });
}
