import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json();
  const text = (body.text as string)?.trim();
  if (!text || text.length > 2000) {
    return NextResponse.json({ error: "Texto invalido (1-2000 caracteres)" }, { status: 400 });
  }

  const log = await prisma.auditLog.create({
    data: {
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: "case.comment",
      details: text,
    },
  });

  return NextResponse.json(log, { status: 201 });
}
