import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { estadoVisible, sePuedeRevocar, invalidarEnlace } from "@/lib/invitaciones";

/**
 * DELETE /api/invitations/[id] — revoca una invitacion pendiente o caducada.
 *
 * Revocar hace tres cosas, y las tres importan:
 *
 *   1. Borra la membresia. El acceso se decide mirando `Membership`, asi que
 *      esta es la unica accion que de verdad quita el acceso, y es el camino
 *      que ya estaba probado por la expulsion de miembros.
 *   2. Invalida el enlace, para que un correo reenviado a un tercero no siga
 *      sirviendo para crear la contrasena de esa cuenta.
 *   3. Deja el estado y la auditoria.
 *
 * NO se borra la cuenta de usuario: puede pertenecer a otras organizaciones.
 */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("org.members.invite");
  if (!auth.ok) return auth.response;
  const { orgId, userId } = auth.session;

  const invitacion = await prisma.invitation.findFirst({
    where: { id: params.id, orgId },
    select: { id: true, email: true, status: true, expiresAt: true },
  });

  if (!invitacion) {
    return NextResponse.json({ error: "Invitacion no encontrada" }, { status: 404 });
  }

  const estado = estadoVisible(invitacion);
  if (!sePuedeRevocar(estado)) {
    return NextResponse.json(
      {
        error:
          estado === "ACCEPTED"
            ? "Esa persona ya entro: revocar no procede, hay que quitarla del equipo."
            : "Esta invitacion ya estaba revocada.",
      },
      { status: 409 },
    );
  }

  const usuario = await prisma.user.findUnique({
    where: { email: invitacion.email },
    select: { id: true },
  });

  let enlaceAnulado = false;

  await prisma.$transaction(async (tx) => {
    if (usuario) {
      await tx.membership.deleteMany({ where: { userId: usuario.id, orgId } });
      // Solo si la persona sigue sin contrasena: si ya la tiene, ese token
      // puede ser una recuperacion legitima en curso que no toca romper.
      enlaceAnulado = await invalidarEnlace(tx, usuario.id);
    }

    await tx.invitation.update({
      where: { id: invitacion.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
  });

  await logAudit({
    orgId,
    userId,
    action: "invitation.revoked",
    details:
      `Invitacion revocada a ${invitacion.email}; membresia eliminada` +
      (enlaceAnulado ? "; enlace de acceso anulado" : ""),
  }).catch(console.error);

  return NextResponse.json({ revoked: true, linkInvalidated: enlaceAnulado });
}
