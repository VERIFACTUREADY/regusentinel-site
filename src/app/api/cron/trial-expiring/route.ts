import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialExpiringNotification } from "@/lib/email";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(now.getDate() + 3);

  const expiring = await prisma.subscription.findMany({
    where: {
      status: "trialing",
      currentPeriodEnd: { lte: threeDaysFromNow, gt: now },
    },
    include: {
      org: {
        select: {
          name: true,
          slug: true,
          members: {
            where: { role: "OWNER" },
            select: { user: { select: { email: true, name: true } } },
            take: 1,
          },
        },
      },
    },
  });

  let notified = 0;
  for (const sub of expiring) {
    const ownerEmail = sub.org.members[0]?.user.email;
    if (!ownerEmail || !sub.currentPeriodEnd) continue;

    const daysLeft = Math.ceil(
      (sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    await sendTrialExpiringNotification({
      orgName: sub.org.name,
      ownerEmail,
      ownerName: sub.org.members[0]?.user.name || ownerEmail,
      plan: sub.plan,
      daysLeft,
      expiresAt: sub.currentPeriodEnd,
    }).catch(console.error);

    notified++;
  }

  const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
  if (notifyEmail && expiring.length > 0) {
    const { sendEmail } = await import("@/lib/email");
    const rows = expiring
      .map((s) => {
        const days = s.currentPeriodEnd
          ? Math.ceil((s.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return `<tr>
          <td style="padding:4px 12px 4px 0;font-size:14px;">${s.org.name}</td>
          <td style="padding:4px 12px;font-size:14px;">${s.plan}</td>
          <td style="padding:4px 12px;font-size:14px;font-weight:600;color:#b91c1c;">${days}d</td>
        </tr>`;
      })
      .join("");

    await sendEmail({
      to: notifyEmail,
      subject: `${expiring.length} trial(s) expiran en 3 dias o menos`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <p style="background:#b91c1c;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;">TRIALS A PUNTO DE EXPIRAR</p>
          <table style="border-collapse:collapse;margin:16px 0;width:100%;">
            <tr style="border-bottom:1px solid #eee;">
              <th style="padding:4px 12px 4px 0;text-align:left;font-size:13px;color:#666;">Org</th>
              <th style="padding:4px 12px;text-align:left;font-size:13px;color:#666;">Plan</th>
              <th style="padding:4px 12px;text-align:left;font-size:13px;color:#666;">Dias</th>
            </tr>
            ${rows}
          </table>
        </div>
      `,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, notified });
}
