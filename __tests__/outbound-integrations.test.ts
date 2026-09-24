import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// El envio outbound valida ahora el destino antes de conectar: se resuelve el
// DNS y se comprueban todas las IPs. Aqui lo fijamos a una direccion publica
// para que las pruebas no dependan de la red (la proteccion SSRF en si se
// verifica en __tests__/ssrf-guard.test.ts).
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import {
  buildSlackMessage,
  buildTeamsMessage,
  sendSlackNotification,
  sendTeamsNotification,
  signWebhookPayload,
  verifyWebhookSignature,
  sendCustomWebhook,
  eventNameForKind,
  type OutboundEvent,
} from "../src/lib/outbound-integrations";
import { __setTransporteParaPruebas, type Transporte } from "../src/lib/ssrf-guard";

type OpcionesTransporte = Parameters<Transporte>[2];

let restaurarTransporte: (() => void) | null = null;

/**
 * Instala un transporte de prueba y devuelve el espia.
 *
 * Antes estas pruebas sustituian `globalThis.fetch`. Ya no sirve: la
 * correccion de SSRF consistio precisamente en dejar de usar `fetch` —que
 * vuelve a resolver el nombre y reabre la ventana de DNS rebinding— y conectar
 * a la IP validada con `http(s).request`. El espia recibe ahora
 * `(url, ipFijada, opciones)`.
 */
function transporte(respuesta: { status: number; location?: string } | Error) {
  const espia = vi.fn(async (_url: string, _ip: string, _opciones: OpcionesTransporte) => {
    if (respuesta instanceof Error) throw respuesta;
    return { status: respuesta.status, location: respuesta.location ?? null };
  });
  restaurarTransporte?.();
  restaurarTransporte = __setTransporteParaPruebas(espia as unknown as Transporte);
  return espia;
}

afterEach(() => {
  restaurarTransporte?.();
  restaurarTransporte = null;
});

const sampleEvent: OutboundEvent = {
  event: "isd.deadline_7d",
  orgId: "org_abc",
  caseId: "case_xyz",
  caseRef: "EXP-2026-001",
  caseUrl: "https://heredia.app/cases/case_xyz",
  deceasedName: "García López, María",
  daysRemaining: 5,
  deadline: "2026-06-01T00:00:00.000Z",
  emittedAt: "2026-05-27T10:00:00.000Z",
};

describe("buildSlackMessage", () => {
  it("incluye el ref y el causante en el texto plano", () => {
    const msg = buildSlackMessage(sampleEvent) as { text: string };
    expect(msg.text).toContain("EXP-2026-001");
    expect(msg.text).toContain("García López, María");
  });

  it("marca el evento como CRITICO cuando quedan <=7 dias", () => {
    const msg = buildSlackMessage(sampleEvent) as { text: string };
    expect(msg.text).toContain("CRÍTICO");
  });

  it("marca como VENCIDO cuando daysRemaining es negativo", () => {
    const msg = buildSlackMessage({ ...sampleEvent, daysRemaining: -3 }) as { text: string };
    expect(msg.text).toContain("VENCIDO");
  });
});

describe("signWebhookPayload / verifyWebhookSignature", () => {
  it("firma con prefijo sha256= y hex de 64 chars", () => {
    const sig = signWebhookPayload("topsecret", '{"a":1}');
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(sig.length).toBe("sha256=".length + 64);
  });

  it("verifica una firma válida", () => {
    const body = '{"event":"x"}';
    const sig = signWebhookPayload("topsecret", body);
    expect(verifyWebhookSignature("topsecret", body, sig)).toBe(true);
  });

  it("rechaza una firma con secret distinto", () => {
    const body = '{"event":"x"}';
    const sig = signWebhookPayload("topsecret", body);
    expect(verifyWebhookSignature("otrosecret", body, sig)).toBe(false);
  });

  it("rechaza una firma con body alterado", () => {
    const sig = signWebhookPayload("topsecret", '{"event":"x"}');
    expect(verifyWebhookSignature("topsecret", '{"event":"y"}', sig)).toBe(false);
  });
});

describe("eventNameForKind", () => {
  it("convierte ISD_7D → isd.deadline_7d", () => {
    expect(eventNameForKind("ISD_7D")).toBe("isd.deadline_7d");
  });
  it("convierte ISD_PASSED → isd.deadline_passed", () => {
    expect(eventNameForKind("ISD_PASSED")).toBe("isd.deadline_passed");
  });
});

