import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { PLAN_PRICING } from "@/lib/stripe";
import { ROLE_LABELS } from "@/lib/constants";
import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "org.members")) redirect("/dashboard");

  const [members, subscription] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: session.user.orgId },
      include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subscription.findUnique({
      where: { orgId: session.user.orgId },
      select: { plan: true },
    }),
  ]);

  const plan = (subscription?.plan ?? "INICIA") as keyof typeof PLAN_PRICING;
  const maxUsers = PLAN_PRICING[plan]?.maxUsers ?? 2;
  const canInvite = hasPermission(session.user.role, "org.members.invite") && members.length < maxUsers;
  const canManage = hasPermission(session.user.role, "org.members");

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Equipo</h1>
          <p className="text-sm text-gray-500 mt-1">
            {members.length} de {maxUsers} usuarios ({PLAN_PRICING[plan]?.label ?? plan})
          </p>
        </div>
      </div>

      {members.length >= maxUsers && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
          Has alcanzado el limite de usuarios de tu plan.{" "}
          <a href="/billing" className="text-primary font-medium underline">Mejora tu plan</a> para invitar a mas miembros.
        </div>
      )}

      {canInvite && <InviteForm />}

      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Miembros</h2>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Rol</th>
                <th className="px-6 py-3">Desde</th>
                {canManage && <th className="px-6 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  userId={m.user.id}
                  name={m.user.name}
                  email={m.user.email}
                  role={m.role}
                  roleLabel={ROLE_LABELS[m.role] ?? m.role}
                  joinedAt={m.createdAt.toLocaleDateString("es-ES")}
                  isSelf={m.user.id === session.user.id}
                  canManage={canManage}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {members.map((m) => (
            <div key={m.id} className="px-4 py-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{m.user.name || m.user.email}</p>
                  <p className="text-xs text-gray-500">{m.user.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  m.role === "OWNER" ? "bg-purple-100 text-purple-700" :
                  m.role === "MANAGER" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
              </div>
              {canManage && m.user.id !== session.user.id && (
                <MemberRow
                  userId={m.user.id}
                  name={m.user.name}
                  email={m.user.email}
                  role={m.role}
                  roleLabel={ROLE_LABELS[m.role] ?? m.role}
                  joinedAt={m.createdAt.toLocaleDateString("es-ES")}
                  isSelf={false}
                  canManage={canManage}
                  mobileActions
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
        <h3 className="font-semibold text-gray-700 mb-2">Roles disponibles</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <div><strong>Owner:</strong> acceso completo, facturacion, ajustes de organizacion</div>
          <div><strong>Manager:</strong> gestion de equipo, expedientes, plantillas, audit trail</div>
          <div><strong>Operador:</strong> crear/editar expedientes y tareas, subir documentos</div>
          <div><strong>Viewer:</strong> solo lectura en expedientes, tareas y documentos</div>
          <div><strong>Managed Ops:</strong> como Operador + configurar y ejecutar autopilot</div>
        </div>
      </div>
    </div>
  );
}
