import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildSlackMessage,
  sendSlackNotification,
  signWebhookPayload,
  verifyWebhookSignature,
  sendCustomWebhook,
  eventNameForKind,
  type OutboundEvent,
} from "../src/lib/outbound-integrations";

const sampleEvent: OutboundEvent = {
  event: "isd.deadline_7d",
  orgId: "org_abc",
  caseId: "case_xyz",
  caseRef: "EXP-2026-001",
  caseUrl: "https://bariturpro.com/cases/case_xyz",
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
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendSlackNotification("https://hooks.slack.com/test", sampleEvent);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).text).toContain("EXP-2026-001");
  });

  it("devuelve ok=false cuando el webhook responde 4xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("invalid", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendSlackNotification("https://hooks.slack.com/test", sampleEvent);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  it("captura excepciones de red en error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network unreachable"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendSlackNotification("https://hooks.slack.com/test", sampleEvent);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("network unreachable");
  });

  it("rechaza URL vacía sin hacer fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendSlackNotification("", sampleEvent);
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
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendCustomWebhook("https://api.cliente.com/baritur", null, sampleEvent);
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cliente.com/baritur");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-BARITUR-Event"]).toBe("isd.deadline_7d");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toMatchObject({
      event: "isd.deadline_7d",
      caseRef: "EXP-2026-001",
    });
  });

  it("incluye X-BARITUR-Signature cuando hay secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendCustomWebhook("https://api.cliente.com", "miSecreto", sampleEvent);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-BARITUR-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("omite la firma si no hay secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendCustomWebhook("https://api.cliente.com", null, sampleEvent);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-BARITUR-Signature"]).toBeUndefined();
  });

  it("la firma incluida es verificable con verifyWebhookSignature", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendCustomWebhook("https://api.cliente.com", "topsecret", sampleEvent);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(verifyWebhookSignature("topsecret", init.body as string, headers["X-BARITUR-Signature"])).toBe(true);
  });
});
