import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile, getPresignedUrl } from "@/lib/s3";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const c = await prisma.case.findFirst({
    where: { portalToken: params.token, portalEnabled: true, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const docs = await prisma.document.findMany({
    where: { caseId: c.id },
    orderBy: { createdAt: "desc" },
  });

  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      createdAt: doc.createdAt,
      isPortalUpload: doc.isPortalUpload,
      downloadUrl: await getPresignedUrl(doc.fileKey),
    }))
  );

  return NextResponse.json(docsWithUrls);
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const c = await prisma.case.findFirst({
    where: { portalToken: params.token, portalEnabled: true, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No se encontro archivo" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = `${c.orgId}/${c.id}/portal/${Date.now()}-${file.name}`;

    await uploadFile(fileKey, buffer, file.type);

    const doc = await prisma.document.create({
      data: {
        caseId: c.id,
        fileName: file.name,
        fileKey,
        mimeType: file.type,
        fileSize: buffer.length,
        isPortalUpload: true,
      },
    });

    await logAudit({
      orgId: c.orgId,
      caseId: c.id,
      action: "portal.document_uploaded",
      details: `Documento "${file.name}" subido desde portal familia`,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Portal upload error:", error);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}
