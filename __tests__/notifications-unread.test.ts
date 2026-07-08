import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de sesión y prisma ANTES de importar el SUT (hoisting de vi.mock).
const getServerSessionMock = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => getServerSessionMock(...args) }));
vi.mock("../src/lib/auth", () => ({ authOptions: {} }));
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    notificationLog: { findMany: vi.fn().mockResolvedValue([]) },
    task: { findMany: vi.fn().mockResolvedValue([]) },
    case: { findMany: vi.fn().mockResolvedValue([]) },
    portalMessage: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { GET } from "../src/app/api/notifications/unread/route";
import { prisma } from "../src/lib/prisma";

describe("GET /api/notifications/unread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve 401 sin sesión", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  // Regresión: un usuario autenticado sin organización (alta por Google SSO
  // pendiente de crear la org) recibía 401 y la campana del shell spameaba
  // errores en consola cada minuto. Debe recibir 200 con lista vacía.
  it("devuelve 200 vacío para usuario autenticado sin organización", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "ans@test.local", orgId: null, role: null } });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ alerts: [], unreadCount: 0 });
    // Y no toca la base de datos.
    expect(prisma.notificationLog.findMany).not.toHaveBeenCalled();
  });

  it("consulta alertas para usuario con organización", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c", orgId: "org1", role: "OWNER" } });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unreadCount).toBe(0);
    expect(prisma.notificationLog.findMany).toHaveBeenCalled();
  });
});
