import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { CaseTemplatesClient } from "./CaseTemplatesClient";

export const metadata: Metadata = { title: "Plantillas de expediente — Heredia" };

export default async function CaseTemplatesPage() {
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.user.role!, "casetemplates.read")) redirect("/dashboard");

  const canManage = hasPermission(session.user.role!, "casetemplates.manage");
  return <CaseTemplatesClient canManage={canManage} />;
}
