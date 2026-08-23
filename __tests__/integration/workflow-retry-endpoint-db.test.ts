/**
 * ENDPOINT DE REINTENTO, CONTRA POSTGRESQL REAL.
 *
 * POR QUE EXISTE
 * --------------
 * `reintentarEntregasFallidas()` estaba implementada pero no habia forma de
 * llamarla: ni endpoint, ni cron, ni boton. Una ejecucion PARTIAL se quedaba
 * asi para siempre. Registrar un fallo que nadie puede resolver es solo
 * documentar el problema.
 *
 * Lo unico simulado es la cookie de sesion, resuelta con AsyncLocalStorage para
 * que dos peticiones concurrentes puedan actuar como usuarios distintos. Todo
 * lo demas —transacciones, restricciones unicas, reclamaciones— es PostgreSQL.
 * Las llamadas al proveedor de correo se cuentan.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";

interface Identidad {
  userId: string;
  orgId: string | null;
}

const { identidad, llamadas, fallan } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AsyncLocalStorage } = require("node:async_hooks") as typeof import("node:async_hooks");
  return {
    identidad: new AsyncLocalStorage() as InstanceType<
      typeof import("node:async_hooks").AsyncLocalStorage<Identidad>
    >,
    llamadas: [] as string[],
    fallan: new Set<string>(),
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

vi.mock("../../src/lib/email", () => ({
  sendEmail: vi.fn(async ({ to }: { to: string }) => {
    llamadas.push(to);
    // Pequeña ventana real: sin ella dos peticiones "concurrentes" se
    // serializan solas y la prueba de carrera no probaria nada.
    await new Promise((r) => setTimeout(r, 25));
    if (fallan.has(to)) throw new Error(`rebote de ${to}`);
  }),
}));

import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import { triggerWorkflow, ENTREGA_WORKFLOW_COLGADA_MS } from "../../src/lib/workflow-engine";
import { POST as reintentar } from "../../src/app/api/workflow-logs/[id]/retry/route";

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
  llamadas.length = 0;
  fallan.clear();
  vi.clearAllMocks();
});

let seq = 0;
let ip = 0;

/** Cada peticion usa una IP distinta: el endpoint esta limitado por IP. */
function peticion() {
  ip++;
  return new NextRequest("http://localhost/api/workflow-logs/x/retry", {
    method: "POST",
    headers: { "x-forwarded-for": `198.51.100.${ip % 250}` },
  });
}

/** Organizacion con equipo, regla de aviso y una ejecucion PARCIAL. */
async function escenarioConFallos(cuantosFallan = 2) {
  seq++;
  const { org, owner } = await createOrg();

  const correos: string[] = [owner.email];
  for (let i = 0; i < 3; i++) {
    const email = `equipo${i}-${seq}-${Date.now()}@gestoria.test`;
    const u = await prisma.user.create({ data: { email, name: `Miembro ${i}` } });
    await prisma.membership.create({ data: { userId: u.id, orgId: org.id, role: "MANAGER" } });
    correos.push(email);
  }

  const expediente = await createCase(org.id, `EXP-2026-${8000 + seq}`);
  await prisma.workflowRule.create({
    data: {
      orgId: org.id,
      name: "Aviso al equipo",
      trigger: "CASE_STATUS_CHANGED",
      conditions: {},
      action: "SEND_EMAIL_TEAM",
      actionConfig: { subject: "Cambio en {{case.ref}}", body: "Novedades" },
      isActive: true,
    },
  });

  for (const c of correos.slice(0, cuantosFallan)) fallan.add(c);

  await triggerWorkflow({
    type: "CASE_STATUS_CHANGED",
    orgId: org.id,
    caseId: expediente.id,
    toStatus: "IN_PROGRESS",
    eventKey: `ev-${seq}`,
  });

  const log = await prisma.workflowLog.findFirstOrThrow({
    where: { caseId: expediente.id },
    orderBy: { createdAt: "desc" },
  });

  llamadas.length = 0;
  fallan.clear();

  return { org, owner, expediente, correos, log };
}

