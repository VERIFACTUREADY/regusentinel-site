/**
 * RESERVA ANTES DEL ENVÍO, CONTRA POSTGRESQL REAL.
 *
 * QUE FALLA SIN LA CORRECCION
 * ---------------------------
 * `SEND_EMAIL_TEAM` enviaba los correos y DESPUES creaba `WorkflowLog` y
 * `WorkflowDelivery`. Eso no es idempotencia:
 *
 *   - dos ejecuciones simultaneas del mismo evento llamaban las dos al
 *     proveedor, porque no habia nada escrito que la segunda pudiera ver;
 *   - si el proceso moria despues de llamar al proveedor y antes de escribir en
 *     PostgreSQL, el correo quedaba enviado SIN REGISTRO: invisible, y
 *     reenviado en el siguiente intento.
 *
 * ESTAS PRUEBAS NO MIRAN SOLO LAS FILAS.
 * Cuentan las llamadas al proveedor de correo y exigen exactamente una. Una
 * prueba que solo comprobara `WorkflowDelivery` daria por bueno el diseño
 * antiguo: alli tambien acababa habiendo una fila por destinatario.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

/** Proveedor de correo controlado: cuenta CADA llamada. */
const { llamadas, fallan, bloquear } = vi.hoisted(() => ({
  llamadas: [] as string[],
  fallan: new Set<string>(),
  bloquear: { activo: false, resolver: null as null | (() => void) },
}));

vi.mock("../../src/lib/email", () => ({
  sendEmail: vi.fn(async ({ to }: { to: string }) => {
    llamadas.push(to);
    if (bloquear.activo) {
      await new Promise<void>((r) => {
        bloquear.resolver = r;
      });
    }
    if (fallan.has(to)) throw new Error(`rebote de ${to}`);
  }),
}));

import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import {
  triggerWorkflow,
  reintentarEntregasFallidas,
  reclamarEntrega,
  recalcularEstadoLog,
  claveEjecucion,
  ENTREGA_WORKFLOW_COLGADA_MS,
} from "../../src/lib/workflow-engine";

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
  bloquear.activo = false;
  bloquear.resolver = null;
  vi.clearAllMocks();
});

let seq = 0;

/** Organizacion con `cuantos` destinatarios internos y una regla de aviso. */
async function escenario(cuantos = 3) {
  seq++;
  const { org, owner } = await createOrg();

  const correos: string[] = [owner.email];
  for (let i = 0; i < cuantos - 1; i++) {
    const email = `equipo${i}-${seq}-${Date.now()}@gestoria.test`;
    const u = await prisma.user.create({ data: { email, name: `Miembro ${i}` } });
    await prisma.membership.create({ data: { userId: u.id, orgId: org.id, role: "MANAGER" } });
    correos.push(email);
  }

  const expediente = await createCase(org.id, `EXP-2026-${String(5000 + seq)}`);

  const regla = await prisma.workflowRule.create({
    data: {
      orgId: org.id,
      name: "Aviso al equipo",
      trigger: "CASE_STATUS_CHANGED",
      conditions: {},
      action: "SEND_EMAIL_TEAM",
      actionConfig: { subject: "Cambio de estado", body: "El expediente {{case.ref}} ha cambiado" },
      isActive: true,
    },
  });

  return { org, expediente, regla, correos };
}

/** Evento con identidad estable: dos disparos son el MISMO hecho. */
function evento(orgId: string, caseId: string, eventKey = "transicion-1") {
  return {
    type: "CASE_STATUS_CHANGED" as const,
    orgId,
    caseId,
    toStatus: "IN_PROGRESS" as const,
    eventKey,
  };
}

async function logDe(caseId: string) {
  return prisma.workflowLog.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    include: { deliveries: { orderBy: { recipient: "asc" } } },
  });
}

