import { getVerifiedSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { WorkflowRulesClient } from "./workflow-rules-client";

export const metadata = {
  title: "Automatizaciones — Heredia",
  robots: { index: false },
};

export default async function WorkflowRulesPage() {
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.user.role, "workflow.read")) redirect("/dashboard");

  const canManage = hasPermission(session.user.role, "workflow.manage");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Automatizaciones</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reglas que se ejecutan automáticamente cuando ocurren eventos en el sistema
        </p>
      </div>
      <WorkflowRulesClient canManage={canManage} />
    </div>
  );
}
