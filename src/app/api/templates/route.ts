import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const auth = await requireOrgPermission("templates.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

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
  const auth = await requireOrgPermission("templates.create");
  if (!auth.ok) return auth.response;
  const session = auth.session;

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
