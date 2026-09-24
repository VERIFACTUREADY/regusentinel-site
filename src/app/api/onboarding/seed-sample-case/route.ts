import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { seedSampleCase } from "@/lib/sample-case-seeder";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireOrgPermission("cases.create");
  if (!auth.ok) return auth.response;
  const session = auth.session;

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
