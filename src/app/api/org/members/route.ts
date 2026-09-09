import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const members = await prisma.membership.findMany({
    where: { orgId: session.user.orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role }))
  );
}
