import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/api-rate-limit";
import crypto from "crypto";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  // Rate limit por IP: 5 intentos / hora. Evita reset-email spam y saturacion
  // de SMTP/Resend si alguien itera sobre listas de emails de la org.
  const limited = rateLimit(req, { bucket: "forgot-password", windowMs: 60 * 60 * 1000, max: 5 });
  if (limited) return limited;

  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { magicToken: token, magicTokenExp: expires },
      });

      const baseUrl = process.env.NEXTAUTH_URL || "https://heredia.app";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      await sendEmail({
        to: email,
        subject: "Restablecer contrasena — Heredia",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1e40af;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:24px;">Heredia</h1>
            </div>
            <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <h2 style="color:#1a1a2e;margin-top:0;">Restablecer contrasena</h2>
              <p style="font-size:15px;color:#333;">
                Hemos recibido una solicitud para restablecer la contrasena de tu cuenta.
                Haz clic en el boton de abajo para crear una nueva contrasena.
              </p>
              <p style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}"
                   style="background-color:#1e40af;color:white;padding:12px 32px;
                          border-radius:6px;text-decoration:none;font-weight:600;">
                  Restablecer contrasena
                </a>
              </p>
              <p style="font-size:13px;color:#666;">
                Este enlace expira en 1 hora. Si no solicitaste este cambio, puedes ignorar este email.
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
              <p style="color:#999;font-size:12px;">Heredia — Gestion post-mortem profesional</p>
            </div>
          </div>
        `,
      }).catch(console.error);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: "Si el email existe, recibiras un enlace para restablecer tu contrasena.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Email no valido" }, { status: 400 });
    }
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
