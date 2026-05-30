import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/api-rate-limit";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  // 60 lecturas/min por IP. El token es CUID (~10^36) asi que el riesgo es
  // scraping si el enlace se filtra, no bruteforce.
  const limited = rateLimit(req, { bucket: "portal-messages-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;

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
  // 20 mensajes/min por IP. Limite mas bajo que la lectura porque el write
  // crea filas en BD; sin esto un atacante con token filtrado podria spammear
  // miles de mensajes en el expediente.
  const limited = rateLimit(req, { bucket: "portal-messages-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;

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
