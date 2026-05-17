import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  retentionDays: z.number().int().min(30).max(3650).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.user.orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      retentionDays: true,
      createdAt: true,
      _count: { select: { members: true, cases: true } },
      subscription: { select: { plan: true, status: true, interval: true, currentPeriodEnd: true } },
    },
  });

  return NextResponse.json(org);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "billing.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", details: parsed.error.errors }, { status: 400 });
  }

  const updated = await prisma.organization.update({
    where: { id: session.user.orgId },
    data: parsed.data,
    select: { name: true, retentionDays: true },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "org.settings.update",
    details: `Ajustes actualizados: ${Object.keys(parsed.data).join(", ")}`,
  });

  return NextResponse.json(updated);
}
