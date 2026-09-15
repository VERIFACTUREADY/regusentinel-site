import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission, requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  retentionDays: z.number().int().min(30).max(3650).optional(),
});

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;

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
  const auth = await requireOrgPermission("billing.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

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
