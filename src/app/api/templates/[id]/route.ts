import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "templates.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const template = await prisma.template.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    include: { versions: { orderBy: { version: "desc" } } },
  });

  if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  return NextResponse.json(template);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "templates.update")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

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
