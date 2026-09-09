import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; versionId: string }> }
) {
  const params = await props.params;
  const auth = await requireOrgPermission("templates.update");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  // Verify ownership: the version must belong to a template in this org
  const version = await prisma.templateVersion.findFirst({
    where: {
      id: params.versionId,
      templateId: params.id,
      template: { orgId: session.user.orgId },
    },
  });

  if (!version) {
    return NextResponse.json({ error: "Version no encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const updated = await prisma.templateVersion.update({
    where: { id: params.versionId },
    data: {
      ...(typeof body.isApproved === "boolean" ? { isApproved: body.isApproved } : {}),
    },
  });

  return NextResponse.json(updated);
}
