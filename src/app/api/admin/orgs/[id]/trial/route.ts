import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const VALID_PLANS = ["INICIA", "DESPACHO", "FIRMA"] as const;

const bodySchema = z.object({
  plan: z.enum(VALID_PLANS),
  days: z.number().int().min(1).max(90),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    select: { id: true, subscription: { select: { id: true, status: true, currentPeriodEnd: true } } },
  });

  if (!org) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { plan, days } = parsed.data;
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + days);

  if (org.subscription) {
    const updated = await prisma.subscription.update({
      where: { id: org.subscription.id },
      data: { plan, status: "trialing", currentPeriodEnd },
    });
    return NextResponse.json(updated);
  }

  const created = await prisma.subscription.create({
    data: {
      orgId: org.id,
      plan,
      status: "trialing",
      currentPeriodEnd,
    },
  });
  return NextResponse.json(created);
}
