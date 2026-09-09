/**
 * Resolución del acceso por token del portal familiar.
 *
 * Centraliza tres comprobaciones que antes estaban repetidas (y no siempre
 * completas) en cada endpoint del portal:
 *   1. El token identifica un expediente vivo con el portal habilitado.
 *   2. El token no está revocado ni caducado (antes ni siquiera existía la
 *      posibilidad de revocarlo).
 *   3. Hay consentimiento vigente, cuando la operación lo requiere.
 */

import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getConsentStatus } from "./portal-consent";

export interface PortalCase {
  id: string;
  orgId: string;
  ref: string;
  portalEnabled: boolean;
}

export type PortalDenial =
  | "not_found" // token inexistente, portal deshabilitado o expediente borrado
  | "revoked"
  | "expired"
  | "consent_required"
  | "consent_outdated";

export type PortalAccess =
  | { ok: true; case: PortalCase }
  | { ok: false; reason: PortalDenial; response: NextResponse };

function deny(reason: PortalDenial, status: number, error: string, extra?: Record<string, unknown>): PortalAccess {
  return { ok: false, reason, response: NextResponse.json({ error, ...extra }, { status }) };
}

/**
 * Resuelve el token. `requireConsent` debe ser `true` en toda operación que no
 * sea la de mostrar y aceptar el propio consentimiento.
 */
export async function resolvePortalAccess(
  token: string,
  options: { requireConsent?: boolean } = {},
): Promise<PortalAccess> {
  if (!token) {
    return deny("not_found", 404, "Expediente no encontrado o acceso deshabilitado");
  }

  const c = await prisma.case.findFirst({
    where: { portalToken: token, portalEnabled: true, deletedAt: null },
    select: {
      id: true,
      orgId: true,
      ref: true,
      portalEnabled: true,
      portalTokenRevokedAt: true,
      portalTokenExpiresAt: true,
    },
  });

  // Mismo 404 para token inexistente y portal deshabilitado: no revelamos si
  // el expediente existe.
  if (!c) {
    return deny("not_found", 404, "Expediente no encontrado o acceso deshabilitado");
  }

  if (c.portalTokenRevokedAt) {
    return deny(
      "revoked",
      403,
      "Este enlace ha sido revocado. Solicita uno nuevo a la entidad que gestiona el expediente.",
    );
  }

  if (c.portalTokenExpiresAt && c.portalTokenExpiresAt.getTime() < Date.now()) {
    return deny(
      "expired",
      403,
      "Este enlace ha caducado. Solicita uno nuevo a la entidad que gestiona el expediente.",
    );
  }

  if (options.requireConsent) {
    const consent = await getConsentStatus(c.id);
    if (!consent.valid) {
      return deny(
        consent.outdated ? "consent_outdated" : "consent_required",
        403,
        consent.outdated
          ? "Las condiciones han cambiado. Debes aceptarlas de nuevo para continuar."
          : "Debes aceptar el consentimiento antes de usar el portal.",
        { consentRequired: true },
      );
    }
  }

  return {
    ok: true,
    case: { id: c.id, orgId: c.orgId, ref: c.ref, portalEnabled: c.portalEnabled },
  };
}
