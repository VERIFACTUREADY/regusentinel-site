import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/lib/session";
import { findCaseInOrg } from "@/lib/tenancy";
import { logAudit } from "@/lib/audit";

/**
 * Rotación y revocación del enlace del portal familiar.
 *
 * Antes el token se generaba una vez (`@default(cuid())`) y era permanente: si
 * el enlace se filtraba —un WhatsApp reenviado, un buzón comprometido— no
 * había forma de invalidarlo salvo desactivar el portal entero para esa
 * familia.
 *
 * POST   → genera un token nuevo; el anterior deja de funcionar al instante.
 * DELETE → revoca el acceso sin generar uno nuevo.
 *
 * Ambas quedan auditadas.
 */

/** 32 bytes de entropía criptográfica, frente al CUID (temporal y adivinable). */
function newPortalToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("cases.update");
  if (!auth.ok) return auth.response;
  const { orgId, userId } = auth.session;

  const c = await findCaseInOrg(params.id, orgId);
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Caducidad opcional en días. Sin valor, el enlace no caduca por tiempo
  // (pero sigue siendo revocable, que es lo que faltaba).
  let expiresAt: Date | null = null;
  const days = Number(body?.expiresInDays);
  if (Number.isFinite(days) && days > 0 && days <= 3650) {
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const token = newPortalToken();

  await prisma.case.update({
    where: { id: c.id },
    data: {
      portalToken: token,
      portalTokenRotatedAt: new Date(),
      portalTokenExpiresAt: expiresAt,
      // Rotar reactiva el acceso: es la vía para dar un enlace nuevo tras una
      // revocación.
      portalTokenRevokedAt: null,
      portalEnabled: true,
    },
  });

  await logAudit({
    orgId,
    userId,
    caseId: c.id,
    action: "portal.token_rotated",
    details: expiresAt
      ? `Enlace del portal regenerado, caduca el ${expiresAt.toISOString().slice(0, 10)}`
      : "Enlace del portal regenerado; el anterior queda invalidado",
  });

  return NextResponse.json({ token, expiresAt });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("cases.update");
  if (!auth.ok) return auth.response;
  const { orgId, userId } = auth.session;

  const c = await findCaseInOrg(params.id, orgId);
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  await prisma.case.update({
    where: { id: c.id },
    data: { portalTokenRevokedAt: new Date() },
  });

  await logAudit({
    orgId,
    userId,
    caseId: c.id,
    action: "portal.token_revoked",
    details: "Acceso al portal revocado; el enlace deja de funcionar de inmediato",
  });

  return NextResponse.json({ ok: true, revoked: true });
}
