/**
 * Sesión verificada contra base de datos.
 *
 * PROBLEMA QUE RESUELVE
 * ---------------------
 * NextAuth está configurado con `strategy: "jwt"` y `maxAge` de 30 días, y el
 * token transporta `orgId` y `role`. El callback `jwt` sólo recarga la
 * membresía cuando el token todavía no tiene `orgId`, así que una vez fijado
 * el rol **nunca se refresca**: un usuario expulsado, degradado o cuya cuenta
 * ha sido borrada conserva sus permisos hasta que el token caduca.
 *
 * Este módulo es la única fuente de verdad de autorización. En cada petición:
 *   1. Lee la sesión de NextAuth (sólo para saber *quién dice ser*).
 *   2. Comprueba en PostgreSQL que el usuario sigue existiendo.
 *   3. Comprueba que sigue teniendo membresía en la organización.
 *   4. Toma el rol **de la base de datos**, nunca del JWT.
 *   5. Aplica el permiso requerido y el estado de suscripción.
 *
 * El JWT queda reducido a un identificador de usuario: si se manipula el
 * `role` o el `orgId` que contiene, no tiene ningún efecto porque ambos se
 * releen. Esto hace innecesaria una versión de sesión o lista de revocación:
 * la revocación es inmediata porque el estado vive en la base de datos.
 *
 * Coste: una consulta indexada por petición autenticada (`Membership` tiene
 * `@@unique([userId, orgId])`). Es el precio de que expulsar a alguien
 * signifique algo.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { Role, type PlanTier } from "@prisma/client";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { hasPermission } from "./rbac";
import { DEMO_ORG_SLUG } from "./demo-data";

/** Identidad y contexto ya verificados contra la base de datos. */
export interface VerifiedSession {
  userId: string;
  email: string;
  name: string | null;
  orgId: string;
  orgSlug: string;
  /** Rol vigente en base de datos, no el del JWT. */
  role: Role;
  membershipId: string;
  plan: PlanTier;
  subscriptionStatus: string | null;
  /** true si la suscripción no permite operar (impago, cancelada, trial vencido). */
  suspended: boolean;
  /** Organización de demo pública: exenta de la suspensión. */
  isDemoOrg: boolean;
  /**
   * Misma identidad en la forma `session.user.*` que ya usan las rutas.
   * Todos estos campos vienen de la base de datos, no del JWT, así que el
   * código existente que lee `session.user.role` pasa a estar verificado sin
   * reescribir su cuerpo.
   */
  user: {
    id: string;
    email: string;
    name: string | null;
    orgId: string;
    role: Role;
  };
}

/** Motivo por el que una sesión no es utilizable. */
export type SessionFailure =
  | "unauthenticated" // sin sesión NextAuth
  | "user_gone" // cuenta borrada o anonimizada
  | "no_membership" // expulsado de la organización
  | "forbidden" // rol sin el permiso requerido
  | "suspended"; // suscripción inactiva

export type AuthResult =
  | { ok: true; session: VerifiedSession }
  | { ok: false; reason: SessionFailure; response: NextResponse };

/**
 * Estados de suscripción que suspenden el acceso. `trialing` no suspende por
 * sí mismo: se comprueba además que el periodo no haya vencido.
 */
const SUSPENDING_STATUSES = new Set(["canceled", "past_due", "unpaid", "incomplete_expired"]);

/**
 * Marca de cuenta anonimizada por borrado (ver `api/account/me`). El row User
 * se conserva por integridad referencial, pero no debe poder autenticarse.
 */
const DELETED_EMAIL_DOMAIN = "@heredia.invalid";

function isSuspended(
  status: string | null | undefined,
  currentPeriodEnd: Date | null | undefined,
): boolean {
  if (!status) return false;
  if (SUSPENDING_STATUSES.has(status)) return true;
  // Trial vencido: el cron `trial-expired` puede no haber corrido todavía,
  // así que la fecha manda sobre el estado almacenado.
  if (status === "trialing" && currentPeriodEnd && currentPeriodEnd.getTime() < Date.now()) {
    return true;
  }
  return false;
}

/**
 * Devuelve la sesión verificada contra base de datos, o `null` si el usuario
 * no está autenticado, ha sido borrado o ya no pertenece a la organización.
 *
 * Reutilizable desde rutas API y desde server components.
 */
