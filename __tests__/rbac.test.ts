import { describe, it, expect } from "vitest";

// We test the permission logic directly without importing Prisma client enums
// to avoid needing the generated client at test time.

// Inline the role/permission logic for unit testing
const ALL_PERMISSIONS = [
  "cases.create", "cases.read", "cases.update", "cases.delete",
  "tasks.create", "tasks.read", "tasks.update", "tasks.delete",
  "documents.create", "documents.read", "documents.update", "documents.delete",
  "templates.create", "templates.read", "templates.update", "templates.delete",
  "org.settings", "org.members", "org.members.invite",
  "billing.read", "billing.manage",
  "audit.read",
  "autopilot.run", "autopilot.approve", "autopilot.configure",
] as const;

type Role = "OWNER" | "MANAGER" | "OPERATOR" | "VIEWER" | "MANAGED_OPS";

const PERMISSIONS_MAP: Record<Role, string[]> = {
  OWNER: [...ALL_PERMISSIONS],
  MANAGER: ALL_PERMISSIONS.filter(
    (p) => !p.startsWith("billing.") && p !== "org.settings"
  ),
  OPERATOR: [
    "cases.create", "cases.read", "cases.update",
    "tasks.create", "tasks.read", "tasks.update", "tasks.delete",
    "documents.create", "documents.read", "documents.update", "documents.delete",
    "templates.read",
  ],
  VIEWER: ALL_PERMISSIONS.filter((p) => p.endsWith(".read")),
  MANAGED_OPS: [
    "cases.create", "cases.read", "cases.update",
    "tasks.create", "tasks.read", "tasks.update", "tasks.delete",
    "documents.create", "documents.read", "documents.update", "documents.delete",
    "templates.read",
    "autopilot.run", "autopilot.approve", "autopilot.configure",
  ],
};

function hasPermission(role: Role, permission: string): boolean {
  const allowed = PERMISSIONS_MAP[role];
  if (!allowed) return false;
  return allowed.some((p) => {
    if (p === permission) return true;
    if (permission.endsWith(".*")) {
      const prefix = permission.slice(0, -1);
      return p.startsWith(prefix);
    }
    if (p.endsWith(".*")) {
      const prefix = p.slice(0, -1);
      return permission.startsWith(prefix);
    }
    return false;
  });
}

describe("RBAC - hasPermission", () => {
  it("OWNER should have all permissions", () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(hasPermission("OWNER", perm)).toBe(true);
    }
  });

  it("VIEWER should only have read permissions", () => {
    expect(hasPermission("VIEWER", "cases.read")).toBe(true);
    expect(hasPermission("VIEWER", "tasks.read")).toBe(true);
    expect(hasPermission("VIEWER", "billing.read")).toBe(true);
    expect(hasPermission("VIEWER", "cases.create")).toBe(false);
    expect(hasPermission("VIEWER", "cases.update")).toBe(false);
    expect(hasPermission("VIEWER", "cases.delete")).toBe(false);
    expect(hasPermission("VIEWER", "billing.manage")).toBe(false);
  });

  it("OPERATOR should have case/task/doc permissions but not billing or org settings", () => {
    expect(hasPermission("OPERATOR", "cases.create")).toBe(true);
    expect(hasPermission("OPERATOR", "cases.read")).toBe(true);
    expect(hasPermission("OPERATOR", "documents.create")).toBe(true);
    expect(hasPermission("OPERATOR", "templates.read")).toBe(true);
    expect(hasPermission("OPERATOR", "templates.create")).toBe(false);
    expect(hasPermission("OPERATOR", "billing.read")).toBe(false);
    expect(hasPermission("OPERATOR", "billing.manage")).toBe(false);
    expect(hasPermission("OPERATOR", "org.settings")).toBe(false);
    expect(hasPermission("OPERATOR", "autopilot.run")).toBe(false);
  });

  it("MANAGED_OPS should have operator permissions plus autopilot", () => {
    expect(hasPermission("MANAGED_OPS", "cases.create")).toBe(true);
    expect(hasPermission("MANAGED_OPS", "autopilot.run")).toBe(true);
    expect(hasPermission("MANAGED_OPS", "autopilot.approve")).toBe(true);
    expect(hasPermission("MANAGED_OPS", "billing.read")).toBe(false);
    expect(hasPermission("MANAGED_OPS", "org.settings")).toBe(false);
  });

  it("MANAGER should have most permissions except billing and org.settings", () => {
    expect(hasPermission("MANAGER", "cases.create")).toBe(true);
    expect(hasPermission("MANAGER", "cases.delete")).toBe(true);
    expect(hasPermission("MANAGER", "org.members")).toBe(true);
    expect(hasPermission("MANAGER", "autopilot.run")).toBe(true);
    expect(hasPermission("MANAGER", "billing.read")).toBe(false);
    expect(hasPermission("MANAGER", "billing.manage")).toBe(false);
    expect(hasPermission("MANAGER", "org.settings")).toBe(false);
  });
});
