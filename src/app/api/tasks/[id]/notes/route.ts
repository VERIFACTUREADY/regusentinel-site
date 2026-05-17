import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "tasks.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

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
