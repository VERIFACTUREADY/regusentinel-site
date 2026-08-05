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
  prisma: {
    notificationLog: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  },
}));

import { prisma } from "../src/lib/prisma";
import {
  dedupeKeyFor,
  isoWeekWindow,
  alreadyDelivered,
  reservarEntrega,
  entregarUnaVez,
  ENTREGA_COLGADA_MS,
} from "../src/lib/notification-dedupe";

const findUnique = prisma.notificationLog.findUnique as unknown as ReturnType<typeof vi.fn>;
const create = prisma.notificationLog.create as unknown as ReturnType<typeof vi.fn>;
const updateMany = prisma.notificationLog.updateMany as unknown as ReturnType<typeof vi.fn>;

const P2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

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
  updateMany.mockResolvedValue({ count: 1 });
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

describe("Reserva atomica: reservar ANTES de enviar", () => {
  it("la fila se crea en PROCESSING antes de llamar al proveedor", async () => {
    const r = await reservarEntrega(base);

    expect(r).toBe("reservada");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryStatus: "PROCESSING",
          attempts: 1,
          dedupeKey: dedupeKeyFor(base),
        }),
      }),
    );
  });

  it("si otra ejecucion ya la reservo, esta NO envia", async () => {
    // La segunda ejecucion choca con la restriccion unica y observa PROCESSING
    // reciente. Con el flujo anterior (consultar, enviar, registrar) ambas
    // habrian llamado al proveedor y la familia habria recibido dos correos.
    create.mockRejectedValue(P2002);
    findUnique.mockResolvedValue({ deliveryStatus: "PROCESSING", startedAt: new Date() });

    expect(await reservarEntrega(base)).toBe("en_curso");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("una entrega ya confirmada no se repite", async () => {
    create.mockRejectedValue(P2002);
    findUnique.mockResolvedValue({ deliveryStatus: "SENT", startedAt: new Date() });

    expect(await reservarEntrega(base)).toBe("ya_entregada");
  });

  it("una entrega FAILED se puede reclamar de nuevo", async () => {
    create.mockRejectedValue(P2002);
    findUnique.mockResolvedValue({ deliveryStatus: "FAILED", startedAt: new Date() });

    expect(await reservarEntrega(base)).toBe("reservada");
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: dedupeKeyFor(base), deliveryStatus: "FAILED" },
        data: expect.objectContaining({ attempts: { increment: 1 } }),
      }),
    );
  });

  it("una entrega PROCESSING colgada se recupera", async () => {
    create.mockRejectedValue(P2002);
    findUnique.mockResolvedValue({
      deliveryStatus: "PROCESSING",
      startedAt: new Date(Date.now() - ENTREGA_COLGADA_MS - 1000),
    });

    expect(await reservarEntrega(base)).toBe("reservada");
  });

  it("perder la reclamacion condicional no envia", async () => {
    create.mockRejectedValue(P2002);
    findUnique.mockResolvedValue({ deliveryStatus: "FAILED", startedAt: new Date() });
    updateMany.mockResolvedValue({ count: 0 }); // otra la reclamo primero

    expect(await reservarEntrega(base)).toBe("en_curso");
  });

  it("un error distinto de P2002 se propaga", async () => {
    create.mockRejectedValue(Object.assign(new Error("DB caida"), { code: "P1001" }));
    await expect(reservarEntrega(base)).rejects.toThrow("DB caida");
  });
});

describe("entregarUnaVez", () => {
  it("llama al proveedor UNA sola vez y confirma", async () => {
    const enviar = vi.fn().mockResolvedValue(undefined);

    const r = await entregarUnaVez(base, enviar);

    expect(r.enviado).toBe(true);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "SENT" }) }),
    );
  });

  it("NO llama al proveedor si la reserva la tiene otro", async () => {
    create.mockRejectedValue(P2002);
    findUnique.mockResolvedValue({ deliveryStatus: "PROCESSING", startedAt: new Date() });
    const enviar = vi.fn();

    const r = await entregarUnaVez(base, enviar);

    expect(r.enviado).toBe(false);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("un fallo del proveedor deja la entrega en FAILED, reintentable", async () => {
    const enviar = vi.fn().mockRejectedValue(new Error("SMTP caido"));

    const r = await entregarUnaVez(base, enviar);

    expect(r.enviado).toBe(false);
    expect(r.error).toContain("SMTP caido");
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deliveryStatus: "FAILED", error: "SMTP caido" }),
      }),
    );
  });
});

describe("Independencia entre canales y destinatarios", () => {
  it("el fallo de un destinatario no marca como entregado a otro", async () => {
    expect(dedupeKeyFor({ ...base, recipient: "ana@x.es" })).not.toBe(
      dedupeKeyFor({ ...base, recipient: "luis@x.es" }),
    );
  });

  it("un email entregado NO bloquea el canal de Slack", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { dedupeKey: string } }) =>
      where.dedupeKey.includes("EMAIL_INTERNAL")
        ? { deliveryStatus: "SENT", startedAt: new Date() }
        : null,
    );

    expect(await alreadyDelivered(base)).toBe(true);
    expect(await alreadyDelivered({ ...base, channel: "SLACK" })).toBe(false);
  });

  it("alreadyDelivered solo cuenta las entregas CONFIRMADAS", async () => {
    findUnique.mockResolvedValue({ deliveryStatus: "PROCESSING" });
    expect(await alreadyDelivered(base)).toBe(false);

    findUnique.mockResolvedValue({ deliveryStatus: "FAILED" });
    expect(await alreadyDelivered(base)).toBe(false);

    findUnique.mockResolvedValue({ deliveryStatus: "SENT" });
    expect(await alreadyDelivered(base)).toBe(true);
  });
});
