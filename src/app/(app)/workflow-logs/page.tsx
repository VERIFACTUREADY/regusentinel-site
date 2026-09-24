import { getVerifiedSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { WorkflowLogsClient } from "./workflow-logs-client";

export const metadata = {
  title: "Registro de automatizaciones — Heredia",
  robots: { index: false },
};

export default async function WorkflowLogsPage() {
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.user.role, "workflow.read")) redirect("/dashboard");

  const orgId = session.user.orgId;

  const [initialLogs, initialTotal, rules, stats] = await Promise.all([
    prisma.workflowLog.findMany({
      where: { rule: { orgId } },
      include: {
        rule: { select: { id: true, name: true } },
        case: { select: { id: true, ref: true } },
        // Sin este contador, «Reintentar fallidas» salía en toda ejecución
        // PARTIAL o FAILED durante el primer render —incluidas las que ya no
        // tenían nada pendiente— y sólo desaparecía tras recargar por el API.
        _count: {
          select: {
            deliveries: { where: { status: { in: ["PENDING", "FAILED", "PROCESSING"] } } },
          },
        },
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
    pendingDeliveries: l._count.deliveries,
  }));

  return (
    <WorkflowLogsClient
      initialLogs={serialized}
      initialTotal={initialTotal}
      rules={rules}
      statMap={statMap}
      /*
       * El reintento provoca envíos reales y el API lo protege con
       * `workflow.manage` —sólo OWNER y MANAGER—. La pantalla, en cambio,
       * ofrecía el botón a los cuatro roles: un OPERATOR podía pulsarlo, ver
       * «No se pudo reintentar», y no tener forma de saber que el problema era
       * que no le corresponde a él. Esconderlo no es el control de seguridad
       * —ése está en el servidor, y sigue estando—, es no prometer algo que no
       * se va a poder hacer.
       */
      puedeReintentar={hasPermission(session.user.role, "workflow.manage")}
    />
  );
}
