import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.update")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { ids, action, status } = body as {
    ids: string[];
    action: "status" | "delete";
    status?: string;
  };

  if (!ids || !Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return NextResponse.json({ error: "IDs invalidos (1-100)" }, { status: 400 });
  }

  const orgId = session.user.orgId;
  const cases = await prisma.case.findMany({
    where: { id: { in: ids }, orgId, deletedAt: null },
    select: { id: true, ref: true, status: true },
  });

  if (cases.length === 0) {
    return NextResponse.json({ error: "No se encontraron expedientes" }, { status: 404 });
  }

  if (action === "status" && status) {
    await prisma.case.updateMany({
      where: { id: { in: cases.map((c) => c.id) } },
      data: {
        status: status as any,
        ...(status === "CLOSED" ? { closedAt: new Date() } : {}),
      },
    });

    await logAudit({
      orgId,
      userId: session.user.id,
      action: "cases.batch_status",
      details: `${cases.length} expedientes → ${status}: ${cases.map((c) => c.ref).join(", ")}`,
    });

    return NextResponse.json({ updated: cases.length });
  }

  if (action === "delete") {
    if (!hasPermission(session.user.role, "cases.delete")) {
      return NextResponse.json({ error: "Sin permisos para eliminar" }, { status: 403 });
    }

    await prisma.case.updateMany({
      where: { id: { in: cases.map((c) => c.id) } },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      orgId,
      userId: session.user.id,
      action: "cases.batch_deleted",
      details: `${cases.length} expedientes eliminados: ${cases.map((c) => c.ref).join(", ")}`,
    });

    return NextResponse.json({ deleted: cases.length });
  }

  return NextResponse.json({ error: "Accion no valida" }, { status: 400 });
}
