import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

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
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

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
