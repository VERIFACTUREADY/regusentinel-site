import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("tasks.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const task = await prisma.task.findFirst({
    where: { id: params.id, case: { orgId: session.user.orgId, deletedAt: null } },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const notes = await prisma.taskNote.findMany({
    where: { taskId: params.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(notes);
}

/**
 * Escribir una nota es escribir.
 *
 * Este POST pedia `tasks.read`. Un VIEWER —que por definicion tiene solo los
 * permisos terminados en `.read`— podia dejar notas de gestion en cualquier
 * tarea de la organizacion: una escritura permanente, firmada con su nombre y
 * visible para todos, colada bajo un permiso de lectura. Pide `tasks.update`,
 * que es lo que corresponde a modificar una tarea.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("tasks.update");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const task = await prisma.task.findFirst({
    where: { id: params.id, case: { orgId: session.user.orgId, deletedAt: null } },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const body = await req.json();
  const content = body.content?.trim();
  if (!content || content.length < 1) {
    return NextResponse.json({ error: "La nota no puede estar vacia" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Nota demasiado larga (max 2000 caracteres)" }, { status: 400 });
  }

  const note = await prisma.taskNote.create({
    data: { taskId: params.id, userId: session.user.id, content },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(note, { status: 201 });
}
