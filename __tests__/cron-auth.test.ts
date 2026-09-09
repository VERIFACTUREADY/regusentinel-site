import { describe, it, expect, beforeEach } from "vitest";
import { validateCronSecret } from "../src/lib/cron-auth";

function buildReq(opts: { authHeader?: string; secretParam?: string }) {
  const url = new URL("http://localhost/api/cron/foo");
  if (opts.secretParam) url.searchParams.set("secret", opts.secretParam);
  return {
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "authorization" ? opts.authHeader ?? null : null,
    },
    nextUrl: url,
  } as any;
}

describe("validateCronSecret", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("rechaza si CRON_SECRET no esta configurado (fail-closed)", () => {
    const req = buildReq({ authHeader: "Bearer cualquiercosa" });
    expect(validateCronSecret(req)).toBe(false);
  });

  it("acepta header Bearer correcto", () => {
    process.env.CRON_SECRET = "supersecretvalue123";
    const req = buildReq({ authHeader: "Bearer supersecretvalue123" });
    expect(validateCronSecret(req)).toBe(true);
  });

  it("rechaza header Bearer incorrecto", () => {
    process.env.CRON_SECRET = "supersecretvalue123";
    const req = buildReq({ authHeader: "Bearer otrovalor456" });
    expect(validateCronSecret(req)).toBe(false);
  });

  it("rechaza si la longitud del header difiere (sin llamar timingSafeEqual)", () => {
    process.env.CRON_SECRET = "supersecretvalue123";
    const req = buildReq({ authHeader: "Bearer short" });
    expect(validateCronSecret(req)).toBe(false);
  });

  it("acepta secret via query param ?secret=", () => {
    process.env.CRON_SECRET = "supersecretvalue123";
    const req = buildReq({ secretParam: "supersecretvalue123" });
    expect(validateCronSecret(req)).toBe(true);
  });

  it("rechaza query param ?secret= incorrecto", () => {
    process.env.CRON_SECRET = "supersecretvalue123";
    const req = buildReq({ secretParam: "otrovalor456789" });
    expect(validateCronSecret(req)).toBe(false);
  });

  it("rechaza request sin auth ni query param", () => {
    process.env.CRON_SECRET = "supersecretvalue123";
    const req = buildReq({});
    expect(validateCronSecret(req)).toBe(false);
  });

  it("no acepta header con typo en 'Bearer'", () => {
    process.env.CRON_SECRET = "supersecretvalue123";
    const req = buildReq({ authHeader: "bearer supersecretvalue123" });
    expect(validateCronSecret(req)).toBe(false);
  });
});
