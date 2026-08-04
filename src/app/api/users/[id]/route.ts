import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { checkRoleAssignment, isValidRole, Role } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/users/[id] — cambio de rol de un miembro.
 *
 * `org.members` lo tienen OWNER y MANAGER. Antes, el `role` del body llegaba
 * sin validar hasta `prisma.membership.update`, así que un MANAGER podía
 * enviar `{"role":"OWNER"}` sobre sí mismo y auto-promoverse. Además el
 * recuento de owners y la actualización iban en consultas separadas: dos
 * degradaciones simultáneas podían dejar la organización sin ningún OWNER.
 *
 * Ahora: rol validado contra el enum, política de OWNER centralizada y la
 * comprobación del último owner dentro de la misma transacción que escribe.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("org.members");
  if (!auth.ok) return auth.response;
  const { orgId, userId: actorId, role: actorRole } = auth.session;

  const body = await req.json().catch(() => ({}));
  const { role } = body as { role?: unknown };

  if (!isValidRole(role)) {
    return NextResponse.json({ error: "Rol no válido" }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: params.id, orgId },
  });
  if (!membership) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  const denial = checkRoleAssignment({
    actorRole,
    actorUserId: actorId,
    targetUserId: params.id,
    targetRole: role,
    currentTargetRole: membership.role,
  });
  if (denial) {
    return NextResponse.json({ error: denial }, { status: 403 });
  }

  if (membership.role === role) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Releemos dentro de la transacción: entre la lectura anterior y este
      // punto otra petición pudo cambiar el rol o degradar al otro owner.
      const current = await tx.membership.findFirst({
        where: { userId: params.id, orgId },
        select: { id: true, role: true },
      });
      if (!current) throw new Error("MEMBER_GONE");

      if (current.role === Role.OWNER && role !== Role.OWNER) {
        const ownerCount = await tx.membership.count({
          where: { orgId, role: Role.OWNER },
        });
        if (ownerCount <= 1) throw new Error("LAST_OWNER");
      }

      await tx.membership.update({ where: { id: current.id }, data: { role } });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "LAST_OWNER") {
      return NextResponse.json(
        { error: "Debe haber al menos un Owner en la organización." },
        { status: 409 },
      );
    }
    if (msg === "MEMBER_GONE") {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }
    throw err;
  }

  await logAudit({
    orgId,
    userId: actorId,
    // La transferencia de titularidad se audita con acción propia para que sea
    // localizable sin leer el texto libre.
    action: role === Role.OWNER ? "user.ownership_granted" : "user.role_changed",
    details: `Rol del miembro ${params.id}: ${membership.role} -> ${role}`,
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/users/[id] — expulsión de un miembro.
 *
 * Tras esto la sesión del expulsado deja de servir de inmediato: la
 * autorización relee la membresía en cada petición (ver `lib/session.ts`).
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("org.members");
  if (!auth.ok) return auth.response;
  const { orgId, userId: actorId, role: actorRole } = auth.session;

  if (params.id === actorId) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: params.id, orgId },
  });
  if (!membership) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  // Expulsar a un OWNER exige ser OWNER: si no, un MANAGER podría echar a la
  // titularidad de la organización.
  if (membership.role === Role.OWNER && actorRole !== Role.OWNER) {
    return NextResponse.json(
      { error: "Sólo un Owner puede eliminar a otro Owner." },
      { status: 403 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.membership.findFirst({
        where: { userId: params.id, orgId },
        select: { id: true, role: true },
      });
      if (!current) throw new Error("MEMBER_GONE");

      if (current.role === Role.OWNER) {
        const ownerCount = await tx.membership.count({
          where: { orgId, role: Role.OWNER },
        });
        if (ownerCount <= 1) throw new Error("LAST_OWNER");
      }

      await tx.membership.delete({ where: { id: current.id } });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "LAST_OWNER") {
      return NextResponse.json(
        { error: "No puedes eliminar al último Owner de la organización." },
        { status: 409 },
      );
    }
    if (msg === "MEMBER_GONE") {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }
    throw err;
  }

  await logAudit({
    orgId,
    userId: actorId,
    action: "user.removed",
    details: `Miembro ${params.id} (${membership.role}) eliminado de la organización`,
  });

  return NextResponse.json({ success: true });
}
