import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      passwordHash: true,
      memberships: {
        select: {
          role: true,
          createdAt: true,
          org: { select: { name: true, slug: true } },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    hasPassword: !!user.passwordHash,
    memberships: user.memberships.map((m) => ({
      role: m.role,
      joinedAt: m.createdAt,
      orgName: m.org.name,
      orgSlug: m.org.slug,
    })),
  });
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(72).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const updateData: { name?: string; passwordHash?: string } = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Introduce tu contraseña actual" }, { status: 400 });
    }
    if (!user.passwordHash) {
      return NextResponse.json({ error: "Esta cuenta no tiene contraseña configurada" }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
    }
    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, email: true, name: true },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: "profile.update",
    details: name ? `Nombre actualizado a ${name}` : "Contraseña actualizada",
  });

  return NextResponse.json({ user: updated });
}
