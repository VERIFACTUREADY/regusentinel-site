import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPresignedUrl } from "@/lib/s3";

/**
 * Documentos del expediente.
 *
 * AQUÍ YA NO SE SUBE NADA, Y ES A PROPÓSITO
 * -----------------------------------------
 * Esta ruta tenía un `POST` que recibía el archivo entero en un multipart. En
 * producción eso no podía funcionar: una función de Vercel admite **4,5 MB** de
 * cuerpo de petición y el producto promete **20 MiB**. El archivo lo cortaba la
 * entrada de la plataforma antes de llegar al código, así que el endpoint
 * prometía un límite que no podía cumplir. Que en local pasara las pruebas no
 * demostraba lo contrario: en local ese techo no existe.
 *
 * La subida vive ahora en dos endpoints que sólo mueven JSON pequeño:
 *
 *   POST  documents/upload-url  → autoriza y devuelve una URL prefirmada
 *   POST  documents/complete    → verifica el objeto real y crea la fila
 *
 * El archivo viaja del navegador al almacenamiento sin pasar por la función.
 * El `POST` multipart se ha RETIRADO en lugar de dejarlo ahí: mantenerlo habría
 * dejado dos contratos de subida contradictorios, uno de los cuales miente
 * sobre el tamaño que admite.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
