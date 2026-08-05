/**
 * Pruebas de INTEGRACION contra PostgreSQL real.
 *
 * Comprueban lo que un mock no puede: que la restriccion unica existe de
 * verdad, que la transaccion aisla, y que dos altas simultaneas no producen la
 * misma referencia de expediente.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import { nextCaseRef, validateTaskDependency } from "../../src/lib/tenancy";

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

/**
 * PENDIENTES MENORES DE LA AUDITORIA.
 *
 *   1. `validateTaskDependency` daba por VALIDA una cadena que no habia podido
 *      recorrer entera: el unico caso en el que la comprobacion no concluia era
 *      justamente el que se aceptaba.
 *   2. La siguiente referencia se deducia de `ORDER BY ref DESC`, es decir de
 *      comparar CADENAS. Superados los 9.999 expedientes de un año,
 *      `EXP-2026-10000` es lexicograficamente MENOR que `EXP-2026-9999`.
 */
describe("Contador numerico de referencias", () => {
  it("supera los 9.999 expedientes sin repetir referencia", async () => {
    const { org } = await createOrg();

    // Se coloca el contador justo antes del salto de cuatro a cinco digitos.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CaseCounter" ("orgId","year","lastNumber") VALUES ($1, $2, 9998)`,
      org.id,
      new Date().getFullYear(),
    );

    const refs: string[] = [];
    for (let i = 0; i < 4; i++) {
      const ref = await prisma.$transaction((tx) => nextCaseRef(org.id, tx));
      refs.push(ref);
      await createCase(org.id, ref);
    }

    const anio = new Date().getFullYear();
    expect(refs).toEqual([
      `EXP-${anio}-9999`,
      `EXP-${anio}-10000`,
      `EXP-${anio}-10001`,
      `EXP-${anio}-10002`,
    ]);
    // Ninguna repetida: con el orden lexicografico, tras 10000 el maximo leido
    // habria vuelto a ser 9999 y la siguiente referencia habria chocado.
    expect(new Set(refs).size).toBe(4);
  });

  it("veinte altas simultaneas obtienen veinte numeros distintos", async () => {
    const { org } = await createOrg();

    const refs = await Promise.all(
      Array.from({ length: 20 }, () => prisma.$transaction((tx) => nextCaseRef(org.id, tx))),
    );

    expect(new Set(refs).size).toBe(20);
  });

  it("el contador es independiente por organizacion", async () => {
    const a = await createOrg();
    const b = await createOrg();

    const refA = await prisma.$transaction((tx) => nextCaseRef(a.org.id, tx));
    const refB = await prisma.$transaction((tx) => nextCaseRef(b.org.id, tx));

    expect(refA).toBe(refB); // ambas empiezan por 0001
    await createCase(a.org.id, refA);
    await createCase(b.org.id, refB);
  });

  it("no reutiliza una referencia despues de borrar el ultimo expediente", async () => {
    const { org } = await createOrg();

    const primera = await prisma.$transaction((tx) => nextCaseRef(org.id, tx));
    const caso = await createCase(org.id, primera);
    await prisma.case.delete({ where: { id: caso.id } });

    const segunda = await prisma.$transaction((tx) => nextCaseRef(org.id, tx));

    // Con el maximo leido de la tabla `Case`, borrar el ultimo expediente hacia
    // que la siguiente alta reutilizara su referencia — y con ella su rastro en
    // auditoria y en las comunicaciones ya enviadas a la familia.
    expect(segunda).not.toBe(primera);
  });
});

describe("Profundidad de la cadena de dependencias", () => {
  /** Crea `n` tareas encadenadas: t0 <- t1 <- ... <- t(n-1). */
  async function cadena(caseId: string, n: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = await prisma.task.create({
        data: {
          caseId,
          category: "BANCOS",
          title: `Tarea ${i}`,
          ...(i > 0 ? { dependsOnId: ids[i - 1] } : {}),
        },
      });
      ids.push(t.id);
    }
    return ids;
  }

  it("una cadena mas larga que el maximo se RECHAZA en vez de darse por valida", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-6001");

    const ids = await cadena(caso.id, 70);
    const nueva = await prisma.task.create({
      data: { caseId: caso.id, category: "BANCOS", title: "Nueva" },
    });

    const r = await validateTaskDependency(nueva.id, ids[69], caso.id, org.id);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_deep");
  });

  it("una cadena dentro del maximo se acepta", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-6002");

    const ids = await cadena(caso.id, 10);
    const nueva = await prisma.task.create({
      data: { caseId: caso.id, category: "BANCOS", title: "Nueva" },
    });

    expect((await validateTaskDependency(nueva.id, ids[9], caso.id, org.id)).ok).toBe(true);
  });

  it("un ciclo directo se rechaza", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-6003");

    const [a, b] = await cadena(caso.id, 2);
    // b depende de a; intentar que a dependa de b cierra el ciclo.
    const r = await validateTaskDependency(a, b, caso.id, org.id);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cycle");
  });

  it("un ciclo entre terceras tareas se detecta y no bloquea el recorrido", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-6004");

    const [a, b, c] = await cadena(caso.id, 3);
    // Se cierra el ciclo a -> c por la base de datos.
    await prisma.task.update({ where: { id: a }, data: { dependsOnId: c } });

    const nueva = await prisma.task.create({
      data: { caseId: caso.id, category: "BANCOS", title: "Nueva" },
    });

    const r = await validateTaskDependency(nueva.id, c, caso.id, org.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cycle");
    expect(b).toBeTruthy();
  });
});
