import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPresignedUrl } from "@/lib/s3";
import { rateLimit } from "@/lib/api-rate-limit";
import { resolvePortalAccess } from "@/lib/portal-access";

/**
 * Documentos visibles para la familia.
 *
 * GET — antes devolvía TODOS los documentos del expediente, incluidos los
 * internos, cada uno con su URL de descarga prefirmada. El filtro
 * `visibleToFamily` es la corrección: los documentos internos son privados por
 * defecto.
 *
 * AQUÍ YA NO SE SUBE NADA, Y ES A PROPÓSITO
 * -----------------------------------------
 * El `POST` multipart de esta ruta se ha retirado por el mismo motivo que el de
 * la ficha del expediente: una función de Vercel admite 4,5 MB de cuerpo y el
 * producto promete 20 MiB, así que el archivo no puede atravesarla. La familia
 * sube ahora directamente al almacenamiento:
 *
 *   POST  documents/upload-url  → autoriza (token + consentimiento) y firma
 *   POST  documents/complete    → verifica el objeto real y crea la fila
 *
 * El consentimiento se sigue exigiendo en AMBOS pasos.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
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
      downloadUrl: await getPresignedUrl(doc.fileKey, {
        fileName: doc.fileName,
        mimeType: doc.mimeType,
      }),
    })),
  );

  return NextResponse.json(docsWithUrls);
}
