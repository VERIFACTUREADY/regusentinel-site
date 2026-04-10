import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaseDeadlines } from "@/lib/deadline-engine";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const c = await prisma.case.findFirst({
    where: { portalToken: params.token, portalEnabled: true, deletedAt: null },
    include: {
      deceased: { select: { fullName: true, deathDate: true } },
      tasks: {
        select: { id: true, title: true, status: true, category: true, docTag: true, deadline: true, blockedUntil: true },
        orderBy: { sortOrder: "asc" },
      },
      documents: { select: { id: true, fileName: true, createdAt: true, isPortalUpload: true, taskId: true } },
    },
  });

  if (!c) return NextResponse.json({ error: "Expediente no encontrado o acceso deshabilitado" }, { status: 404 });

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
  });
}
