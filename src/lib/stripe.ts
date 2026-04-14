import Stripe from "stripe";
import { prisma } from "./prisma";
import type { PlanTier, BillingInterval } from "@prisma/client";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
  typescript: true,
});

/**
 * Pricing source of truth (EUR, IVA excluido).
 *
 * Regla de prepago anual: 17% descuento = 2 meses gratis.
 *   annual_price = monthly_price * 10
 *
 * Setup fee es one-off, cobrado en el primer Checkout del plan.
 * Inicia no tiene setup (entry-level, self-serve).
 * Despacho: 299 EUR setup (plan ancla).
 * Firma: 990 EUR setup (incluye onboarding asistido).
 */
export const PLAN_PRICING = {
  INICIA: {
    label: "Inicia",
    monthlyPrice: 149,
    annualPrice: 1490, // 2 meses gratis
    setupFee: 0,
    includedCases: 15,
    maxUsers: 2,
  },
  DESPACHO: {
    label: "Despacho",
    monthlyPrice: 349,
    annualPrice: 3490,
    setupFee: 299,
    includedCases: 50,
    maxUsers: 5,
  },
  FIRMA: {
    label: "Firma",
    monthlyPrice: 749,
    annualPrice: 7490,
    setupFee: 990,
    includedCases: 200,
    maxUsers: 20,
  },
} as const;

type PriceKey = `${PlanTier}_${BillingInterval}`;

// Stripe Price IDs por plan+intervalo. Configurar en env.
// STRIPE_PRICE_INICIA_MONTHLY, STRIPE_PRICE_INICIA_ANNUAL, etc.
function priceIdFor(plan: PlanTier, interval: BillingInterval): string {
  const key = `STRIPE_PRICE_${plan}_${interval}` as const;
  const id = process.env[key];
  if (!id) {
    throw new Error(`Stripe price no configurado para ${plan} ${interval} (env: ${key})`);
  }
  return id;
}

// Setup fee one-off prices (Stripe Price con recurring=null).
function setupFeePriceIdFor(plan: PlanTier): string | null {
  if (PLAN_PRICING[plan].setupFee === 0) return null;
  const key = `STRIPE_PRICE_SETUP_${plan}` as const;
  const id = process.env[key];
  if (!id) {
    throw new Error(`Setup fee no configurado para ${plan} (env: ${key})`);
  }
  return id;
}

/**
 * Create a Stripe Checkout session for a subscription upgrade.
 * Includes setup fee as a one-time line item the first time the org activates a paid plan.
 */
export async function createCheckoutSession(
  orgId: string,
  plan: PlanTier,
  interval: BillingInterval,
  returnUrl: string
): Promise<Stripe.Checkout.Session> {
  const priceId = priceIdFor(plan, interval);

  // Find or create a Stripe customer
  let subscription = await prisma.subscription.findUnique({
    where: { orgId },
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

    await prisma.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        stripeCustomerId: customerId,
        plan: "INICIA",
      },
      update: {
        stripeCustomerId: customerId,
      },
    });
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ];

  // Setup fee: solo si el plan lo requiere y aún no se ha cobrado.
  const setupPriceId = setupFeePriceIdFor(plan);
  const alreadyPaidSetup = subscription?.setupFeePaid ?? false;
  if (setupPriceId && !alreadyPaidSetup) {
    lineItems.push({ price: setupPriceId, quantity: 1 });
  }

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: lineItems,
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${returnUrl}?canceled=true`,
    metadata: {
      orgId,
      plan,
      interval,
      chargedSetupFee: setupPriceId && !alreadyPaidSetup ? "true" : "false",
    },
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
      const interval = (session.metadata?.interval as BillingInterval | undefined) ?? "MONTHLY";
      const chargedSetupFee = session.metadata?.chargedSetupFee === "true";

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
            interval,
            status: "active",
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            setupFeePaid: chargedSetupFee,
            setupFeePaidAt: chargedSetupFee ? new Date() : null,
          },
          update: {
            stripeSubId: stripeSubscription.id,
            plan,
            interval,
            status: "active",
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            ...(chargedSetupFee ? { setupFeePaid: true, setupFeePaidAt: new Date() } : {}),
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
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      const existingSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (existingSub) {
        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: { status: "canceled" },
        });
      }
      break;
    }
  }

  return { received: true, type: event.type };
}
