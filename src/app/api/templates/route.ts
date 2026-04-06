import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "templates.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const templates = await prisma.template.findMany({
    where: { orgId: session.user.orgId },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "templates.create")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { name, category, type, body: templateBody, variables, subject } = body;

  const template = await prisma.template.create({
    data: {
      orgId: session.user.orgId,
      name,
      category: category || null,
      type: type || "email",
      versions: {
        create: {
          version: 1,
          subject: subject || null,
          body: templateBody,
          variables: variables || [],
          isApproved: false,
        },
      },
    },
    include: { versions: true },
  });

  return NextResponse.json(template, { status: 201 });
}
