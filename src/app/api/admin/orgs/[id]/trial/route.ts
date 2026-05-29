import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
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
  // Solo el equipo de Heredia (ADMIN_EMAILS whitelist) puede otorgar trials
  // a otras orgs. Antes esto comprobaba `role === "OWNER"`, lo cual permitia
  // a cualquier OWNER de cualquier despacho darse 90 dias gratis a si mismo
  // o a otra org saltandose el billing — cross-tenant privilege escalation.
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
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

  const result = org.subscription
    ? await prisma.subscription.update({
        where: { id: org.subscription.id },
        data: { plan, status: "trialing", currentPeriodEnd },
      })
    : await prisma.subscription.create({
        data: {
          orgId: org.id,
          plan,
          status: "trialing",
          currentPeriodEnd,
        },
      });

  // Audit trail: queda registrado quien del equipo Heredia toco el trial.
  logAudit({
    orgId: org.id,
    userId: session.user.id ?? undefined,
    action: "admin.trial_granted",
    details: `Superadmin ${session.user.email} otorgo trial ${plan} por ${days} dias`,
  }).catch(() => {});

  return NextResponse.json(result);
}
