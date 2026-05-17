import { describe, it, expect } from "vitest";
import {
  GLOSSARY,
  ALL_GLOSSARY_SLUGS,
  getTermBySlug,
  getRelatedTerms,
  GLOSSARY_CATEGORIES,
} from "../src/lib/glossary";

describe("glossary", () => {
  it("exposes at least 30 terms", () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
  });

  it("each slug is unique", () => {
    const set = new Set(ALL_GLOSSARY_SLUGS);
    expect(set.size).toBe(ALL_GLOSSARY_SLUGS.length);
  });

  it("slugs are URL-safe (lowercase, hyphenated)", () => {
    for (const slug of ALL_GLOSSARY_SLUGS) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug.length).toBeGreaterThan(2);
    }
  });

  it("each term has all required fields", () => {
    for (const t of GLOSSARY) {
      expect(t.term.length).toBeGreaterThan(2);
      expect(t.definition.length).toBeGreaterThan(40);
      expect(t.definition.length).toBeLessThan(300);
      expect(t.longExplanation.length).toBeGreaterThan(0);
      for (const p of t.longExplanation) {
        expect(p.length).toBeGreaterThan(30);
      }
      expect(GLOSSARY_CATEGORIES).toContain(t.category);
    }
  });

  it("relatedTerms slugs are all valid", () => {
    const validSlugs = new Set(ALL_GLOSSARY_SLUGS);
    for (const t of GLOSSARY) {
      for (const related of t.relatedTerms) {
        expect(validSlugs).toContain(related);
      }
    }
  });

  it("getTermBySlug returns the correct term", () => {
    const sample = GLOSSARY[0];
    const found = getTermBySlug(sample.slug);
    expect(found?.slug).toBe(sample.slug);
  });

  it("getTermBySlug returns null for unknown slug", () => {
    expect(getTermBySlug("does-not-exist")).toBeNull();
    expect(getTermBySlug("")).toBeNull();
  });

  it("getRelatedTerms excludes the current term", () => {
    const term = GLOSSARY.find((t) => t.relatedTerms.length > 0)!;
    const related = getRelatedTerms(term.slug);
    for (const r of related) {
      expect(r.slug).not.toBe(term.slug);
    }
  });

  it("getRelatedTerms returns valid terms", () => {
    for (const t of GLOSSARY) {
      const related = getRelatedTerms(t.slug);
      expect(related.length).toBeLessThanOrEqual(t.relatedTerms.length);
      for (const r of related) {
        expect(getTermBySlug(r.slug)).not.toBeNull();
      }
    }
  });

  it("relatedTools point to existing site URLs", () => {
    const validPaths = [
      "/calculadora-isd",
      "/calculadora-donaciones",
      "/borrador-modelo650",
      "/borrador-modelo651",
      "/comparador-isd",
      "/donaciones",
      "/plantillas-documentos",
      "/seguridad",
      "/integraciones",
      "/#demo",
    ];
    for (const t of GLOSSARY) {
      for (const tool of t.relatedTools) {
        const ok = validPaths.some((p) => tool.href.startsWith(p));
        expect(ok).toBe(true);
      }
    }
  });

  it("every category has at least one term", () => {
    for (const cat of GLOSSARY_CATEGORIES) {
      const matches = GLOSSARY.filter((t) => t.category === cat);
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it("normRef references real articles when present", () => {
    for (const t of GLOSSARY) {
      if (t.normRef) {
        // Should mention Art., Ley, RD or LGT
        expect(t.normRef).toMatch(/(Art\.|Ley|RD|LGT)/);
      }
    }
  });
});
