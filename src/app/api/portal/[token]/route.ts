import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const c = await prisma.case.findFirst({
    where: { portalToken: params.token, portalEnabled: true, deletedAt: null },
    include: {
      deceased: { select: { fullName: true } },
      tasks: { select: { id: true, title: true, status: true, category: true }, orderBy: { sortOrder: "asc" } },
      documents: { select: { id: true, fileName: true, createdAt: true, isPortalUpload: true } },
    },
  });

  if (!c) return NextResponse.json({ error: "Expediente no encontrado o acceso deshabilitado" }, { status: 404 });

  return NextResponse.json({
    ref: c.ref,
    status: c.status,
    deceasedName: c.deceased?.fullName,
    tasksTotal: c.tasks.length,
    tasksPending: c.tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length,
    documents: c.documents,
    tasks: c.tasks.map((t) => ({ title: t.title, status: t.status, category: t.category })),
  });
}
