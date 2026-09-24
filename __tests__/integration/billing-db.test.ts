/**
 * Integracion real (PostgreSQL): maquina de estados de StripeEvent y
 * concurrencia de los topes de plan.
 *
 * Aqui no hay mocks: se comprueba que la reclamacion condicional funciona de
 * verdad bajo concurrencia y que el advisory lock impide superar el tope.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma, resetDatabase, createOrg } from "./helpers/db";
import { checkUserLimit, lockOrgForLimits } from "../../src/lib/plan-limits";
import { PLAN_PRICING } from "../../src/lib/stripe";

beforeAll(async () => { await resetDatabase(); });
afterAll(async () => { await prisma.$disconnect(); });
beforeEach(async () => { await resetDatabase(); });

describe("StripeEvent: reclamacion condicional", () => {
  it("solo una de dos reclamaciones simultaneas gana", async () => {
    await prisma.stripeEvent.create({
      data: { id: "evt_race", type: "invoice.paid", status: "RECEIVED" },
    });

    // Misma actualizacion condicional que usa claimEvent.
    const reclamar = () =>
      prisma.stripeEvent.updateMany({
        where: { id: "evt_race", status: "RECEIVED" },
        data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
      });

    const [a, b] = await Promise.all([reclamar(), reclamar()]);

    // Exactamente una afecta a una fila.
    expect(a.count + b.count).toBe(1);
  });

  it("un evento FAILED se puede volver a reclamar; uno PROCESSED no", async () => {
    await prisma.stripeEvent.createMany({
      data: [
        { id: "evt_failed", type: "t", status: "FAILED", attempts: 1, lastError: "boom" },
        { id: "evt_done", type: "t", status: "PROCESSED", attempts: 1, completedAt: new Date() },
      ],
    });

    const failed = await prisma.stripeEvent.updateMany({
      where: { id: "evt_failed", status: "FAILED" },
      data: { status: "PROCESSING" },
    });
    expect(failed.count).toBe(1);

    const done = await prisma.stripeEvent.updateMany({
      where: { id: "evt_done", status: { in: ["RECEIVED", "FAILED"] } },
      data: { status: "PROCESSING" },
    });
    expect(done.count).toBe(0);
  });

  it("conserva el error y el numero de intentos entre reintentos", async () => {
    await prisma.stripeEvent.create({
      data: { id: "evt_r", type: "t", status: "RECEIVED" },
    });

    for (let i = 0; i < 3; i++) {
      await prisma.stripeEvent.updateMany({
        where: { id: "evt_r", status: { in: ["RECEIVED", "FAILED"] } },
        data: { status: "PROCESSING", attempts: { increment: 1 }, startedAt: new Date() },
      });
      await prisma.stripeEvent.update({
        where: { id: "evt_r" },
        data: { status: "FAILED", lastError: `fallo ${i + 1}` },
      });
    }

    const fila = await prisma.stripeEvent.findUniqueOrThrow({ where: { id: "evt_r" } });
    expect(fila.attempts).toBe(3);
    expect(fila.lastError).toBe("fallo 3");
    expect(fila.status).toBe("FAILED");
  });
});

describe("Tope de usuarios bajo concurrencia", () => {
  /**
   * Reproduce el fallo original: contar fuera de la transaccion y crear
   * despues permitia que varias invitaciones simultaneas superasen el tope.
   */
  it("N invitaciones simultaneas no superan el maximo del plan", async () => {
    const { org } = await createOrg({ plan: "INICIA" }); // maxUsers = 2, ya hay 1 OWNER
    const maxUsers = PLAN_PRICING.INICIA.maxUsers;

    const usuarios = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        prisma.user.create({ data: { email: `inv-${i}-${Date.now()}@ejemplo.test` } }),
      ),
    );

    const invitar = async (userId: string) => {
      try {
        await prisma.$transaction(async (tx) => {
          await lockOrgForLimits(org.id, tx);
          const limite = await checkUserLimit(org.id, "INICIA", tx);
          if (!limite.allowed) throw new Error("LIMIT");
          await tx.membership.create({ data: { userId, orgId: org.id, role: "OPERATOR" } });
        });
        return "ok";
      } catch (e) {
        return (e as Error).message === "LIMIT" ? "rechazada" : "error";
      }
    };

    const resultados = await Promise.all(usuarios.map((u) => invitar(u.id)));

    expect(resultados).not.toContain("error");

    const total = await prisma.membership.count({ where: { orgId: org.id } });
    expect(total).toBe(maxUsers);
    expect(resultados.filter((r) => r === "ok")).toHaveLength(maxUsers - 1); // el OWNER ya contaba
  });

  it("sin el lock, el mismo escenario superaria el tope", async () => {
    // Demuestra que el lock es lo que resuelve el problema, no la casualidad.
    const { org } = await createOrg({ plan: "INICIA" });

    const usuarios = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        prisma.user.create({ data: { email: `nolock-${i}-${Date.now()}@ejemplo.test` } }),
      ),
    );

    const invitarSinLock = async (userId: string) => {
      // Implementacion ANTIGUA: contar fuera, crear despues.
      const actuales = await prisma.membership.count({ where: { orgId: org.id } });
      if (actuales >= PLAN_PRICING.INICIA.maxUsers) return "rechazada";
      await prisma.membership.create({ data: { userId, orgId: org.id, role: "OPERATOR" } });
      return "ok";
    };

    await Promise.all(usuarios.map((u) => invitarSinLock(u.id)));

    const total = await prisma.membership.count({ where: { orgId: org.id } });
    expect(total).toBeGreaterThan(PLAN_PRICING.INICIA.maxUsers);
  });
});
