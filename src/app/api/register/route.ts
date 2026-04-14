import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  orgName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  plan: z.enum(["INICIA", "DESPACHO", "FIRMA"]).default("INICIA"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });
    }

    const slug = data.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existingOrg = await prisma.organization.findUnique({ where: { slug } });
    if (existingOrg) {
      return NextResponse.json({ error: "Nombre de organizacion ya en uso" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: data.orgName, slug },
      });

      const user = await tx.user.create({
        data: { email: data.email, name: data.name, passwordHash },
      });

      await tx.membership.create({
        data: { userId: user.id, orgId: org.id, role: "OWNER" },
      });

      await tx.subscription.create({
        data: { orgId: org.id, plan: data.plan, status: "active" },
      });

      return { org, user };
    });

    return NextResponse.json({ orgId: result.org.id, userId: result.user.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Register error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
