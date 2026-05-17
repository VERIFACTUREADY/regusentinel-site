import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { TEMPLATE_TYPE_LABELS, CATEGORY_LABELS } from "@/lib/constants";
import { TemplateList } from "./template-list";

export const metadata = {
  title: "Plantillas — BARITUR PRO",
  robots: { index: false },
};

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "templates.read")) redirect("/dashboard");

  const canCreate = hasPermission(session.user.role, "templates.create");

  const templates = await prisma.template.findMany({
    where: { orgId: session.user.orgId },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const items = templates.map((t) => {
    const latest = t.versions[0];
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      typeLabel: TEMPLATE_TYPE_LABELS[t.type] ?? t.type,
      category: t.category,
      categoryLabel: t.category ? (CATEGORY_LABELS[t.category] ?? t.category) : null,
      latestVersion: latest?.version ?? 0,
      isApproved: latest?.isApproved ?? false,
      updatedAt: t.updatedAt.toLocaleDateString("es-ES"),
    };
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Plantillas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {templates.length} plantilla{templates.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <TemplateList templates={items} canCreate={canCreate} />
    </div>
  );
}
