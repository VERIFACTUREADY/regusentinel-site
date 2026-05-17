import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, "La contrasena debe tener al menos 6 caracteres").max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);

    const user = await prisma.user.findFirst({
      where: {
        magicToken: token,
        magicTokenExp: { gte: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Enlace invalido o expirado. Solicita uno nuevo." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        magicToken: null,
        magicTokenExp: null,
      },
    });

    return NextResponse.json({ message: "Contrasena actualizada correctamente." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
