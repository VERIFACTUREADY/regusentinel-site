import { getVerifiedSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect, notFound } from "next/navigation";
import { TemplateEditor } from "./template-editor";

export const metadata = {
  title: "Editar plantilla — Heredia",
  robots: { index: false },
};

export default async function TemplateDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.user.role, "templates.read")) redirect("/dashboard");

  const template = await prisma.template.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    include: {
      versions: { orderBy: { version: "desc" } },
    },
  });

  if (!template) notFound();

  const canEdit = hasPermission(session.user.role, "templates.update");

  const versions = template.versions.map((v) => ({
    id: v.id,
    version: v.version,
    subject: v.subject,
    body: v.body,
    variables: v.variables,
    isApproved: v.isApproved,
    createdAt: v.createdAt.toLocaleString("es-ES"),
  }));

  return (
    <TemplateEditor
      templateId={template.id}
      name={template.name}
      type={template.type}
      category={template.category}
      versions={versions}
      canEdit={canEdit}
    />
  );
}
