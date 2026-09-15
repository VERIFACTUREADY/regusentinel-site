import { getVerifiedSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { ApprovalsQueue } from "./approvals-queue";

export const metadata = {
  title: "Aprobaciones — Heredia",
  robots: { index: false },
};

export default async function ApprovalsPage() {
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.user.role, "autopilot.approve")) redirect("/dashboard");

  /*
   * `deletedAt: null` faltaba aqui y en `GET /api/approvals`.
   *
   * Una aprobacion de un expediente ya borrado seguia contando como
   * «pendiente de revision» y saliendo en la cola, aunque no hubiera nada que
   * revisar. Ademas descuadraba con /dashboard y con /today, que si los
   * excluyen: la misma organizacion mostraba dos cifras distintas de
   * aprobaciones pendientes en tres pantallas, sin ninguna explicacion.
   */
  const pendingCount = await prisma.approval.count({
    where: {
      case: { orgId: session.user.orgId, deletedAt: null },
      status: "PENDING",
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Aprobaciones</h1>
        <p className="text-sm text-gray-500 mt-1" data-testid="pendientes-de-revision">
          {pendingCount > 0
            ? `${pendingCount} accion${pendingCount !== 1 ? "es" : ""} pendiente${pendingCount !== 1 ? "s" : ""} de revision`
            : "No hay acciones pendientes de revision"}
        </p>
      </div>
      <ApprovalsQueue />
    </div>
  );
}
