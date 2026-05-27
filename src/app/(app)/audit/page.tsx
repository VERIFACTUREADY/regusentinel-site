import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { AuditLogViewer } from "./audit-log-viewer";

export const metadata = {
  title: "Audit Trail — Heredia",
  robots: { index: false },
};

export default async function AuditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "audit.read")) redirect("/dashboard");

  const members = await prisma.membership.findMany({
    where: { orgId: session.user.orgId },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const users = members.map((m) => ({
    id: m.user.id,
    label: m.user.name || m.user.email,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registro completo de actividad de la organizacion
        </p>
      </div>
      <AuditLogViewer users={users} />
    </div>
  );
}
