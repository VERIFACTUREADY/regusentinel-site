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
 * ESTADOS DE SUSCRIPCIÓN: LISTA BLANCA, NO LISTA NEGRA.
 *
 * Antes esto era una lista negra de cuatro estados
 * (`canceled`, `past_due`, `unpaid`, `incomplete_expired`) más
 * `if (!status) return false`. Dos consecuencias graves:
 *
 *   1. Una organización SIN fila `Subscription` no quedaba suspendida nunca.
 *      Borrar la suscripción —a mano, por un fallo de webhook, o por una
 *      restauración parcial— daba acceso ilimitado con plan INICIA implícito.
 *   2. Cualquier estado que Stripe añada en el futuro, o que llegue con un
 *      valor inesperado, se interpretaba como "puede operar".
 *
 * Ahora se enumeran TODOS los estados que Stripe define para una suscripción y
 * cada uno decide explícitamente. Un valor desconocido, nulo, o la ausencia de
 * la fila entera, suspenden: es la única postura segura para una decisión de
 * facturación.
 *
 * Referencia (Stripe `Subscription.status`):
 *   trialing | active | incomplete | incomplete_expired | past_due | canceled |
 *   unpaid | paused
 */
const ESTADOS_STRIPE = {
  /** Prueba en curso. Permite operar sólo mientras el periodo no haya vencido. */
  trialing: "trial",
  /** Al corriente de pago. */
  active: "operativo",
  /** Primer pago sin confirmar (3-D Secure pendiente). Aún no ha pagado nadie. */
  incomplete: "suspende",
  /** El primer pago nunca se completó y Stripe cerró la suscripción. */
  incomplete_expired: "suspende",
  /** Factura vencida y sin cobrar. */
  past_due: "suspende",
  /** Cancelada. */
  canceled: "suspende",
  /** Agotados los reintentos de cobro. */
  unpaid: "suspende",
  /** Pausada desde Stripe (p. ej. `pause_collection`). */
  paused: "suspende",
} as const satisfies Record<string, "trial" | "operativo" | "suspende">;

export type EstadoStripe = keyof typeof ESTADOS_STRIPE;

/** Lista de estados reconocidos, expuesta para que los tests la recorran entera. */
export const ESTADOS_STRIPE_CONOCIDOS = Object.keys(ESTADOS_STRIPE) as EstadoStripe[];

/**
 * Marca de cuenta anonimizada por borrado (ver `api/account/me`). El row User
 * se conserva por integridad referencial, pero no debe poder autenticarse.
 */
const DELETED_EMAIL_DOMAIN = "@heredia.invalid";

/**
 * ¿Debe suspenderse el acceso?
 *
 * Cierra en falso (suspende) ante: ausencia de suscripción, estado nulo,
 * estado vacío y estado no reconocido.
 */
export function isSuspended(
  status: string | null | undefined,
  currentPeriodEnd: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  // Sin suscripción no hay derecho de uso demostrable. Todas las vías legítimas
  // de alta (`/api/register`, `/api/onboarding/create-organization`) crean la
  // fila en la MISMA transacción que la organización, así que una organización
  // sin ella está en un estado que el producto no genera.
  if (!status) return true;

  const politica = (ESTADOS_STRIPE as Record<string, string | undefined>)[status];

  // Estado que Stripe no documenta o que ha llegado corrupto: no se adivina.
  if (!politica) return true;

  if (politica === "suspende") return true;

  if (politica === "trial") {
    // Trial sin fecha de fin: no se puede comprobar que siga vigente.
    if (!currentPeriodEnd) return true;
    // El cron `trial-expired` puede no haber corrido todavía, así que la fecha
    // manda sobre el estado almacenado.
    return currentPeriodEnd.getTime() < now.getTime();
  }

  return false;
}

/**
 * Resultado detallado de resolver la sesión. `getVerifiedSession` es la
 * envoltura que colapsa todo lo que no sea `ok` a `null`; quien necesite
 * distinguir el motivo —la interfaz, para saber si redirigir a onboarding o a
 * login— usa esta función.
 */
export type ResultadoSesion =
  | { estado: "ok"; sesion: VerifiedSession }
  | { estado: "sin_autenticar" }
  | { estado: "usuario_borrado" }
  | { estado: "sin_membresia" }
  /** El token nombra una organización a la que el usuario ya no pertenece. */
  | { estado: "organizacion_perdida"; orgIdSolicitada: string };

