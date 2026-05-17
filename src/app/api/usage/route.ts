import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_PRICING } from "@/lib/stripe";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const month = new Date().toISOString().slice(0, 7);

  const [subscription, usage, memberCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { orgId: session.user.orgId } }),
    prisma.usageRecord.findUnique({
      where: { orgId_month: { orgId: session.user.orgId, month } },
    }),
    prisma.membership.count({ where: { orgId: session.user.orgId } }),
  ]);

  const plan = (subscription?.plan ?? "INICIA") as keyof typeof PLAN_PRICING;
  const pricing = PLAN_PRICING[plan];

  return NextResponse.json({
    plan,
    planLabel: pricing.label,
    status: subscription?.status ?? "trialing",
    casesUsed: usage?.casesCreated ?? 0,
    casesLimit: pricing.includedCases,
    membersUsed: memberCount,
    membersLimit: pricing.maxUsers,
    month,
  });
}
