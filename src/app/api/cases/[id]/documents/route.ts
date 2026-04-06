import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { uploadFile, getPresignedUrl } from "@/lib/s3";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "documents.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const docs = await prisma.document.findMany({
    where: { caseId: params.id, case: { orgId: session.user.orgId } },
    orderBy: { createdAt: "desc" },
  });

  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      downloadUrl: await getPresignedUrl(doc.fileKey),
    }))
  );

  return NextResponse.json(docsWithUrls);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "documents.create")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({ where: { id: params.id, orgId: session.user.orgId } });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No se encontro archivo" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = `${session.user.orgId}/${params.id}/${Date.now()}-${file.name}`;

    await uploadFile(fileKey, buffer, file.type);

    const doc = await prisma.document.create({
      data: {
        caseId: params.id,
        fileName: file.name,
        fileKey,
        mimeType: file.type,
        fileSize: buffer.length,
        uploadedBy: session.user.id,
      },
    });

    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: "document.uploaded",
      details: `Archivo "${file.name}" subido`,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}
