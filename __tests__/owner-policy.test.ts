/**
 * Politica de OWNER y VIEWER de solo lectura.
 *
 * HANDLER TESTS con Prisma mockeado (no E2E). La concurrencia real de la
 * proteccion del ultimo OWNER se verifica en las pruebas de integracion con
 * PostgreSQL; aqui se comprueba la logica de decision.
 *
 * Fallan con la implementacion anterior, donde `role` llegaba del body sin
 * validar hasta `prisma.membership.update` y ningun control impedia que un
 * MANAGER se auto-promoviera a OWNER.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { checkRoleAssignment, isValidRole, hasPermission } from "../src/lib/rbac";

const getServerSessionMock = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("../src/lib/auth", () => ({ authOptions: {} }));
vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../src/lib/prisma";
import { PATCH as patchMember, DELETE as deleteMember } from "../src/app/api/users/[id]/route";
import { fakeUserRow } from "./helpers/verified-session";

const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const memFindFirst = prisma.membership.findFirst as unknown as ReturnType<typeof vi.fn>;
const memCount = prisma.membership.count as unknown as ReturnType<typeof vi.fn>;
const txMock = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

function actor(role: Role | string, userId = "actor-1") {
  getServerSessionMock.mockResolvedValue({
    user: { id: userId, email: "a@b.c", orgId: "org-1", role: "OWNER" },
  });
  userFindUnique.mockResolvedValue(fakeUserRow({ userId, orgId: "org-1", role }));
}

/** Ejecuta el callback de la transaccion contra un cliente simulado. */
function runTransaction(state: { role: Role; ownerCount: number }) {
  txMock.mockImplementation(async (cb: any) =>
    cb({
      membership: {
        findFirst: async () => ({ id: "mem-target", role: state.role }),
        count: async () => state.ownerCount,
        update: async () => ({}),
        delete: async () => ({}),
      },
    }),
  );
}

const req = (body: unknown) => ({ json: async () => body }) as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkRoleAssignment — reglas puras", () => {
  it("un MANAGER no puede asignar el rol OWNER", () => {
    const denial = checkRoleAssignment({
      actorRole: Role.MANAGER,
      actorUserId: "m1",
      targetUserId: "u2",
      targetRole: Role.OWNER,
      currentTargetRole: Role.OPERATOR,
    });
    expect(denial).toMatch(/Sólo un Owner/i);
  });

  it("un MANAGER no puede auto-promoverse a OWNER", () => {
    const denial = checkRoleAssignment({
      actorRole: Role.MANAGER,
      actorUserId: "m1",
      targetUserId: "m1",
      targetRole: Role.OWNER,
      currentTargetRole: Role.MANAGER,
    });
    expect(denial).toBeTruthy();
  });

  it("nadie puede cambiar su propio rol", () => {
    const denial = checkRoleAssignment({
      actorRole: Role.OWNER,
      actorUserId: "o1",
      targetUserId: "o1",
      targetRole: Role.VIEWER,
      currentTargetRole: Role.OWNER,
    });
    expect(denial).toMatch(/tu propio rol/i);
  });

  it("un MANAGER no puede degradar a un OWNER", () => {
    const denial = checkRoleAssignment({
      actorRole: Role.MANAGER,
      actorUserId: "m1",
      targetUserId: "o1",
      targetRole: Role.VIEWER,
      currentTargetRole: Role.OWNER,
    });
    expect(denial).toBeTruthy();
  });

  it("un OWNER si puede promover a otro miembro a OWNER", () => {
    const denial = checkRoleAssignment({
      actorRole: Role.OWNER,
      actorUserId: "o1",
      targetUserId: "u2",
      targetRole: Role.OWNER,
      currentTargetRole: Role.MANAGER,
    });
    expect(denial).toBeNull();
  });

  it("rechaza valores que no son roles del enum", () => {
    expect(isValidRole("SUPERUSER")).toBe(false);
    expect(isValidRole("owner")).toBe(false);
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(Role.OWNER)).toBe(true);
  });
});

