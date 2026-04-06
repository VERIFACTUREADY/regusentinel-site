import { describe, it, expect } from "vitest";
import { z } from "zod";

// Inline validation schemas to avoid Prisma dependency
const createCaseSchema = z.object({
  deceasedName: z.string().min(1, "Nombre del fallecido obligatorio"),
  deathDate: z.string().nullable().optional(),
  deceasedDni: z.string().nullable().optional(),
  contactName: z.string().min(1, "Nombre del solicitante obligatorio"),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  relationship: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  isUrgent: z.boolean().default(false),
  hasDeceasedInsurance: z.boolean().default(false),
  categories: z.array(z.string()).min(1, "Selecciona al menos una categoria"),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar el consentimiento" }),
  }),
});

const demoRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
});

describe("Validation Schemas", () => {
  describe("createCaseSchema", () => {
    it("should accept valid case data", () => {
      const result = createCaseSchema.safeParse({
        deceasedName: "Maria Garcia",
        contactName: "Juan Garcia",
        contactEmail: "juan@example.com",
        categories: ["BANCOS", "SUMINISTROS"],
        consentAccepted: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing deceased name", () => {
      const result = createCaseSchema.safeParse({
        deceasedName: "",
        contactName: "Juan",
        categories: ["BANCOS"],
        consentAccepted: true,
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing consent", () => {
      const result = createCaseSchema.safeParse({
        deceasedName: "Maria",
        contactName: "Juan",
        categories: ["BANCOS"],
        consentAccepted: false,
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty categories", () => {
      const result = createCaseSchema.safeParse({
        deceasedName: "Maria",
        contactName: "Juan",
        categories: [],
        consentAccepted: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("demoRequestSchema", () => {
    it("should accept valid demo request", () => {
      const result = demoRequestSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        company: "Gestoria Example",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = demoRequestSchema.safeParse({
        name: "Test",
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing name", () => {
      const result = demoRequestSchema.safeParse({
        name: "",
        email: "test@example.com",
      });
      expect(result.success).toBe(false);
    });
  });
});
