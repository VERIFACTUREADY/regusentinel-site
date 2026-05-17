import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { seedDefaultCaseTemplates } from "@/lib/default-case-templates";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "casetemplates.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

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
