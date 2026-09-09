import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api-rate-limit";
import { resolvePortalAccess } from "@/lib/portal-access";
import { autorizarSubida } from "@/lib/subida-directa";

/**
 * Paso 1 de la subida del portal familiar: autorizar.
 *
 * El consentimiento sigue siendo obligatorio (`requireConsent: true`) y el
 * límite de subidas sigue vivo: se cuenta aquí, que es donde se entrega el
 * permiso de escritura. Ponerlo sólo en la confirmación dejaría emitir URLs sin
 * freno.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  // Mismo presupuesto que tenía la subida multipart: 10 por minuto e IP.
  const limited = rateLimit(req, { bucket: "portal-docs-upload", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const access = await resolvePortalAccess(params.token, { requireConsent: true });
  if (!access.ok) return access.response;
  const c = access.case;

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  const resultado = await autorizarSubida({
    actor: {
      orgId: c.orgId,
      caseId: c.id,
      // La familia no es un usuario del equipo: la autoría queda vacía, como
      // en la subida multipart que esto sustituye.
      userId: null,
      isPortalUpload: true,
    },
    fileName: (body as { fileName?: unknown }).fileName,
    size: (body as { size?: unknown }).size,
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
