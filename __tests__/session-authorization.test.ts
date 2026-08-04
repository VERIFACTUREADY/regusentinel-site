/**
 * Pruebas de comportamiento de la autorizacion centralizada (`lib/session.ts`).
 *
 * Son HANDLER TESTS: importan el handler y mockean Prisma. No son E2E.
 * La cobertura con base de datos real esta en las pruebas de integracion.
 *
 * Todas estas pruebas FALLAN con la implementacion anterior, en la que el rol
 * y la organizacion se leian del JWT (`session.user.role`) y por tanto
 * sobrevivian hasta 30 dias a una expulsion o una degradacion.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getServerSessionMock = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("../src/lib/auth", () => ({ authOptions: {} }));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../src/lib/prisma";
import {
  getVerifiedSession,
  requireOrgPermission,
  requireBillingAccess,
} from "../src/lib/session";
import { fakeUserRow } from "./helpers/verified-session";

const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

/**
 * El JWT sigue afirmando ser un OWNER de org-1 en todos los casos. Lo que
 * cambia es lo que dice la base de datos. Ese contraste es justamente el
 * agujero que se cierra.
 */
const JWT_CLAIMS_OWNER = {
  user: { id: "user-1", email: "owner@ejemplo.es", name: "Owner", orgId: "org-1", role: "OWNER" },
};

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue(JWT_CLAIMS_OWNER);
});

describe("Revocacion inmediata de sesiones", () => {
  it("un usuario expulsado no puede usar un JWT emitido antes de la expulsion", async () => {
    // El JWT dice OWNER de org-1; en la base de datos ya no hay membresia.
    userFindUnique.mockResolvedValue(fakeUserRow({ memberships: [] }));

    const session = await getVerifiedSession();
    expect(session).toBeNull();

    const auth = await requireOrgPermission("cases.read");
    expect(auth.ok).toBe(false);
    if (!auth.ok) {
      expect(auth.reason).toBe("unauthenticated");
      expect(auth.response.status).toBe(401);
    }
  });

  it("un usuario degradado pierde los permisos del rol antiguo de inmediato", async () => {
    // JWT: OWNER. Base de datos: VIEWER.
    userFindUnique.mockResolvedValue(fakeUserRow({ role: "VIEWER" }));

    const session = await getVerifiedSession();
    expect(session?.role).toBe("VIEWER");

    // Permiso que solo tiene un rol con capacidad de escritura.
    const auth = await requireOrgPermission("cases.create");
    expect(auth.ok).toBe(false);
    if (!auth.ok) {
      expect(auth.reason).toBe("forbidden");
      expect(auth.response.status).toBe(403);
    }
  });

  it("una cuenta borrada no puede acceder aunque conserve el JWT", async () => {
    // `api/account/me` anonimiza el email al dominio .invalid y borra las
    // membresias, pero mantiene la fila por integridad referencial.
    userFindUnique.mockResolvedValue(
      fakeUserRow({ email: "deleted-user-user-1@heredia.invalid", memberships: [] }),
    );

    expect(await getVerifiedSession()).toBeNull();
    const auth = await requireOrgPermission("cases.read");
    expect(auth.ok).toBe(false);
  });

  it("una cuenta borrada que conservara membresias tampoco autentica", async () => {
    // Defensa en profundidad: aunque el borrado dejara una membresia huerfana,
    // el dominio .invalid basta para rechazar.
    userFindUnique.mockResolvedValue(
      fakeUserRow({ email: "deleted-user-user-1@heredia.invalid", role: "OWNER" }),
    );

    expect(await getVerifiedSession()).toBeNull();
  });

  it("un usuario cuya fila ya no existe no autentica", async () => {
    userFindUnique.mockResolvedValue(null);
    expect(await getVerifiedSession()).toBeNull();
  });

  it("el rol del JWT se ignora: manda el de la base de datos", async () => {
    userFindUnique.mockResolvedValue(fakeUserRow({ role: "OPERATOR" }));
    const session = await getVerifiedSession();
    // El JWT decia OWNER.
    expect(session?.role).toBe("OPERATOR");
    expect(session?.user.role).toBe("OPERATOR");
  });

  it("el orgId del JWT se ignora si no hay membresia viva en esa organizacion", async () => {
    // El JWT apunta a org-1; el usuario solo es miembro de org-9.
    userFindUnique.mockResolvedValue(
      fakeUserRow({ orgId: "org-9", orgSlug: "org-nueve", role: "MANAGER" }),
    );
    const session = await getVerifiedSession();
    expect(session?.orgId).toBe("org-9");
    expect(session?.role).toBe("MANAGER");
  });
});

describe("Suspension por suscripcion aplicada en la capa API", () => {
  const suspendedStatuses = ["canceled", "past_due", "unpaid", "incomplete_expired"];

  for (const status of suspendedStatuses) {
    it(`bloquea las APIs privadas con la suscripcion en "${status}"`, async () => {
      userFindUnique.mockResolvedValue(fakeUserRow({ subscriptionStatus: status }));

      const auth = await requireOrgPermission("cases.read");
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.reason).toBe("suspended");
        expect(auth.response.status).toBe(402);
      }
    });
  }

  it("bloquea cuando el trial ha vencido aunque el estado siga siendo trialing", async () => {
    userFindUnique.mockResolvedValue(
      fakeUserRow({
        subscriptionStatus: "trialing",
        currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }),
    );

    const auth = await requireOrgPermission("cases.read");
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toBe("suspended");
  });

  it("permite operar durante un trial vigente", async () => {
    userFindUnique.mockResolvedValue(
      fakeUserRow({
        subscriptionStatus: "trialing",
        currentPeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      }),
    );

    const auth = await requireOrgPermission("cases.read");
    expect(auth.ok).toBe(true);
  });

  it("un OWNER suspendido SI puede entrar en facturacion (unica via de reactivacion)", async () => {
    userFindUnique.mockResolvedValue(
      fakeUserRow({ role: "OWNER", subscriptionStatus: "past_due" }),
    );

    const read = await requireBillingAccess("billing.read");
    expect(read.ok).toBe(true);

    const manage = await requireBillingAccess("billing.manage");
    expect(manage.ok).toBe(true);
  });

  it("un MANAGER suspendido no entra en facturacion: no tiene el permiso", async () => {
    userFindUnique.mockResolvedValue(
      fakeUserRow({ role: "MANAGER", subscriptionStatus: "past_due" }),
    );

    const auth = await requireBillingAccess("billing.manage");
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toBe("forbidden");
  });

  it("no suspende cuando la suscripcion esta activa", async () => {
    userFindUnique.mockResolvedValue(fakeUserRow({ subscriptionStatus: "active" }));
    const auth = await requireOrgPermission("cases.create");
    expect(auth.ok).toBe(true);
  });
});
