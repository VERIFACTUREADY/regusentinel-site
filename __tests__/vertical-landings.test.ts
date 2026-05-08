import { describe, it, expect } from "vitest";
import { VERTICAL_CONFIG, ALL_VERTICAL_SLUGS, getVerticalBySlug } from "../src/lib/vertical-landings";

describe("vertical-landings", () => {
  it("exposes 3 verticals", () => {
    expect(ALL_VERTICAL_SLUGS).toHaveLength(3);
    expect(ALL_VERTICAL_SLUGS).toEqual(expect.arrayContaining(["funerarias", "gestorias", "abogados"]));
  });

  it("each vertical has all required fields", () => {
    for (const slug of ALL_VERTICAL_SLUGS) {
      const v = VERTICAL_CONFIG[slug];
      expect(v.title.length).toBeGreaterThan(20);
      expect(v.description.length).toBeGreaterThan(50);
      expect(v.headline.length).toBeGreaterThan(0);
      expect(v.subtitle.length).toBeGreaterThan(50);
      expect(v.painPoints.length).toBe(3);
      expect(v.benefits.length).toBe(6);
      expect(v.workflow.length).toBe(4);
      expect(v.scenarios.length).toBe(3);
      expect(v.faq.length).toBeGreaterThanOrEqual(3);
      expect(v.quote.text.length).toBeGreaterThan(20);
    }
  });

  it("recommends a valid plan for each vertical", () => {
    for (const slug of ALL_VERTICAL_SLUGS) {
      const v = VERTICAL_CONFIG[slug];
      expect(["INICIA", "DESPACHO", "FIRMA"]).toContain(v.recommendedPlan);
    }
  });

  it("each scenario has problem and solution", () => {
    for (const slug of ALL_VERTICAL_SLUGS) {
      const v = VERTICAL_CONFIG[slug];
      for (const s of v.scenarios) {
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.problem.length).toBeGreaterThan(20);
        expect(s.solution.length).toBeGreaterThan(20);
      }
    }
  });

  it("getVerticalBySlug returns correct config", () => {
    const f = getVerticalBySlug("funerarias");
    expect(f).toBeDefined();
    expect(f!.slug).toBe("funerarias");
  });

  it("getVerticalBySlug returns null for unknown slug", () => {
    expect(getVerticalBySlug("unknown")).toBeNull();
    expect(getVerticalBySlug("")).toBeNull();
  });

  it("benefits all have non-empty icon paths", () => {
    for (const slug of ALL_VERTICAL_SLUGS) {
      const v = VERTICAL_CONFIG[slug];
      for (const b of v.benefits) {
        expect(b.icon.length).toBeGreaterThan(10);
        expect(b.title.length).toBeGreaterThan(0);
        expect(b.desc.length).toBeGreaterThan(20);
      }
    }
  });
});
