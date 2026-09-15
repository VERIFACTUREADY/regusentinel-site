import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("templates.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const template = await prisma.template.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    include: { versions: { orderBy: { version: "desc" } } },
  });

  if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  return NextResponse.json(template);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("templates.update");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const template = await prisma.template.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

  const body = await req.json();
  const lastVersion = template.versions[0]?.version || 0;

  const version = await prisma.templateVersion.create({
    data: {
      templateId: params.id,
      version: lastVersion + 1,
      subject: body.subject,
      body: body.body,
      variables: body.variables || [],
      isApproved: false,
    },
  });

  return NextResponse.json(version);
}