describe("4. Dos reintentos simultaneos: una sola entrega", () => {
  it("dos peticiones concurrentes producen UNA llamada por destinatario", async () => {
    const { org, owner, correos, log } = await escenarioConFallos(2);

    const [a, b] = await Promise.all([
      como(owner.id, org.id, () => reintentar(peticion(), { params: Promise.resolve({ id: log.id }) })),
      como(owner.id, org.id, () => reintentar(peticion(), { params: Promise.resolve({ id: log.id }) })),
    ]);

    // LO DECISIVO: el proveedor se llamo una vez por destinatario fallido.
    expect(llamadas.sort()).toEqual([correos[0], correos[1]].sort());
    expect(llamadas).toHaveLength(2);

    expect([a.status, b.status]).toEqual([200, 200]);

    const tras = await prisma.workflowDelivery.findMany({ where: { workflowLogId: log.id } });
    expect(tras.every((d) => d.status === "SENT")).toBe(true);
  });
});

describe("5. Aislamiento entre organizaciones", () => {
  it("un usuario de otra organizacion recibe 404 y no dispara ningun envio", async () => {
    const { log } = await escenarioConFallos(2);
    const otra = await createOrg();

    const res = await como(otra.owner.id, otra.org.id, () =>
      reintentar(peticion(), { params: Promise.resolve({ id: log.id }) }),
    );

    expect(res.status).toBe(404);
    expect(llamadas).toHaveLength(0);

    // Las entregas del log ajeno siguen intactas.
    const fallidas = await prisma.workflowDelivery.count({
      where: { workflowLogId: log.id, status: "FAILED" },
    });
    expect(fallidas).toBe(2);
  });

  it("el 404 no distingue 'no existe' de 'es de otra organizacion'", async () => {
    const otra = await createOrg();

    const inexistente = await como(otra.owner.id, otra.org.id, () =>
      reintentar(peticion(), { params: Promise.resolve({ id: "log-que-no-existe" }) }),
    );

    expect(inexistente.status).toBe(404);
    expect(await inexistente.json()).toEqual({ error: "Ejecución no encontrada" });
  });
});

describe("6. Permisos", () => {
  /** Añade un miembro con el rol indicado y devuelve su id. */
  async function miembro(orgId: string, role: "VIEWER" | "OPERATOR" | "MANAGER") {
    seq++;
    const u = await prisma.user.create({
      data: { email: `${role.toLowerCase()}-${seq}-${Date.now()}@ejemplo.test`, name: role },
    });
    await prisma.membership.create({ data: { userId: u.id, orgId, role } });
    return u.id;
  }

  it("VIEWER no puede reintentar", async () => {
    const { org, log } = await escenarioConFallos(2);
    const viewer = await miembro(org.id, "VIEWER");

    const res = await como(viewer, org.id, () => reintentar(peticion(), { params: Promise.resolve({ id: log.id }) }));

    expect(res.status).toBe(403);
    expect(llamadas).toHaveLength(0);
  });

  it("OPERATOR no puede reintentar", async () => {
    const { org, log } = await escenarioConFallos(2);
    const operator = await miembro(org.id, "OPERATOR");

    const res = await como(operator, org.id, () =>
      reintentar(peticion(), { params: Promise.resolve({ id: log.id }) }),
    );

    expect(res.status).toBe(403);
    expect(llamadas).toHaveLength(0);
  });

  it("MANAGER, que tiene workflow.manage, si puede", async () => {
    const { org, log, correos } = await escenarioConFallos(2);
    const manager = await miembro(org.id, "MANAGER");

    const res = await como(manager, org.id, () =>
      reintentar(peticion(), { params: Promise.resolve({ id: log.id }) }),
    );

    expect(res.status).toBe(200);
    expect(llamadas.sort()).toEqual([correos[0], correos[1]].sort());
  });

  it("sin sesion, 401", async () => {
    const { log } = await escenarioConFallos(2);
    const res = await reintentar(peticion(), { params: Promise.resolve({ id: log.id }) });
    expect(res.status).toBe(401);
    expect(llamadas).toHaveLength(0);
  });
});

