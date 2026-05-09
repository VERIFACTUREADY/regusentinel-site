import { describe, it, expect } from "vitest";
import { BLOG_POSTS, getPostBySlug, getRelatedPosts } from "../src/lib/blog-posts";

describe("blog-posts", () => {
  it("exposes at least 8 posts", () => {
    expect(BLOG_POSTS.length).toBeGreaterThanOrEqual(8);
  });

  it("each post has all required fields populated", () => {
    for (const p of BLOG_POSTS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.title.length).toBeGreaterThan(15);
      expect(p.title.length).toBeLessThan(120);
      expect(p.description.length).toBeGreaterThan(40);
      expect(p.description.length).toBeLessThan(220);
      expect(p.lead.length).toBeGreaterThan(50);
      expect(p.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.readingMinutes).toBeGreaterThan(0);
      expect(p.readingMinutes).toBeLessThan(30);
      expect(p.tags.length).toBeGreaterThan(0);
      expect(p.blocks.length).toBeGreaterThan(2);
    }
  });

  it("each slug is unique", () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);
    const set = new Set(slugs);
    expect(set.size).toBe(slugs.length);
  });

  it("each post has at least one h2 block", () => {
    for (const p of BLOG_POSTS) {
      const h2Count = p.blocks.filter((b) => b.type === "h2").length;
      expect(h2Count).toBeGreaterThan(0);
    }
  });

  it("each post has at least one CTA pointing to a product surface", () => {
    const productPaths = ["/calculadora-isd", "/calculadora-donaciones", "/borrador-modelo650", "/borrador-modelo651", "/comparador-isd", "/donaciones", "/#demo"];
    for (const p of BLOG_POSTS) {
      const ctas = p.blocks.filter((b) => b.type === "cta") as { type: "cta"; href: string }[];
      expect(ctas.length).toBeGreaterThan(0);
      const hasProductCTA = ctas.some((c) => productPaths.some((pp) => c.href.startsWith(pp)));
      expect(hasProductCTA).toBe(true);
    }
  });

  it("publishedAt is a valid past or present date", () => {
    const now = Date.now() + 86400000; // tolerate 1 day in future for staging
    for (const p of BLOG_POSTS) {
      const ts = new Date(p.publishedAt).getTime();
      expect(isNaN(ts)).toBe(false);
      expect(ts).toBeLessThanOrEqual(now);
    }
  });

  it("category is one of the allowed values", () => {
    const allowed = ["Plazos", "Tramites", "Fiscalidad", "CCAA", "Profesional"];
    for (const p of BLOG_POSTS) {
      expect(allowed).toContain(p.category);
    }
  });

  it("getPostBySlug returns the correct post", () => {
    const sample = BLOG_POSTS[0];
    const found = getPostBySlug(sample.slug);
    expect(found?.slug).toBe(sample.slug);
  });

  it("getPostBySlug returns null for unknown slug", () => {
    expect(getPostBySlug("does-not-exist")).toBeNull();
    expect(getPostBySlug("")).toBeNull();
  });

  it("getRelatedPosts excludes the current post", () => {
    const sample = BLOG_POSTS[0];
    const related = getRelatedPosts(sample.slug, 3);
    for (const r of related) {
      expect(r.slug).not.toBe(sample.slug);
    }
  });

  it("getRelatedPosts respects the limit", () => {
    const related = getRelatedPosts("any", 2);
    expect(related.length).toBeLessThanOrEqual(2);
  });

  it("ContentBlock types are valid", () => {
    const validTypes = ["h2", "h3", "p", "ul", "ol", "callout", "cta", "quote"];
    for (const p of BLOG_POSTS) {
      for (const block of p.blocks) {
        expect(validTypes).toContain(block.type);
      }
    }
  });

  it("ul/ol blocks have non-empty items", () => {
    for (const p of BLOG_POSTS) {
      for (const block of p.blocks) {
        if (block.type === "ul" || block.type === "ol") {
          expect(block.items.length).toBeGreaterThan(0);
          for (const item of block.items) {
            expect(item.length).toBeGreaterThan(2);
          }
        }
      }
    }
  });

  it("callout blocks have valid tones", () => {
    const validTones = ["info", "warning", "success"];
    for (const p of BLOG_POSTS) {
      for (const block of p.blocks) {
        if (block.type === "callout") {
          expect(validTones).toContain(block.tone);
          expect(block.title.length).toBeGreaterThan(0);
          expect(block.text.length).toBeGreaterThan(10);
        }
      }
    }
  });
});
