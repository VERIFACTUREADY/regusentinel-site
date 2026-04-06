import Stripe from "stripe";
import { prisma } from "./prisma";
import type { PlanTier } from "@prisma/client";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
  typescript: true,
});

// Map plan tiers to Stripe price IDs (configure in env)
const PLAN_PRICE_MAP: Record<string, string> = {
  STARTER: process.env.STRIPE_PRICE_STARTER || "",
  PRO: process.env.STRIPE_PRICE_PRO || "",
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE || "",
};

/**
 * Create a Stripe Checkout session for a subscription upgrade.
 */
export async function createCheckoutSession(
  orgId: string,
  plan: PlanTier,
  returnUrl: string
): Promise<Stripe.Checkout.Session> {
  const priceId = PLAN_PRICE_MAP[plan];
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan: ${plan}`);
  }

  // Find or create a Stripe customer
  let subscription = await prisma.subscription.findUnique({
    where: { orgId },
    include: { org: true },
  });

  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { orgId },
    });

    customerId = customer.id;

    // Upsert subscription record with customer ID
    await prisma.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        stripeCustomerId: customerId,
        plan: "STARTER",
      },
      update: {
        stripeCustomerId: customerId,
      },
    });
  }

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${returnUrl}?canceled=true`,
    metadata: { orgId, plan },
  });
}

/**
 * Create a Stripe Customer Portal session for managing billing.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Process Stripe webhook events.
 */
export async function handleWebhookEvent(
  body: string | Buffer,
  sig: string
): Promise<{ received: boolean; type: string }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      const plan = session.metadata?.plan as PlanTier | undefined;

      if (orgId && plan && session.subscription) {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        await prisma.subscription.upsert({
          where: { orgId },
          create: {
            orgId,
            stripeCustomerId: session.customer as string,
            stripeSubId: stripeSubscription.id,
            plan,
            status: "active",
            currentPeriodEnd: new Date(
              stripeSubscription.current_period_end * 1000
            ),
          },
          update: {
            stripeSubId: stripeSubscription.id,
            plan,
            status: "active",
            currentPeriodEnd: new Date(
              stripeSubscription.current_period_end * 1000
            ),
          },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      const existingSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (existingSub) {
        const status = subscription.status === "active"
          ? "active"
          : subscription.status === "past_due"
            ? "past_due"
            : "canceled";

        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            status,
            currentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ),
          },
        });
      }
      break;
    }
  }

  return { received: true, type: event.type };
}
