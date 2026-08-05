/**
 * SESIONES FAIL-CLOSED, CONTRA POSTGRESQL REAL.
 *
 * `getVerifiedSession` decide, en cada peticion, quien eres, en que
 * organizacion estas y si esa organizacion puede operar. Estas pruebas usan la
 * base de datos de verdad porque lo que se comprueba es precisamente el estado
 * almacenado: la fila `Subscription`, su `status`, y que la membresia siga
 * existiendo. Lo unico simulado es la cookie de NextAuth.
 *
 * QUE FALLA SIN LA CORRECCION
 * ---------------------------
 *   1. `isSuspended` empezaba con `if (!status) return false`. Una
 *      organizacion SIN fila `Subscription` no quedaba suspendida jamas y caia
 *      implicitamente al plan INICIA: acceso completo sin ningun derecho de uso
 *      demostrable.
 *   2. Los estados se comprobaban con una LISTA NEGRA de cuatro valores. Un
 *      estado que Stripe anada en el futuro —o uno corrupto— se interpretaba
 *      como "puede operar". `incomplete` y `paused` estaban justamente fuera de
 *      esa lista: nadie habia pagado y el acceso era total.
 *   3. Si el `orgId` del JWT ya no correspondia a ninguna membresia viva, se
 *      caia en silencio a `memberships[0]`. Para un usuario con dos
 *      organizaciones, ser expulsado de A significaba que las peticiones
 *      dirigidas a A se respondian con datos de B.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";

interface Identidad {
  userId: string;
  orgId: string | null;
}

const { identidad } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AsyncLocalStorage } = require("node:async_hooks") as typeof import("node:async_hooks");
  return {
    identidad: new AsyncLocalStorage() as InstanceType<
      typeof import("node:async_hooks").AsyncLocalStorage<Identidad>
    >,
  };
});

vi.mock("next-auth", () => ({
  getServerSession: async () => {
    const actual = identidad.getStore();
    if (!actual) return null;
    return { user: { id: actual.userId, email: "sesion@ejemplo.test", orgId: actual.orgId } };
  },
}));
vi.mock("../../src/lib/auth", () => ({ authOptions: {} }));

import { prisma, resetDatabase } from "./helpers/db";
import {
  getVerifiedSession,
  isSuspended,
  ESTADOS_STRIPE_CONOCIDOS,
} from "../../src/lib/session";
import { GET as listarExpedientes } from "../../src/app/api/cases/route";

function como<T>(userId: string, orgId: string | null, fn: () => Promise<T>): Promise<T> {
  return identidad.run({ userId, orgId }, fn);
}

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
});

let seq = 0;

/**
 * Crea organizacion + usuario OWNER. `subscription: null` crea la organizacion
 * SIN fila de suscripcion, que es el caso 1.
 */