describe("1. Dos triggerWorkflow simultaneos: UNA llamada por destinatario", () => {
  it("tres destinatarios, dos disparos concurrentes -> tres llamadas, no seis", async () => {
    const { org, expediente, correos } = await escenario(3);

    await Promise.all([
      triggerWorkflow(evento(org.id, expediente.id)),
      triggerWorkflow(evento(org.id, expediente.id)),
    ]);

    // LO DECISIVO: el proveedor se llamo una vez por destinatario.
    expect(llamadas.sort()).toEqual([...correos].sort());
    expect(llamadas).toHaveLength(3);

    // Y una sola ejecucion registrada, con una entrega por destinatario.
    const logs = await prisma.workflowLog.findMany({ where: { caseId: expediente.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].idempotencyKey).not.toBeNull();

    const log = await logDe(expediente.id);
    expect(log!.deliveries).toHaveLength(3);
    expect(log!.deliveries.every((d) => d.status === "SENT")).toBe(true);
    expect(log!.status).toBe("SUCCESS");
  });

  it("diez disparos concurrentes siguen produciendo una llamada por destinatario", async () => {
    const { org, expediente, correos } = await escenario(2);

    await Promise.all(
      Array.from({ length: 10 }, () => triggerWorkflow(evento(org.id, expediente.id))),
    );

    expect(llamadas.sort()).toEqual([...correos].sort());
    expect(await prisma.workflowLog.count({ where: { caseId: expediente.id } })).toBe(1);
  });

  it("la clave idempotente distingue organizacion, regla, expediente, evento y ventana", () => {
    const base = { type: "CASE_STATUS_CHANGED" as const, orgId: "org-1", caseId: "case-1" };
    const k = (o: Partial<typeof base> & { eventKey?: string }, rule = "rule-1") =>
      claveEjecucion({ ...base, ...o }, rule);

    expect(k({})).toBe(k({})); // estable
    expect(k({ orgId: "org-2" })).not.toBe(k({}));
    expect(k({}, "rule-2")).not.toBe(k({}));
    expect(k({ caseId: "case-2" })).not.toBe(k({}));
    expect(k({ eventKey: "otra-ventana" })).not.toBe(k({}));
  });

  it("la clave no contiene datos personales", () => {
    const clave = claveEjecucion(
      { type: "CASE_STATUS_CHANGED", orgId: "org-1", caseId: "case-1" },
      "rule-1",
    );
    // SHA-256 en hexadecimal: sin emails, sin nombres, sin contenido.
    expect(clave).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("2. Caida DESPUES de reservar y ANTES de enviar", () => {
  it("la entrega queda reclamada y el siguiente intento la recupera", async () => {
    const { org, expediente, correos } = await escenario(2);

    // Se simula el proceso que reservo y murio: la fila existe en PROCESSING.
    const log = await prisma.workflowLog.create({
      data: {
        ruleId: (await prisma.workflowRule.findFirstOrThrow({ where: { orgId: org.id } })).id,
        caseId: expediente.id,
        status: "PROCESSING",
        idempotencyKey: "clave-de-la-ejecucion-muerta",
        startedAt: new Date(Date.now() - ENTREGA_WORKFLOW_COLGADA_MS - 60_000),
      },
    });
    await prisma.workflowDelivery.create({
      data: {
        workflowLogId: log.id,
        recipient: correos[0],
        status: "PROCESSING",
        attempts: 1,
        lastTriedAt: new Date(Date.now() - ENTREGA_WORKFLOW_COLGADA_MS - 60_000),
      },
    });

    // Nadie envio nada todavia.
    expect(llamadas).toHaveLength(0);

    // El reintento recupera la reclamacion abandonada.
    const r = await reintentarEntregasFallidas(log.id);

    expect(r.reintentadas).toBe(1);
    expect(llamadas).toEqual([correos[0]]);

    const tras = await prisma.workflowDelivery.findFirstOrThrow({
      where: { workflowLogId: log.id, recipient: correos[0] },
    });
    expect(tras.status).toBe("SENT");
  });

  it("una reclamacion RECIENTE no se recupera: otro proceso puede estar enviando", async () => {
    const { org, expediente, correos } = await escenario(2);
    const regla = await prisma.workflowRule.findFirstOrThrow({ where: { orgId: org.id } });

    const log = await prisma.workflowLog.create({
      data: {
        ruleId: regla.id,
        caseId: expediente.id,
        status: "PROCESSING",
        idempotencyKey: "clave-en-curso",
        startedAt: new Date(),
      },
    });
    await prisma.workflowDelivery.create({
      data: {
        workflowLogId: log.id,
        recipient: correos[0],
        status: "PROCESSING",
        attempts: 1,
        lastTriedAt: new Date(),
      },
    });

    const r = await reintentarEntregasFallidas(log.id);

    expect(r.reintentadas).toBe(0);
    expect(llamadas).toHaveLength(0);
  });
});

describe("3. Caida DESPUES de enviar: no hay reenvio ciego", () => {
  it("un destinatario SENT no vuelve a recibir el mismo evento", async () => {
    const { org, expediente, correos } = await escenario(2);

    await triggerWorkflow(evento(org.id, expediente.id));
    expect(llamadas).toHaveLength(2);

    // El mismo hecho se vuelve a disparar (reintento del proceso, reenvio de
    // la cola, doble click…). La reserva ya esta escrita: nadie repite.
    llamadas.length = 0;
    await triggerWorkflow(evento(org.id, expediente.id));

    expect(llamadas).toHaveLength(0);
    expect(await prisma.workflowLog.count({ where: { caseId: expediente.id } })).toBe(1);
    expect(correos).toHaveLength(2);
  });

  it("reclamar una entrega ya SENT devuelve 'ya_enviada' y no permite enviar", async () => {
    const { org, expediente, correos } = await escenario(2);
    await triggerWorkflow(evento(org.id, expediente.id));

    const log = await logDe(expediente.id);
    expect(await reclamarEntrega(log!.id, correos[0])).toBe("ya_enviada");
  });
});

describe("7 y 8. Solo se reintentan los fallidos", () => {
  it("los ya enviados no reciben un segundo correo", async () => {
    const { org, expediente, correos } = await escenario(4);
    fallan.add(correos[1]);
    fallan.add(correos[3]);

    await triggerWorkflow(evento(org.id, expediente.id));
    expect(llamadas).toHaveLength(4);

    const log = await logDe(expediente.id);
    expect(log!.status).toBe("PARTIAL");

    // El proveedor se recupera y se reintenta.
    fallan.clear();
    llamadas.length = 0;
    const r = await reintentarEntregasFallidas(log!.id);

    // SOLO los dos que fallaron.
    expect(llamadas.sort()).toEqual([correos[1], correos[3]].sort());
    expect(r.recuperadas).toBe(2);

    const tras = await logDe(expediente.id);
    expect(tras!.status).toBe("SUCCESS");
    expect(tras!.deliveries.every((d) => d.status === "SENT")).toBe(true);
  });

  it("un reintento sobre una ejecucion sin fallos no llama al proveedor", async () => {
    const { org, expediente } = await escenario(2);
    await triggerWorkflow(evento(org.id, expediente.id));

    const log = await logDe(expediente.id);
    llamadas.length = 0;

    const r = await reintentarEntregasFallidas(log!.id);

    expect(r.reintentadas).toBe(0);
    expect(llamadas).toHaveLength(0);
  });
});

describe("9. PROCESSING colgado se recupera", () => {
  it("se puede reclamar de nuevo pasado el plazo", async () => {
    const { org, expediente, correos } = await escenario(2);
    await triggerWorkflow(evento(org.id, expediente.id));
    const log = await logDe(expediente.id);

    // Se fuerza una entrega a PROCESSING antigua.
    await prisma.workflowDelivery.updateMany({
      where: { workflowLogId: log!.id, recipient: correos[0] },
      data: {
        status: "PROCESSING",
        sentAt: null,
        lastTriedAt: new Date(Date.now() - ENTREGA_WORKFLOW_COLGADA_MS - 60_000),
      },
    });

    expect(await reclamarEntrega(log!.id, correos[0])).toBe("reclamada");
  });

  it("una PROCESSING reciente NO se puede reclamar", async () => {
    const { org, expediente, correos } = await escenario(2);
    await triggerWorkflow(evento(org.id, expediente.id));
    const log = await logDe(expediente.id);

    await prisma.workflowDelivery.updateMany({
      where: { workflowLogId: log!.id, recipient: correos[0] },
      data: { status: "PROCESSING", sentAt: null, lastTriedAt: new Date() },
    });

    expect(await reclamarEntrega(log!.id, correos[0])).toBe("en_curso");
  });
});

describe("10. Estado agregado recalculado", () => {
  it("refleja el estado real de las entregas", async () => {
    const { org, expediente, correos } = await escenario(3);
    for (const c of correos) fallan.add(c);

    await triggerWorkflow(evento(org.id, expediente.id));
    const log = await logDe(expediente.id);
    expect(log!.status).toBe("FAILED");

    await prisma.workflowDelivery.updateMany({
      where: { workflowLogId: log!.id, recipient: correos[0] },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
    expect(await recalcularEstadoLog(log!.id)).toBe("PARTIAL");

    await prisma.workflowDelivery.updateMany({
      where: { workflowLogId: log!.id },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
    expect(await recalcularEstadoLog(log!.id)).toBe("SUCCESS");
  });

  it("una entrega en PROCESSING cuenta como pendiente, no como exito", async () => {
    const { org, expediente, correos } = await escenario(2);
    await triggerWorkflow(evento(org.id, expediente.id));
    const log = await logDe(expediente.id);

    await prisma.workflowDelivery.updateMany({
      where: { workflowLogId: log!.id, recipient: correos[0] },
      data: { status: "PROCESSING", sentAt: null },
    });

    expect(await recalcularEstadoLog(log!.id)).toBe("PARTIAL");
  });
});

describe("Otras acciones tambien quedan protegidas", () => {
  it("SEND_EMAIL_CONTACT deja entrega y no duplica el aviso a la familia", async () => {
    seq++;
    const { org } = await createOrg();
    const expediente = await prisma.case.create({
      data: {
        orgId: org.id,
        ref: `EXP-2026-${6000 + seq}`,
        deceased: { create: { fullName: "Fallecido" } },
        contact: { create: { fullName: "Contacto", email: `familia-${seq}@ejemplo.test` } },
      },
    });
    await prisma.workflowRule.create({
      data: {
        orgId: org.id,
        name: "Aviso a la familia",
        trigger: "CASE_STATUS_CHANGED",
        conditions: {},
        action: "SEND_EMAIL_CONTACT",
        actionConfig: { subject: "Su expediente", body: "Novedades" },
        isActive: true,
      },
    });

    await Promise.all([
      triggerWorkflow(evento(org.id, expediente.id)),
      triggerWorkflow(evento(org.id, expediente.id)),
    ]);

    // Antes esta accion enviaba directamente y no dejaba ninguna entrega: un
    // aviso duplicado a la familia era invisible e irreintentable.
    expect(llamadas).toEqual([`familia-${seq}@ejemplo.test`]);

    const log = await logDe(expediente.id);
    expect(log!.deliveries).toHaveLength(1);
    expect(log!.deliveries[0].status).toBe("SENT");
  });

  it("CHANGE_CASE_STATUS solo se aplica una vez con disparos concurrentes", async () => {
    seq++;
    const { org } = await createOrg();
    const expediente = await createCase(org.id, `EXP-2026-${7000 + seq}`);
    await prisma.workflowRule.create({
      data: {
        orgId: org.id,
        name: "Cerrar",
        trigger: "CASE_STATUS_CHANGED",
        conditions: {},
        action: "CHANGE_CASE_STATUS",
        actionConfig: { newStatus: "CLOSED" },
        isActive: true,
      },
    });

    await Promise.all([
      triggerWorkflow(evento(org.id, expediente.id)),
      triggerWorkflow(evento(org.id, expediente.id)),
    ]);

    expect(await prisma.workflowLog.count({ where: { caseId: expediente.id } })).toBe(1);
    const tras = await prisma.case.findUniqueOrThrow({ where: { id: expediente.id } });
    expect(tras.status).toBe("CLOSED");
  });
});
