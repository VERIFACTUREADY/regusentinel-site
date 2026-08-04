import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaseDeadlines } from "@/lib/deadline-engine";
import { rateLimit } from "@/lib/api-rate-limit";
import { resolvePortalAccess } from "@/lib/portal-access";
import { getConsentStatus } from "@/lib/portal-consent";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  // Rate limit por IP: 60 lecturas/min. El token es CUID (espacio ~10^36) y
  // el bruteforce es invianle, pero si un enlace se filtra (WhatsApp, search
  // engine) impedimos scraping pesado del expediente.
  const limited = rateLimit(req, { bucket: "portal-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const access = await resolvePortalAccess(params.token);
  if (!access.ok) return access.response;

  const c = await prisma.case.findFirst({
    where: { id: access.case.id },
    include: {
      deceased: { select: { fullName: true, deathDate: true } },
      tasks: {
        select: { id: true, title: true, status: true, category: true, docTag: true, deadline: true, blockedUntil: true },
        orderBy: { sortOrder: "asc" },
      },
      // Sólo los visibles para la familia: antes se incluían también los
      // documentos internos y sus nombres se filtraban en la respuesta.
      documents: {
        where: { visibleToFamily: true, deletionState: null },
        select: { id: true, fileName: true, createdAt: true, isPortalUpload: true, taskId: true },
      },
      org: {
        select: {
          name: true,
          brandDisplayName: true,
          brandLogoUrl: true,
          brandPrimaryColor: true,
          brandSupportEmail: true,
          brandFooterText: true,
          subscription: { select: { plan: true } },
        },
      },
    },
  });

  if (!c) return NextResponse.json({ error: "Expediente no encontrado o acceso deshabilitado" }, { status: 404 });

  // El estado del consentimiento decide qué puede hacer la familia. Este
  // endpoint sigue respondiendo sin consentimiento porque es el que permite
  // presentarlo, pero las acciones (subir, descargar, escribir) lo exigen.
  const consent = await getConsentStatus(c.id);

  const plan = c.org?.subscription?.plan ?? "INICIA";
  const hideAttribution = plan === "DESPACHO" || plan === "FIRMA";

  const branding = {
    displayName: c.org?.brandDisplayName || c.org?.name || "Portal de seguimiento",
    logoUrl: c.org?.brandLogoUrl || null,
    primaryColor: c.org?.brandPrimaryColor || null,
    supportEmail: c.org?.brandSupportEmail || null,
    footerText: c.org?.brandFooterText || null,
    showPoweredBy: !hideAttribution,
  };

  // Identify tasks that need family documents (not done, have docTag, no linked doc).
  //
  // Qué tareas tienen ya documento se calcula sobre TODOS los documentos, no
  // sólo los visibles: si el equipo ha adjuntado internamente el certificado,
  // no debemos seguir pidiéndoselo a la familia. Es un hecho de la tarea, no
  // una divulgación del documento — sólo se usa para filtrar la lista de
  // pendientes, y ningún metadato del documento interno sale en la respuesta.
  const linkedTasks = await prisma.document.findMany({
    where: { caseId: c.id, taskId: { not: null }, deletionState: null },
    select: { taskId: true },
  });
  const linkedTaskIds = new Set(linkedTasks.map((d) => d.taskId));
  const pendingDocs = c.tasks
    .filter((t) => t.docTag && !linkedTaskIds.has(t.id) && t.status !== "DONE" && t.status !== "SKIPPED")
    .map((t) => ({
      title: t.title,
      category: t.category,
      deadline: t.deadline,
    }));

  // Case-level deadlines
  const deathDate = c.deceased?.deathDate;
  const caseDeadlines = deathDate ? getCaseDeadlines(new Date(deathDate)) : null;

  return NextResponse.json({
    ref: c.ref,
    status: c.status,
    deceasedName: c.deceased?.fullName,
    tasksTotal: c.tasks.length,
    tasksPending: c.tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length,
    tasksDone: c.tasks.filter((t) => t.status === "DONE").length,
    documents: c.documents.map((d) => ({ id: d.id, fileName: d.fileName, createdAt: d.createdAt, isPortalUpload: d.isPortalUpload })),
    tasks: c.tasks.map((t) => ({ title: t.title, status: t.status, category: t.category })),
    pendingDocs,
    caseDeadlines,
    branding,
    consentAccepted: consent.valid,
    consentOutdated: consent.outdated,
  });
}
