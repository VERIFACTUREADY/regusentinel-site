import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { uploadFile, getPresignedUrl, deleteFile } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { matchDocumentToTag, DOC_MATCH_RULES } from "@/lib/doc-task-matching";
import { findTaskInCase } from "@/lib/tenancy";
import { validateFile, sanitizeFileName, buildFileKey, MAX_FILE_BYTES, MAX_FILE_MB } from "@/lib/file-policy";
import { triggerWorkflow, claveDeEvento } from "@/lib/workflow-engine";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("documents.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const docs = await prisma.document.findMany({
    where: { caseId: params.id, case: { orgId: session.user.orgId } },
    orderBy: { createdAt: "desc" },
    include: { task: { select: { id: true, title: true, category: true } } },
  });

  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      downloadUrl: await getPresignedUrl(doc.fileKey, {
        fileName: doc.fileName,
        mimeType: doc.mimeType,
      }),
    }))
  );

  return NextResponse.json(docsWithUrls);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("documents.create");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({ where: { id: params.id, orgId: session.user.orgId } });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const manualTaskId = formData.get("taskId") as string | null;
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No se encontro archivo" }, { status: 400 });
    }

    // Tamaño ANTES de leer el contenido: un archivo enorme no llega a cargarse
    // en memoria ni a subirse a S3.
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
    // Clave aleatoria: la anterior incluía el nombre original del usuario
    // (con su posible path traversal) y era adivinable por marca de tiempo.
    const fileKey = buildFileKey({
      orgId: session.user.orgId,
      caseId: params.id,
      fileName: safeName,
    });

    await uploadFile(fileKey, buffer, verdict.detectedType ?? "application/octet-stream");

    // El taskId enviado por el cliente sólo vale si la tarea pertenece a ESTE
    // expediente y a esta organización. Antes se usaba tal cual, y más abajo
    // se actualizaba con `findUnique({ where: { id } })` sin filtrar por
    // organización: se podía marcar como READY una tarea de otro tenant.
    let linkedTaskId: string | null = null;
    if (manualTaskId) {
      const manualTask = await findTaskInCase(manualTaskId, params.id, session.user.orgId);
      if (!manualTask) {
        return NextResponse.json(
          { error: "La tarea indicada no pertenece a este expediente" },
          { status: 404 },
        );
      }
      linkedTaskId = manualTask.id;
    }

    if (!linkedTaskId) {
      const docTag = matchDocumentToTag(safeName);
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

    let doc;
    try {
      doc = await prisma.document.create({
        data: {
          caseId: params.id,
          taskId: linkedTaskId,
          fileName: safeName,
          fileKey,
          mimeType: verdict.detectedType,
          fileSize: buffer.length,
          uploadedBy: session.user.id,
          // Documento interno: privado para la familia salvo que alguien lo
          // comparta explícitamente desde la aplicación.
          visibleToFamily: false,
        },
      });
    } catch (dbError) {
      // Compensación: el objeto ya está en S3 pero la fila no existe. Sin esto
      // el bucket acumulaba huérfanos que nadie podía encontrar ni borrar.
      await deleteFile(fileKey).catch((e) =>
        console.error("No se pudo limpiar el objeto huérfano en S3:", fileKey, e),
      );
      throw dbError;
    }

    // Auto-update task status to READY when document is linked.
    // La relectura vuelve a filtrar por expediente y organización: aunque
    // `linkedTaskId` ya viene validado, este `update` es la escritura que
    // antes cruzaba tenants y no debe depender de una validación remota.
    let taskUpdated = false;
    if (linkedTaskId) {
      const task = await findTaskInCase(linkedTaskId, params.id, session.user.orgId);
      if (task && (task.status === "PENDING" || task.status === "IN_PROGRESS")) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: "READY" },
        });
        taskUpdated = true;

        await logAudit({
          orgId: session.user.orgId,
          userId: session.user.id,
          caseId: params.id,
          action: "task.auto_updated",
          details: `Tarea "${task.title}" actualizada a READY por documento "${safeName}"`,
        });
      }
    }

    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: "document.uploaded",
      details: `Archivo "${safeName}" subido${linkedTaskId ? ` (vinculado a tarea)` : ""}`,
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
      /*
       * EL ID DEL DOCUMENTO. El evento no llevaba NADA que lo identificara, así
       * que la clave era `(org, regla, expediente, tipo, ventana)`: subir tres
       * documentos al mismo expediente en cinco minutos —lo normal cuando la
       * familia manda la documentación de golpe— ejecutaba la automatización
       * UNA sola vez, y los otros dos no dejaban rastro de por qué.
       */
      eventKey: claveDeEvento.documentoSubido(doc.id),
    }).catch(console.error);

    return NextResponse.json({ ...doc, taskUpdated, suggestions }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}
