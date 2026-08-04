/**
 * Pruebas de INTEGRACION contra PostgreSQL real.
 *
 * Comprueban lo que un mock no puede: que la restriccion unica existe de
 * verdad, que la transaccion aisla, y que dos altas simultaneas no producen la
 * misma referencia de expediente.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import { nextCaseRef } from "../../src/lib/tenancy";

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
});

describe("Restriccion unica (orgId, ref)", () => {
  it("la base de datos rechaza dos expedientes con la misma ref en la misma organizacion", async () => {
    const { org } = await createOrg();
    await createCase(org.id, "EXP-2026-0001");

    await expect(createCase(org.id, "EXP-2026-0001")).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("dos organizaciones SI pueden usar la misma referencia", async () => {
    const a = await createOrg();
    const b = await createOrg();

    await createCase(a.org.id, "EXP-2026-0001");
    const segundo = await createCase(b.org.id, "EXP-2026-0001");

    expect(segundo.ref).toBe("EXP-2026-0001");
  });
});

describe("Generacion concurrente de referencias", () => {
  /**
   * Reproduce el fallo original: `count + 1` daba la misma referencia a dos
   * altas simultaneas. Ahora la restriccion hace fallar a la perdedora con
   * P2002 y el endpoint reintenta, asi que ninguna referencia se duplica.
   */
  it("10 altas simultaneas producen 10 referencias distintas", async () => {
    const { org } = await createOrg();

    const crear = async () => {
      // Mismo bucle de reintento que usa POST /api/cases.
      for (let intento = 0; intento < 8; intento++) {
        try {
          return await prisma.$transaction(async (tx) => {
            const ref = await nextCaseRef(org.id, tx);
            return tx.case.create({
              data: {
                orgId: org.id,
                ref,
                deceased: { create: { fullName: "Fallecido" } },
                contact: { create: { fullName: "Contacto" } },
              },
            });
          });
        } catch (err) {
          if ((err as { code?: string })?.code === "P2002") continue;
          throw err;
        }
      }
      throw new Error("No se pudo asignar referencia tras varios intentos");
    };

    const creados = await Promise.all(Array.from({ length: 10 }, crear));
    const refs = creados.map((c) => c.ref);

    expect(refs).toHaveLength(10);
    expect(new Set(refs).size).toBe(10);

    const enBase = await prisma.case.findMany({
      where: { orgId: org.id },
      select: { ref: true },
    });
    expect(new Set(enBase.map((c) => c.ref)).size).toBe(10);
  });

  it("la secuencia continua desde el maximo existente, no desde el recuento", async () => {
    const { org } = await createOrg();
    const year = new Date().getFullYear();

    // Un hueco: si se usara `count + 1` daria 0003 y chocaria con la 0007.
    await createCase(org.id, `EXP-${year}-0001`);
    await createCase(org.id, `EXP-${year}-0007`);

    expect(await nextCaseRef(org.id, prisma)).toBe(`EXP-${year}-0008`);
  });
});

describe("Aislamiento entre organizaciones a nivel de consulta", () => {
  it("una tarea de otra organizacion no es alcanzable filtrando por orgId", async () => {
    const a = await createOrg();
    const b = await createOrg();

    const casoB = await createCase(b.org.id, "EXP-2026-9001");
    const tareaB = await prisma.task.create({
      data: { caseId: casoB.id, category: "BANCOS", title: "Tarea de B" },
    });

    // Exactamente el filtro que aplica findTaskInCase.
    const encontrada = await prisma.task.findFirst({
      where: { id: tareaB.id, caseId: casoB.id, case: { orgId: a.org.id, deletedAt: null } },
    });

    expect(encontrada).toBeNull();
  });

  it("la membresia es la que decide si un assigneeId es aceptable", async () => {
    const a = await createOrg();
    const b = await createOrg();

    const externo = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: b.owner.id, orgId: a.org.id } },
    });
    expect(externo).toBeNull();

    const interno = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: a.owner.id, orgId: a.org.id } },
    });
    expect(interno).not.toBeNull();
  });
});

describe("Revocacion de membresia", () => {
  it("expulsar a un miembro lo deja sin membresia consultable de inmediato", async () => {
    const { org, owner } = await createOrg();
    const otro = await prisma.user.create({
      data: { email: `op-${Date.now()}@ejemplo.test`, name: "Operador" },
    });
    await prisma.membership.create({
      data: { userId: otro.id, orgId: org.id, role: "OPERATOR" },
    });

    expect(
      await prisma.membership.findUnique({
        where: { userId_orgId: { userId: otro.id, orgId: org.id } },
      }),
    ).not.toBeNull();

    await prisma.membership.delete({
      where: { userId_orgId: { userId: otro.id, orgId: org.id } },
    });

    // Esto es lo que consulta getVerifiedSession en cada peticion.
    const usuario = await prisma.user.findUnique({
      where: { id: otro.id },
      select: { memberships: { select: { orgId: true } } },
    });
    expect(usuario?.memberships).toHaveLength(0);

    // El OWNER sigue teniendo la suya.
    const ownerRow = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { memberships: { select: { orgId: true } } },
    });
    expect(ownerRow?.memberships).toHaveLength(1);
  });
});
