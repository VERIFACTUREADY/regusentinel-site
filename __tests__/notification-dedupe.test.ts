/**
 * Deduplicacion de notificaciones POR ENTREGA.
 *
 * Antes se comprobaba (caseId, kind, status='sent'): si el email llegaba a un
 * destinatario y fallaba en otro, la siguiente ejecucion saltaba el expediente
 * entero y el segundo no lo recibia nunca; ademas un email enviado bloqueaba
 * tambien Slack, Teams y el webhook.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma", () => ({
  prisma: { notificationLog: { findUnique: vi.fn(), create: vi.fn() } },
}));

import { prisma } from "../src/lib/prisma";
import {
  dedupeKeyFor,
  isoWeekWindow,
  alreadyDelivered,
  recordDelivery,
  recordFailure,
} from "../src/lib/notification-dedupe";

const findUnique = prisma.notificationLog.findUnique as unknown as ReturnType<typeof vi.fn>;
const create = prisma.notificationLog.create as unknown as ReturnType<typeof vi.fn>;

const base = {
  orgId: "org-1",
  caseId: "case-1",
  kind: "ISD_30D" as const,
  channel: "EMAIL_INTERNAL" as const,
  recipient: "ana@gestoria.es",
};

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(null);
  create.mockResolvedValue({});
});

describe("Composicion de la clave", () => {
  it("distingue destinatarios distintos del mismo aviso", () => {
    const a = dedupeKeyFor({ ...base, recipient: "ana@x.es" });
    const b = dedupeKeyFor({ ...base, recipient: "luis@x.es" });
    expect(a).not.toBe(b);
  });

  it("distingue canales distintos del mismo aviso", () => {
    const email = dedupeKeyFor(base);
    const slack = dedupeKeyFor({ ...base, channel: "SLACK" });
    expect(email).not.toBe(slack);
  });

  it("distingue tipos de aviso distintos", () => {
    expect(dedupeKeyFor(base)).not.toBe(dedupeKeyFor({ ...base, kind: "ISD_7D" }));
  });

  it("distingue expedientes distintos", () => {
    expect(dedupeKeyFor(base)).not.toBe(dedupeKeyFor({ ...base, caseId: "case-2" }));
  });

  it("normaliza el destinatario a minusculas", () => {
    expect(dedupeKeyFor({ ...base, recipient: "Ana@Gestoria.ES" })).toBe(dedupeKeyFor(base));
  });

  it("la ventana separa periodos en los avisos recurrentes", () => {
    const s1 = dedupeKeyFor({ ...base, window: "2026-W31" });
    const s2 = dedupeKeyFor({ ...base, window: "2026-W32" });
    expect(s1).not.toBe(s2);
  });
});

describe("Ventana semanal ISO", () => {
  it("dos dias de la misma semana caen en la misma ventana", () => {
    expect(isoWeekWindow(new Date("2026-08-04T00:00:00Z"))).toBe(
      isoWeekWindow(new Date("2026-08-06T00:00:00Z")),
    );
  });

  it("semanas distintas dan ventanas distintas", () => {
    expect(isoWeekWindow(new Date("2026-08-04T00:00:00Z"))).not.toBe(
      isoWeekWindow(new Date("2026-08-12T00:00:00Z")),
    );
  });

  it("tiene formato YYYY-Www", () => {
    expect(isoWeekWindow(new Date("2026-03-10T00:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("Entrega y reintento independientes", () => {
  it("una entrega correcta escribe la clave", async () => {
    await recordDelivery(base);
    expect(create.mock.calls[0][0].data.dedupeKey).toBe(dedupeKeyFor(base));
    expect(create.mock.calls[0][0].data.status).toBe("sent");
  });

  it("un fallo se registra SIN clave, para poder reintentarlo", async () => {
    // Esta es la diferencia con la implementacion antigua: alli el fallo
    // dejaba el expediente marcado y nunca se reintentaba.
    await recordFailure({ ...base, error: "SMTP timeout" });
    expect(create.mock.calls[0][0].data.dedupeKey).toBeNull();
    expect(create.mock.calls[0][0].data.status).toBe("failed");
  });

  it("el fallo de un destinatario no marca como entregado a otro", async () => {
    await recordFailure({ ...base, recipient: "luis@x.es", error: "rebote" });
    // La consulta del otro destinatario sigue sin encontrar entrega.
    findUnique.mockResolvedValue(null);
    expect(await alreadyDelivered({ ...base, recipient: "ana@x.es" })).toBe(false);
  });

  it("una entrega ya hecha no se repite", async () => {
    findUnique.mockResolvedValue({ id: "log-1" });
    expect(await alreadyDelivered(base)).toBe(true);
  });

  it("un email entregado NO bloquea el canal de Slack", async () => {
    findUnique.mockImplementation(async ({ where }: any) =>
      where.dedupeKey === dedupeKeyFor(base) ? { id: "log-1" } : null,
    );

    expect(await alreadyDelivered(base)).toBe(true);
    expect(await alreadyDelivered({ ...base, channel: "SLACK" })).toBe(false);
    expect(await alreadyDelivered({ ...base, channel: "TEAMS" })).toBe(false);
    expect(await alreadyDelivered({ ...base, channel: "WEBHOOK" })).toBe(false);
  });

  it("dos ejecuciones solapadas del cron no duplican: P2002 devuelve false", async () => {
    create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    expect(await recordDelivery(base)).toBe(false);
  });

  it("un error distinto de P2002 se propaga", async () => {
    create.mockRejectedValue(Object.assign(new Error("DB caida"), { code: "P1001" }));
    await expect(recordDelivery(base)).rejects.toThrow("DB caida");
  });
});
