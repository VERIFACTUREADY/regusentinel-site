import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { uploadFile, getPresignedUrl } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { matchDocumentToTag, DOC_MATCH_RULES } from "@/lib/doc-task-matching";
import { triggerWorkflow } from "@/lib/workflow-engine";

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
    include: { task: { select: { id: true, title: true, category: true } } },
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
    const manualTaskId = formData.get("taskId") as string | null;
    if (!file) return NextResponse.json({ error: "No se encontro archivo" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = `${session.user.orgId}/${params.id}/${Date.now()}-${file.name}`;

    await uploadFile(fileKey, buffer, file.type);

    // Auto-match document to a task
    let linkedTaskId: string | null = manualTaskId || null;

    if (!linkedTaskId) {
      const docTag = matchDocumentToTag(file.name);
      if (docTag) {
        // Find a PENDING task with this docTag in this case
        const matchingTask = await prisma.task.findFirst({
          where: {
            caseId: params.id,
            docTag,
            status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
          },
          orderBy: { sortOrder: "asc" },
        });
        if (matchingTask) linkedTaskId = matchingTask.id;
      }
    }

    const doc = await prisma.document.create({
      data: {
        caseId: params.id,
        taskId: linkedTaskId,
        fileName: file.name,
        fileKey,
        mimeType: file.type,
        fileSize: buffer.length,
        uploadedBy: session.user.id,
      },
    });

    // Auto-update task status to READY when document is linked
    let taskUpdated = false;
    if (linkedTaskId) {
      const task = await prisma.task.findUnique({ where: { id: linkedTaskId } });
      if (task && (task.status === "PENDING" || task.status === "IN_PROGRESS")) {
        await prisma.task.update({
          where: { id: linkedTaskId },
          data: { status: "READY" },
        });
        taskUpdated = true;

        await logAudit({
          orgId: session.user.orgId,
          userId: session.user.id,
          caseId: params.id,
          action: "task.auto_updated",
          details: `Tarea "${task.title}" actualizada a READY por documento "${file.name}"`,
        });
      }
    }

    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: "document.uploaded",
      details: `Archivo "${file.name}" subido${linkedTaskId ? ` (vinculado a tarea)` : ""}`,
    });

    // If no task was linked, return naming suggestions from pending tasks
    let suggestions: string[] | undefined;
    if (!linkedTaskId) {
      const pendingTasks = await prisma.task.findMany({
        where: { caseId: params.id, status: { in: ["PENDING", "IN_PROGRESS"] }, docTag: { not: null } },
        select: { docTag: true, title: true },
        take: 5,
      });
      if (pendingTasks.length > 0) {
        suggestions = pendingTasks.map((t) => {
          const rule = DOC_MATCH_RULES.find((r) => r.docTag === t.docTag);
          const keyword = rule?.keywords[0] || t.docTag;
          return `${keyword} → ${t.title}`;
        });
      }
    }

    triggerWorkflow({
      type: "DOCUMENT_UPLOADED",
      orgId: session.user.orgId,
      caseId: params.id,
      userId: session.user.id,
    }).catch(console.error);

    return NextResponse.json({ ...doc, taskUpdated, suggestions }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}