export async function getVerifiedSession(): Promise<VerifiedSession | null> {
  let raw;
  try {
    raw = await getServerSession(authOptions);
  } catch {
    return null;
  }

  const userId = raw?.user?.id;
  if (!userId) return null;

  // Una sola consulta: usuario + membresías + suscripción de cada organización.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          orgId: true,
          org: {
            select: {
              slug: true,
              subscription: {
                select: { status: true, plan: true, currentPeriodEnd: true },
              },
            },
          },
        },
      },
    },
  });

  // Cuenta borrada: el row puede seguir existiendo anonimizado, pero no
  // autentica. Comprobamos ambos casos.
  if (!user) return null;
  if (user.email.endsWith(DELETED_EMAIL_DOMAIN)) return null;

  if (user.memberships.length === 0) return null;

  // El JWT propone una organización; sólo la aceptamos si la membresía sigue
  // viva. Si no, caemos a la más antigua (equivalente al callback `jwt`).
  const proposedOrgId = raw?.user?.orgId ?? null;
  const membership =
    (proposedOrgId && user.memberships.find((m) => m.orgId === proposedOrgId)) ||
    user.memberships[0];

  const sub = membership.org.subscription;
  const isDemoOrg =
    process.env.DEMO_ENABLED === "true" && membership.org.slug === DEMO_ORG_SLUG;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    orgId: membership.orgId,
    orgSlug: membership.org.slug,
    role: membership.role,
    membershipId: membership.id,
    plan: sub?.plan ?? "INICIA",
    subscriptionStatus: sub?.status ?? null,
    suspended: !isDemoOrg && isSuspended(sub?.status, sub?.currentPeriodEnd),
    isDemoOrg,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      orgId: membership.orgId,
      role: membership.role,
    },
  };
}

/** Identidad verificada sin exigir membresía. */
export interface VerifiedUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Comprueba contra la base de datos que el usuario del JWT sigue existiendo y
 * no está anonimizado, **sin** exigir que pertenezca a ninguna organización.
 *
 * Necesario en dos sitios donde no puede haber membresía todavía o nunca:
 *   - alta de organización (el usuario acaba de registrarse);
 *   - panel de superadmin (el equipo de Heredia no es miembro del cliente).
 *
 * Sigue cerrando el agujero principal: una cuenta borrada deja de autenticar
 * de inmediato aunque su JWT siga siendo criptográficamente válido.
 */
export async function getVerifiedUser(): Promise<VerifiedUser | null> {
  let raw;
  try {
    raw = await getServerSession(authOptions);
  } catch {
    return null;
  }

  const userId = raw?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) return null;
  if (user.email.endsWith(DELETED_EMAIL_DOMAIN)) return null;

  return user;
}

function fail(reason: SessionFailure, status: number, error: string, extra?: Record<string, unknown>): AuthResult {
  return {
    ok: false,
    reason,
    response: NextResponse.json({ error, ...extra }, { status }),
  };
}

export interface RequireOptions {
  /**
   * Permite continuar aunque la suscripción esté suspendida. Reservado para
   * los endpoints de facturación, que son justamente los que permiten
   * reactivar el servicio.
   */
  allowSuspended?: boolean;
}

/**
 * Puerta única de las rutas API privadas.
 *
 * Uso:
 *   const auth = await requireOrgPermission("cases.read");
 *   if (!auth.ok) return auth.response;
 *   const { orgId, userId, role } = auth.session;
 *
 * Sustituye al patrón antiguo (`getServerSession` + `hasPermission` sobre el
 * rol del JWT), que no detectaba expulsiones ni degradaciones.
 */
export async function requireOrgPermission(
  permission: string,
  options: RequireOptions = {},
): Promise<AuthResult> {
  const session = await getVerifiedSession();

  if (!session) {
    return fail("unauthenticated", 401, "No autorizado");
  }

  if (!hasPermission(session.role, permission)) {
    return fail("forbidden", 403, "No tienes permisos para realizar esta acción", {
      required: permission,
    });
  }

  if (session.suspended && !options.allowSuspended) {
    return fail(
      "suspended",
      402,
      "Suscripción inactiva. Un Owner debe reactivar el plan desde Facturación para seguir operando.",
    );
  }

  return { ok: true, session };
}

/**
 * Exige sesión válida sin comprobar ningún permiso concreto. Para endpoints
 * que sólo necesitan saber que quien llama sigue siendo miembro vivo de la
 * organización (perfil propio, preferencias, cierre de sesión).
 */
export async function requireSession(options: RequireOptions = {}): Promise<AuthResult> {
  const session = await getVerifiedSession();

  if (!session) {
    return fail("unauthenticated", 401, "No autorizado");
  }

  if (session.suspended && !options.allowSuspended) {
    return fail(
      "suspended",
      402,
      "Suscripción inactiva. Un Owner debe reactivar el plan desde Facturación para seguir operando.",
    );
  }

  return { ok: true, session };
}

/**
 * Acceso a facturación. Sólo el OWNER puede gestionarla, y puede hacerlo
 * **aunque la cuenta esté suspendida** — es la única vía de reactivación.
 */
export async function requireBillingAccess(
  permission: "billing.read" | "billing.manage" = "billing.read",
): Promise<AuthResult> {
  return requireOrgPermission(permission, { allowSuspended: true });
}

/**
 * Comprueba el estado de suscripción de una organización ya conocida. Se usa
 * en los flujos que no parten de una sesión de usuario (crons, portal).
 */
export async function isOrgSuspended(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      slug: true,
      subscription: { select: { status: true, currentPeriodEnd: true } },
    },
  });
  if (!org) return true;
  if (process.env.DEMO_ENABLED === "true" && org.slug === DEMO_ORG_SLUG) return false;
  return isSuspended(org.subscription?.status, org.subscription?.currentPeriodEnd);
}

export { Role };
