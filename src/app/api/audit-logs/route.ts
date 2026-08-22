import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { inicioDelDiaDeES, sumarDiasES } from "@/lib/fecha-es";

export async function GET(req: NextRequest) {
  const auth = await requireOrgPermission("audit.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const caseId = url.searchParams.get("caseId");
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("userId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const search = url.searchParams.get("search");

  const conditions: Record<string, unknown>[] = [{ orgId: session.user.orgId }];
  if (caseId) conditions.push({ caseId });
  if (userId) conditions.push({ userId: userId === "system" ? null : userId });
  if (action) conditions.push({ action: { startsWith: action } });
  /*
   * Los limites del rango son DIAS CIVILES ESPANOLES, no dias UTC.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Antes: `gte: new Date(from)` y `lte: new Date(to + "T23:59:59.999Z")`.
   * Las dos mitades estaban mal para un usuario en Madrid:
   *
   *   - `new Date("2026-08-22")` es la medianoche UTC, que en Madrid son las
   *     02:00. Filtrando «desde el 22» se PERDIAN los registros de entre las
   *     00:00 y las 02:00 del dia 22.
   *   - `"2026-08-22T23:59:59.999Z"` son las 01:59 del dia 23 en Madrid, asi
   *     que filtrando «hasta el 22» se COLABAN registros del dia 23.
   *
   * Una auditoria que pierde registros del dia que pides, y ademas te ensena
   * los del dia siguiente, no sirve como auditoria. `inicioDelDiaES` es el
   * mismo ayudante con el que la aplicacion agrupa por dia.
   */
  if (from || to) {
    conditions.push({
      createdAt: {
        ...(from ? { gte: inicioDelDiaDeES(new Date(`${from}T12:00:00Z`)) } : {}),
        ...(to ? { lt: sumarDiasES(new Date(`${to}T12:00:00Z`), 1) } : {}),
      },
    });
  }
  if (search) {
    conditions.push({
      OR: [
        { action: { contains: search, mode: "insensitive" } },
        { details: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  const where = { AND: conditions };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: where as any,
      include: {
        user: { select: { name: true, email: true } },
        case: { select: { ref: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where: where as any }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
