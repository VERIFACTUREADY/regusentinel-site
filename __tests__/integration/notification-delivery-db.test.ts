/**
 * RESERVA DE ENTREGAS CONTRA POSTGRESQL REAL.
 *
 * La reserva se apoya en dos garantias que solo existen en la base de datos:
 * la restriccion unica de `dedupeKey` y la actualizacion condicional al estado
 * observado. Con Prisma mockeado no se puede demostrar ninguna de las dos: no
 * hay dos transacciones compitiendo.
 *
 * QUE FALLA SIN LA CORRECCION
 * ---------------------------
 * El flujo anterior era: consultar si ya se entrego, enviar, y registrar
 * despues. Dos ejecuciones simultaneas del cron leian ambas "no enviado" y
 * ambas llamaban al proveedor. La restriccion unica impedia la segunda FILA,
 * no el segundo CORREO: la familia recibia el aviso dos veces.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import {
  entregarUnaVez,
  reservarEntrega,
  marcarFalloEntrega,
  recuperarEntregasColgadas,
  dedupeKeyFor,
  ENTREGA_COLGADA_MS,
  type DeliveryTarget,
} from "../../src/lib/notification-dedupe";

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

async function escenario() {
  seq++;
  const { org } = await createOrg();
  const expediente = await createCase(org.id, `EXP-2026-${String(seq).padStart(4, "0")}`);
  return { orgId: org.id, caseId: expediente.id };
}

function objetivo(
  base: { orgId: string; caseId: string },
  over: Partial<DeliveryTarget> = {},
): DeliveryTarget & { orgId: string } {
  return {
    orgId: base.orgId,
    caseId: base.caseId,
    kind: "ISD_30D",
    channel: "EMAIL_INTERNAL",
    recipient: "ana@gestoria.test",
    ...over,
  };
}

describe("Dos procesos simultaneos generan UNA sola llamada externa", () => {
  it("diez entregas concurrentes del mismo aviso llaman al proveedor una vez", async () => {
    const base = await escenario();
    const t = objetivo(base);

    let llamadas = 0;
    const enviar = async () => {
      llamadas++;
      // Ventana real durante la que el flujo antiguo dejaba pasar a los demas.
      await new Promise((r) => setTimeout(r, 20));
    };

    const resultados = await Promise.all(
      Array.from({ length: 10 }, () => entregarUnaVez(t, enviar)),
    );

    expect(llamadas).toBe(1);
    expect(resultados.filter((r) => r.enviado).length).toBe(1);

    const filas = await prisma.notificationLog.count({
      where: { dedupeKey: dedupeKeyFor(t) },
    });
    expect(filas).toBe(1);

    const fila = await prisma.notificationLog.findUnique({ where: { dedupeKey: dedupeKeyFor(t) } });
    expect(fila!.deliveryStatus).toBe("SENT");
  });

  it("una segunda pasada posterior tampoco reenvia", async () => {
    const base = await escenario();
    const t = objetivo(base);

    let llamadas = 0;
    await entregarUnaVez(t, async () => {
      llamadas++;
    });
    const segunda = await entregarUnaVez(t, async () => {
      llamadas++;
    });

    expect(llamadas).toBe(1);
    expect(segunda.motivo).toBe("ya_entregada");
  });
});

describe("Un canal enviado no bloquea otro", () => {
  it("email, Slack, Teams y webhook se entregan cada uno por su cuenta", async () => {
    const base = await escenario();
    const canales = ["EMAIL_INTERNAL", "SLACK", "TEAMS", "WEBHOOK"] as const;

    const enviados: string[] = [];
    for (const canal of canales) {
      const r = await entregarUnaVez(
        objetivo(base, { channel: canal, recipient: canal.toLowerCase() }),
        async () => {
          enviados.push(canal);
        },
      );
      expect(r.enviado).toBe(true);
    }

    expect(enviados).toEqual([...canales]);
  });

  it("si el email falla, Slack sigue entregandose", async () => {
    const base = await escenario();

    const email = await entregarUnaVez(objetivo(base), async () => {
      throw new Error("SMTP caido");
    });
    expect(email.enviado).toBe(false);

    const slack = await entregarUnaVez(
      objetivo(base, { channel: "SLACK", recipient: "slack" }),
      async () => undefined,
    );
    expect(slack.enviado).toBe(true);
  });
});

describe("Un destinatario fallido no bloquea a los demas", () => {
  it("el segundo destinatario recibe el aviso aunque el primero falle", async () => {
    const base = await escenario();
    const destinatarios = ["ana@gestoria.test", "luis@gestoria.test", "eva@gestoria.test"];

    const entregados: string[] = [];
    for (const recipient of destinatarios) {
      await entregarUnaVez(objetivo(base, { recipient }), async () => {
        if (recipient === "ana@gestoria.test") throw new Error("buzon lleno");
        entregados.push(recipient);
      });
    }

    expect(entregados).toEqual(["luis@gestoria.test", "eva@gestoria.test"]);
  });
});

describe("Reintento de una entrega FAILED", () => {
  it("la siguiente pasada vuelve a intentarla y la confirma", async () => {
    const base = await escenario();
    const t = objetivo(base);

    const primera = await entregarUnaVez(t, async () => {
      throw new Error("SMTP caido");
    });
    expect(primera.enviado).toBe(false);

    const fallida = await prisma.notificationLog.findUnique({ where: { dedupeKey: dedupeKeyFor(t) } });
    expect(fallida!.deliveryStatus).toBe("FAILED");
    expect(fallida!.attempts).toBe(1);

    const segunda = await entregarUnaVez(t, async () => undefined);
    expect(segunda.enviado).toBe(true);

    const final = await prisma.notificationLog.findUnique({ where: { dedupeKey: dedupeKeyFor(t) } });
    expect(final!.deliveryStatus).toBe("SENT");
    expect(final!.attempts).toBe(2);
    expect(final!.error).toBeNull();
  });

  it("dos reintentos simultaneos de una FAILED llaman al proveedor una sola vez", async () => {
    const base = await escenario();
    const t = objetivo(base);

    await reservarEntrega(t);
    await marcarFalloEntrega({ ...t, error: "SMTP caido" });

    let llamadas = 0;
    const resultados = await Promise.all(
      Array.from({ length: 5 }, () =>
        entregarUnaVez(t, async () => {
          llamadas++;
          await new Promise((r) => setTimeout(r, 20));
        }),
      ),
    );

    expect(llamadas).toBe(1);
    expect(resultados.filter((r) => r.enviado).length).toBe(1);
  });
});

describe("Entrega colgada en PROCESSING", () => {
  it("se recupera pasado el plazo y se reintenta", async () => {
    const base = await escenario();
    const t = objetivo(base);

    // El proceso murio con la reserva tomada.
    await reservarEntrega(t);
    await prisma.notificationLog.update({
      where: { dedupeKey: dedupeKeyFor(t) },
      data: { startedAt: new Date(Date.now() - ENTREGA_COLGADA_MS - 60_000) },
    });

    const recuperadas = await recuperarEntregasColgadas();
    expect(recuperadas).toBe(1);

    const tras = await prisma.notificationLog.findUnique({ where: { dedupeKey: dedupeKeyFor(t) } });
    expect(tras!.deliveryStatus).toBe("FAILED");

    let llamadas = 0;
    const r = await entregarUnaVez(t, async () => {
      llamadas++;
    });
    expect(r.enviado).toBe(true);
    expect(llamadas).toBe(1);
  });

  it("una entrega PROCESSING reciente NO se recupera ni se reenvia", async () => {
    const base = await escenario();
    const t = objetivo(base);

    await reservarEntrega(t);

    expect(await recuperarEntregasColgadas()).toBe(0);

    let llamadas = 0;
    const r = await entregarUnaVez(t, async () => {
      llamadas++;
    });
    expect(r.enviado).toBe(false);
    expect(r.motivo).toBe("en_curso");
    expect(llamadas).toBe(0);
  });
});

describe("Ventanas temporales", () => {
  it("un recordatorio semanal se entrega una vez por ventana, no una por pasada", async () => {
    const base = await escenario();

    let llamadas = 0;
    const enviar = async () => {
      llamadas++;
    };

    const semana31 = objetivo(base, { kind: "FAMILY_PENDING_DOCS", channel: "EMAIL_FAMILY", window: "2026-W31" });
    const semana32 = { ...semana31, window: "2026-W32" };

    await entregarUnaVez(semana31, enviar);
    await entregarUnaVez(semana31, enviar); // misma semana: no reenvia
    await entregarUnaVez(semana32, enviar); // semana siguiente: si

    expect(llamadas).toBe(2);
  });
});
