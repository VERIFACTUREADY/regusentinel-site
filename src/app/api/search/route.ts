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
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const orgId = session.user.orgId;

  const [cases, tasks] = await Promise.all([
    prisma.case.findMany({
      where: {
        orgId,
        deletedAt: null,
        OR: [
          { ref: { contains: q, mode: "insensitive" } },
          { deceased: { fullName: { contains: q, mode: "insensitive" } } },
          { contact: { fullName: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        ref: true,
        status: true,
        isUrgent: true,
        deceased: { select: { fullName: true } },
        contact: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.task.findMany({
      where: {
        case: { orgId, deletedAt: null },
        title: { contains: q, mode: "insensitive" },
        status: { notIn: ["DONE", "SKIPPED"] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        caseId: true,
        case: { select: { ref: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const results = [
    ...cases.map((c) => ({
      type: "case" as const,
      id: c.id,
      title: c.ref,
      subtitle: c.deceased?.fullName || c.contact?.fullName || "",
      href: `/cases/${c.id}`,
      status: c.status,
      isUrgent: c.isUrgent,
    })),
    ...tasks.map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      subtitle: t.case.ref,
      href: `/cases/${t.caseId}`,
      status: t.status,
      category: t.category,
    })),
  ];

  return NextResponse.json({ results });
}
