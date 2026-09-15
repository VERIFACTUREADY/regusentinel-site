import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/api-rate-limit";
import { logAudit } from "@/lib/audit";
import { resolvePortalAccess } from "@/lib/portal-access";
import {
  PORTAL_CONSENT_TEXT,
  PORTAL_CONSENT_VERSION,
  getConsentStatus,
  recordConsent,
  clientIp,
} from "@/lib/portal-consent";

/**
 * GET — texto vigente del consentimiento y estado actual.
 *
 * No exige consentimiento previo (es el endpoint que lo presenta) y no expone
 * ningún dato del expediente más allá de si ya está aceptado.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const limited = rateLimit(req, { bucket: "portal-consent-read", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const access = await resolvePortalAccess(params.token);
  if (!access.ok) return access.response;

  const status = await getConsentStatus(access.case.id);

  return NextResponse.json({
    version: PORTAL_CONSENT_VERSION,
    text: PORTAL_CONSENT_TEXT,
    accepted: status.valid,
    outdated: status.outdated,
    acceptedAt: status.acceptedAt,
  });
}

/**
 * POST — registra una aceptación.
 *
 * Antes esto hacía `case.update({ consentAccepted: true })`, sobrescribiendo
 * silenciosamente cualquier aceptación anterior y sin dejar constancia de qué
 * texto se aceptó ni desde dónde. Ahora cada aceptación crea una fila de
 * evidencia con versión, hash del texto, IP y user-agent.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const limited = rateLimit(req, { bucket: "portal-consent", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const access = await resolvePortalAccess(params.token);
  if (!access.ok) return access.response;
  const c = access.case;

  const body = await req.json().catch(() => ({}));
  const declaredName =
    typeof body.authorName === "string" && body.authorName.trim()
      ? body.authorName.trim().slice(0, 200)
      : null;

  const existing = await getConsentStatus(c.id);
  if (existing.valid) {
    // Ya hay una aceptación vigente: no creamos una fila duplicada por cada
    // recarga de la página.
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  const consent = await recordConsent({
    caseId: c.id,
    declaredName,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });

  // `Case.consentAccepted` se mantiene como caché de consulta rápida para la
  // aplicación interna; la evidencia es la fila de PortalConsent.
  await prisma.case.update({
    where: { id: c.id },
    data: { consentAccepted: true, consentDate: consent.acceptedAt },
  });

  await logAudit({
    orgId: c.orgId,
    caseId: c.id,
    action: "portal.consent_accepted",
    // Sin nombre ni IP en el texto libre: ya están en PortalConsent, que es
    // donde deben estar y donde la purga de retención puede alcanzarlos.
    details: `Consentimiento del portal aceptado (versión ${PORTAL_CONSENT_VERSION}, evidencia ${consent.id})`,
    ip: clientIp(req.headers) ?? undefined,
  }).catch(console.error);

  return NextResponse.json({ ok: true, consentId: consent.id, version: PORTAL_CONSENT_VERSION });
}
