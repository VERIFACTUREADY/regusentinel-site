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
/**
 * Tiempo tras el cual una ejecución en PROCESSING se considera colgada (el
 * proceso murió a mitad) y otro reintento puede tomarla.
 */
const PROCESSING_STALE_MS = 5 * 60 * 1000;

/**
 * Reintentos automáticos antes de exigir intervención humana. Stripe reintenta
 * durante 3 días; pasado ese punto nadie va a volver a enviar el evento, así
 * que un evento que sigue fallando deja de ser un problema transitorio.
 */
export const MAX_INTENTOS_EVENTO = 8;

/** Un evento en PROCESSING más antiguo que esto se considera colgado. */
export function eventoColgado(startedAt: Date | null, ahora: Date = new Date()): boolean {
  if (!startedAt) return false;
  return ahora.getTime() - startedAt.getTime() > PROCESSING_STALE_MS;
}

/**
 * Reclama el evento para procesarlo, o indica que no hay que hacerlo.
 *
 * La reclamación es una **actualización condicional atómica**: `updateMany`
 * con el estado esperado en el `where`. Si dos entregas simultáneas del mismo
 * evento llegan a la vez, sólo una verá `count === 1` y la otra se retira. No
 * hace falta bloquear ni mantener una transacción abierta durante las llamadas
 * de red a Stripe, que son lentas.
 */
