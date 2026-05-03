import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "templates.update")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Verify ownership: the version must belong to a template in this org
  const version = await prisma.templateVersion.findFirst({
    where: {
      id: params.versionId,
      templateId: params.id,
      template: { orgId: session.user.orgId },
    },
  });

  if (!version) {
    return NextResponse.json({ error: "Version no encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const updated = await prisma.templateVersion.update({
    where: { id: params.versionId },
    data: {
      ...(typeof body.isApproved === "boolean" ? { isApproved: body.isApproved } : {}),
    },
  });

  return NextResponse.json(updated);
}