describe("sendSlackNotification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve ok cuando el webhook responde 200", async () => {
    const fetchMock = transporte({ status: 200 });

    const res = await sendSlackNotification("https://hooks.slack.com/test", sampleEvent);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][2] as OpcionesTransporte;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body!).text).toContain("EXP-2026-001");
  });

  it("devuelve ok=false cuando el webhook responde 4xx", async () => {
    const fetchMock = transporte({ status: 400 });

    const res = await sendSlackNotification("https://hooks.slack.com/test", sampleEvent);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  it("captura excepciones de red en error", async () => {
    const fetchMock = transporte(new Error("network unreachable"));

    const res = await sendSlackNotification("https://hooks.slack.com/test", sampleEvent);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("network unreachable");
  });

  it("rechaza URL vacía sin hacer fetch", async () => {
    const fetchMock = transporte({ status: 200 });

    const res = await sendSlackNotification("", sampleEvent);
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("buildTeamsMessage", () => {
  it("usa MessageCard con themeColor según urgencia", () => {
    const msg = buildTeamsMessage(sampleEvent) as { "@type": string; themeColor: string };
    expect(msg["@type"]).toBe("MessageCard");
    // 5 días → CRÍTICO → color naranja/rojo
    expect(msg.themeColor.toUpperCase()).toBe("F9A825");
  });

  it("color rojo para evento vencido", () => {
    const msg = buildTeamsMessage({ ...sampleEvent, daysRemaining: -3 }) as { themeColor: string };
    expect(msg.themeColor.toUpperCase()).toBe("EE2C2C");
  });

  it("incluye potentialAction con OpenUri al caseUrl", () => {
    const msg = buildTeamsMessage(sampleEvent) as { potentialAction: Array<{ targets: Array<{ uri: string }> }> };
    expect(msg.potentialAction[0].targets[0].uri).toBe(sampleEvent.caseUrl);
  });
});

describe("sendTeamsNotification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve ok cuando el webhook responde 200", async () => {
    const fetchMock = transporte({ status: 200 });

    const res = await sendTeamsNotification("https://outlook.office.com/webhook/test", sampleEvent);
    expect(res.ok).toBe(true);
    const init = fetchMock.mock.calls[0][2] as OpcionesTransporte;
    expect(JSON.parse(init.body!)["@type"]).toBe("MessageCard");
  });

  it("rechaza URL vacía sin hacer fetch", async () => {
    const fetchMock = transporte({ status: 200 });
    const res = await sendTeamsNotification("", sampleEvent);
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendCustomWebhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("envía body JSON con el evento serializado y headers correctos", async () => {
    const fetchMock = transporte({ status: 200 });

    const res = await sendCustomWebhook("https://api.cliente.com/heredia", null, sampleEvent);
    expect(res.ok).toBe(true);
    const [url, , init] = fetchMock.mock.calls[0] as [string, string, OpcionesTransporte];
    expect(url).toBe("https://api.cliente.com/heredia");
    expect(init.method).toBe("POST");
    const headers = init.headers;
    expect(headers["X-HEREDIA-Event"]).toBe("isd.deadline_7d");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body!)).toMatchObject({
      event: "isd.deadline_7d",
      caseRef: "EXP-2026-001",
    });
  });

  it("incluye X-HEREDIA-Signature cuando hay secret", async () => {
    const fetchMock = transporte({ status: 200 });

    await sendCustomWebhook("https://api.cliente.com", "miSecreto", sampleEvent);
    const headers = (fetchMock.mock.calls[0][2] as OpcionesTransporte).headers;
    expect(headers["X-HEREDIA-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("omite la firma si no hay secret", async () => {
    const fetchMock = transporte({ status: 200 });

    await sendCustomWebhook("https://api.cliente.com", null, sampleEvent);
    const headers = (fetchMock.mock.calls[0][2] as OpcionesTransporte).headers;
    expect(headers["X-HEREDIA-Signature"]).toBeUndefined();
  });

  it("la firma incluida es verificable con verifyWebhookSignature", async () => {
    const fetchMock = transporte({ status: 200 });

    await sendCustomWebhook("https://api.cliente.com", "topsecret", sampleEvent);
    const init = fetchMock.mock.calls[0][2] as OpcionesTransporte;
    const headers = init.headers;
    expect(verifyWebhookSignature("topsecret", init.body as string, headers["X-HEREDIA-Signature"])).toBe(true);
  });
});
