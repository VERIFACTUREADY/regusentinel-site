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
  ],

  [Role.VIEWER]: ALL_PERMISSIONS.filter((p) => p.endsWith(".read")),

  [Role.MANAGED_OPS]: [
    // Same as OPERATOR
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
    // Plus autopilot
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

export { Role, ALL_PERMISSIONS, type Permission };
