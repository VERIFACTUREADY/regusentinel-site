import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getPresignedUrl } from "@/lib/s3";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "documents.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.id, case: { orgId: session.user.orgId } },
  });

  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const downloadUrl = await getPresignedUrl(doc.fileKey);
  return NextResponse.json({ downloadUrl });
}
