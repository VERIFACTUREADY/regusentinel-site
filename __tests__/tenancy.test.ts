/**
 * Aislamiento multi-tenant: validacion de los identificadores que llegan del
 * cliente.
 *
 * UNIT/SERVICE TESTS con un cliente Prisma simulado. La verificacion contra
 * PostgreSQL real (constraints, concurrencia) esta en
 * __tests__/integration/tenancy-db.test.ts.
 *
 * Todas fallan con la implementacion anterior, donde los ids se usaban tal
 * cual: `manualTaskId` sin comprobar propiedad, `assigneeId` sin comprobar
 * membresia y `dependsOnId` sin comprobar expediente, ciclo ni auto-referencia.
 */
import { describe, it, expect, vi } from "vitest";
import {
  findTaskInCase,
  findActiveMember,
  validateTaskDependency,
  nextCaseRef,
  caseRefFor,
} from "../src/lib/tenancy";

/**
 * Cliente Prisma simulado sobre datos en memoria. Reproduce el filtrado de
 * `where` que hacen los helpers, que es justo lo que queremos comprobar: que
 * la pertenencia se resuelve EN la consulta y no leyendo y comparando despues.
 */
function fakeDb(data: {
  tasks?: Array<{ id: string; caseId: string; orgId: string; dependsOnId?: string | null; deletedAt?: Date | null }>;
  memberships?: Array<{ userId: string; orgId: string; role: string }>;
  cases?: Array<{ id: string; orgId: string; ref: string }>;
}) {
  const tasks = data.tasks ?? [];
  const memberships = data.memberships ?? [];
  const cases = data.cases ?? [];

  return {
    task: {
      findFirst: vi.fn(async ({ where, select }: any) => {
        const found = tasks.find((t) => {
          if (where.id && t.id !== where.id) return false;
          if (where.caseId && t.caseId !== where.caseId) return false;
          if (where.case?.orgId && t.orgId !== where.case.orgId) return false;
          if (where.case?.deletedAt === null && t.deletedAt) return false;
          return true;
        });
        if (!found) return null;
        if (select?.dependsOnId) return { dependsOnId: found.dependsOnId ?? null };
        return { ...found, dependsOnId: found.dependsOnId ?? null };
      }),
    },
    membership: {
      findUnique: vi.fn(async ({ where }: any) => {
        const { userId, orgId } = where.userId_orgId;
        const m = memberships.find((x) => x.userId === userId && x.orgId === orgId);
        return m ? { id: `mem-${userId}`, ...m } : null;
      }),
    },
    case: {
      findFirst: vi.fn(async ({ where }: any) => {
        const matching = cases
          .filter((c) => c.orgId === where.orgId)
          .filter((c) => !where.ref?.startsWith || c.ref.startsWith(where.ref.startsWith))
          .sort((a, b) => b.ref.localeCompare(a.ref));
        return matching[0] ?? null;
      }),
    },
  } as any;
}

describe("Pertenencia de tareas", () => {
  const db = fakeDb({
    tasks: [
      { id: "t-propia", caseId: "case-1", orgId: "org-1" },
      { id: "t-otro-caso", caseId: "case-2", orgId: "org-1" },
      { id: "t-otro-tenant", caseId: "case-9", orgId: "org-9" },
    ],
  });

  it("encuentra la tarea del expediente y organizacion correctos", async () => {
    expect(await findTaskInCase("t-propia", "case-1", "org-1", db)).toBeTruthy();
  });

  it("NO devuelve una tarea de otra organizacion", async () => {
    // Este era el vector: subir un documento con el taskId de otro tenant
    // marcaba esa tarea ajena como READY.
    expect(await findTaskInCase("t-otro-tenant", "case-9", "org-1", db)).toBeNull();
  });

  it("NO devuelve una tarea de otro expediente aunque sea del mismo tenant", async () => {
    expect(await findTaskInCase("t-otro-caso", "case-1", "org-1", db)).toBeNull();
  });

  it("rechaza identificadores vacios sin consultar", async () => {
    expect(await findTaskInCase("", "case-1", "org-1", db)).toBeNull();
    expect(await findTaskInCase("t-propia", "case-1", "", db)).toBeNull();
  });
});

describe("Pertenencia de miembros (assigneeId)", () => {
  const db = fakeDb({
    memberships: [
      { userId: "u-interno", orgId: "org-1", role: "OPERATOR" },
      { userId: "u-externo", orgId: "org-9", role: "OWNER" },
    ],
  });

  it("acepta a un miembro de la organizacion", async () => {
    expect(await findActiveMember("u-interno", "org-1", db)).toBeTruthy();
  });

  it("NO acepta a un usuario de otra organizacion", async () => {
    expect(await findActiveMember("u-externo", "org-1", db)).toBeNull();
  });

  it("NO acepta a un usuario expulsado (sin membresia)", async () => {
    expect(await findActiveMember("u-expulsado", "org-1", db)).toBeNull();
  });
});

