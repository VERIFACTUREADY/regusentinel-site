/**
 * ENTREGAS DE WORKFLOW POR DESTINATARIO, CONTRA POSTGRESQL REAL.
 *
 * QUE FALLA SIN LA CORRECCION
 * ---------------------------
 * `SEND_EMAIL_TEAM` se registraba como SUCCESS si al menos UN destinatario
 * recibia el correo. Con diez destinatarios y nueve fallos, la ejecucion
 * figuraba como correcta: los nueve fallos quedaban invisibles y no habia forma
 * de reintentarlos, porque reintentar la regla entera habria duplicado el envio
 * al unico que si lo recibio.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

/** Correo controlado: se decide que direcciones fallan. */
const { fallan, enviados } = vi.hoisted(() => ({
  fallan: new Set<string>(),
  enviados: [] as string[],
}));

vi.mock("../../src/lib/email", () => ({
  sendEmail: vi.fn(async ({ to }: { to: string }) => {
    if (fallan.has(to)) throw new Error(`rebote de ${to}`);
    enviados.push(to);
  }),
}));

import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import {
  triggerWorkflow,
  reintentarEntregasFallidas,
  recalcularEstadoLog,
} from "../../src/lib/workflow-engine";
import { sendEmail } from "../../src/lib/email";

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  fallan.clear();
  enviados.length = 0;
  vi.clearAllMocks();
});

let seq = 0;

/** Organizacion con `cuantos` destinatarios internos y una regla de aviso. */
async function escenario(cuantos: number) {
  seq++;
  // `createOrg` ya crea un OWNER, que tambien es destinatario interno.
  const { org, owner } = await createOrg();

  const correos: string[] = [owner.email];
  for (let i = 0; i < cuantos - 1; i++) {
    const email = `equipo${i}-${seq}-${Date.now()}@gestoria.test`;
    const u = await prisma.user.create({ data: { email, name: `Miembro ${i}` } });
    await prisma.membership.create({ data: { userId: u.id, orgId: org.id, role: "MANAGER" } });
    correos.push(email);
  }

  const expediente = await createCase(org.id, `EXP-2026-${String(seq).padStart(4, "0")}`);

  const regla = await prisma.workflowRule.create({
    data: {
      orgId: org.id,
      name: "Aviso al equipo",
      trigger: "CASE_STATUS_CHANGED",
      conditions: {},
      action: "SEND_EMAIL_TEAM",
      actionConfig: { subject: "Cambio de estado", body: "El expediente ha cambiado" },
      isActive: true,
    },
  });

  return { org, expediente, regla, correos };
}

async function disparar(orgId: string, caseId: string) {
  await triggerWorkflow({
    type: "CASE_STATUS_CHANGED",
    orgId,
    caseId,
    toStatus: "IN_PROGRESS",
  });

  return prisma.workflowLog.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    include: { deliveries: { orderBy: { recipient: "asc" } } },
  });
}

describe("Estado agregado a partir de las entregas", () => {
  it("todos enviados -> SUCCESS", async () => {
    const { org, expediente, correos } = await escenario(4);

    const log = await disparar(org.id, expediente.id);

    expect(log!.status).toBe("SUCCESS");
    expect(log!.error).toBeNull();
    expect(log!.deliveries).toHaveLength(4);
    expect(log!.deliveries.every((d) => d.status === "SENT")).toBe(true);
    expect(enviados.sort()).toEqual([...correos].sort());
  });

  it("algunos enviados -> PARTIAL (antes se registraba SUCCESS)", async () => {
    const { org, expediente, correos } = await escenario(5);
    // Fallan cuatro de cinco. Con la implementacion anterior bastaba con que
    // uno funcionara para registrar la ejecucion como exitosa.
    for (const c of correos.slice(1)) fallan.add(c);

    const log = await disparar(org.id, expediente.id);

    expect(log!.status).toBe("PARTIAL");
    expect(log!.error).toMatch(/4 de 5 destinatario/);

    const entregadas = log!.deliveries.filter((d) => d.status === "SENT");
    const fallidas = log!.deliveries.filter((d) => d.status === "FAILED");
    expect(entregadas).toHaveLength(1);
    expect(fallidas).toHaveLength(4);
    // Cada fallo queda identificado por destinatario y con su motivo.
    expect(fallidas.every((d) => (d.error ?? "").includes("rebote"))).toBe(true);
    expect(fallidas.map((d) => d.recipient).sort()).toEqual([...correos.slice(1)].sort());
  });

  it("ninguno enviado -> FAILED", async () => {
    const { org, expediente, correos } = await escenario(3);
    for (const c of correos) fallan.add(c);

    const log = await disparar(org.id, expediente.id);

    expect(log!.status).toBe("FAILED");
    expect(log!.deliveries.every((d) => d.status === "FAILED")).toBe(true);
  });
});