export async function resolverSesion(): Promise<ResultadoSesion> {
  let raw;
  try {
    raw = await getServerSession(authOptions);
  } catch {
    return { estado: "sin_autenticar" };
  }

  const userId = raw?.user?.id;
  if (!userId) return { estado: "sin_autenticar" };

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
  if (!user) return { estado: "usuario_borrado" };
  if (user.email.endsWith(DELETED_EMAIL_DOMAIN)) return { estado: "usuario_borrado" };

  if (user.memberships.length === 0) return { estado: "sin_membresia" };

  // EL JWT PROPONE UNA ORGANIZACIÓN; NO SE CAMBIA POR OTRA EN SILENCIO.
  //
  // Antes, si el `orgId` del token ya no correspondía a ninguna membresía viva
  // se caía a `memberships[0]`. Para un usuario con varias organizaciones eso
  // significaba que, al ser expulsado de la organización A, la petición que
  // pedía datos de A se respondía con datos de B: misma URL, mismo token,
  // organización distinta y sin ninguna señal para el usuario ni para la
  // auditoría. Un `DELETE /api/cases/x` dirigido a A podía ejecutarse contra B.
  //
  // Ahora: si el token nombra una organización y esa membresía ya no existe, la
  // sesión no es utilizable. El usuario vuelve a autenticarse y elige de nuevo.
  // La caída a la membresía más antigua se conserva SÓLO cuando el token no
  // nombra ninguna organización (primer login, antes de que el callback `jwt`
  // haya fijado el `orgId`).
  const proposedOrgId = raw?.user?.orgId ?? null;
  const membership = proposedOrgId
    ? user.memberships.find((m) => m.orgId === proposedOrgId)
    : user.memberships[0];

  if (!membership) {
    return { estado: "organizacion_perdida", orgIdSolicitada: proposedOrgId! };
  }

  const sub = membership.org.subscription;
  const isDemoOrg =
    process.env.DEMO_ENABLED === "true" && membership.org.slug === DEMO_ORG_SLUG;

  const sesion: VerifiedSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    orgId: membership.orgId,
    orgSlug: membership.org.slug,
    role: membership.role,
    membershipId: membership.id,
    // Plan más restrictivo si la fila no existe; en ese caso, además, la
    // sesión queda suspendida por `isSuspended(undefined, …) === true`.
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

  return { estado: "ok", sesion };
}

/**
 * Devuelve la sesión verificada contra base de datos, o `null` si el usuario
 * no está autenticado, ha sido borrado, ya no pertenece a ninguna organización
 * o su token nombra una organización que ha perdido.
 *
 * Reutilizable desde rutas API y desde server components.
 */
export async function getVerifiedSession(): Promise<VerifiedSession | null> {
  const resultado = await resolverSesion();
  return resultado.estado === "ok" ? resultado.sesion : null;
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

/**
 * Traduce un resultado de sesión no utilizable a la respuesta HTTP.
 *
 * `organizacion_perdida` se distingue del resto con un `code` propio: el
 * cliente no debe reintentar ni asumir que sigue en la misma organización, sino
 * volver a autenticarse y elegir organización de forma explícita. Antes este
 * caso no existía porque la sesión cambiaba de organización en silencio.
 */
function fallo401(resultado: Exclude<ResultadoSesion, { estado: "ok" }>): AuthResult {
  if (resultado.estado === "organizacion_perdida") {
    return fail("no_membership", 401, "Ya no perteneces a esta organización. Vuelve a iniciar sesión.", {
      code: "ORG_CONTEXT_LOST",
    });
  }
  if (resultado.estado === "sin_membresia") {
    return fail("no_membership", 401, "No autorizado");
  }
  if (resultado.estado === "usuario_borrado") {
    return fail("user_gone", 401, "No autorizado");
  }
  return fail("unauthenticated", 401, "No autorizado");
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
  const resultado = await resolverSesion();

  if (resultado.estado !== "ok") {
    return fallo401(resultado);
  }
  const session = resultado.sesion;

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
  const resultado = await resolverSesion();

  if (resultado.estado !== "ok") {
    return fallo401(resultado);
  }
  const session = resultado.sesion;

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
