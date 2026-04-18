import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect, notFound } from "next/navigation";
import { TemplateEditor } from "./template-editor";

export const metadata = {
  title: "Editar plantilla — BARITUR PRO",
  robots: { index: false },
};

export default async function TemplateDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
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