describe("Dependencias entre tareas", () => {
  it("rechaza que una tarea dependa de si misma", async () => {
    const db = fakeDb({ tasks: [{ id: "t1", caseId: "case-1", orgId: "org-1" }] });
    const r = await validateTaskDependency("t1", "t1", "case-1", "org-1", db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("self_dependency");
  });

  it("rechaza depender de una tarea de otro expediente", async () => {
    const db = fakeDb({
      tasks: [
        { id: "t1", caseId: "case-1", orgId: "org-1" },
        { id: "t-otro", caseId: "case-2", orgId: "org-1" },
      ],
    });
    const r = await validateTaskDependency("t1", "t-otro", "case-1", "org-1", db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");
  });

  it("rechaza depender de una tarea de otro tenant", async () => {
    const db = fakeDb({
      tasks: [
        { id: "t1", caseId: "case-1", orgId: "org-1" },
        { id: "t-ajena", caseId: "case-1", orgId: "org-9" },
      ],
    });
    const r = await validateTaskDependency("t1", "t-ajena", "case-1", "org-1", db);
    expect(r.ok).toBe(false);
  });

  it("acepta una dependencia valida del mismo expediente", async () => {
    const db = fakeDb({
      tasks: [
        { id: "t1", caseId: "case-1", orgId: "org-1" },
        { id: "t2", caseId: "case-1", orgId: "org-1", dependsOnId: null },
      ],
    });
    const r = await validateTaskDependency("t1", "t2", "case-1", "org-1", db);
    expect(r.ok).toBe(true);
  });

  it("detecta un ciclo directo (A depende de B, B ya depende de A)", async () => {
    const db = fakeDb({
      tasks: [
        { id: "A", caseId: "case-1", orgId: "org-1" },
        { id: "B", caseId: "case-1", orgId: "org-1", dependsOnId: "A" },
      ],
    });
    const r = await validateTaskDependency("A", "B", "case-1", "org-1", db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cycle");
  });

  it("detecta un ciclo indirecto A -> B -> C -> A", async () => {
    const db = fakeDb({
      tasks: [
        { id: "A", caseId: "case-1", orgId: "org-1" },
        { id: "B", caseId: "case-1", orgId: "org-1", dependsOnId: "A" },
        { id: "C", caseId: "case-1", orgId: "org-1", dependsOnId: "B" },
      ],
    });
    // A pasaria a depender de C, cerrando A -> C -> B -> A.
    const r = await validateTaskDependency("A", "C", "case-1", "org-1", db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cycle");
  });

  it("no cuelga si la cadena ya es circular entre terceras tareas", async () => {
    const db = fakeDb({
      tasks: [
        { id: "X", caseId: "case-1", orgId: "org-1" },
        { id: "B", caseId: "case-1", orgId: "org-1", dependsOnId: "C" },
        { id: "C", caseId: "case-1", orgId: "org-1", dependsOnId: "B" },
      ],
    });
    const r = await validateTaskDependency("X", "B", "case-1", "org-1", db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cycle");
  });
});

describe("Referencia de expediente", () => {
  it("formatea con cuatro digitos", () => {
    expect(caseRefFor(2026, 1)).toBe("EXP-2026-0001");
    expect(caseRefFor(2026, 42)).toBe("EXP-2026-0042");
    expect(caseRefFor(2026, 1234)).toBe("EXP-2026-1234");
  });

  it("empieza en 0001 cuando la organizacion no tiene expedientes del anyo", async () => {
    const db = fakeDb({ cases: [] });
    expect(await nextCaseRef("org-1", db, new Date("2026-03-01"))).toBe("EXP-2026-0001");
  });

  it("continua desde el maximo existente, no desde el recuento", async () => {
    // Con `count + 1` esto habria devuelto EXP-2026-0003 y chocado con la 0007.
    const db = fakeDb({
      cases: [
        { id: "c1", orgId: "org-1", ref: "EXP-2026-0001" },
        { id: "c2", orgId: "org-1", ref: "EXP-2026-0007" },
      ],
    });
    expect(await nextCaseRef("org-1", db, new Date("2026-03-01"))).toBe("EXP-2026-0008");
  });

  it("no mezcla expedientes de otras organizaciones", async () => {
    const db = fakeDb({
      cases: [{ id: "c9", orgId: "org-9", ref: "EXP-2026-0055" }],
    });
    expect(await nextCaseRef("org-1", db, new Date("2026-03-01"))).toBe("EXP-2026-0001");
  });
});
