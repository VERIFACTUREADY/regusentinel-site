import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api-rate-limit";
import { resolvePortalAccess } from "@/lib/portal-access";
import { confirmarSubida } from "@/lib/subida-directa";

/**
 * Paso 2 de la subida del portal familiar: confirmar.
 *
 * Se vuelve a resolver el token Y el consentimiento: entre autorizar y
 * confirmar el enlace puede haberse revocado o el consentimiento retirado, y en
 * ese caso el documento no debe guardarse.
 *
 * El límite es más holgado que el de autorizar porque una confirmación puede
 * reintentarse legítimamente varias veces tras un corte de red, y repetirla no
 * crea documentos nuevos.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const limited = rateLimit(req, { bucket: "portal-docs-complete", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const access = await resolvePortalAccess(params.token, { requireConsent: true });
  if (!access.ok) return access.response;
  const c = access.case;

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  try {
    const resultado = await confirmarSubida({
      actor: { orgId: c.orgId, caseId: c.id, userId: null, isPortalUpload: true },
      uploadId: (body as { uploadId?: unknown }).uploadId,
    });

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }

    return NextResponse.json(resultado.documento, {
      status: resultado.yaConfirmada ? 200 : 201,
    });
  } catch (error) {
    console.error("Portal upload complete error:", error);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}
