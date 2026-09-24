import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireOrgPermission("autopilot.approve");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);

  // `deletedAt: null`: una aprobacion de un expediente borrado no es trabajo
  // pendiente. Es el mismo criterio que /dashboard, /today y el contador del
  // encabezado de esta pantalla.
  const where: Record<string, unknown> = {
    case: { orgId: session.user.orgId, deletedAt: null },
  };
  if (status) where.status = status;

  const [approvals, total] = await Promise.all([
    prisma.approval.findMany({
      where: where as any,
      include: {
        case: { select: { ref: true, deceased: { select: { fullName: true } } } },
        task: { select: { title: true } },
        reviewer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.approval.count({ where: where as any }),
  ]);

  return NextResponse.json({ approvals, total, page, limit });
}
