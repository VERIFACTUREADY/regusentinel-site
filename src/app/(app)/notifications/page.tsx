import { getVerifiedSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { NotificationLogViewer } from "./notification-log-viewer";

export const metadata = {
  title: "Notificaciones — Heredia",
  robots: { index: false },
};

export default async function NotificationsPage() {
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
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