async function escenario(opts: {
  subscription: { status: string; plan?: "INICIA" | "DESPACHO" | "FIRMA"; currentPeriodEnd?: Date } | null;
  slug?: string;
}) {
  seq++;
  const slug = opts.slug ?? `fc-${seq}-${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: `Org ${slug}`,
      slug,
      ...(opts.subscription
        ? {
            subscription: {
              create: {
                plan: opts.subscription.plan ?? "FIRMA",
                status: opts.subscription.status,
                currentPeriodEnd: opts.subscription.currentPeriodEnd ?? null,
              },
            },
          }
        : {}),
    },
  });

  const user = await prisma.user.create({
    data: { email: `u-${slug}@ejemplo.test`, name: "Titular" },
  });
  await prisma.membership.create({ data: { userId: user.id, orgId: org.id, role: "OWNER" } });

  return { org, user };
}

describe("Organizacion sin fila Subscription", () => {
  it("queda SUSPENDIDA en vez de caer implicitamente al plan INICIA", async () => {
    const { org, user } = await escenario({ subscription: null });

    const sesion = await como(user.id, org.id, () => getVerifiedSession());

    expect(sesion).not.toBeNull();
    expect(sesion!.subscriptionStatus).toBeNull();
    expect(sesion!.suspended).toBe(true);
  });

  it("sus APIs responden 402 y no devuelven datos de la organizacion", async () => {
    const { org, user } = await escenario({ subscription: null });
    await prisma.case.create({
      data: {
        orgId: org.id,
        ref: "EXP-2026-0001",
        deceased: { create: { fullName: "Fallecido" } },
        contact: { create: { fullName: "Contacto", email: "c@ejemplo.test" } },
      },
    });

    const res = await como(user.id, org.id, () =>
      listarExpedientes(new NextRequest("http://localhost/api/cases")),
    );

    expect(res.status).toBe(402);
    const cuerpo = await res.text();
    expect(cuerpo).not.toContain("EXP-2026-0001");
  });
});

describe("Estados de suscripcion: lista blanca explicita", () => {
  const OPERATIVOS = ["active", "trialing"];

  it.each(ESTADOS_STRIPE_CONOCIDOS)("el estado '%s' decide de forma explicita", async (estado) => {
    // `trialing` necesita periodo vigente para operar.
    const futuro = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { org, user } = await escenario({
      subscription: { status: estado, currentPeriodEnd: futuro },
    });

    const sesion = await como(user.id, org.id, () => getVerifiedSession());
    expect(sesion!.suspended).toBe(!OPERATIVOS.includes(estado));
  });

  it("un estado que Stripe no define suspende (no se adivina)", async () => {
    const { org, user } = await escenario({ subscription: { status: "unknown_future_state" } });

    const sesion = await como(user.id, org.id, () => getVerifiedSession());
    expect(sesion!.suspended).toBe(true);
  });

  it("`incomplete` suspende: el primer pago nunca llego a confirmarse", async () => {
    const { org, user } = await escenario({ subscription: { status: "incomplete" } });
    const sesion = await como(user.id, org.id, () => getVerifiedSession());
    expect(sesion!.suspended).toBe(true);
  });

  it("`paused` suspende", async () => {
    const { org, user } = await escenario({ subscription: { status: "paused" } });
    const sesion = await como(user.id, org.id, () => getVerifiedSession());
    expect(sesion!.suspended).toBe(true);
  });

  it("un trial vencido suspende aunque el cron no haya corrido", async () => {
    const pasado = new Date(Date.now() - 60 * 60 * 1000);
    const { org, user } = await escenario({
      subscription: { status: "trialing", currentPeriodEnd: pasado },
    });
    const sesion = await como(user.id, org.id, () => getVerifiedSession());
    expect(sesion!.suspended).toBe(true);
  });

  it("un trial sin fecha de fin suspende: no se puede comprobar que siga vigente", () => {
    expect(isSuspended("trialing", null)).toBe(true);
  });

  it("la ausencia de estado suspende", () => {
    expect(isSuspended(null, null)).toBe(true);
    expect(isSuspended(undefined, null)).toBe(true);
    expect(isSuspended("", null)).toBe(true);
  });
});

describe("JWT que referencia una organizacion perdida", () => {
  it("no cambia en silencio a la otra organizacion del usuario", async () => {
    const a = await escenario({ subscription: { status: "active" } });
    const b = await escenario({ subscription: { status: "active" } });

    // El mismo usuario pertenece a las dos. `a` es la mas antigua, que es la
    // que la implementacion anterior elegia como sustituta.
    await prisma.membership.create({
      data: { userId: a.user.id, orgId: b.org.id, role: "OPERATOR" },
    });

    // Es expulsado de A.
    await prisma.membership.deleteMany({ where: { userId: a.user.id, orgId: a.org.id } });

    // El JWT sigue diciendo "estoy en A".
    const sesion = await como(a.user.id, a.org.id, () => getVerifiedSession());

    expect(sesion).toBeNull();
  });

  it("una peticion con el contexto perdido responde 401, no datos de otra organizacion", async () => {
    const a = await escenario({ subscription: { status: "active" } });
    const b = await escenario({ subscription: { status: "active" } });

    await prisma.membership.create({
      data: { userId: a.user.id, orgId: b.org.id, role: "OWNER" },
    });
    await prisma.case.create({
      data: {
        orgId: b.org.id,
        ref: "EXP-B-0001",
        deceased: { create: { fullName: "Fallecido B" } },
        contact: { create: { fullName: "Contacto B", email: "b@ejemplo.test" } },
      },
    });

    await prisma.membership.deleteMany({ where: { userId: a.user.id, orgId: a.org.id } });

    const res = await como(a.user.id, a.org.id, () =>
      listarExpedientes(new NextRequest("http://localhost/api/cases")),
    );

    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("EXP-B-0001");
  });

  it("si el JWT no nombra ninguna organizacion, se usa la membresia mas antigua", async () => {
    // Primer login: el callback `jwt` aun no ha fijado el orgId. Este es el
    // unico caso en el que la eleccion automatica sigue siendo correcta.
    const a = await escenario({ subscription: { status: "active" } });

    const sesion = await como(a.user.id, null, () => getVerifiedSession());

    expect(sesion).not.toBeNull();
    expect(sesion!.orgId).toBe(a.org.id);
  });

  it("un usuario sin ninguna membresia no obtiene sesion de organizacion", async () => {
    const a = await escenario({ subscription: { status: "active" } });
    await prisma.membership.deleteMany({ where: { userId: a.user.id } });

    expect(await como(a.user.id, a.org.id, () => getVerifiedSession())).toBeNull();
    expect(await como(a.user.id, null, () => getVerifiedSession())).toBeNull();
  });
});

describe("Usuario suspendido atacando las APIs directamente", () => {
  it("no puede leer expedientes aunque tenga rol OWNER y membresia viva", async () => {
    const { org, user } = await escenario({ subscription: { status: "past_due" } });
    await prisma.case.create({
      data: {
        orgId: org.id,
        ref: "EXP-SUSPENDIDO-1",
        deceased: { create: { fullName: "Fallecido" } },
        contact: { create: { fullName: "Contacto", email: "c@ejemplo.test" } },
      },
    });

    const res = await como(user.id, org.id, () =>
      listarExpedientes(new NextRequest("http://localhost/api/cases")),
    );

    expect(res.status).toBe(402);
    expect(await res.text()).not.toContain("EXP-SUSPENDIDO-1");
  });

  it("tampoco puede con la suscripcion borrada a mano", async () => {
    const { org, user } = await escenario({ subscription: { status: "active" } });
    await prisma.subscription.delete({ where: { orgId: org.id } });

    const res = await como(user.id, org.id, () =>
      listarExpedientes(new NextRequest("http://localhost/api/cases")),
    );

    expect(res.status).toBe(402);
  });
});
