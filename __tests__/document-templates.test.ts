import { describe, it, expect } from "vitest";
import {
  DOCUMENT_TEMPLATES,
  ALL_TEMPLATE_SLUGS,
  getTemplateBySlug,
  renderTemplate,
} from "../src/lib/document-templates";
import { generateTemplatePDF } from "../src/lib/template-pdf";

describe("document-templates", () => {
  it("exposes at least 6 templates", () => {
    expect(DOCUMENT_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });

  it("each template has unique slug", () => {
    const set = new Set(ALL_TEMPLATE_SLUGS);
    expect(set.size).toBe(ALL_TEMPLATE_SLUGS.length);
  });

  it("each template has all required fields", () => {
    for (const t of DOCUMENT_TEMPLATES) {
      expect(t.slug).toMatch(/^[a-z0-9-]+$/);
      expect(t.title.length).toBeGreaterThan(15);
      expect(t.description.length).toBeGreaterThan(40);
      expect(t.body.length).toBeGreaterThan(200);
      expect(t.fields.length).toBeGreaterThan(2);
      expect(t.documentTitle.length).toBeGreaterThan(10);
      expect(["banco", "aseguradora", "fiscal", "comunidad", "otros"]).toContain(t.category);
    }
  });

  it("each field has required props", () => {
    for (const t of DOCUMENT_TEMPLATES) {
      for (const f of t.fields) {
        expect(f.key).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
        expect(f.label.length).toBeGreaterThan(2);
        expect(["text", "textarea", "date", "number", "select"]).toContain(f.type);
        if (f.type === "select") {
          expect(f.options).toBeDefined();
          expect(f.options!.length).toBeGreaterThan(1);
        }
      }
    }
  });

  it("getTemplateBySlug returns the correct template", () => {
    const sample = DOCUMENT_TEMPLATES[0];
    const found = getTemplateBySlug(sample.slug);
    expect(found?.slug).toBe(sample.slug);
  });

  it("getTemplateBySlug returns null for unknown slug", () => {
    expect(getTemplateBySlug("does-not-exist")).toBeNull();
    expect(getTemplateBySlug("")).toBeNull();
  });

  it("renderTemplate substitutes placeholders", () => {
    const t = DOCUMENT_TEMPLATES[0];
    const values: Record<string, string> = {};
    for (const f of t.fields) {
      values[f.key] = `VALUE-${f.key}`;
    }
    const rendered = renderTemplate(t, values);
    expect(rendered.body).not.toContain("{{");
    for (const f of t.fields) {
      if (t.body.includes(`{{${f.key}}}`)) {
        expect(rendered.body).toContain(`VALUE-${f.key}`);
      }
    }
  });

  it("renderTemplate marks missing values as PENDIENTE", () => {
    const t = DOCUMENT_TEMPLATES[0];
    const rendered = renderTemplate(t, {});
    // Body should have at least one [PENDIENTE: xxx] marker
    expect(rendered.body).toMatch(/\[PENDIENTE: \w+\]/);
  });

  it("renderTemplate handles reference line substitution", () => {
    const t = getTemplateBySlug("carta-banco-solicitud-saldos")!;
    const rendered = renderTemplate(t, { deceasedName: "Pepe Ejemplo", deceasedDni: "12345678A" });
    expect(rendered.referenceLine).toContain("Pepe Ejemplo");
    expect(rendered.referenceLine).toContain("12345678A");
  });

  it("placeholders in body match field keys", () => {
    for (const t of DOCUMENT_TEMPLATES) {
      const placeholderRegex = /\{\{(\w+)\}\}/g;
      const fieldKeys = new Set(t.fields.map((f) => f.key));
      let match: RegExpExecArray | null;
      while ((match = placeholderRegex.exec(t.body)) !== null) {
        expect(fieldKeys).toContain(match[1]);
      }
    }
  });
});

describe("generateTemplatePDF", () => {
  it("returns a valid PDF byte stream", async () => {
    const t = DOCUMENT_TEMPLATES[0];
    const values: Record<string, string> = {};
    for (const f of t.fields) values[f.key] = `Valor-${f.key}`;
    const rendered = renderTemplate(t, values);

    const bytes = await generateTemplatePDF({
      ...rendered,
      remitenteName: values.remitenteName ?? "Remitente",
      remitenteAddress: values.remitenteAddress ?? "",
      remitenteEmail: values.remitenteEmail ?? "",
      remitentePhone: values.remitentePhone ?? "",
      recipientLabel: t.destinatario,
      generatedBy: "BARITUR PRO",
      generatedAt: new Date(),
    });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("renders all 6 templates without error", async () => {
    for (const t of DOCUMENT_TEMPLATES) {
      const values: Record<string, string> = {};
      for (const f of t.fields) values[f.key] = `Test-${f.key}`;
      const rendered = renderTemplate(t, values);

      const bytes = await generateTemplatePDF({
        ...rendered,
        remitenteName: "Test Remitente",
        remitenteAddress: "Calle Test 1",
        remitenteEmail: "test@example.com",
        remitentePhone: "+34 600 000 000",
        recipientLabel: t.destinatario,
        generatedBy: "BARITUR PRO Test",
        generatedAt: new Date(),
      });

      expect(bytes.length).toBeGreaterThan(1000);
    }
  });

  it("works with empty optional values", async () => {
    const t = DOCUMENT_TEMPLATES[0];
    const rendered = renderTemplate(t, {});

    const bytes = await generateTemplatePDF({
      ...rendered,
      remitenteName: "Anonymous",
      remitenteAddress: "",
      remitenteEmail: "",
      remitentePhone: "",
      recipientLabel: t.destinatario,
      generatedBy: "BARITUR PRO",
      generatedAt: new Date(),
    });

    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("paginates long bodies across multiple pages", async () => {
    const longBody = Array(80).fill("Parrafo de prueba que se repite muchas veces para forzar paginacion en el PDF generado.").join("\n\n");

    const bytes = await generateTemplatePDF({
      documentTitle: "DOCUMENTO LARGO",
      referenceLine: "Test paginacion",
      body: longBody,
      footer: "Footer test",
      remitenteName: "Test",
      remitenteAddress: "Calle 1",
      remitenteEmail: "x@y.es",
      remitentePhone: "+34",
      recipientLabel: "Test",
      generatedBy: "BARITUR PRO",
      generatedAt: new Date(),
    });

    expect(bytes.length).toBeGreaterThan(2000);
  });
});
