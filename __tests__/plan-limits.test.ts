/**
 * Limites de plan.
 *
 * Antes el tope de expedientes solo se aplicaba a INICIA, y con el numero 15
 * escrito a mano en la ruta en vez de leerlo de PLAN_PRICING. DESPACHO y
 * FIRMA anunciaban 50 y 200 expedientes y no tenian NINGUN tope.
 */
import { describe, it, expect, vi } from "vitest";
import { PLAN_PRICING } from "../src/lib/stripe";
import {
  caseLimitFor,
  userLimitFor,
  checkCaseLimit,
  checkUserLimit,
  currentMonthKey,
} from "../src/lib/plan-limits";

function fakeDb(state: { casesCreated?: number; members?: number } = {}) {
  return {
    usageRecord: {
      findUnique: vi.fn(async () =>
        state.casesCreated === undefined ? null : { casesCreated: state.casesCreated },
      ),
    },
    membership: { count: vi.fn(async () => state.members ?? 0) },
    subscription: { findUnique: vi.fn(async () => null) },
    $executeRaw: vi.fn(async () => 1),
  } as any;
}

describe("Fuente unica de verdad", () => {
  it("los limites salen de PLAN_PRICING, no de numeros escritos a mano", () => {
    expect(caseLimitFor("INICIA")).toBe(PLAN_PRICING.INICIA.includedCases);
    expect(caseLimitFor("DESPACHO")).toBe(PLAN_PRICING.DESPACHO.includedCases);
    expect(caseLimitFor("FIRMA")).toBe(PLAN_PRICING.FIRMA.includedCases);

    expect(userLimitFor("INICIA")).toBe(PLAN_PRICING.INICIA.maxUsers);
    expect(userLimitFor("DESPACHO")).toBe(PLAN_PRICING.DESPACHO.maxUsers);
    expect(userLimitFor("FIRMA")).toBe(PLAN_PRICING.FIRMA.maxUsers);
  });

  it("el mes se calcula en formato YYYY-MM", () => {
    expect(currentMonthKey(new Date("2026-03-15T12:00:00Z"))).toBe("2026-03");
    expect(currentMonthKey(new Date("2026-12-31T23:00:00Z"))).toBe("2026-12");
  });
});

describe("Tope de expedientes — LOS TRES planes", () => {
  const planes = ["INICIA", "DESPACHO", "FIRMA"] as const;

  for (const plan of planes) {
    const limite = PLAN_PRICING[plan].includedCases;

    it(`${plan}: permite crear justo por debajo del tope (${limite - 1}/${limite})`, async () => {
      const r = await checkCaseLimit("org-1", plan, fakeDb({ casesCreated: limite - 1 }));
      expect(r.allowed).toBe(true);
    });

    it(`${plan}: BLOQUEA al alcanzar el tope (${limite}/${limite})`, async () => {
      // DESPACHO y FIRMA no tenian ningun tope: esto fallaba antes.
      const r = await checkCaseLimit("org-1", plan, fakeDb({ casesCreated: limite }));
      expect(r.allowed).toBe(false);
      expect(r.limit).toBe(limite);
      expect(r.message).toContain(String(limite));
    });

    it(`${plan}: bloquea tambien por encima del tope`, async () => {
      const r = await checkCaseLimit("org-1", plan, fakeDb({ casesCreated: limite + 5 }));
      expect(r.allowed).toBe(false);
    });
  }

  it("sin registro de uso, permite (primer expediente del mes)", async () => {
    const r = await checkCaseLimit("org-1", "INICIA", fakeDb({}));
    expect(r.allowed).toBe(true);
    expect(r.used).toBe(0);
  });

  it("el mensaje sugiere el plan siguiente, y en FIRMA no inventa uno", async () => {
    const inicia = await checkCaseLimit("o", "INICIA", fakeDb({ casesCreated: 999 }));
    expect(inicia.message).toContain("Despacho");

    const despacho = await checkCaseLimit("o", "DESPACHO", fakeDb({ casesCreated: 999 }));
    expect(despacho.message).toContain("Firma");

    const firma = await checkCaseLimit("o", "FIRMA", fakeDb({ casesCreated: 999 }));
    expect(firma.message).not.toMatch(/Actualiza a/);
    expect(firma.message).toMatch(/soporte/i);
  });
});

describe("Tope de usuarios — LOS TRES planes", () => {
  const planes = ["INICIA", "DESPACHO", "FIRMA"] as const;

  for (const plan of planes) {
    const limite = PLAN_PRICING[plan].maxUsers;

    it(`${plan}: permite invitar por debajo del tope`, async () => {
      const r = await checkUserLimit("org-1", plan, fakeDb({ members: limite - 1 }));
      expect(r.allowed).toBe(true);
    });

    it(`${plan}: bloquea al alcanzar ${limite} usuarios`, async () => {
      const r = await checkUserLimit("org-1", plan, fakeDb({ members: limite }));
      expect(r.allowed).toBe(false);
      expect(r.message).toContain(String(limite));
    });
  }
});

describe("Coherencia con el copy comercial", () => {
  it("los planes estan ordenados de menor a mayor en ambos limites", () => {
    expect(PLAN_PRICING.INICIA.includedCases).toBeLessThan(PLAN_PRICING.DESPACHO.includedCases);
    expect(PLAN_PRICING.DESPACHO.includedCases).toBeLessThan(PLAN_PRICING.FIRMA.includedCases);
    expect(PLAN_PRICING.INICIA.maxUsers).toBeLessThan(PLAN_PRICING.DESPACHO.maxUsers);
    expect(PLAN_PRICING.DESPACHO.maxUsers).toBeLessThan(PLAN_PRICING.FIRMA.maxUsers);
  });

  it("ningun plan tiene limite cero o negativo", () => {
    for (const plan of ["INICIA", "DESPACHO", "FIRMA"] as const) {
      expect(caseLimitFor(plan)).toBeGreaterThan(0);
      expect(userLimitFor(plan)).toBeGreaterThan(0);
    }
  });
});
