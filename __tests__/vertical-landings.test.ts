import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
      // `quote` es opcional a proposito: sin una cita real y verificable, el
      // vertical simplemente no trae una. Si trae una, tiene que ser sustancial.
      if (v.quote) {
        expect(v.quote.text.length).toBeGreaterThan(20);
      }
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

describe("el testimonio fabricado no vuelve", () => {
  /*
   * "Pasamos de 60 herencias al año a 150 con el mismo equipo", atribuido a
   * "Gestoría boutique · Madrid" (en /onboarding) y a una variante casi
   * identica ("Gestoría con 4 gestores — Comunidad Valenciana", en el
   * vertical de gestorias) fue un cliente, una cifra y una atribucion
   * inventados. Se retiraron sin sustituirlos por otra cita inventada: esta
   * prueba falla si alguno de los dos vuelve a aparecer, aqui o en cualquier
   * otro vertical.
   */
  const FRAGMENTOS_PROHIBIDOS = [
    /60 herencias/i,
    /150 con el mismo equipo/i,
    /Gestoría boutique/i,
    /Gestoria boutique/i,
    /Gestoría con 4 gestores/i,
  ];

  it("ningun vertical trae la cifra o la atribucion inventadas", () => {
    for (const slug of ALL_VERTICAL_SLUGS) {
      const v = VERTICAL_CONFIG[slug];
      if (!v.quote) continue;
      for (const patron of FRAGMENTOS_PROHIBIDOS) {
        expect(v.quote.text, `${slug}: quote.text`).not.toMatch(patron);
        expect(v.quote.attribution, `${slug}: quote.attribution`).not.toMatch(patron);
      }
    }
  });

  it("la pagina de registro no vuelve a publicar la cita ni la atribucion", () => {
    const contenido = readFileSync(
      join(process.cwd(), "src/app/onboarding/page.tsx"),
      "utf8",
    );
    for (const patron of FRAGMENTOS_PROHIBIDOS) {
      expect(contenido, `onboarding/page.tsx coincide con ${patron}`).not.toMatch(patron);
    }
  });
});
