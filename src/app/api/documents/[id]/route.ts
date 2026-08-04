import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPresignedUrl, deleteFile } from "@/lib/s3";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("documents.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const doc = await prisma.document.findFirst({
    where: { id: params.id, case: { orgId: session.user.orgId } },
  });

  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const downloadUrl = await getPresignedUrl(doc.fileKey);
  return NextResponse.json({ downloadUrl });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("documents.delete");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const doc = await prisma.document.findFirst({
    where: { id: params.id, case: { orgId: session.user.orgId } },
    select: { id: true, fileKey: true, fileName: true, caseId: true },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  // Antes: `deleteFile(...).catch(() => {})` seguido de `document.delete`. El
  // fallo de S3 se tragaba y la fila se borraba igualmente, dejando el objeto
  // huérfano en el bucket para siempre — y afirmando al usuario que el
  // documento estaba eliminado cuando su contenido seguía almacenado.
  //
  // Ahora: si S3 falla, la fila NO se borra y queda marcada para reintento.
  try {
    await deleteFile(doc.fileKey);
  } catch (err) {
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        deletionState: "S3_DELETE_FAILED",
        deletionError: err instanceof Error ? err.message.slice(0, 500) : "error desconocido",
        deletionAt: new Date(),
      },
    });

    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: doc.caseId,
      action: "document.delete_failed",
      details: `No se pudo eliminar el archivo del almacenamiento; el documento queda marcado para reintento`,
    }).catch(console.error);

    return NextResponse.json(
      {
        error:
          "No se pudo eliminar el archivo del almacenamiento. El documento queda marcado y se reintentará; no se ha borrado la referencia.",
      },
      { status: 502 },
    );
  }

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

/**
 * PATCH — control de visibilidad para la familia.
 *
 * Los documentos internos son privados por defecto. Este endpoint es la vía
 * explícita para compartir uno con la familia (y para dejar de compartirlo).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOrgPermission("documents.update");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const body = await req.json().catch(() => ({}));
  const visibleToFamily = body?.visibleToFamily;
  if (typeof visibleToFamily !== "boolean") {
    return NextResponse.json({ error: "visibleToFamily debe ser booleano" }, { status: 400 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.id, case: { orgId: session.user.orgId } },
    select: { id: true, fileName: true, caseId: true, visibleToFamily: true },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  if (doc.visibleToFamily === visibleToFamily) {
    return NextResponse.json({ ok: true, unchanged: true, visibleToFamily });
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: { visibleToFamily },
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: doc.caseId,
    action: visibleToFamily ? "document.shared_with_family" : "document.unshared_from_family",
    details: `Documento "${doc.fileName}" ${visibleToFamily ? "compartido con" : "ocultado a"} la familia`,
  });

  return NextResponse.json({ ok: true, visibleToFamily });
}
