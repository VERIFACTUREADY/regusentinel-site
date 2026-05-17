import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendWelcomeEmail, sendEmail } from "@/lib/email";
import { seedDefaultCaseTemplates } from "@/lib/default-case-templates";
import bcrypt from "bcryptjs";
import { z } from "zod";

const TRIAL_DAYS = 14;

const registerSchema = z.object({
  orgName: z.string().min(2).max(200),
  name: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  plan: z.enum(["INICIA", "DESPACHO", "FIRMA"]).default("INICIA"),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Debe aceptar los terminos y la politica de privacidad" }),
  }),
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
    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

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
        data: {
          orgId: org.id,
          plan: data.plan,
          status: "trialing",
          currentPeriodEnd: trialEnd,
        },
      });

      await seedDefaultCaseTemplates(tx, org.id);

      return { org, user };
    });

    logAudit({
      orgId: result.org.id,
      userId: result.user.id,
      action: "org.created",
      details: `Plan ${data.plan}, trial ${TRIAL_DAYS} dias`,
    }).catch(console.error);

    sendWelcomeEmail({
      email: data.email,
      name: data.name,
      orgName: data.orgName,
      plan: data.plan,
      trialDays: TRIAL_DAYS,
    }).catch(console.error);

    const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
    if (notifyEmail) {
      sendEmail({
        to: notifyEmail,
        subject: `Nuevo registro — ${data.orgName} (${data.plan})`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <p style="background:#16a34a;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;">NUEVO REGISTRO</p>
            <h2 style="color:#1a1a2e;margin-top:12px;">Nueva cuenta creada</h2>
            <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
              <tr><td style="padding:4px 16px 4px 0;color:#666;">Organizacion</td><td><strong>${data.orgName}</strong></td></tr>
              <tr><td style="padding:4px 16px 4px 0;color:#666;">Contacto</td><td>${data.name} &lt;${data.email}&gt;</td></tr>
              <tr><td style="padding:4px 16px 4px 0;color:#666;">Plan</td><td><strong>${data.plan}</strong></td></tr>
              <tr><td style="padding:4px 16px 4px 0;color:#666;">Trial</td><td>${TRIAL_DAYS} dias</td></tr>
            </table>
          </div>
        `,
      }).catch(console.error);
    }

    return NextResponse.json({ orgId: result.org.id, userId: result.user.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos", details: error.errors }, { status: 400 });
    }
    console.error("Register error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
