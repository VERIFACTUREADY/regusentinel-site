import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { demoRequestSchema } from "@/lib/validations";
import { sendNewLeadNotification } from "@/lib/email";
import { rateLimit } from "@/lib/api-rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit por IP (5 por hora) ANTES de tocar la DB — antes el filtro era
  // por email y un atacante podia variar demo+N@... para bypass total.
  const limited = rateLimit(req, { bucket: "demo-request", windowMs: 60 * 60 * 1000, max: 5 });
  if (limited) return limited;

  try {
    const body = await req.json();
    const data = demoRequestSchema.parse(body);

    // Segundo filtro por email para evitar que el mismo prospect spamee
    // distintas IPs con NAT compartido o proxies.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentByEmail = await prisma.demoRequest.count({
      where: { email: data.email, createdAt: { gte: oneHourAgo } },
    });
    if (recentByEmail >= 5) {
      return NextResponse.json({ error: "Demasiadas solicitudes, intente mas tarde" }, { status: 429 });
    }

    const timeLabels: Record<string, string> = {
      manana: "Mañana (9:00–12:00)",
      mediodia: "Mediodía (12:00–14:00)",
      tarde: "Tarde (16:00–19:00)",
    };
    const messageWithTime = [
      data.message,
      data.preferredTime ? `Horario preferido: ${timeLabels[data.preferredTime] ?? data.preferredTime}` : null,
    ].filter(Boolean).join("\n") || undefined;

    const request = await prisma.demoRequest.create({
      data: {
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        message: messageWithTime,
        source: data.source,
      },
    });

    // Fire-and-forget: don't block the response if email delivery fails.
    const baseUrl = process.env.NEXTAUTH_URL || "https://heredia.app";
    sendNewLeadNotification({
      name: data.name,
      email: data.email,
      company: data.company,
      phone: data.phone,
      message: messageWithTime,
      source: data.source,
      adminUrl: `${baseUrl}/admin/demo-requests`,
    }).catch((err) => console.error("Lead notification email failed:", err));

    return NextResponse.json({ id: request.id, message: "Solicitud recibida" }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Datos invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Demo request error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
