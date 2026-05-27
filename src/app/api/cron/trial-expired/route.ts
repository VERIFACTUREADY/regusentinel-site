import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: "trialing",
      currentPeriodEnd: { lt: now },
    },
    include: {
      org: {
        select: {
          name: true,
          members: {
            where: { role: "OWNER" },
            select: { user: { select: { email: true, name: true } } },
            take: 1,
          },
        },
      },
    },
  });

  if (expiredTrials.length === 0) {
    return NextResponse.json({ processed: 0, suspended: 0, timestamp: now.toISOString() });
  }

  // Batch update all expired trials at once
  const expiredIds = expiredTrials.map((s) => s.id);
  await prisma.subscription.updateMany({
    where: { id: { in: expiredIds } },
    data: { status: "canceled" },
  });

  const suspended = expiredTrials.length;

  // Parallel: audit logs + owner emails
  await Promise.all(
    expiredTrials.flatMap((sub) => {
      const tasks: Promise<unknown>[] = [
        logAudit({
          orgId: sub.orgId,
          action: "subscription.trial_expired",
          details: `Plan ${sub.plan} — trial expirado, acceso suspendido`,
        }).catch(console.error),
      ];

      const owner = sub.org.members[0]?.user;
      if (owner?.email) {
        tasks.push(
          sendEmail({
            to: owner.email,
            subject: `Tu trial de Heredia ha finalizado — ${sub.org.name}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:#dc2626;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                  <h1 style="color:white;margin:0;font-size:24px;">Heredia</h1>
                </div>
                <div style="padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                  <h2 style="color:#1a1a2e;margin-top:0;">Hola ${owner.name ?? ""},</h2>
                  <p style="font-size:15px;color:#333;">
                    Tu periodo de prueba del plan <strong>${sub.plan}</strong> para
                    <strong>${sub.org.name}</strong> ha finalizado.
                  </p>
                  <p style="font-size:15px;color:#333;">
                    El acceso a la plataforma ha sido suspendido. Tus datos estan seguros y
                    se conservaran durante 90 dias. Activa un plan de pago para recuperar el acceso.
                  </p>
                  <p style="text-align:center;margin:32px 0;">
                    <a href="https://heredia.app/billing"
                       style="background-color:#1e40af;color:white;padding:12px 32px;
                              border-radius:6px;text-decoration:none;font-weight:600;">
                      Activar suscripcion
                    </a>
                  </p>
                  <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
                  <p style="color:#999;font-size:12px;">Heredia — Gestion post-mortem profesional</p>
                </div>
              </div>
            `,
          }).catch(console.error),
        );
      }

      return tasks;
    }),
  );

  const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
  if (notifyEmail && suspended > 0) {
    const orgList = expiredTrials
      .map((s) => `<li>${s.org.name} (${s.plan})</li>`)
      .join("");

    await sendEmail({
      to: notifyEmail,
      subject: `${suspended} trial(s) expirado(s) hoy`,
      html: `
        <div style="font-family:sans-serif;">
          <p><strong>${suspended}</strong> organizacion(es) con trial expirado:</p>
          <ul>${orgList}</ul>
          <p>Los accesos han sido suspendidos automaticamente.</p>
        </div>
      `,
    }).catch(console.error);
  }

  return NextResponse.json({
    processed: expiredTrials.length,
    suspended,
    timestamp: now.toISOString(),
  });
}
