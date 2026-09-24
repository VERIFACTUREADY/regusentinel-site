import { NextRequest, NextResponse } from "next/server";
import { requireBillingAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createPortalSession } from "@/lib/stripe";

export async function POST(_req: NextRequest) {
  const auth = await requireBillingAccess("billing.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const subscription = await prisma.subscription.findUnique({
    where: { orgId: session.user.orgId },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: "No hay cuenta de facturacion" }, { status: 400 });
  }

  try {
    const url = await createPortalSession(
      subscription.stripeCustomerId,
      `${process.env.APP_URL}/billing`
    );
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Stripe portal error:", error);
    return NextResponse.json({ error: "Error al crear portal" }, { status: 500 });
  }
}
