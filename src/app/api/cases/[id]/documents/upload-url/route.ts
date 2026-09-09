import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { autorizarSubida } from "@/lib/subida-directa";

/**
 * Paso 1 de la subida interna: autorizar.
 *
 * No recibe el archivo. Recibe su nombre y su tamaño, comprueba permisos,
 * tenencia y política, y devuelve una URL prefirmada para que el navegador
 * escriba DIRECTAMENTE en el almacenamiento. El motivo está en
 * `src/lib/subida-directa.ts`: una función de Vercel admite 4,5 MB de cuerpo y
 * el producto promete 20 MiB.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("documents.create");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  // El expediente debe ser de esta organización. Igual que en la ruta que
  // recibía el multipart: el id de la URL no se cree sin comprobarlo.
  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  const resultado = await autorizarSubida({
    actor: {
      orgId: session.user.orgId,
      caseId: params.id,
      userId: session.user.id,
      isPortalUpload: false,
    },
    fileName: (body as { fileName?: unknown }).fileName,
    size: (body as { size?: unknown }).size,
    taskId: (body as { taskId?: unknown }).taskId,
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(
    {
      uploadId: resultado.uploadId,
      uploadUrl: resultado.uploadUrl,
      fileName: resultado.fileName,
      expiresAt: resultado.expiresAt,
    },
    { status: 201 },
  );
}
