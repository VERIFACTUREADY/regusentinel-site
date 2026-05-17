import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Find all cases for this org
  const cases = await prisma.case.findMany({
    where: { orgId: session.user.orgId },
    select: { id: true },
  });

  let totalRemoved = 0;

  for (const c of cases) {
    const tasks = await prisma.task.findMany({
      where: { caseId: c.id },
      orderBy: { createdAt: "asc" },
    });

    // Group by title+category to find duplicates
    const seen = new Map<string, string>(); // key -> first task id
    const toDelete: string[] = [];

    for (const task of tasks) {
      const key = `${task.category}::${task.title}`;
      if (seen.has(key)) {
        toDelete.push(task.id);
      } else {
        seen.set(key, task.id);
      }
    }

    if (toDelete.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: toDelete } } });
      totalRemoved += toDelete.length;
    }
  }

  return NextResponse.json({ success: true, tasksRemoved: totalRemoved });
}
