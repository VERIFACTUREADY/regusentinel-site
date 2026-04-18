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
  let totalCleaned = 0;
  const orgResults: { name: string; cleaned: number; retentionDays: number }[] = [];

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, retentionDays: true },
  });

  for (const org of orgs) {
    const cutoff = new Date(now.getTime() - org.retentionDays * 24 * 60 * 60 * 1000);

    // Soft-delete closed cases older than the retention period
    const result = await prisma.case.updateMany({
      where: {
        orgId: org.id,
        status: "CLOSED",
        closedAt: { lt: cutoff },
        deletedAt: null,
      },
      data: { deletedAt: now },
    });

    if (result.count > 0) {
      totalCleaned += result.count;
      orgResults.push({
        name: org.name,
        cleaned: result.count,
        retentionDays: org.retentionDays,
      });

      await logAudit({
        orgId: org.id,
        action: "retention.cleanup",
        details: `${result.count} expediente(s) archivado(s) (retencion: ${org.retentionDays} dias)`,
      }).catch(console.error);
    }
  }

  if (totalCleaned > 0) {
    const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
    if (notifyEmail) {
      const rows = orgResults
        .map(
          (r) =>
            `<tr><td style="padding:4px 12px 4px 0;">${r.name}</td><td style="padding:4px 12px;">${r.cleaned}</td><td style="padding:4px 0;">${r.retentionDays}d</td></tr>`
        )
        .join("");

      await sendEmail({
        to: notifyEmail,
        subject: `Limpieza de retencion — ${totalCleaned} expediente(s) archivado(s)`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <p style="background:#6366f1;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;">RETENCION RGPD</p>
            <h2 style="color:#1a1a2e;margin-top:12px;">Limpieza automatica de datos</h2>
            <p style="font-size:14px;color:#333;">${totalCleaned} expediente(s) cerrado(s) han sido archivados (soft-delete) por superar el periodo de retencion configurado.</p>
            <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
              <tr style="border-bottom:1px solid #eee;font-weight:600;"><td style="padding:4px 12px 4px 0;">Organizacion</td><td style="padding:4px 12px;">Archivados</td><td style="padding:4px 0;">Retencion</td></tr>
              ${rows}
            </table>
          </div>
        `,
      }).catch(console.error);
    }
  }

  return NextResponse.json({
    processed: orgs.length,
    totalCleaned,
    details: orgResults,
    timestamp: now.toISOString(),
  });
}
