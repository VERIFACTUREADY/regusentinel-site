import { describe, it, expect } from "vitest";
import { CCAA_CONTENT, ALL_CCAA_SLUGS, getCCAABySlug } from "../src/lib/ccaa-content";
import { CCAA_LABELS, type CCAAKey } from "../src/lib/isd-calculator";

describe("ccaa-content", () => {
  it("covers all 17 CCAA from CCAA_LABELS", () => {
    const labelKeys = Object.keys(CCAA_LABELS) as CCAAKey[];
    expect(labelKeys.length).toBe(17);
    for (const key of labelKeys) {
      expect(CCAA_CONTENT[key]).toBeDefined();
      expect(CCAA_CONTENT[key].ccaa).toBe(key);
    }
  });

  it("each CCAA has a unique slug", () => {
    const slugs = new Set(ALL_CCAA_SLUGS);
    expect(slugs.size).toBe(ALL_CCAA_SLUGS.length);
    expect(slugs.size).toBe(17);
  });

  it("slugs are URL-safe (lowercase, hyphenated, no accents)", () => {
    for (const slug of ALL_CCAA_SLUGS) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug.length).toBeGreaterThan(0);
    }
  });

  it("getCCAABySlug returns content for valid slug", () => {
    const madrid = getCCAABySlug("madrid");
    expect(madrid).toBeDefined();
    expect(madrid!.ccaa).toBe("MADRID");
    expect(madrid!.capital).toBe("Madrid");
  });

  it("getCCAABySlug returns null for unknown slug", () => {
    expect(getCCAABySlug("atlantis")).toBeNull();
    expect(getCCAABySlug("")).toBeNull();
  });

  it("each CCAA has at least one paragraph and one highlight", () => {
    for (const c of Object.values(CCAA_CONTENT)) {
      expect(c.paragraphs.length).toBeGreaterThan(0);
      expect(c.highlights.length).toBeGreaterThan(0);
      expect(c.haciendaName.length).toBeGreaterThan(0);
      expect(c.haciendaUrl).toMatch(/^https?:\/\//);
    }
  });

  it("each CCAA has at least one FAQ entry", () => {
    for (const c of Object.values(CCAA_CONTENT)) {
      expect(c.faq.length).toBeGreaterThan(0);
      for (const f of c.faq) {
        expect(f.q.length).toBeGreaterThan(5);
        expect(f.a.length).toBeGreaterThan(20);
      }
    }
  });

  it("foral CCAAs reference 'foral' or 'régimen' in their content", () => {
    const navarra = CCAA_CONTENT.NAVARRA;
    const pv = CCAA_CONTENT.PAIS_VASCO;
    expect(JSON.stringify(navarra).toLowerCase()).toContain("foral");
    expect(JSON.stringify(pv).toLowerCase()).toContain("foral");
  });

  it("Madrid content mentions the 99% bonification", () => {
    const madrid = CCAA_CONTENT.MADRID;
    expect(JSON.stringify(madrid)).toContain("99");
  });
});
