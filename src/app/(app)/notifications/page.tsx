import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { NotificationLogViewer } from "./notification-log-viewer";

export const metadata = {
  title: "Notificaciones — BARITUR PRO",
  robots: { index: false },
};

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "audit.read")) redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Notificaciones enviadas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Historial de alertas ISD y recordatorios enviados automaticamente
        </p>
      </div>
      <NotificationLogViewer />
    </div>
  );
}
