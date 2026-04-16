import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const sourceLabels: Record<string, { label: string; color: string }> = {
  landing_hero: { label: "Landing", color: "bg-gray-100 text-gray-700" },
  demo_banner: { label: "Demo → Banner", color: "bg-amber-100 text-amber-800" },
  demo_dashboard: { label: "Demo → Dashboard", color: "bg-indigo-100 text-indigo-800" },
  pricing: { label: "Precios", color: "bg-purple-100 text-purple-700" },
};

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-gray-400 text-xs">—</span>;
  const s = sourceLabels[source] ?? { label: source, color: "bg-blue-100 text-blue-700" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

export default async function DemoRequestsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "OWNER") redirect("/dashboard");

  const requests = await prisma.demoRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Aggregate by source for the summary row
  const bySource: Record<string, number> = {};
  for (const r of requests) {
    const key = r.source ?? "(sin source)";
    bySource[key] = (bySource[key] ?? 0) + 1;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Solicitudes de demo</h1>
        <span className="text-sm text-gray-500">{requests.length} totales</span>
      </div>

      {/* Summary by source */}
      {requests.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Object.entries(bySource).map(([src, count]) => {
            const s = sourceLabels[src] ?? { label: src, color: "bg-gray-100 text-gray-700" };
            return (
              <div key={src} className="bg-white border rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-1 ${s.color}`}>
                    {s.label}
                  </span>
                </p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Contacto</th>
              <th className="px-6 py-3">Empresa</th>
              <th className="px-6 py-3">Telefono</th>
              <th className="px-6 py-3">Mensaje</th>
              <th className="px-6 py-3">Source</th>
              <th className="px-6 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-6 py-3">
                  <p className="font-medium">{r.name}</p>
                  <a
                    href={`mailto:${r.email}`}
                    className="text-primary hover:underline text-xs"
                  >
                    {r.email}
                  </a>
                </td>
                <td className="px-6 py-3 text-gray-700">{r.company || "—"}</td>
                <td className="px-6 py-3 text-gray-700">{r.phone || "—"}</td>
                <td className="px-6 py-3 text-gray-600 max-w-xs">
                  <p className="truncate" title={r.message ?? ""}>
                    {r.message || "—"}
                  </p>
                </td>
                <td className="px-6 py-3">
                  <SourceBadge source={r.source} />
                </td>
                <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleDateString("es-ES")}{" "}
                  <span className="text-gray-400 text-xs">
                    {new Date(r.createdAt).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  Ninguna solicitud todavia
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
