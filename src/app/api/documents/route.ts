import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireOrgPermission("documents.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const orgId = session.user.orgId;
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "30")));
  const search = url.searchParams.get("search") || "";
  const source = url.searchParams.get("source"); // "portal" | "admin"

  const where: Record<string, unknown> = { case: { orgId } };
  if (search) where.fileName = { contains: search, mode: "insensitive" };
  if (source === "portal") where.isPortalUpload = true;
  if (source === "admin") where.isPortalUpload = false;

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where: where as any,
      include: {
        case: { select: { id: true, ref: true, deceased: { select: { fullName: true } } } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.document.count({ where: where as any }),
  ]);

  /*
   * Misma forma que la primera carga del servidor.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Aquí se devolvía `case.deceased.fullName` anidado, mientras que el
   * renderizado inicial de `/documents` aplana ese dato a `case.deceasedName`,
   * que es lo que lee el cliente. Resultado: el nombre del fallecido se veía al
   * abrir la página y DESAPARECÍA de toda la tabla en cuanto se buscaba, se
   * filtraba o se cambiaba de página, porque la propiedad que el cliente lee no
   * existía en esta respuesta.
   */
  const documentos = documents.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    fileSize: d.fileSize,
    isPortalUpload: d.isPortalUpload,
    uploadedBy: d.uploadedBy,
    createdAt: d.createdAt,
    case: d.case
      ? { id: d.case.id, ref: d.case.ref, deceasedName: d.case.deceased?.fullName ?? null }
      : null,
    task: d.task ? { id: d.task.id, title: d.task.title } : null,
  }));

  return NextResponse.json({ documents: documentos, total, page, limit });
}
