import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/admin";
import { LeadsTable } from "./leads-table";

export default async function DemoRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin(session?.user?.email)) redirect("/dashboard");

  const requests = await prisma.demoRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const byStatus: Record<string, number> = {};
  for (const r of requests) {
    byStatus[r.leadStatus] = (byStatus[r.leadStatus] ?? 0) + 1;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Pipeline de leads</h1>
        <span className="text-sm text-gray-500">{requests.length} totales</span>
      </div>

      {/* Pipeline summary */}
      {requests.length > 0 && (
        <div className="flex gap-2 mb-8 flex-wrap">
          {(["NEW", "CONTACTED", "MEETING", "PILOT", "CUSTOMER", "LOST"] as const).map((s) => (
            <div key={s} className="bg-white border rounded-lg px-4 py-3 flex items-center gap-3">
              <StatusDot status={s} />
              <div>
                <p className="text-xs text-gray-500">{STATUS_LABELS[s]}</p>
                <p className="text-xl font-bold text-gray-900">{byStatus[s] ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <LeadsTable initialLeads={requests} />
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  MEETING: "Reunión",
  PILOT: "Piloto",
  CUSTOMER: "Cliente",
  LOST: "Perdido",
};

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    NEW: "bg-gray-400",
    CONTACTED: "bg-blue-400",
    MEETING: "bg-yellow-400",
    PILOT: "bg-purple-400",
    CUSTOMER: "bg-green-500",
    LOST: "bg-red-400",
  };
  return <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[status] ?? "bg-gray-300"}`} />;
}
