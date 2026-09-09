import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { confirmarSubida } from "@/lib/subida-directa";

/**
 * Paso 2 de la subida interna: confirmar.
 *
 * Vuelve a autenticar y autorizar —no se hereda nada del paso anterior— y
 * comprueba el objeto REAL en el almacenamiento antes de crear la fila. Es
 * idempotente: reintentar tras un corte de red devuelve el mismo documento en
 * lugar de crear otro.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("documents.create");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  try {
    const resultado = await confirmarSubida({
      actor: {
        orgId: session.user.orgId,
        caseId: params.id,
        userId: session.user.id,
        isPortalUpload: false,
      },
      uploadId: (body as { uploadId?: unknown }).uploadId,
    });

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }

    return NextResponse.json(
      {
        ...resultado.documento,
        taskUpdated: resultado.taskUpdated,
        suggestions: resultado.suggestions,
      },
      // 200 si ya estaba: no se ha creado nada nuevo en esta llamada.
      { status: resultado.yaConfirmada ? 200 : 201 },
    );
  } catch (error) {
    console.error("Upload complete error:", error);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}
