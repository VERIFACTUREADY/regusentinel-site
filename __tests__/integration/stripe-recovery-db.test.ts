/**
 * RECUPERACION DE EVENTOS DE STRIPE CONTRA POSTGRESQL REAL.
 *
 * La maquina de estados de `StripeEvent` vive en la base de datos: la
 * reclamacion es un `updateMany` condicionado al estado leido, y la deteccion
 * de ejecuciones colgadas es una comparacion de fechas sobre filas reales. Con
 * Prisma mockeado no se comprueba nada de eso, solo que se llamo a un spy.
 *
 * Lo unico simulado es la API de Stripe (red externa).
 *
 * QUE FALLA SIN LA CORRECCION
 * ---------------------------
 * No existia recuperador. Un evento que quedaba en PROCESSING porque el
 * proceso murio a mitad —despliegue, OOM, timeout de la funcion— se quedaba
 * ahi para siempre: el webhook respondia 200 con `duplicate: true`, Stripe
 * dejaba de reintentarlo, y el efecto del evento (activar el plan, levantar
 * una suspension) no se aplicaba jamas. Un cobro cobrado y no aplicado.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const { stripeMock } = vi.hoisted(() => ({
  stripeMock: {
    subscriptions: { retrieve: vi.fn() },
    events: { retrieve: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  },
}));

vi.mock("stripe", () => ({
  default: class FakeStripe {
    subscriptions = stripeMock.subscriptions;
    events = stripeMock.events;
    webhooks = stripeMock.webhooks;
  },
}));

const enviarEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/lib/email", () => ({ sendEmail: (...a: unknown[]) => enviarEmail(...a) }));

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
process.env.OPS_ALERT_EMAIL = "ops@ejemplo.test";

import { prisma, resetDatabase } from "./helpers/db";
import {
  recuperarEventosAtascados,
  reintentarEvento,
  MAX_INTENTOS_EVENTO,
} from "../../src/lib/stripe";

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  await prisma.stripeEvent.deleteMany();
  vi.clearAllMocks();
});

let seq = 0;

/** Organizacion con suscripcion impagada, correlacionada por stripeSubId. */
async function orgImpagada() {
  seq++;
  const slug = `rec-${seq}-${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: `Org ${slug}`,
      slug,
      subscription: {
        create: {
          plan: "DESPACHO",
          status: "past_due",
          stripeCustomerId: `cus_${slug}`,
          stripeSubId: `sub_${slug}`,
        },
      },
    },
  });
  return { org, subId: `sub_${slug}`, customerId: `cus_${slug}` };
}

function eventoDePago(id: string, subId: string) {
  return {
    id,
    type: "invoice.payment_succeeded",
    data: { object: { id: "in_1", customer: "cus_x", subscription: subId } },
  };
}

describe("PROCESSING colgado", () => {
  it("se libera y se reprocesa, aplicando el efecto que se habia perdido", async () => {
    const { org, subId } = await orgImpagada();

    // El proceso murio hace media hora con el evento reclamado.
    await prisma.stripeEvent.create({
      data: {
        id: "evt_colgado",
        type: "invoice.payment_succeeded",
        status: "PROCESSING",
        attempts: 1,
        startedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    });

    stripeMock.events.retrieve.mockResolvedValue(eventoDePago("evt_colgado", subId));
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      id: subId,
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    });

    const resumen = await recuperarEventosAtascados();

    expect(resumen.liberados).toBe(1);
    expect(resumen.reprocesados).toBe(1);

    const fila = await prisma.stripeEvent.findUnique({ where: { id: "evt_colgado" } });
    expect(fila!.status).toBe("PROCESSED");

    // El efecto perdido SI se ha aplicado.
    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub!.status).toBe("active");
  });

  it("un PROCESSING reciente NO se toca: otra entrega lo esta ejecutando ahora", async () => {
    await prisma.stripeEvent.create({
      data: {
        id: "evt_en_curso",
        type: "invoice.payment_succeeded",
        status: "PROCESSING",
        attempts: 1,
        startedAt: new Date(),
      },
    });

    const resumen = await recuperarEventosAtascados();

    expect(resumen.liberados).toBe(0);
    expect(stripeMock.events.retrieve).not.toHaveBeenCalled();
    const fila = await prisma.stripeEvent.findUnique({ where: { id: "evt_en_curso" } });
    expect(fila!.status).toBe("PROCESSING");
  });
});

describe("FAILED reintentable", () => {
  it("se reprocesa y queda PROCESSED", async () => {
    const { org, subId } = await orgImpagada();

    await prisma.stripeEvent.create({
      data: {
        id: "evt_fallido",
        type: "invoice.payment_succeeded",
        status: "FAILED",
        attempts: 2,
        lastError: "DB caida",
      },
    });

    stripeMock.events.retrieve.mockResolvedValue(eventoDePago("evt_fallido", subId));
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      id: subId,
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    });

    const resumen = await recuperarEventosAtascados();
    expect(resumen.reprocesados).toBe(1);

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub!.status).toBe("active");
  });

  it("si vuelve a fallar sigue en FAILED con el contador subido, no se pierde", async () => {
    await prisma.stripeEvent.create({
      data: { id: "evt_persistente", type: "invoice.payment_succeeded", status: "FAILED", attempts: 1 },
    });

    stripeMock.events.retrieve.mockRejectedValue(new Error("Stripe no responde"));

    const resumen = await recuperarEventosAtascados();
    expect(resumen.fallidos).toBe(1);

    const fila = await prisma.stripeEvent.findUnique({ where: { id: "evt_persistente" } });
    expect(fila!.status).toBe("FAILED");
    expect(fila!.attempts).toBe(2);
    expect(fila!.lastError).toContain("Stripe no responde");
  });
});

describe("Reintentos agotados", () => {
  it("pasa a NEEDS_INTERVENTION y genera aviso operativo una sola vez", async () => {
    await prisma.stripeEvent.create({
      data: {
        id: "evt_agotado",
        type: "invoice.payment_succeeded",
        status: "FAILED",
        attempts: MAX_INTENTOS_EVENTO,
        lastError: "Suscripcion inexistente en Stripe",
      },
    });

    const primera = await recuperarEventosAtascados();

    expect(primera.requierenIntervencion).toBe(1);
    expect(primera.alertas).toBe(1);
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail.mock.calls[0][0].to).toBe("ops@ejemplo.test");
    expect(enviarEmail.mock.calls[0][0].subject).toContain("URGENTE");

    const fila = await prisma.stripeEvent.findUnique({ where: { id: "evt_agotado" } });
    expect(fila!.status).toBe("NEEDS_INTERVENTION");
    expect(fila!.alertedAt).not.toBeNull();

    // Segunda pasada: no repite el aviso.
    enviarEmail.mockClear();
    const segunda = await recuperarEventosAtascados();
    expect(segunda.alertas).toBe(0);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it("un evento NEEDS_INTERVENTION no se reintenta solo", async () => {
    await prisma.stripeEvent.create({
      data: {
        id: "evt_bloqueado",
        type: "invoice.payment_succeeded",
        status: "NEEDS_INTERVENTION",
        attempts: MAX_INTENTOS_EVENTO,
        alertedAt: new Date(),
      },
    });

    await recuperarEventosAtascados();
    expect(stripeMock.events.retrieve).not.toHaveBeenCalled();
  });

  it("el reintento MANUAL si lo vuelve a ejecutar", async () => {
    const { org, subId } = await orgImpagada();

    await prisma.stripeEvent.create({
      data: {
        id: "evt_manual",
        type: "invoice.payment_succeeded",
        status: "NEEDS_INTERVENTION",
        attempts: MAX_INTENTOS_EVENTO,
        alertedAt: new Date(),
      },
    });

    stripeMock.events.retrieve.mockResolvedValue(eventoDePago("evt_manual", subId));
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      id: subId,
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    });

    const resultado = await reintentarEvento("evt_manual");
    expect(resultado.ok).toBe(true);

    const fila = await prisma.stripeEvent.findUnique({ where: { id: "evt_manual" } });
    expect(fila!.status).toBe("PROCESSED");

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub!.status).toBe("active");
  });
});

describe("Idempotencia del recuperador", () => {
  it("un evento ya PROCESSED no se vuelve a aplicar", async () => {
    const { org, subId } = await orgImpagada();

    await prisma.stripeEvent.create({
      data: {
        id: "evt_hecho",
        type: "invoice.payment_succeeded",
        status: "PROCESSED",
        attempts: 1,
        completedAt: new Date(),
      },
    });

    const resumen = await recuperarEventosAtascados();

    expect(resumen.reprocesados).toBe(0);
    expect(stripeMock.events.retrieve).not.toHaveBeenCalled();

    // La suscripcion sigue impagada: no se ha reaplicado nada.
    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub!.status).toBe("past_due");
    expect(subId).toBeTruthy();
  });

  it("dos pasadas simultaneas del recuperador aplican el evento una sola vez", async () => {
    const { subId } = await orgImpagada();

    await prisma.stripeEvent.create({
      data: { id: "evt_carrera", type: "invoice.payment_succeeded", status: "FAILED", attempts: 1 },
    });

    stripeMock.events.retrieve.mockResolvedValue(eventoDePago("evt_carrera", subId));
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      id: subId,
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    });

    const [a, b] = await Promise.all([recuperarEventosAtascados(), recuperarEventosAtascados()]);

    // La reclamacion es un updateMany condicionado al estado: solo una gana.
    expect(a.reprocesados + b.reprocesados).toBe(1);
    expect(stripeMock.events.retrieve).toHaveBeenCalledTimes(1);
  });
});
