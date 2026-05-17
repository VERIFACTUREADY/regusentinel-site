import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "documents.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

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

  return NextResponse.json({ documents, total, page, limit });
}
