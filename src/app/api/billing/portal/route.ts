import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { createPortalSession } from "@/lib/stripe";

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "billing.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

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
