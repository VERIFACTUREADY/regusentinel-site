import { describe, it, expect } from "vitest";
import { z } from "zod";
// Importamos el schema REAL: una copia inline divergió del de producción
// (aceptaba null y usaba "relationship") y ocultó un bug del wizard de alta.
import {
  createCaseSchema,
  batchTaskSchema,
  createTaskSchema,
  updateTaskSchema,
} from "../src/lib/validations";

const CUID_VALIDO = "ckabcdefgh1234567890ab";

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

    // Regresión: el wizard (y otros clientes JS) serializan los opcionales
    // vacíos como null; el schema debe tratarlos como undefined en vez de
    // rechazar el alta con "Datos invalidos".
    it("should accept null for empty optional fields", () => {
      const result = createCaseSchema.safeParse({
        deceasedName: "Maria Garcia",
        contactName: "Juan Garcia",
        contactPhone: "600111222",
        contactEmail: null,
        province: null,
        notes: null,
        deathDate: null,
        deceasedDni: null,
        contactRelationship: null,
        categories: ["BANCOS"],
        consentAccepted: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contactEmail).toBeUndefined();
        expect(result.data.province).toBeUndefined();
      }
    });

    it("should still require email or phone when both are null", () => {
      const result = createCaseSchema.safeParse({
        deceasedName: "Maria Garcia",
        contactName: "Juan Garcia",
        contactPhone: null,
        contactEmail: null,
        categories: ["BANCOS"],
        consentAccepted: true,
      });
      expect(result.success).toBe(false);
    });

    it("should keep contactRelationship in parsed output", () => {
      const result = createCaseSchema.safeParse({
        deceasedName: "Maria Garcia",
        contactName: "Juan Garcia",
        contactEmail: "juan@example.com",
        contactRelationship: "Hijo/a",
        categories: ["BANCOS"],
        consentAccepted: true,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.contactRelationship).toBe("Hijo/a");
    });
  });

  // Regresión: la organización pública de demo usa tres ids estables
  // (demo-user-owner/operator/viewer) en vez de CUID, porque su reset diario
  // reconstruye relaciones deterministas. Antes, el validador exigia CUID sin
  // excepcion y el selector de responsable de la demo se rechazaba antes de
  // llegar a la comprobacion real de membresia en la organizacion.
  describe("assigneeId (ids de demo + CUID)", () => {
    it("createTaskSchema acepta el id de demo demo-user-owner", () => {
      const result = createTaskSchema.safeParse({
        category: "BANCOS",
        title: "Tarea de prueba",
        assigneeId: "demo-user-owner",
      });
      expect(result.success).toBe(true);
    });

    it("updateTaskSchema acepta el id de demo demo-user-operator", () => {
      const result = updateTaskSchema.safeParse({
        taskId: CUID_VALIDO,
        assigneeId: "demo-user-operator",
      });
      expect(result.success).toBe(true);
    });

    it("batchTaskSchema sigue aceptando un CUID normal", () => {
      const result = batchTaskSchema.safeParse({
        taskIds: [CUID_VALIDO],
        assigneeId: CUID_VALIDO,
      });
      expect(result.success).toBe(true);
    });

    it("rechaza un assigneeId vacio", () => {
      const result = createTaskSchema.safeParse({
        category: "BANCOS",
        title: "Tarea de prueba",
        assigneeId: "",
      });
      expect(result.success).toBe(false);
    });

    it("rechaza un identificador arbitrario o excesivamente largo", () => {
      const arbitrario = updateTaskSchema.safeParse({
        taskId: CUID_VALIDO,
        assigneeId: "usuario-cualquiera",
      });
      expect(arbitrario.success).toBe(false);

      const excesivo = updateTaskSchema.safeParse({
        taskId: CUID_VALIDO,
        assigneeId: "demo-user-owner".repeat(50),
      });
      expect(excesivo.success).toBe(false);
    });

    it("acepta los tres ids de demo permitidos y rechaza prefijos parecidos no autorizados", () => {
      for (const id of ["demo-user-owner", "demo-user-operator", "demo-user-viewer"]) {
        expect(updateTaskSchema.safeParse({ taskId: CUID_VALIDO, assigneeId: id }).success).toBe(true);
      }
      for (const id of ["demo-user-admin", "demo-user-inventado", "demo-user"]) {
        expect(updateTaskSchema.safeParse({ taskId: CUID_VALIDO, assigneeId: id }).success).toBe(false);
      }
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
