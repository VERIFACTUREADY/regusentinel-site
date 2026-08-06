/**
 * Ciclo de vida de las invitaciones.
 *
 * QUE ESTABA MAL
 * --------------
 * Invitar creaba usuario y membresia, generaba un `magicToken` de siete dias y
 * no lo enviaba a ninguna parte. No habia reenviar, ni revocar, ni estado, ni
 * forma de saber si un enlace seguia vivo. Y el caso peor pasaba desapercibido:
 * invitar a alguien que YA existia en la base de datos pero nunca habia fijado
 * contrasena —porque le habian invitado antes y nunca entro— no le emitia
 * ningun token nuevo. Se le daba de alta en la organizacion y se quedaba fuera
 * para siempre.
 *
 * DECISION DE DISENO
 * ------------------
 * El estado vive en la tabla `Invitation`, no en `Membership`. El acceso se
 * decide mirando `Membership` desde varios sitios —el callback de NextAuth, la
 * carga de sesion, la comprobacion de tenencia—, y meter ahi un estado
 * "revocada" obligaria a excluirlo en todos: olvidarse de uno deja acceso a
 * quien se le ha revocado. Revocar sigue siendo borrar la membresia, que es lo
 * que ya estaba probado, y el estado queda registrado aparte.
 */
import { randomBytes } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Validez del enlace de invitacion. */
export const VALIDEZ_INVITACION_MS = 7 * 24 * 60 * 60 * 1000;

type ClienteBD = PrismaClient | Prisma.TransactionClient;

/**
 * Una credencial es utilizable cuando hay `passwordHash`.
 *
 * Es la comprobacion que faltaba. Sin ella, reinvitar a alguien que existe pero
 * nunca puso contrasena no le emitia token: entraba en la organizacion sin
 * ninguna forma de identificarse.
 */
export function tieneCredencialUtilizable(usuario: { passwordHash: string | null }): boolean {
  return usuario.passwordHash !== null && usuario.passwordHash !== "";
}

export interface TokenEmitido {
  token: string;
  expira: Date;
}

/**
 * Emite un token nuevo, invalidando el anterior.
 *
 * Es una rotacion, no una adicion: `magicToken` es un unico campo, asi que
 * escribir el nuevo deja muerto el viejo. Es justo lo que debe pasar al
 * reenviar una invitacion — el enlace antiguo, que puede estar en un correo
 * reenviado a terceros, deja de servir.
 */
export async function rotarTokenInvitacion(
  db: ClienteBD,
  userId: string,
  ahora = new Date(),
): Promise<TokenEmitido> {
  const token = randomBytes(32).toString("hex");
  const expira = new Date(ahora.getTime() + VALIDEZ_INVITACION_MS);

  await db.user.update({
    where: { id: userId },
    data: { magicToken: token, magicTokenExp: expira },
  });

  return { token, expira };
}

/**
 * Invalida el enlace vivo de un usuario.
 *
 * Se usa al revocar. Solo se hace si la persona NO tiene contrasena: si ya la
 * tiene, ese token puede ser una recuperacion de contrasena legitima en curso y
 * borrarlo seria romperle algo que no tiene que ver con la invitacion.
 */
export async function invalidarEnlace(db: ClienteBD, userId: string): Promise<boolean> {
  const usuario = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!usuario || tieneCredencialUtilizable(usuario)) return false;

  await db.user.update({
    where: { id: userId },
    data: { magicToken: null, magicTokenExp: null },
  });
  return true;
}

export function enlaceCrearContrasena(token: string): string {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return `${base}/reset-password?token=${token}`;
}

/**
 * Estado que se muestra en la interfaz.
 *
 * `EXPIRED` no se guarda al caducar —nadie ejecuta nada en ese instante— sino
 * que se deriva al leer. Guardar un estado que depende del reloj obliga a un
 * proceso que lo actualice, y si ese proceso falla la pantalla miente.
 */
export function estadoVisible(inv: {
  status: string;
  expiresAt: Date;
}, ahora = new Date()): "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED" {
  if (inv.status === "ACCEPTED") return "ACCEPTED";
  if (inv.status === "REVOKED") return "REVOKED";
  if (inv.expiresAt.getTime() <= ahora.getTime()) return "EXPIRED";
  return "PENDING";
}

export const ETIQUETA_ESTADO: Record<string, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REVOKED: "Revocada",
  EXPIRED: "Caducada",
};

/** Solo tiene sentido reenviar lo que sigue sin aceptarse. */
export function sePuedeReenviar(estado: string): boolean {
  return estado === "PENDING" || estado === "EXPIRED";
}

/** Revocar una invitacion ya aceptada no es revocar: es expulsar a un miembro. */
export function sePuedeRevocar(estado: string): boolean {
  return estado === "PENDING" || estado === "EXPIRED";
}
