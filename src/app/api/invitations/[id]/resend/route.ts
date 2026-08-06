import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { sendEmail } from "@/lib/email";
import {
  estadoVisible,
  sePuedeReenviar,
  rotarTokenInvitacion,
  enlaceCrearContrasena,
  tieneCredencialUtilizable,
} from "@/lib/invitaciones";

/**
 * POST /api/invitations/[id]/resend — vuelve a enviar la invitacion.
 *
 * El enlace anterior deja de servir: `magicToken` es un unico campo, asi que
 * emitir uno nuevo mata al viejo. Es lo que debe pasar — un enlace de
 * invitacion puede haber acabado en un correo reenviado a terceros, y cada
 * reenvio tiene que cerrar el anterior.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Provoca correo saliente bajo demanda: sin limite sirve para bombardear.
  const limitado = rateLimit(req, { bucket: "invitacion-reenvio", windowMs: 60_000, max: 10 });
  if (limitado) return limitado;

  const auth = await requireOrgPermission("org.members.invite");
  if (!auth.ok) return auth.response;
  const { orgId, userId } = auth.session;

  // Filtrado por la organizacion de la sesion: conocer un id no puede bastar
  // para disparar correos en nombre de otra organizacion.
  const invitacion = await prisma.invitation.findFirst({
    where: { id: params.id, orgId },
    select: { id: true, email: true, role: true, status: true, expiresAt: true },
  });

  // Mismo 404 para "no existe" y "es de otra organizacion".
  if (!invitacion) {
    return NextResponse.json({ error: "Invitacion no encontrada" }, { status: 404 });
  }

  const estado = estadoVisible(invitacion);
  if (!sePuedeReenviar(estado)) {
    return NextResponse.json(
      {
        error:
          estado === "ACCEPTED"
            ? "Esta invitacion ya se acepto."
            : "Esta invitacion esta revocada. Vuelve a invitar si procede.",
      },
      { status: 409 },
    );
  }

  const usuario = await prisma.user.findUnique({
    where: { email: invitacion.email },
    select: { id: true, passwordHash: true },
  });

  if (!usuario) {
    return NextResponse.json({ error: "La cuenta invitada ya no existe" }, { status: 409 });
  }

  /*
   * Si entre medias la persona ya puso contrasena, no hay nada que reenviar:
   * la invitacion esta de hecho aceptada. Se corrige el estado y se dice.
   */
  if (tieneCredencialUtilizable(usuario)) {
    await prisma.invitation.update({
      where: { id: invitacion.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    return NextResponse.json(
      { error: "Esa persona ya tiene contrasena; la invitacion consta aceptada." },
      { status: 409 },
    );
  }

  const { token, expira } = await rotarTokenInvitacion(prisma, usuario.id);

  let correoEnviado = false;
  let motivoFallo: string | null = null;
  try {
    await sendEmail({
      to: invitacion.email,
      subject: "Invitacion a Heredia (reenvio)",
      html: `<p>Te reenviamos la invitacion para unirte a Heredia.</p>
             <p><a href="${enlaceCrearContrasena(token)}">Crear mi contrasena</a></p>
             <p>Este enlace caduca en 7 dias y anula el anterior, si habias
             recibido otro.</p>`,
    });
    correoEnviado = true;
  } catch (err) {
    // No se traga: la interfaz tiene que poder decir que no ha salido.
    motivoFallo = err instanceof Error ? err.message : "error desconocido";
    console.error("[invitacion] reenvio fallido:", motivoFallo);
  }

  const actualizada = await prisma.invitation.update({
    where: { id: invitacion.id },
    data: {
      status: "PENDING",
      expiresAt: expira,
      revokedAt: null,
      resendCount: { increment: 1 },
      lastSentAt: new Date(),
    },
    select: { resendCount: true },
  });

  await logAudit({
    orgId,
    userId,
    action: "invitation.resent",
    details:
      `Invitacion reenviada a ${invitacion.email} (reenvio n.º ${actualizada.resendCount})` +
      (correoEnviado ? "" : ` — EL CORREO NO SE PUDO ENVIAR (${motivoFallo})`) +
      "; el enlace anterior queda anulado",
  }).catch(console.error);

  return NextResponse.json({
    emailSent: correoEnviado,
    expiresAt: expira,
    resendCount: actualizada.resendCount,
  });
}
