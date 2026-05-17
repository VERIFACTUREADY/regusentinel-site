import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const c = await prisma.case.findFirst({
    where: { portalToken: params.token, portalEnabled: true, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const messages = await prisma.portalMessage.findMany({
    where: { caseId: c.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, fromFamily: true, authorName: true, content: true, createdAt: true },
  });

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const c = await prisma.case.findFirst({
    where: { portalToken: params.token, portalEnabled: true, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const content = body.content?.trim();
  const authorName = body.authorName?.trim() || null;

  if (!content || content.length < 2) {
    return NextResponse.json({ error: "El mensaje no puede estar vacio" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Mensaje demasiado largo (max 2000 caracteres)" }, { status: 400 });
  }

  const message = await prisma.portalMessage.create({
    data: { caseId: c.id, fromFamily: true, authorName, content },
    select: { id: true, fromFamily: true, authorName: true, content: true, createdAt: true },
  });

  return NextResponse.json(message, { status: 201 });
}
