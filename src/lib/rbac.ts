import { type NextRequest } from "next/server";
import { Role } from "@prisma/client";

// ─── Permission definitions ────────────────────────────

const ALL_PERMISSIONS = [
  "cases.create",
  "cases.read",
  "cases.update",
  "cases.delete",
  "tasks.create",
  "tasks.read",
  "tasks.update",
  "tasks.delete",
  "documents.create",
  "documents.read",
  "documents.update",
  "documents.delete",
  "templates.create",
  "templates.read",
  "templates.update",
  "templates.delete",
  "org.settings",
  "org.members",
  "org.members.invite",
  "billing.read",
  "billing.manage",
  "audit.read",
  "autopilot.run",
  "autopilot.approve",
  "autopilot.configure",
  "workflow.read",
  "workflow.manage",
  "casetemplates.read",
  "casetemplates.manage",
] as const;

type Permission = (typeof ALL_PERMISSIONS)[number];

const PERMISSIONS_MAP: Record<Role, string[]> = {
  [Role.OWNER]: [...ALL_PERMISSIONS],

  [Role.MANAGER]: ALL_PERMISSIONS.filter(
    (p) =>
      !p.startsWith("billing.") &&
      p !== "org.settings"
  ),

  [Role.OPERATOR]: [
    "cases.create",
    "cases.read",
    "cases.update",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "tasks.delete",
    "documents.create",
    "documents.read",
    "documents.update",
    "documents.delete",
    "templates.read",
    "casetemplates.read",
    "audit.read",
    "workflow.read",
    "autopilot.run",
    "autopilot.approve",
  ],

  // VIEWER es estrictamente de solo lectura. `autopilot.approve` estuvo aquí
  // y era una mutación encubierta bajo una etiqueta comercial de "solo
  // lectura": aprobar una acción del autopilot cambia el estado de la tarea y
  // dispara envíos. Quien deba aprobar necesita OPERATOR o superior.
  [Role.VIEWER]: [...ALL_PERMISSIONS.filter((p) => p.endsWith(".read"))],

  [Role.MANAGED_OPS]: [
    "cases.create",
    "cases.read",
    "cases.update",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "tasks.delete",
    "documents.create",
    "documents.read",
    "documents.update",
    "documents.delete",
    "templates.read",
    "casetemplates.read",
    "autopilot.run",
    "autopilot.approve",
    "autopilot.configure",
  ],
};

// ─── Helpers ────────────────────────────────────────────

/**
 * Checks whether a given role has a specific permission.
 * Supports wildcard patterns: "cases.*" matches "cases.read", "cases.create", etc.
 */
export function hasPermission(role: Role, permission: string): boolean {
  const allowed = PERMISSIONS_MAP[role];
  if (!allowed) return false;

  return allowed.some((p) => {
    if (p === permission) return true;
    // Support wildcard check: if permission is "cases.*", match anything starting with "cases."
    if (permission.endsWith(".*")) {
      const prefix = permission.slice(0, -1); // "cases."
      return p.startsWith(prefix);
    }
    if (p.endsWith(".*")) {
      const prefix = p.slice(0, -1);
      return permission.startsWith(prefix);
    }
    return false;
  });
}

interface SessionUser {
  id: string;
  email: string;
  orgId: string | null;
  role: Role | null;
}

/**
 * Middleware-style helper for API routes.
 * Returns a Response with 403 if the user lacks the required permission,
 * or null if access is granted.
 */
export function requirePermission(
  _request: NextRequest,
  session: { user: SessionUser } | null,
  permission: string
): Response | null {
  if (!session?.user) {
    return new Response(
      JSON.stringify({ error: "No autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!session.user.role) {
    return new Response(
      JSON.stringify({ error: "Sin rol asignado" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!hasPermission(session.user.role, permission)) {
    return new Response(
      JSON.stringify({
        error: "No tienes permisos para realizar esta acción",
        required: permission,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return null; // Access granted
}

// ─── Política de OWNER ──────────────────────────────────
//
// `org.members` lo tienen OWNER y MANAGER. Sin las reglas de abajo, un MANAGER
// podía enviar `role: "OWNER"` en el body y auto-promoverse, porque el valor
// llegaba sin validar hasta `prisma.membership.update`.

/** Roles asignables. Cualquier valor fuera de esta lista se rechaza. */
export const ASSIGNABLE_ROLES: Role[] = [
  Role.OWNER,
  Role.MANAGER,
  Role.OPERATOR,
  Role.VIEWER,
  Role.MANAGED_OPS,
];

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ASSIGNABLE_ROLES as string[]).includes(value);
}

/**
 * Sólo un OWNER puede crear otro OWNER (invitación o promoción). Devuelve el
 * motivo del rechazo, o `null` si la operación está permitida.
 */
export function checkRoleAssignment(params: {
  actorRole: Role;
  actorUserId: string;
  targetUserId: string;
  targetRole: Role;
  /** Rol actual del destinatario; `null` en una invitación. */
  currentTargetRole?: Role | null;
}): string | null {
  const { actorRole, actorUserId, targetUserId, targetRole, currentTargetRole } = params;

  if (targetRole === Role.OWNER && actorRole !== Role.OWNER) {
    return "Sólo un Owner puede asignar el rol Owner.";
  }

  // Nadie cambia su propio rol: es la vía directa de auto-promoción y además
  // permitiría que el último OWNER se degradase dejando la organización huérfana.
  if (actorUserId === targetUserId && currentTargetRole !== undefined && targetRole !== currentTargetRole) {
    return "No puedes cambiar tu propio rol.";
  }

  // Degradar a un OWNER requiere ser OWNER.
  if (currentTargetRole === Role.OWNER && targetRole !== Role.OWNER && actorRole !== Role.OWNER) {
    return "Sólo un Owner puede modificar el rol de otro Owner.";
  }

  return null;
}

export { Role, ALL_PERMISSIONS, type Permission };
