import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile, getPresignedUrl, deleteFile } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { matchDocumentToTag } from "@/lib/doc-task-matching";
import { triggerWorkflow } from "@/lib/workflow-engine";
import { rateLimit } from "@/lib/api-rate-limit";
import { resolvePortalAccess } from "@/lib/portal-access";
import { validateFile, sanitizeFileName, buildFileKey, MAX_FILE_BYTES, MAX_FILE_MB } from "@/lib/file-policy";

/**
 * GET — documentos visibles para la familia.
 *
 * Antes devolvía TODOS los documentos del expediente, incluidos los internos,
 * cada uno con su URL de descarga prefirmada. El filtro `visibleToFamily` es
 * la corrección: los documentos internos son privados por defecto.
 */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const limited = rateLimit(req, { bucket: "portal-docs-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const access = await resolvePortalAccess(params.token, { requireConsent: true });
  if (!access.ok) return access.response;

  const docs = await prisma.document.findMany({
    where: { caseId: access.case.id, visibleToFamily: true, deletionState: null },
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
    })),
  );

  return NextResponse.json(docsWithUrls);
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  // 10 uploads/min por IP. Limite muy bajo porque cada upload escribe en S3 + DB.
  const limited = rateLimit(req, { bucket: "portal-docs-upload", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const access = await resolvePortalAccess(params.token, { requireConsent: true });
  if (!access.ok) return access.response;
  const c = access.case;

  let fileKey: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No se encontro archivo" }, { status: 400 });
    }

    // Tamaño ANTES de leer el contenido: así un archivo de 2 GB no llega
    // siquiera a cargarse en memoria ni a subirse a S3.
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el máximo de ${MAX_FILE_MB} MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const verdict = validateFile({
      fileName: file.name,
      size: buffer.length,
      declaredMime: file.type,
      head: buffer.subarray(0, 4096),
    });
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.message }, { status: 400 });
    }

    const safeName = sanitizeFileName(file.name);
    fileKey = buildFileKey({ orgId: c.orgId, caseId: c.id, fileName: safeName, fromPortal: true });

    await uploadFile(fileKey, buffer, verdict.detectedType ?? "application/octet-stream");

    // Auto-match document to a task (siempre dentro de este expediente).
    let linkedTaskId: string | null = null;
    const docTag = matchDocumentToTag(safeName);
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

    let doc;
    try {
      doc = await prisma.document.create({
        data: {
          caseId: c.id,
          taskId: linkedTaskId,
          fileName: safeName,
          fileKey,
          mimeType: verdict.detectedType,
          fileSize: buffer.length,
          isPortalUpload: true,
          // Lo ha subido la familia: es suyo y debe poder verlo.
          visibleToFamily: true,
        },
      });
    } catch (dbError) {
      // Compensación: el objeto ya está en S3 pero la fila no existe. Sin esto
      // el bucket acumulaba huérfanos que nadie podía borrar ni encontrar.
      await deleteFile(fileKey).catch((e) =>
        console.error("No se pudo limpiar el objeto huérfano en S3:", fileKey, e),
      );
      throw dbError;
    }

    if (linkedTaskId) {
      const task = await prisma.task.findFirst({
        where: { id: linkedTaskId, caseId: c.id },
      });
      if (task && (task.status === "PENDING" || task.status === "IN_PROGRESS")) {
        await prisma.task.update({ where: { id: task.id }, data: { status: "READY" } });

        await logAudit({
          orgId: c.orgId,
          caseId: c.id,
          action: "task.auto_updated_portal",
          details: `Tarea "${task.title}" actualizada a READY por un documento del portal`,
        });
      }
    }

    await logAudit({
      orgId: c.orgId,
      caseId: c.id,
      action: "portal.document_uploaded",
      details: `Documento subido desde el portal familiar${linkedTaskId ? " (vinculado a tarea)" : ""}`,
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
