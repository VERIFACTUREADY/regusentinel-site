import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaseDeadlines } from "@/lib/deadline-engine";
import { rateLimit } from "@/lib/api-rate-limit";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  // Rate limit por IP: 60 lecturas/min. El token es CUID (espacio ~10^36) y
  // el bruteforce es invianle, pero si un enlace se filtra (WhatsApp, search
  // engine) impedimos scraping pesado del expediente.
  const limited = rateLimit(req, { bucket: "portal-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const c = await prisma.case.findFirst({
    where: { portalToken: params.token, portalEnabled: true, deletedAt: null },
    include: {
      deceased: { select: { fullName: true, deathDate: true } },
      tasks: {
        select: { id: true, title: true, status: true, category: true, docTag: true, deadline: true, blockedUntil: true },
        orderBy: { sortOrder: "asc" },
      },
      documents: { select: { id: true, fileName: true, createdAt: true, isPortalUpload: true, taskId: true } },
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

  // Identify tasks that need family documents (not done, have docTag, no linked doc)
  const linkedTaskIds = new Set(c.documents.filter((d) => d.taskId).map((d) => d.taskId));
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
    consentAccepted: c.consentAccepted,
  });
}
