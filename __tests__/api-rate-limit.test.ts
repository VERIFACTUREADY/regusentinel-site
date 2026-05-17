import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { rateLimit, getClientIP } from "../src/lib/api-rate-limit";

function makeReq(ip = "1.2.3.4"): NextRequest {
  const req = new NextRequest("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
  return req;
}

describe("rate-limit", () => {
  // Each test uses a fresh bucket name to avoid cross-test interference
  let counter = 0;
  beforeEach(() => { counter++; });

  it("allows requests under the limit", () => {
    const bucket = `bucket-${counter}-under`;
    for (let i = 0; i < 10; i++) {
      const result = rateLimit(makeReq(), { bucket, max: 20 });
      expect(result).toBeNull();
    }
  });

  it("returns 429 when limit exceeded", async () => {
    const bucket = `bucket-${counter}-exceed`;
    for (let i = 0; i < 5; i++) {
      rateLimit(makeReq(), { bucket, max: 5 });
    }
    const result = rateLimit(makeReq(), { bucket, max: 5 });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
    const body = await result!.json();
    expect(body.error).toMatch(/too many/i);
    expect(typeof body.retryAfter).toBe("number");
  });

  it("returns Retry-After header when limited", () => {
    const bucket = `bucket-${counter}-headers`;
    for (let i = 0; i < 3; i++) rateLimit(makeReq(), { bucket, max: 3 });
    const result = rateLimit(makeReq(), { bucket, max: 3 });
    expect(result).not.toBeNull();
    expect(result!.headers.get("Retry-After")).toBeTruthy();
    expect(result!.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(result!.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("isolates limits per IP", () => {
    const bucket = `bucket-${counter}-perip`;
    // exhaust IP A's quota
    for (let i = 0; i < 3; i++) rateLimit(makeReq("1.1.1.1"), { bucket, max: 3 });
    expect(rateLimit(makeReq("1.1.1.1"), { bucket, max: 3 })).not.toBeNull();
    // IP B should still be allowed
    expect(rateLimit(makeReq("2.2.2.2"), { bucket, max: 3 })).toBeNull();
  });

  it("isolates limits per bucket", () => {
    const bucketA = `bucket-${counter}-a`;
    const bucketB = `bucket-${counter}-b`;
    for (let i = 0; i < 3; i++) rateLimit(makeReq(), { bucket: bucketA, max: 3 });
    expect(rateLimit(makeReq(), { bucket: bucketA, max: 3 })).not.toBeNull();
    expect(rateLimit(makeReq(), { bucket: bucketB, max: 3 })).toBeNull();
  });

  it("getClientIP prefers x-forwarded-for first hop", () => {
    const req = new NextRequest("http://localhost", {
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" },
    });
    expect(getClientIP(req)).toBe("1.1.1.1");
  });

  it("getClientIP falls back to x-real-ip", () => {
    const req = new NextRequest("http://localhost", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIP(req)).toBe("9.9.9.9");
  });

  it("getClientIP returns 'unknown' when no IP headers", () => {
    const req = new NextRequest("http://localhost");
    expect(getClientIP(req)).toBe("unknown");
  });
});
