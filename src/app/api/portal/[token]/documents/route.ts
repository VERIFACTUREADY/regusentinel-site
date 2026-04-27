import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile, getPresignedUrl } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { matchDocumentToTag } from "@/lib/doc-task-matching";
import { triggerWorkflow } from "@/lib/workflow-engine";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const c = await prisma.case.findFirst({
    where: { portalToken: params.token, portalEnabled: true, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const docs = await prisma.document.findMany({
    where: { caseId: c.id },
    orderBy: { createdAt: "desc" },
    include: { task: { select: { id: true, title: true, category: true } } },
  });

  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      createdAt: doc.createdAt,
      isPortalUpload: doc.isPortalUpload,
      linkedTask: doc.task ? { title: doc.task.title, category: doc.task.category } : null,
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

    // Auto-match document to a task
    let linkedTaskId: string | null = null;
    const docTag = matchDocumentToTag(file.name);
    if (docTag) {
      const matchingTask = await prisma.task.findFirst({
        where: {
          caseId: c.id,
          docTag,
          status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
        },
        orderBy: { sortOrder: "asc" },
      });
      if (matchingTask) linkedTaskId = matchingTask.id;
    }

    const doc = await prisma.document.create({
      data: {
        caseId: c.id,
        taskId: linkedTaskId,
        fileName: file.name,
        fileKey,
        mimeType: file.type,
        fileSize: buffer.length,
        isPortalUpload: true,
      },
    });

    // Auto-update task status to READY
    if (linkedTaskId) {
      const task = await prisma.task.findUnique({ where: { id: linkedTaskId } });
      if (task && (task.status === "PENDING" || task.status === "IN_PROGRESS")) {
        await prisma.task.update({
          where: { id: linkedTaskId },
          data: { status: "READY" },
        });

        await logAudit({
          orgId: c.orgId,
          caseId: c.id,
          action: "task.auto_updated_portal",
          details: `Tarea "${task.title}" actualizada a READY por documento portal "${file.name}"`,
        });
      }
    }

    await logAudit({
      orgId: c.orgId,
      caseId: c.id,
      action: "portal.document_uploaded",
      details: `Documento "${file.name}" subido desde portal familia${linkedTaskId ? " (vinculado a tarea)" : ""}`,
    });

    triggerWorkflow({
      type: "DOCUMENT_UPLOADED",
      orgId: c.orgId,
      caseId: c.id,
    }).catch(console.error);

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Portal upload error:", error);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}
