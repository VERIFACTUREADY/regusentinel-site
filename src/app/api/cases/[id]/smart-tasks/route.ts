import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateSmartTasks } from "@/lib/smart-tasks";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireOrgPermission("cases.write");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  try {
    const result = await generateSmartTasks(params.id, session.user.id);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[smart-tasks] failed:", err);
    return NextResponse.json(
      { error: err?.message || "Error generando tareas" },
      { status: 500 }
    );
  }
}
