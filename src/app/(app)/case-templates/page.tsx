import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { CaseTemplatesClient } from "./CaseTemplatesClient";

export const metadata: Metadata = { title: "Plantillas de expediente — Heredia" };

export default async function CaseTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) redirect("/login");
  if (!hasPermission(session.user.role!, "casetemplates.read")) redirect("/dashboard");

  const canManage = hasPermission(session.user.role!, "casetemplates.manage");
  return <CaseTemplatesClient canManage={canManage} />;
}
