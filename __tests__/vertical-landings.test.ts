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

describe("los testimonios fabricados no vuelven", () => {
  /*
   * Tres testimonios fabricados, retirados en dos pasadas:
   *
   *   1. "Pasamos de 60 herencias al año a 150 con el mismo equipo",
   *      atribuido a "Gestoría boutique · Madrid" (en /onboarding) y a una
   *      variante casi identica ("Gestoría con 4 gestores — Comunidad
   *      Valenciana", en el vertical de gestorias).
   *   2. "Pasamos de ser la funeraria que organiza el sepelio...", atribuido
   *      a "Despacho funerario — Comunidad de Madrid" (vertical funerarias).
   *   3. "El audit trail nos sacó de un proceso disciplinario...", atribuido
   *      a "Despacho de derecho sucesorio — Cataluña" (vertical abogados).
   *
   * Los tres eran un cliente, una cifra y una atribucion inventados. Se
   * retiraron sin sustituir ninguno por otra cita inventada, y ya no queda
   * ningun testimonio real que verificar: `quote` se elimino por completo de
   * `VerticalConfig` en vez de dejarlo opcional y sin usar. Estas pruebas
   * fallan si cualquiera de los tres vuelve a aparecer, en cualquier campo de
   * cualquier vertical, o si el campo/la seccion de testimonio resucitan.
   */
  const FRAGMENTOS_PROHIBIDOS = [
    /60 herencias/i,
    /150 con el mismo equipo/i,
    /Gestoría boutique/i,
    /Gestoria boutique/i,
    /Gestoría con 4 gestores/i,
    /Pasamos de ser la funeraria/i,
    /Despacho funerario — Comunidad de Madrid/i,
    /nos sacó de un proceso disciplinario/i,
    /Despacho de derecho sucesorio — Cataluña/i,
  ];

  it("ningun vertical trae, en ningun campo, la cifra, la cita o la atribucion inventadas", () => {
    for (const slug of ALL_VERTICAL_SLUGS) {
      // Se serializa el vertical entero: no solo un campo `quote` que ya no
      // existe, sino cualquier lugar donde el texto pudiera reaparecer
      // (un scenario, una FAQ, un benefit...).
      const serializado = JSON.stringify(VERTICAL_CONFIG[slug]);
      for (const patron of FRAGMENTOS_PROHIBIDOS) {
        expect(serializado, `${slug} coincide con ${patron}`).not.toMatch(patron);
      }
    }
  });

  it("`quote` no existe en ningun vertical: sin cita real, no hay campo, no un opcional sin usar", () => {
    for (const slug of ALL_VERTICAL_SLUGS) {
      expect(
        Object.prototype.hasOwnProperty.call(VERTICAL_CONFIG[slug], "quote"),
        `${slug} todavia declara "quote"`,
      ).toBe(false);
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

  it("el componente de landing vertical ya no tiene una seccion de testimonio ni referencia a `.quote`", () => {
    // Cubre el requisito de que las paginas no se queden con una seccion
    // vacia o un hueco de maquetacion: la seccion no esta condicionada a
    // datos, esta eliminada del JSX.
    const contenido = readFileSync(
      join(process.cwd(), "src/components/vertical-landing.tsx"),
      "utf8",
    );
    expect(contenido).not.toMatch(/\.quote\b/);
    expect(contenido).not.toMatch(/testimonial/i);
    for (const patron of FRAGMENTOS_PROHIBIDOS) {
      expect(contenido, `vertical-landing.tsx coincide con ${patron}`).not.toMatch(patron);
    }
  });
});