describe("Reintento SOLO de los destinatarios fallidos", () => {
  it("no reenvia a quien ya lo recibio y el estado pasa a SUCCESS", async () => {
    const { org, expediente, correos } = await escenario(4);
    fallan.add(correos[1]);
    fallan.add(correos[3]);

    const log = await disparar(org.id, expediente.id);
    expect(log!.status).toBe("PARTIAL");

    // El proveedor se recupera.
    fallan.clear();
    enviados.length = 0;
    vi.clearAllMocks();

    const r = await reintentarEntregasFallidas(log!.id);

    expect(r.reintentadas).toBe(2);
    expect(r.recuperadas).toBe(2);
    expect(r.estado).toBe("SUCCESS");

    // SOLO los dos fallidos. Los otros dos no reciben un segundo correo.
    expect(enviados.sort()).toEqual([correos[1], correos[3]].sort());

    const tras = await prisma.workflowLog.findUnique({
      where: { id: log!.id },
      include: { deliveries: true },
    });
    expect(tras!.status).toBe("SUCCESS");
    expect(tras!.error).toBeNull();
    expect(tras!.deliveries.every((d) => d.status === "SENT")).toBe(true);
    // El contador refleja los dos intentos de los que fallaron.
    const reintentada = tras!.deliveries.find((d) => d.recipient === correos[1])!;
    expect(reintentada.attempts).toBe(2);
    expect(reintentada.sentAt).not.toBeNull();
  });

  it("si el reintento vuelve a fallar, sigue en FAILED con el intento contado", async () => {
    const { org, expediente, correos } = await escenario(3);
    fallan.add(correos[2]);

    const log = await disparar(org.id, expediente.id);
    expect(log!.status).toBe("PARTIAL");

    enviados.length = 0;
    const r = await reintentarEntregasFallidas(log!.id);

    expect(r.recuperadas).toBe(0);
    expect(r.estado).toBe("PARTIAL");

    const entrega = await prisma.workflowDelivery.findFirst({
      where: { workflowLogId: log!.id, recipient: correos[2] },
    });
    expect(entrega!.status).toBe("FAILED");
    expect(entrega!.attempts).toBe(2);
  });

  it("un reintento sobre una ejecucion sin fallos no envia nada", async () => {
    const { org, expediente } = await escenario(2);
    const log = await disparar(org.id, expediente.id);
    expect(log!.status).toBe("SUCCESS");

    enviados.length = 0;
    const r = await reintentarEntregasFallidas(log!.id);

    expect(r.reintentadas).toBe(0);
    expect(enviados).toEqual([]);
  });

  it("recalcularEstadoLog refleja el estado real de las entregas", async () => {
    const { org, expediente, correos } = await escenario(3);
    for (const c of correos) fallan.add(c);

    const log = await disparar(org.id, expediente.id);
    expect(log!.status).toBe("FAILED");

    // Se marca una a mano como entregada: el agregado debe pasar a PARTIAL.
    await prisma.workflowDelivery.updateMany({
      where: { workflowLogId: log!.id, recipient: correos[0] },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });

    expect(await recalcularEstadoLog(log!.id)).toBe("PARTIAL");
  });
});
