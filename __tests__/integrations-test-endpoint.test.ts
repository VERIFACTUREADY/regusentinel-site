/**
 * `POST /api/settings/integrations/test`.
 *
 * HANDLER TEST con Prisma mockeado. Comprueba dos cosas que la auditoria
 * senalo:
 *
 *   1. El plan se comprobaba SOLO al guardar la integracion. Este endpoint no
 *      lo comprobaba en absoluto, asi que una organizacion que habia estado en
 *      FIRMA y bajo de plan —o cuya suscripcion se cancelo— conservaba las URLs
 *      guardadas y podia seguir disparando peticiones salientes desde nuestros
 *      servidores indefinidamente.
 *   2. La respuesta no devuelve el cuerpo remoto: el endpoint permite elegir el
 *      destino, asi que devolver lo que responde lo convertiria en un lector de
 *      servicios internos con resultado visible.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getServerSessionMock = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => getServerSessionMock(...a),
}));
vi.mock("../src/lib/auth", () => ({ authOptions: {} }));
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}));

const enviarSlack = vi.fn();
const enviarTeams = vi.fn();
const enviarWebhook = vi.fn();
vi.mock("../src/lib/outbound-integrations", () => ({
  sendSlackNotification: (...a: unknown[]) => enviarSlack(...a),
  sendTeamsNotification: (...a: unknown[]) => enviarTeams(...a),
  sendCustomWebhook: (...a: unknown[]) => enviarWebhook(...a),
}));
vi.mock("../src/lib/secret-crypto", () => ({ readSecret: (v: unknown) => v ?? null }));

import { prisma } from "../src/lib/prisma";
import { POST } from "../src/app/api/settings/integrations/test/route";
import { fakeUserRow } from "./helpers/verified-session";

const orgFindUnique = prisma.organization.findUnique as unknown as ReturnType<typeof vi.fn>;
const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

let ip = 0;

function peticion() {
  ip++;
  return new Request("http://localhost/api/settings/integrations/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // IP distinta por peticion: el endpoint esta limitado por IP y las
      // pruebas comparten el contador en memoria.
      "x-forwarded-for": `203.0.113.${ip % 250}`,
    },
    body: JSON.stringify({ target: "all" }),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", email: "owner@ejemplo.es", orgId: "org-1", role: "OWNER" },
  });
  userFindUnique.mockResolvedValue(fakeUserRow({ role: "OWNER", plan: "FIRMA" }));
  enviarSlack.mockResolvedValue({ ok: true, status: 200 });
  enviarTeams.mockResolvedValue({ ok: true, status: 200 });
  enviarWebhook.mockResolvedValue({ ok: true, status: 200 });
});

function orgConPlan(plan: string | null) {
  orgFindUnique.mockResolvedValue({
    slackWebhookUrl: "https://hooks.slack.com/services/AAA",
    teamsWebhookUrl: null,
    customWebhookUrl: "https://api.cliente.example/heredia",
    customWebhookSecret: null,
    subscription: plan ? { plan } : null,
  });
}

describe("El plan se comprueba en el momento del envio", () => {
  it("con plan FIRMA dispara los envios", async () => {
    orgConPlan("FIRMA");

    const res = await POST(peticion());

    expect(res.status).toBe(200);
    expect(enviarSlack).toHaveBeenCalledTimes(1);
    expect(enviarWebhook).toHaveBeenCalledTimes(1);
  });

  it("con plan DESPACHO responde 402 y NO hace ninguna peticion saliente", async () => {
    // Las URLs siguen guardadas de cuando la organizacion estaba en FIRMA.
    orgConPlan("DESPACHO");

    const res = await POST(peticion());

    expect(res.status).toBe(402);
    expect(enviarSlack).not.toHaveBeenCalled();
    expect(enviarTeams).not.toHaveBeenCalled();
    expect(enviarWebhook).not.toHaveBeenCalled();
  });

  it("con plan INICIA tampoco", async () => {
    orgConPlan("INICIA");

    const res = await POST(peticion());

    expect(res.status).toBe(402);
    expect(enviarSlack).not.toHaveBeenCalled();
  });

  it("sin fila de suscripcion tampoco", async () => {
    orgConPlan(null);

    const res = await POST(peticion());

    expect(res.status).toBe(402);
    expect(enviarSlack).not.toHaveBeenCalled();
  });
});

describe("Limite de peticiones", () => {
  it("corta las rafagas desde la misma IP", async () => {
    orgConPlan("FIRMA");

    const misma = () =>
      new Request("http://localhost/api/settings/integrations/test", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
        body: JSON.stringify({ target: "slack" }),
      }) as never;

    const estados: number[] = [];
    for (let i = 0; i < 9; i++) estados.push((await POST(misma())).status);

    expect(estados.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});

describe("No se devuelve el cuerpo remoto", () => {
  it("la respuesta solo lleva ok/status/error del canal", async () => {
    orgConPlan("FIRMA");
    // Aunque el emisor devolviera contenido remoto, no debe salir. `safeFetch`
    // ya no lo expone; esta prueba fija el contrato del endpoint.
    enviarSlack.mockResolvedValue({ ok: false, status: 500, error: "HTTP 500" });

    const res = await POST(peticion());
    const cuerpo = await res.text();

    expect(cuerpo).not.toMatch(/SECRETO|<html|root:x:/i);
    expect(JSON.parse(cuerpo).results.slack).toEqual({ ok: false, status: 500, error: "HTTP 500" });
  });
});