describe("PATCH /api/users/[id] — cambio de rol", () => {
  it("rechaza un rol inventado antes de tocar la base de datos", async () => {
    actor(Role.OWNER);
    const res = await patchMember(req({ role: "SUPERUSER" }), { params: { id: "u2" } });
    expect(res.status).toBe(400);
    expect(prisma.membership.update).not.toHaveBeenCalled();
    expect(txMock).not.toHaveBeenCalled();
  });

  it("un MANAGER no puede promover a nadie a OWNER", async () => {
    actor(Role.MANAGER);
    memFindFirst.mockResolvedValue({ id: "mem-2", role: Role.OPERATOR });

    const res = await patchMember(req({ role: "OWNER" }), { params: { id: "u2" } });
    expect(res.status).toBe(403);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("un MANAGER no puede auto-promoverse a OWNER", async () => {
    actor(Role.MANAGER, "manager-1");
    memFindFirst.mockResolvedValue({ id: "mem-1", role: Role.MANAGER });

    const res = await patchMember(req({ role: "OWNER" }), { params: { id: "manager-1" } });
    expect(res.status).toBe(403);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("no se puede degradar al ultimo OWNER", async () => {
    actor(Role.OWNER);
    memFindFirst.mockResolvedValue({ id: "mem-2", role: Role.OWNER });
    runTransaction({ role: Role.OWNER, ownerCount: 1 });

    const res = await patchMember(req({ role: "VIEWER" }), { params: { id: "u2" } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/al menos un Owner/i);
  });

  it("si quedan dos OWNER, degradar a uno esta permitido", async () => {
    actor(Role.OWNER);
    memFindFirst.mockResolvedValue({ id: "mem-2", role: Role.OWNER });
    runTransaction({ role: Role.OWNER, ownerCount: 2 });

    const res = await patchMember(req({ role: "MANAGER" }), { params: { id: "u2" } });
    expect(res.status).toBe(200);
  });

  it("el recuento de owners se hace dentro de la transaccion, no fuera", async () => {
    actor(Role.OWNER);
    memFindFirst.mockResolvedValue({ id: "mem-2", role: Role.OWNER });
    runTransaction({ role: Role.OWNER, ownerCount: 2 });

    await patchMember(req({ role: "MANAGER" }), { params: { id: "u2" } });

    // El count de fuera de la transaccion no debe usarse para decidir: si se
    // usara, dos degradaciones simultaneas podrian dejar la org sin OWNER.
    expect(memCount).not.toHaveBeenCalled();
    expect(txMock).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/users/[id] — expulsion", () => {
  it("no se puede eliminar al ultimo OWNER", async () => {
    actor(Role.OWNER);
    memFindFirst.mockResolvedValue({ id: "mem-2", role: Role.OWNER });
    runTransaction({ role: Role.OWNER, ownerCount: 1 });

    const res = await deleteMember({} as any, { params: { id: "u2" } });
    expect(res.status).toBe(409);
  });

  it("un MANAGER no puede expulsar a un OWNER", async () => {
    actor(Role.MANAGER);
    memFindFirst.mockResolvedValue({ id: "mem-2", role: Role.OWNER });

    const res = await deleteMember({} as any, { params: { id: "u2" } });
    expect(res.status).toBe(403);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("nadie puede eliminarse a si mismo", async () => {
    actor(Role.OWNER, "actor-1");
    const res = await deleteMember({} as any, { params: { id: "actor-1" } });
    expect(res.status).toBe(400);
  });
});

describe("VIEWER es realmente de solo lectura", () => {
  it("no puede aprobar acciones del autopilot", () => {
    // Regresion: VIEWER tenia "autopilot.approve", una mutacion encubierta
    // bajo una etiqueta comercial de solo lectura.
    expect(hasPermission(Role.VIEWER, "autopilot.approve")).toBe(false);
  });

  it("no tiene ningun permiso que no termine en .read", () => {
    const writePermissions = [
      "cases.create",
      "cases.update",
      "cases.delete",
      "tasks.create",
      "tasks.update",
      "documents.create",
      "documents.delete",
      "templates.create",
      "org.settings",
      "org.members.invite",
      "billing.manage",
      "autopilot.run",
      "autopilot.approve",
      "autopilot.configure",
      "workflow.manage",
      "casetemplates.manage",
    ];
    for (const p of writePermissions) {
      expect(hasPermission(Role.VIEWER, p), `VIEWER no debe tener ${p}`).toBe(false);
    }
  });

  it("conserva las lecturas", () => {
    expect(hasPermission(Role.VIEWER, "cases.read")).toBe(true);
    expect(hasPermission(Role.VIEWER, "documents.read")).toBe(true);
  });

  it("los roles operativos si conservan la aprobacion", () => {
    expect(hasPermission(Role.OPERATOR, "autopilot.approve")).toBe(true);
    expect(hasPermission(Role.MANAGER, "autopilot.approve")).toBe(true);
    expect(hasPermission(Role.OWNER, "autopilot.approve")).toBe(true);
  });
});
