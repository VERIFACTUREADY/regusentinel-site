import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { WorkflowLogsClient } from "./workflow-logs-client";

export const metadata = {
  title: "Registro de automatizaciones — BARITUR PRO",
  robots: { index: false },
};

export default async function WorkflowLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "workflow.read")) redirect("/dashboard");

  const orgId = session.user.orgId;

  const [initialLogs, initialTotal, rules, stats] = await Promise.all([
    prisma.workflowLog.findMany({
      where: { rule: { orgId } },
      include: {
        rule: { select: { id: true, name: true } },
        case: { select: { id: true, ref: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.workflowLog.count({ where: { rule: { orgId } } }),
    prisma.workflowRule.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.workflowLog.groupBy({
      by: ["status"],
      where: { rule: { orgId } },
      _count: true,
    }),
  ]);

  const statMap: Record<string, number> = {};
  for (const s of stats) statMap[s.status] = s._count;

  const serialized = initialLogs.map((l) => ({
    id: l.id,
    status: l.status,
    error: l.error,
    createdAt: l.createdAt.toISOString(),
    rule: l.rule,
    case: l.case,
  }));

  return (
    <WorkflowLogsClient
      initialLogs={serialized}
      initialTotal={initialTotal}
      rules={rules}
      statMap={statMap}
    />
  );
}
