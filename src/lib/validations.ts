import { z } from "zod";
import {
  TaskCategory,
  TaskStatus,
  CaseStatus,
  Role,
} from "@prisma/client";

// ─── Enum value arrays for Zod ─────────────────────────

const taskCategories = Object.values(TaskCategory) as [TaskCategory, ...TaskCategory[]];
const caseStatuses = Object.values(CaseStatus) as [CaseStatus, ...CaseStatus[]];
const roles = Object.values(Role) as [Role, ...Role[]];

// ─── Case schemas ──────────────────────────────────────

// Los clientes JS suelen serializar los campos vacíos como null; tratamos
// null igual que undefined en los opcionales para no rechazar el alta.
const nullAsUndefined = (v: unknown) => (v === null ? undefined : v);

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
    contactEmail: z.preprocess(nullAsUndefined, z.string().email("Email no valido").optional().or(z.literal(""))),
    contactPhone: z.preprocess(nullAsUndefined, z.string().max(20).optional().or(z.literal(""))),
    province: z.preprocess(nullAsUndefined, z.string().max(100).optional()),
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
    notes: z.preprocess(nullAsUndefined, z.string().max(2000).optional()),
    deathDate: z.preprocess(nullAsUndefined, z.string().optional()),
    deceasedDni: z.preprocess(nullAsUndefined, z.string().max(20).optional()),
    contactRelationship: z.preprocess(nullAsUndefined, z.string().max(100).optional()),
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
  preferredTime: z.enum(["manana", "mediodia", "tarde"]).optional(),
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

// ─── Task schemas ──────────────────────────────────────
//
// Antes, crear y actualizar tareas leia el body sin validar: `status` y
// `category` llegaban como string arbitrario hasta Prisma, y `title` podia
// ser vacio, un objeto o venir sin limite de longitud.

const taskStatuses = Object.values(TaskStatus) as [TaskStatus, ...TaskStatus[]];

/** Fecha ISO opcional; acepta null para borrarla. */
const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.string().date(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined ? v : new Date(v)))
  .refine((v) => v === null || v === undefined || !Number.isNaN(v.getTime()), {
    message: "Fecha no valida",
  });

export const createTaskSchema = z.object({
  category: z.enum(taskCategories, { errorMap: () => ({ message: "Categoria no valida" }) }),
  title: z.string().trim().min(1, "El titulo es obligatorio").max(300, "Titulo demasiado largo"),
  description: z.string().max(5000, "Descripcion demasiado larga").nullish(),
  dueDate: optionalDate,
  assigneeId: z.string().cuid("assigneeId no valido").nullish(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  taskId: z.string().cuid("taskId no valido"),
  status: z.enum(taskStatuses, { errorMap: () => ({ message: "Estado no valido" }) }).optional(),
  assigneeId: z.string().cuid("assigneeId no valido").nullish(),
  dependsOnId: z.string().cuid("dependsOnId no valido").nullish(),
  blockReason: z.string().max(500).nullish(),
  blockedUntil: optionalDate,
  deadline: optionalDate,
  dueDate: optionalDate,
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(5000).nullish(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * Actualizacion en bloque de tareas. Los ids se filtran despues por
 * organizacion; aqui solo se valida la forma y los enums.
 */
export const batchTaskSchema = z.object({
  taskIds: z.array(z.string().cuid()).min(1, "1-100 tareas requeridas").max(100, "1-100 tareas requeridas"),
  status: z.enum(taskStatuses, { errorMap: () => ({ message: "Estado no valido" }) }).optional(),
  assigneeId: z.string().cuid("assigneeId no valido").nullish(),
});

export type BatchTaskInput = z.infer<typeof batchTaskSchema>;
