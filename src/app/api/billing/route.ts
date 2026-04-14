import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { createCheckoutSession, PLAN_PRICING } from "@/lib/stripe";
import type { PlanTier, BillingInterval } from "@prisma/client";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "billing.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { orgId: session.user.orgId },
  });

  const month = new Date().toISOString().slice(0, 7);
  const usage = await prisma.usageRecord.findUnique({
    where: { orgId_month: { orgId: session.user.orgId, month } },
  });

  return NextResponse.json({ subscription, usage, pricing: PLAN_PRICING });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "billing.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const plan = body.plan as PlanTier | undefined;
  const interval = (body.interval as BillingInterval | undefined) ?? "MONTHLY";

  if (!plan || !(plan in PLAN_PRICING)) {
    return NextResponse.json({ error: "Plan invalido" }, { status: 400 });
  }
  if (interval !== "MONTHLY" && interval !== "ANNUAL") {
    return NextResponse.json({ error: "Intervalo invalido" }, { status: 400 });
  }

  try {
    const checkout = await createCheckoutSession(
      session.user.orgId,
      plan,
      interval,
      `${process.env.APP_URL}/billing`
    );
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Error al crear sesion de pago" }, { status: 500 });
  }
}
