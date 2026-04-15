import { z } from "zod";
import {
  TaskCategory,
  CaseStatus,
  Role,
} from "@prisma/client";

// ─── Enum value arrays for Zod ─────────────────────────

const taskCategories = Object.values(TaskCategory) as [TaskCategory, ...TaskCategory[]];
const caseStatuses = Object.values(CaseStatus) as [CaseStatus, ...CaseStatus[]];
const roles = Object.values(Role) as [Role, ...Role[]];

// ─── Case schemas ──────────────────────────────────────

export const createCaseSchema = z
  .object({
    deceasedName: z
      .string()
      .min(1, "El nombre del fallecido es obligatorio")
      .max(200),
    contactName: z
      .string()
      .min(1, "El nombre del contacto es obligatorio")
      .max(200),
    contactEmail: z.string().email("Email no valido").optional().or(z.literal("")),
    contactPhone: z.string().max(20).optional().or(z.literal("")),
    province: z.string().max(100).optional(),
    categories: z
      .array(z.nativeEnum(TaskCategory))
      .min(1, "Seleccione al menos una categoria"),
    isUrgent: z.boolean().default(false),
    hasDeceasedInsurance: z.boolean().default(false),
    consentAccepted: z.literal(true, {
      errorMap: () => ({
        message: "Debe aceptar el consentimiento para continuar",
      }),
    }),
    notes: z.string().max(2000).optional(),
    deathDate: z.string().optional(),
    deceasedDni: z.string().max(20).optional(),
    contactRelationship: z.string().max(100).optional(),
  })
  .refine(
    (data) =>
      (data.contactEmail && data.contactEmail.length > 0) ||
      (data.contactPhone && data.contactPhone.length > 0),
    {
      message: "Se requiere al menos un email o telefono de contacto",
      path: ["contactEmail"],
    }
  );

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const updateCaseSchema = z.object({
  deceasedName: z.string().min(1).max(200).optional(),
  contactName: z.string().min(1).max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(20).optional().or(z.literal("")),
  province: z.string().max(100).optional(),
  categories: z.array(z.nativeEnum(TaskCategory)).optional(),
  isUrgent: z.boolean().optional(),
  hasDeceasedInsurance: z.boolean().optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  notes: z.string().max(2000).optional(),
});

export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

// ─── Task schemas ──────────────────────────────────────

export const createTaskSchema = z.object({
  caseId: z.string().cuid("ID de caso invalido"),
  category: z.nativeEnum(TaskCategory),
  title: z.string().min(1, "El titulo es obligatorio").max(300),
  description: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// ─── Template schemas ──────────────────────────────────

export const createTemplateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  category: z.nativeEnum(TaskCategory).optional(),
  type: z.enum(["email", "carta", "solicitud"], {
    errorMap: () => ({ message: "Tipo debe ser email, carta o solicitud" }),
  }),
  body: z.string().min(1, "El cuerpo de la plantilla es obligatorio"),
  variables: z.array(z.string()).default([]),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

// ─── Demo request schema ───────────────────────────────

export const demoRequestSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  email: z.string().email("Email no valido"),
  company: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  message: z.string().max(2000).optional(),
  source: z.string().max(50).optional(),
});

export type DemoRequestInput = z.infer<typeof demoRequestSchema>;

// ─── Auth schemas ──────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Email no valido"),
  password: z.string().min(1, "La contrasena es obligatoria"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email("Email no valido"),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: "Rol no valido" }),
  }),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
