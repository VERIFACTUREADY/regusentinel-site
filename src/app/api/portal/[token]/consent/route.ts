import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const c = await prisma.case.findFirst({
    where: { portalToken: params.token, portalEnabled: true, deletedAt: null },
    select: { id: true, consentAccepted: true },
  });

  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const legitimationNote: string | undefined = typeof body.authorName === "string" && body.authorName.trim()
    ? body.authorName.trim()
    : undefined;

  await prisma.case.update({
    where: { id: c.id },
    data: {
      consentAccepted: true,
      consentDate: new Date(),
      ...(legitimationNote !== undefined && { legitimationNote }),
    },
  });

  return NextResponse.json({ ok: true });
}
