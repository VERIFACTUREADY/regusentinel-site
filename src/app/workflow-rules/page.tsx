import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { WorkflowRulesClient } from "./WorkflowRulesClient";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Automatizaciones — BARITUR PRO" };

export default async function WorkflowRulesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) redirect("/login");
  if (!hasPermission(session.user.role!, "workflow.read")) redirect("/dashboard");

  const canManage = hasPermission(session.user.role!, "workflow.manage");

  // Load a sample case for the test feature
  const sampleCase = await prisma.case.findFirst({
    where: { orgId: session.user.orgId, deletedAt: null },
    select: { id: true, ref: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell session={session}>
      <WorkflowRulesClient canManage={canManage} sampleCaseId={sampleCase?.id ?? null} />
    </AppShell>
  );
}