describe("7 y 8. Solo los fallidos; los enviados no repiten", () => {
  it("reintenta unicamente los destinatarios FAILED", async () => {
    const { org, owner, correos, log } = await escenarioConFallos(2);

    const res = await como(owner.id, org.id, () =>
      reintentar(peticion(), { params: Promise.resolve({ id: log.id }) }),
    );
    const cuerpo = await res.json();

    expect(cuerpo.retried).toBe(2);
    expect(cuerpo.recovered).toBe(2);
    expect(cuerpo.status).toBe("SUCCESS");
    // Los otros dos, que ya estaban SENT, no reciben nada.
    expect(llamadas).toHaveLength(2);
    expect(llamadas).not.toContain(correos[2]);
    expect(llamadas).not.toContain(correos[3]);

    // Y el resultado se devuelve POR DESTINATARIO.
    expect(cuerpo.deliveries).toHaveLength(2);
    expect(cuerpo.deliveries.every((d: { ok: boolean }) => d.ok)).toBe(true);
  });

  it("si el reintento vuelve a fallar, el estado sigue siendo PARTIAL", async () => {
    const { org, owner, correos, log } = await escenarioConFallos(2);
    fallan.add(correos[0]);

    const res = await como(owner.id, org.id, () =>
      reintentar(peticion(), { params: Promise.resolve({ id: log.id }) }),
    );
    const cuerpo = await res.json();

    expect(cuerpo.recovered).toBe(1);
    expect(cuerpo.status).toBe("PARTIAL");
  });
});

describe("9. PROCESSING colgado se recupera desde el endpoint", () => {
  it("una reclamacion abandonada se reintenta", async () => {
    const { org, owner, correos, log } = await escenarioConFallos(1);

    // El proceso murio con la entrega reclamada.
    await prisma.workflowDelivery.updateMany({
      where: { workflowLogId: log.id, recipient: correos[0] },
      data: {
        status: "PROCESSING",
        error: null,
        lastTriedAt: new Date(Date.now() - ENTREGA_WORKFLOW_COLGADA_MS - 60_000),
      },
    });

    const res = await como(owner.id, org.id, () =>
      reintentar(peticion(), { params: Promise.resolve({ id: log.id }) }),
    );
    const cuerpo = await res.json();

    expect(res.status).toBe(200);
    expect(cuerpo.retried).toBe(1);
    expect(llamadas).toEqual([correos[0]]);
  });
});

describe("El contenido no viene del cliente", () => {
  it("el cuerpo de la peticion se ignora: no es un rele de correo", async () => {
    const { org, owner, correos, log } = await escenarioConFallos(1);

    const maliciosa = new NextRequest("http://localhost/api/workflow-logs/x/retry", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({
        recipients: ["victima@ajena.test"],
        subject: "Factura urgente",
        body: "Transfiera a esta cuenta",
      }),
    });

    const res = await como(owner.id, org.id, () => reintentar(maliciosa, { params: Promise.resolve({ id: log.id }) }));

    expect(res.status).toBe(200);
    // Solo el destinatario real de la ejecucion; nada de lo enviado por el cliente.
    expect(llamadas).toEqual([correos[0]]);
    expect(llamadas).not.toContain("victima@ajena.test");
  });
});

describe("Auditoria", () => {
  it("el reintento queda registrado", async () => {
    const { org, owner, log } = await escenarioConFallos(2);

    await como(owner.id, org.id, () => reintentar(peticion(), { params: Promise.resolve({ id: log.id }) }));

    const entrada = await prisma.auditLog.findFirst({
      where: { orgId: org.id, action: "workflow.retry" },
    });
    expect(entrada).not.toBeNull();
    expect(entrada!.details).toContain("2 de 2");
  });
});
