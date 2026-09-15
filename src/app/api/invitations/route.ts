import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { estadoVisible } from "@/lib/invitaciones";

/**
 * GET /api/invitations — invitaciones de la organizacion de la sesion.
 *
 * El estado "caducada" NO se guarda: se deriva al leer, comparando con el
 * reloj. Guardarlo obligaria a un proceso que lo actualizara al vencer, y si
 * ese proceso falla la pantalla dice "pendiente" de un enlace que ya no sirve.
 */
export async function GET() {
  const auth = await requireOrgPermission("org.members.invite");
  if (!auth.ok) return auth.response;
  const { orgId } = auth.session;

  const invitaciones = await prisma.invitation.findMany({
    // Filtrado por la organizacion de la sesion, nunca por un id del cliente.
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      resendCount: true,
      lastSentAt: true,
      invitedBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(
    invitaciones.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      estado: estadoVisible(i),
      expiresAt: i.expiresAt,
      acceptedAt: i.acceptedAt,
      revokedAt: i.revokedAt,
      resendCount: i.resendCount,
      lastSentAt: i.lastSentAt,
      invitadaPor: i.invitedBy?.name ?? i.invitedBy?.email ?? null,
    })),
  );
}
