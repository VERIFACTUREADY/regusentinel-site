import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { CATEGORY_LABELS } from "@/lib/constants";
import { PrintButton } from "./print-button";

const TASK_STATUS_ES: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  BLOCKED: "Bloqueada",
  READY: "Lista",
  APPROVED: "Aprobada",
  DONE: "Completada",
  SKIPPED: "Omitida",
};

const CASE_STATUS_ES: Record<string, string> = {
  INTAKE: "Recepcion",
  VALIDATION: "Validacion",
  IN_PROGRESS: "En curso",
  PENDING_DOCS: "Docs pendientes",
  READY_TO_SEND: "Listo para enviar",
  SENT: "Enviado",
  FOLLOW_UP: "Seguimiento",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

export default async function CasePrintPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "cases.read")) redirect("/dashboard");

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    include: {
      deceased: true,
      contact: true,
      tasks: {
        include: {
          assignee: { select: { name: true, email: true } },
          dependsOn: { select: { title: true, status: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!c) redirect("/cases");

  const doneCount = c.tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
  const progressPct = c.tasks.length > 0 ? Math.round((doneCount / c.tasks.length) * 100) : 0;

  const tasksByCategory: Record<string, typeof c.tasks> = {};
  for (const t of c.tasks) {
    const cat = t.category;
    if (!tasksByCategory[cat]) tasksByCategory[cat] = [];
    tasksByCategory[cat].push(t);
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 print:px-0 print:py-0">
      <style>{`
        @media print {
          nav, header, aside, .no-print { display: none !important; }
          body { background: white !important; }
          main { padding: 0 !important; }
        }
      `}</style>

      <div className="no-print mb-6 flex gap-3">
        <PrintButton />
        <a
          href={`/cases/${params.id}`}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
        >
          Volver al expediente
        </a>
      </div>

      {/* Header */}
      <div className="border-b pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{c.ref}</h1>
            <p className="text-gray-500 text-sm mt-1">
              Expediente generado el {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium px-3 py-1 bg-gray-100 rounded">
              {CASE_STATUS_ES[c.status] || c.status}
            </span>
            {c.isUrgent && (
              <span className="ml-2 text-sm font-medium px-3 py-1 bg-red-100 text-red-700 rounded">
                Urgente
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Case info */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">Fallecido</h2>
          <table className="text-sm w-full">
            <tbody>
              <tr><td className="text-gray-500 pr-4 py-1">Nombre</td><td className="font-medium">{c.deceased?.fullName || "—"}</td></tr>
              <tr><td className="text-gray-500 pr-4 py-1">DNI</td><td>{c.deceased?.dni || "—"}</td></tr>
              <tr>
                <td className="text-gray-500 pr-4 py-1">Fecha fallecimiento</td>
                <td>{c.deceased?.deathDate ? new Date(c.deceased.deathDate).toLocaleDateString("es-ES") : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">Contacto / Solicitante</h2>
          <table className="text-sm w-full">
            <tbody>
              <tr><td className="text-gray-500 pr-4 py-1">Nombre</td><td className="font-medium">{c.contact?.fullName || "—"}</td></tr>
              <tr><td className="text-gray-500 pr-4 py-1">Telefono</td><td>{c.contact?.phone || "—"}</td></tr>
              <tr><td className="text-gray-500 pr-4 py-1">Email</td><td>{c.contact?.email || "—"}</td></tr>
              <tr><td className="text-gray-500 pr-4 py-1">Relacion</td><td>{c.contact?.relationship || "—"}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Categories & metadata */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500">Provincia: </span>
            <span className="font-medium">{c.province || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500">Categorias: </span>
            <span className="font-medium">
              {(c.categories as string[]).map((cat) => CATEGORY_LABELS[cat] || cat).join(", ") || "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Creado: </span>
            <span>{new Date(c.createdAt).toLocaleDateString("es-ES")}</span>
          </div>
          {c.closedAt && (
            <div>
              <span className="text-gray-500">Cerrado: </span>
              <span>{new Date(c.closedAt).toLocaleDateString("es-ES")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">
          Progreso — {doneCount}/{c.tasks.length} tareas ({progressPct}%)
        </h2>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Tasks by category */}
      <div className="mb-8">
        <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-4">Tareas</h2>
        {Object.entries(tasksByCategory).map(([cat, tasks]) => (
          <div key={cat} className="mb-4">
            <h3 className="font-medium text-sm mb-2">{CATEGORY_LABELS[cat] || cat}</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-1 font-medium w-8"></th>
                  <th className="pb-1 font-medium">Tarea</th>
                  <th className="pb-1 font-medium">Estado</th>
                  <th className="pb-1 font-medium">Asignado</th>
                  <th className="pb-1 font-medium">Plazo</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const depPending = t.dependsOn && t.dependsOn.status !== "DONE" && t.dependsOn.status !== "SKIPPED";
                  const subText = t.status === "BLOCKED" && t.blockReason
                    ? `Motivo bloqueo: ${t.blockReason}${t.blockedUntil ? ` (hasta ${new Date(t.blockedUntil).toLocaleDateString("es-ES")})` : ""}`
                    : depPending
                    ? `Espera: ${t.dependsOn!.title}`
                    : null;
                  return (
                    <>
                      <tr key={t.id} className={subText ? "" : "border-b border-gray-100"}>
                        <td className="py-1.5 text-center">
                          {t.status === "DONE" || t.status === "SKIPPED" ? "✓" : "○"}
                        </td>
                        <td className="py-1.5">{t.title}</td>
                        <td className="py-1.5 text-gray-600">{TASK_STATUS_ES[t.status] || t.status}</td>
                        <td className="py-1.5 text-gray-600">{t.assignee?.name || t.assignee?.email || "—"}</td>
                        <td className="py-1.5 text-gray-600">
                          {t.deadline ? new Date(t.deadline).toLocaleDateString("es-ES") : "—"}
                        </td>
                      </tr>
                      {subText && (
                        <tr key={`${t.id}-sub`} className="border-b border-gray-100">
                          <td />
                          <td colSpan={4} className="pb-1.5 text-xs text-gray-400 italic">{subText}</td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
        {c.tasks.length === 0 && <p className="text-sm text-gray-400">Sin tareas</p>}
      </div>

      {/* Documents */}
      <div className="mb-8">
        <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">
          Documentos ({c.documents.length})
        </h2>
        {c.documents.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-1 font-medium">Archivo</th>
                <th className="pb-1 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {c.documents.map((d) => (
                <tr key={d.id} className="border-b border-gray-100">
                  <td className="py-1.5">{d.fileName}</td>
                  <td className="py-1.5 text-gray-600">{new Date(d.createdAt).toLocaleDateString("es-ES")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">Sin documentos</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t pt-4 text-xs text-gray-400 text-center">
        Heredia — Gestion post-mortem profesional — {new Date().toLocaleDateString("es-ES")}
      </div>
    </div>
  );
}
