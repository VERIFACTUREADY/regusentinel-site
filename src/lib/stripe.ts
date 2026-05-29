import Stripe from "stripe";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { sendEmail } from "./email";
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
): Promise<{ received: boolean; type: string; duplicate?: boolean }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

  // Idempotencia: Stripe reintenta hasta 3 dias si no respondes 200 rapido.
  // Si ya procesamos este event.id antes, devolvemos OK sin ejecutar handlers
  // (evita duplicar emails, mutaciones de subscription, etc.).
  try {
    await prisma.stripeEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (err: any) {
    // P2002 = unique constraint violation → ya procesado.
    if (err?.code === "P2002") {
      return { received: true, type: event.type, duplicate: true };
    }
    throw err;
  }

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

        const previousSub = await prisma.subscription.findUnique({ where: { orgId } });
        const wasTrialing = previousSub?.status === "trialing";

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

        await logAudit({
          orgId,
          action: wasTrialing ? "subscription.trial_converted" : "subscription.activated",
          details: `Plan ${plan} (${interval})${chargedSetupFee ? " + setup fee" : ""}`,
        }).catch(console.error);

        if (wasTrialing) {
          await notifyTrialConverted(orgId, plan).catch(console.error);
        }
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
        const newStatus = mapStripeStatus(subscription.status);
        const previousStatus = existingSub.status;

        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            status: newStatus,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });

        if (previousStatus !== newStatus) {
          await logAudit({
            orgId: existingSub.orgId,
            action: "subscription.status_changed",
            details: `${previousStatus} → ${newStatus}`,
          }).catch(console.error);
        }

        if (newStatus === "past_due" && previousStatus !== "past_due") {
          await notifyPaymentFailed(existingSub.orgId).catch(console.error);
        }
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

        await logAudit({
          orgId: existingSub.orgId,
          action: "subscription.canceled",
          details: `Plan ${existingSub.plan} cancelado`,
        }).catch(console.error);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      if (customerId) {
        const existingSub = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (existingSub) {
          await logAudit({
            orgId: existingSub.orgId,
            action: "billing.payment_failed",
            details: `Importe: ${((invoice.amount_due ?? 0) / 100).toFixed(2)} EUR`,
          }).catch(console.error);
        }
      }
      break;
    }
  }

  return { received: true, type: event.type };
}

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return stripeStatus;
  }
}

async function notifyTrialConverted(orgId: string, plan: string) {
  const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
  if (!notifyEmail) return;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, slug: true },
  });

  await sendEmail({
    to: notifyEmail,
    subject: `Trial convertido — ${org?.name ?? orgId} → ${plan}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <p style="background:#16a34a;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;">CONVERSION</p>
        <h2 style="color:#1a1a2e;margin-top:12px;">Trial convertido a cliente</h2>
        <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:4px 16px 4px 0;color:#666;">Organizacion</td><td><strong>${org?.name ?? orgId}</strong></td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#666;">Slug</td><td>${org?.slug ?? "—"}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#666;">Plan</td><td><strong>${plan}</strong></td></tr>
        </table>
      </div>
    `,
  });
}

async function notifyPaymentFailed(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      members: {
        where: { role: "OWNER" },
        select: { user: { select: { email: true, name: true } } },
        take: 1,
      },
    },
  });

  const ownerEmail = org?.members[0]?.user.email;
  if (!ownerEmail) return;

  await sendEmail({
    to: ownerEmail,
    subject: `Problema con tu pago — Heredia`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <p style="background:#dc2626;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;">PAGO FALLIDO</p>
        <h2 style="color:#1a1a2e;margin-top:12px;">Hola ${org?.members[0]?.user.name ?? ""},</h2>
        <p style="font-size:15px;color:#333;">
          No hemos podido procesar el pago de tu suscripcion de Heredia para <strong>${org?.name}</strong>.
        </p>
        <p style="font-size:15px;color:#333;">
          Actualiza tu metodo de pago desde el panel de facturacion para evitar la suspension del servicio.
          Si el problema persiste tras 7 dias, el acceso se suspendera automaticamente.
        </p>
        <p style="text-align:center;margin:32px 0;">
          <a href="https://heredia.app/billing"
             style="background-color:#dc2626;color:white;padding:12px 32px;
                    border-radius:6px;text-decoration:none;font-weight:600;">
            Actualizar metodo de pago
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
        <p style="color:#999;font-size:12px;">Heredia — Gestion post-mortem profesional</p>
      </div>
    `,
  });

  const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
  if (notifyEmail) {
    await sendEmail({
      to: notifyEmail,
      subject: `Pago fallido — ${org?.name}`,
      html: `<p>El pago de <strong>${org?.name}</strong> ha fallado. Contactar al owner (${ownerEmail}).</p>`,
    });
  }
}
