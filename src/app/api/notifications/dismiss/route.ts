import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST body: { id: string } — dismisses a stored NotificationLog alert.
// Live alerts (id starts with "overdue:", "blocked:", "isd:", "portal:")
// are synthetic and don't persist — client just removes them from state.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Stored logs have a regular cuid (no ":" prefix); verify org ownership
  const log = await prisma.notificationLog.findFirst({
    where: { id, orgId: session.user.orgId },
    select: { id: true },
  });
  if (!log) {
    // May be a synthetic/live alert — treat as success (client removes it)
    return NextResponse.json({ ok: true, synthetic: true });
  }

  // Mark as READ by setting status to "READ"
  await prisma.notificationLog.update({
    where: { id },
    data: { status: "read" },
  });

  return NextResponse.json({ ok: true });
}