async function claimEvent(
  eventId: string,
  eventType: string,
): Promise<"claimed" | "already_processed" | "in_progress" | "needs_intervention"> {
  // Alta idempotente: si ya existe, seguimos con la lógica de reclamación.
  try {
    await prisma.stripeEvent.create({
      data: { id: eventId, type: eventType, status: "RECEIVED" },
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code !== "P2002") throw err;
  }

  const existing = await prisma.stripeEvent.findUnique({ where: { id: eventId } });
  if (!existing) return "in_progress"; // carrera improbable; que Stripe reintente

  // Sólo PROCESSED descarta un reintento. Este es el cambio que impide perder
  // cobros: antes bastaba con que la fila existiera.
  if (existing.status === "PROCESSED") return "already_processed";

  // Reintentos agotados: no se vuelve a intentar solo. El cron de recuperación
  // avisa a operaciones y deja el evento a la espera de reintento manual.
  if (existing.status === "NEEDS_INTERVENTION") return "needs_intervention";

  const stale = existing.status === "PROCESSING" && eventoColgado(existing.startedAt);

  const claimable: Array<typeof existing.status> = ["RECEIVED", "FAILED"];
  if (!claimable.includes(existing.status) && !stale) {
    return "in_progress";
  }

  const claim = await prisma.stripeEvent.updateMany({
    where: { id: eventId, status: existing.status },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  return claim.count === 1 ? "claimed" : "in_progress";
}

/**
 * Procesa un webhook de Stripe de forma reintentable.
 *
 * ANTES: `stripeEvent.create` se ejecutaba antes del `switch`. Si un handler
 * lanzaba, la fila ya existía; el reintento de Stripe chocaba con P2002 y se
 * respondía `duplicate: true` sin volver a aplicar nada. Una activación de
 * suscripción podía perderse para siempre: dinero cobrado y plan no activado.
 *
 * AHORA: el evento se marca PROCESSED sólo si la lógica termina bien. Si
 * falla, queda FAILED con el error, se responde con error para que Stripe
 * reintente, y el reintento vuelve a ejecutarlo.
 */
export type ResultadoWebhook =
  | { received: true; type: string; duplicate?: boolean }
  /**
   * El evento no se ha aplicado y hay que volver a entregarlo. La ruta debe
   * responder != 2xx: si respondiera 200, Stripe daría el evento por entregado
   * y no habría ninguna otra entrega.
   */
  | { received: false; type: string; retry: true; reason: "in_progress" | "needs_intervention" };

export async function handleWebhookEvent(
  body: string | Buffer,
  sig: string
): Promise<ResultadoWebhook> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

  const claim = await claimEvent(event.id, event.type);

  if (claim === "already_processed") {
    return { received: true, type: event.type, duplicate: true };
  }

  // OTRA ENTREGA LO ESTÁ PROCESANDO: NO SE RESPONDE "OK".
  //
  // Antes esto devolvía `{ received: true, duplicate: true }`, es decir 200.
  // Stripe interpretaba el evento como entregado con éxito y dejaba de
  // reintentarlo. Si el proceso que lo tenía reclamado moría antes de
  // terminar —despliegue a mitad, OOM, timeout de la función— el evento
  // quedaba en PROCESSING para siempre y su efecto (activar el plan, aplicar
  // el cobro) no se llegaba a producir nunca. El recuperador existe, pero la
  // defensa correcta es no renunciar al reintento de Stripe, que es gratis.
  //
  // Con 409, Stripe reintenta con backoff; para entonces la otra entrega habrá
  // terminado (y responderemos `duplicate`) o habrá caducado (y la tomaremos).
  if (claim === "in_progress") {
    return { received: false, type: event.type, retry: true, reason: "in_progress" };
  }

  if (claim === "needs_intervention") {
    return { received: false, type: event.type, retry: true, reason: "needs_intervention" };
  }

  try {
    await processEvent(event);
  } catch (err) {
    await marcarFallo(event.id, err);

    // Se propaga para que la ruta responda != 2xx y Stripe reintente.
    throw err;
  }

  await prisma.stripeEvent.update({
    where: { id: event.id },
    data: { status: "PROCESSED", completedAt: new Date(), lastError: null },
  });

  return { received: true, type: event.type };
}

/**
 * Marca el fallo y decide si el evento aún puede recuperarse solo.
 *
 * `attempts` ya se incrementó al reclamar, así que aquí sólo se compara.
 */
async function marcarFallo(eventId: string, err: unknown): Promise<void> {
  const mensaje = err instanceof Error ? err.message : String(err);

  await prisma.stripeEvent
    .updateMany({
      where: { id: eventId, attempts: { lt: MAX_INTENTOS_EVENTO } },
      data: { status: "FAILED", lastError: mensaje.slice(0, 1000), completedAt: null },
    })
    .catch(console.error);

  await prisma.stripeEvent
    .updateMany({
      where: { id: eventId, attempts: { gte: MAX_INTENTOS_EVENTO } },
      data: { status: "NEEDS_INTERVENTION", lastError: mensaje.slice(0, 1000), completedAt: null },
    })
    .catch(console.error);
}

/**
 * Recuperación de eventos atascados. La ejecuta el cron
 * `/api/cron/stripe-recovery`.
 *
 * Cubre los tres casos que la auditoría señala:
 *   - PROCESSING colgado: el proceso que lo reclamó murió. Se libera a FAILED
 *     para que la siguiente pasada (o la siguiente entrega de Stripe) lo tome.
 *   - FAILED reintentable: se vuelve a pedir el evento a Stripe y se reprocesa.
 *   - Reintentos agotados: pasa a NEEDS_INTERVENTION y genera aviso operativo.
 *
 * No depende de que Stripe siga reintentando: pasados 3 días ya no lo hace.
 */
export async function recuperarEventosAtascados(opciones: { ahora?: Date; limite?: number } = {}): Promise<{
  liberados: number;
  reprocesados: number;
  fallidos: number;
  requierenIntervencion: number;
  alertas: number;
}> {
  const ahora = opciones.ahora ?? new Date();
  const limite = opciones.limite ?? 50;

  // 1. PROCESSING colgado -> FAILED (reclamable).
  const liberados = await prisma.stripeEvent.updateMany({
    where: {
      status: "PROCESSING",
      startedAt: { lt: new Date(ahora.getTime() - PROCESSING_STALE_MS) },
    },
    data: {
      status: "FAILED",
      lastError: "Ejecución colgada: el proceso que reclamó el evento no terminó.",
    },
  });

  // 2. FAILED con reintentos disponibles -> reprocesar.
  const reintentables = await prisma.stripeEvent.findMany({
    where: { status: "FAILED", attempts: { lt: MAX_INTENTOS_EVENTO } },
    orderBy: { receivedAt: "asc" },
    take: limite,
    select: { id: true, type: true, attempts: true },
  });

  let reprocesados = 0;
  let fallidos = 0;

  for (const fila of reintentables) {
    const claim = await claimEvent(fila.id, fila.type);
    if (claim !== "claimed") continue;

    try {
      // El cuerpo original no se guarda (contiene datos de pago). Se vuelve a
      // pedir a Stripe, que conserva los eventos 30 días.
      const evento = await stripe.events.retrieve(fila.id);
      await processEvent(evento as Stripe.Event);
      await prisma.stripeEvent.update({
        where: { id: fila.id },
        data: { status: "PROCESSED", completedAt: ahora, lastError: null },
      });
      reprocesados++;
    } catch (err) {
      await marcarFallo(fila.id, err);
      fallidos++;
    }
  }

  // 3. Reintentos agotados -> intervención + aviso.
  const agotados = await prisma.stripeEvent.updateMany({
    where: { status: "FAILED", attempts: { gte: MAX_INTENTOS_EVENTO } },
    data: { status: "NEEDS_INTERVENTION" },
  });

  const pendientesDeAviso = await prisma.stripeEvent.findMany({
    where: { status: "NEEDS_INTERVENTION", alertedAt: null },
    take: limite,
    select: { id: true, type: true, attempts: true, lastError: true, receivedAt: true },
  });

  if (pendientesDeAviso.length > 0) {
    await avisarEventosAtascados(pendientesDeAviso).catch(console.error);
    await prisma.stripeEvent.updateMany({
      where: { id: { in: pendientesDeAviso.map((e) => e.id) } },
      data: { alertedAt: ahora },
    });
  }

  return {
    liberados: liberados.count,
    reprocesados,
    fallidos,
    requierenIntervencion: agotados.count,
    alertas: pendientesDeAviso.length,
  };
}

async function avisarEventosAtascados(
  eventos: Array<{ id: string; type: string; attempts: number; lastError: string | null; receivedAt: Date }>,
): Promise<void> {
  const destino = process.env.OPS_ALERT_EMAIL || process.env.LEADS_NOTIFY_EMAIL;
  if (!destino) {
    console.error(
      `[stripe] ${eventos.length} eventos requieren intervención y no hay OPS_ALERT_EMAIL configurado:`,
      eventos.map((e) => `${e.id} (${e.type})`).join(", "),
    );
    return;
  }

  const filas = eventos
    .map(
      (e) =>
        `<tr><td style="padding:4px 8px;font-family:monospace;">${e.id}</td>` +
        `<td style="padding:4px 8px;">${e.type}</td>` +
        `<td style="padding:4px 8px;text-align:right;">${e.attempts}</td>` +
        `<td style="padding:4px 8px;">${(e.lastError ?? "").slice(0, 200)}</td></tr>`,
    )
    .join("");

  await sendEmail({
    to: destino,
    subject: `[URGENTE] ${eventos.length} evento(s) de Stripe sin aplicar`,
    html: `
      <div style="font-family:sans-serif;max-width:760px;">
        <h2 style="color:#b91c1c;">Eventos de Stripe que no han podido aplicarse</h2>
        <p>
          Han agotado los ${MAX_INTENTOS_EVENTO} reintentos automáticos. Pueden
          corresponder a cobros ya realizados cuyo efecto (activar un plan,
          levantar una suspensión) no se ha aplicado todavía.
        </p>
        <p>
          Reintento manual:
          <code>POST /api/cron/stripe-recovery?force=&lt;event_id&gt;</code>
        </p>
        <table style="border-collapse:collapse;font-size:13px;">
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:4px 8px;">Evento</th><th style="padding:4px 8px;">Tipo</th>
            <th style="padding:4px 8px;">Intentos</th><th style="padding:4px 8px;">Último error</th>
          </tr>
          ${filas}
        </table>
      </div>
    `,
  });
}

/** Reintento manual de un evento concreto tras resolver la causa. */
export async function reintentarEvento(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const fila = await prisma.stripeEvent.findUnique({ where: { id: eventId } });
  if (!fila) return { ok: false, error: "Evento desconocido" };
  if (fila.status === "PROCESSED") return { ok: true };

  // Se devuelve a FAILED con el contador a cero para que vuelva a ser
  // reclamable; el reintento manual presupone que la causa está resuelta.
  await prisma.stripeEvent.update({
    where: { id: eventId },
    data: { status: "FAILED", attempts: 0, alertedAt: null },
  });

  const claim = await claimEvent(eventId, fila.type);
  if (claim !== "claimed") return { ok: false, error: `No reclamable (${claim})` };

  try {
    const evento = await stripe.events.retrieve(eventId);
    await processEvent(evento as Stripe.Event);
    await prisma.stripeEvent.update({
      where: { id: eventId },
      data: { status: "PROCESSED", completedAt: new Date(), lastError: null },
    });
    return { ok: true };
  } catch (err) {
    await marcarFallo(eventId, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Localiza la suscripción local que corresponde a un evento de Stripe.
 *
 * La correlación correcta es por `stripeSubId`: un mismo `customer` puede
 * tener varias suscripciones (un segundo despacho, una suscripción antigua ya
 * sustituida, una de prueba), y `findFirst({ stripeCustomerId })` devolvía
 * cualquiera de ellas — normalmente la equivocada.
 *
 * La caída a `stripeCustomerId` se conserva sólo para filas antiguas que aún
 * no tienen `stripeSubId` guardado, y en ese caso se rellena el campo para que
 * el siguiente evento ya no la necesite.
 */
async function localizarSuscripcion(stripeSubId: string, customerId: string | undefined) {
  const porSuscripcion = await prisma.subscription.findFirst({ where: { stripeSubId } });
  if (porSuscripcion) return porSuscripcion;

  if (!customerId) return null;

  const legado = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId, stripeSubId: null },
  });
  if (!legado) return null;

  return prisma.subscription.update({
    where: { id: legado.id },
    data: { stripeSubId },
  });
}

async function processEvent(event: Stripe.Event): Promise<void> {
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

      const existingSub = await localizarSuscripcion(subscription.id, customerId);

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

      // Cancelar por cliente borraba el acceso de la suscripción equivocada si
      // el cliente tenía más de una.
      const existingSub = await localizarSuscripcion(subscription.id, customerId);

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

      const failedSubId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id ?? null;

      // Una factura suelta que falla no dice nada sobre la suscripción.
      if (failedSubId) {
        const existingSub = await localizarSuscripcion(failedSubId, customerId);

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

    case "invoice.payment_succeeded": {
      // REACTIVACIÓN CORRELACIONADA POR SUSCRIPCIÓN, NO POR CLIENTE.
      //
      // Antes bastaba con que el `customer` de la factura coincidiera con
      // `Subscription.stripeCustomerId` para poner la suscripción en `active`.
      // Eso reactivaba el servicio por cobros que no lo justifican:
      //
      //   - una factura suelta (one-off) emitida al mismo cliente;
      //   - el cobro de un setup fee;
      //   - el pago de una suscripción ANTIGUA ya sustituida;
      //   - el pago de OTRA suscripción del mismo cliente (un segundo
      //     despacho, una suscripción de prueba) que no es la nuestra.
      //
      // En todos esos casos una organización impagada volvía a operar por un
      // cobro ajeno a su suscripción. Ahora se exige que la factura pertenezca
      // a la suscripción concreta que tenemos guardada, y el estado que se
      // aplica es el que Stripe dice que tiene ESA suscripción, no `active`
      // por decreto.
      const invoice = event.data.object as Stripe.Invoice;

      const invoiceSubId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id ?? null;

      // 1. Factura sin suscripción: one-off, setup fee suelto. No reactiva.
      if (!invoiceSubId) break;

      // 2. Debe coincidir con la suscripción que tenemos guardada. Se busca por
      //    `stripeSubId`, no por cliente.
      const existingSub = await prisma.subscription.findFirst({
        where: { stripeSubId: invoiceSubId },
      });
      if (!existingSub) break;

      // 3. Se recupera la suscripción concreta desde Stripe.
      const stripeSub = await stripe.subscriptions.retrieve(invoiceSubId);

      // 4. Se aplica el estado REAL de esa suscripción. Si Stripe dice que
      //    sigue impagada, no se reactiva por mucho que una factura se haya
      //    cobrado.
      const nuevoEstado = mapStripeStatus(stripeSub.status);
      const anterior = existingSub.status;

      if (anterior !== nuevoEstado || existingSub.currentPeriodEnd === null) {
        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            status: nuevoEstado,
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
        });

        await logAudit({
          orgId: existingSub.orgId,
          action:
            nuevoEstado === "active" && anterior !== "active"
              ? "subscription.reactivated"
              : "subscription.status_changed",
          details: `Pago de la factura ${invoice.id}; ${anterior} → ${nuevoEstado}`,
        }).catch(console.error);
      }
      break;
    }
  }
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
