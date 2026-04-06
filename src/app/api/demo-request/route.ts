import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { demoRequestSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = demoRequestSchema.parse(body);

    // Simple rate limit: max 5 requests per IP per hour
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.demoRequest.count({
      where: { email: data.email, createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= 5) {
      return NextResponse.json({ error: "Demasiadas solicitudes, intente mas tarde" }, { status: 429 });
    }

    const request = await prisma.demoRequest.create({
      data: {
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        message: data.message,
      },
    });

    return NextResponse.json({ id: request.id, message: "Solicitud recibida" }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Datos invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Demo request error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
