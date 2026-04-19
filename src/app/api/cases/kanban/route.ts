import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

const ACTIVE_STATUSES = [
  "INTAKE",
  "VALIDATION",
  "IN_PROGRESS",
  "PENDING_DOCS",
  "READY_TO_SEND",
  "SENT",
  "FOLLOW_UP",
] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const cases = await prisma.case.findMany({
    where: {
      orgId: session.user.orgId,
      deletedAt: null,
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      id: true,
      ref: true,
      status: true,
      isUrgent: true,
      updatedAt: true,
      createdAt: true,
      deceased: { select: { fullName: true } },
      _count: { select: { tasks: true, documents: true } },
    },
    orderBy: [{ isUrgent: "desc" }, { updatedAt: "desc" }],
  });

  const columns: Record<string, typeof cases> = {};
  for (const s of ACTIVE_STATUSES) {
    columns[s] = [];
  }
  for (const c of cases) {
    columns[c.status]?.push(c);
  }

  return NextResponse.json({ columns, total: cases.length });
}
