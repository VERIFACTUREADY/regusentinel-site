import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { seedDefaultCaseTemplates } from "@/lib/default-case-templates";

export async function POST() {
  const auth = await requireOrgPermission("casetemplates.manage");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const created = await prisma.$transaction((tx) =>
    seedDefaultCaseTemplates(tx, session.user.orgId!)
  );

  if (created > 0) {
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      action: "casetemplate.seeded",
      details: `${created} plantillas por defecto cargadas`,
    });
  }

  return NextResponse.json({ created });
}
