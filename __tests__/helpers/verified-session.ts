/**
 * Utilidades para las pruebas de handlers que ahora pasan por
 * `getVerifiedSession`, que relee usuario, membresia y suscripcion de la base
 * de datos en cada peticion.
 *
 * Antes bastaba con mockear `getServerSession`: el rol venia del JWT. Ahora el
 * JWT solo aporta el id de usuario, asi que las pruebas tienen que devolver
 * tambien la fila de `User` con sus memberships. Esa es exactamente la
 * diferencia que hace que expulsar a alguien surta efecto.
 */
import type { Role } from "@prisma/client";

export interface FakeUserRowOptions {
  userId?: string;
  email?: string;
  name?: string | null;
  orgId?: string;
  orgSlug?: string;
  role?: Role | string;
  plan?: string;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | null;
  /** Sin membresias: simula a un usuario expulsado de la organizacion. */
  memberships?: unknown[];
}

/**
 * Construye la fila que devuelve `prisma.user.findUnique` con el `select` que
 * usa `getVerifiedSession`. Si la forma de ese select cambia, estas pruebas
 * fallan — que es lo que queremos.
 */
export function fakeUserRow(opts: FakeUserRowOptions = {}) {
  const {
    userId = "user-1",
    email = "owner@ejemplo.es",
    name = "Owner",
    orgId = "org-1",
    orgSlug = "org-uno",
    role = "OWNER",
    plan = "INICIA",
    subscriptionStatus = "active",
    currentPeriodEnd = null,
  } = opts;

  const memberships =
    opts.memberships ??
    [
      {
        id: `mem-${userId}`,
        role,
        orgId,
        org: {
          slug: orgSlug,
          subscription: subscriptionStatus
            ? { status: subscriptionStatus, plan, currentPeriodEnd }
            : null,
        },
      },
    ];

  return { id: userId, email, name, memberships };
}

/** Sesion de NextAuth minima: a partir de aqui todo se relee de la base de datos. */
export function fakeJwtSession(userId = "user-1", orgId: string | null = "org-1") {
  return { user: { id: userId, orgId, email: "owner@ejemplo.es", name: "Owner", role: "OWNER" } };
}
