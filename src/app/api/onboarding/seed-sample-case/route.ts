import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { seedSampleCase } from "@/lib/sample-case-seeder";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.create")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const result = await prisma.$transaction((tx) =>
    seedSampleCase(tx, session.user.orgId!)
  );

  if (result.created) {
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      action: "case.sample_seeded",
      details: `Expediente de ejemplo creado: ${result.caseRef}`,
    });
  }

  return NextResponse.json({
    caseId: result.caseId,
    caseRef: result.caseRef,
    created: result.created,
  });
}
