import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getPresignedUrl, deleteFile } from "@/lib/s3";
import { logAudit } from "@/lib/audit";

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "documents.delete")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.id, case: { orgId: session.user.orgId } },
    select: { id: true, fileKey: true, fileName: true, caseId: true },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  // Delete from S3 then from DB
  await deleteFile(doc.fileKey).catch(() => {});
  await prisma.document.delete({ where: { id: params.id } });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: doc.caseId,
    action: "document.deleted",
    details: `Documento eliminado: ${doc.fileName}`,
  });

  return NextResponse.json({ ok: true });
}
