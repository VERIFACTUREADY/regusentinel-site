import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * Daily cron that flags leads stuck in NEW status for ≥ 2 days and sends
 * a digest to LEADS_NOTIFY_EMAIL so none slip through the cracks.
 * Only fires when LEADS_NOTIFY_EMAIL is configured.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
  if (!notifyEmail) {
    return NextResponse.json({ skipped: "LEADS_NOTIFY_EMAIL not set" });
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  const stale = await prisma.demoRequest.findMany({
    where: {
      leadStatus: "NEW",
      createdAt: { lte: twoDaysAgo },
    },
    orderBy: { createdAt: "asc" },
  });

  if (stale.length === 0) {
    return NextResponse.json({ ok: true, staleCount: 0 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://heredia.app";

  const rows = stale
    .map((r) => {
      const days = Math.floor(
        (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return `
        <tr>
          <td style="padding:6px 12px 6px 0;font-size:14px;">
            <strong>${r.name}</strong><br/>
            <a href="mailto:${r.email}" style="color:#1e40af;font-size:12px;">${r.email}</a>
          </td>
          <td style="padding:6px 12px 6px 0;font-size:14px;">${r.company || "—"}</td>
          <td style="padding:6px 12px 6px 0;font-size:14px;color:#b91c1c;font-weight:600;">${days}d sin contactar</td>
        </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <p style="background:#b91c1c;color:white;padding:6px 12px;display:inline-block;border-radius:4px;font-size:12px;font-weight:700;letter-spacing:0.5px;">
        LEADS FRIOS — ACCION REQUERIDA
      </p>
      <h2 style="color:#1a1a2e;margin-top:12px;">
        ${stale.length} lead${stale.length > 1 ? "s" : ""} sin contactar en más de 2 días
      </h2>
      <table style="border-collapse:collapse;margin:16px 0;width:100%;">
        <thead>
          <tr style="text-align:left;font-size:12px;color:#666;">
            <th style="padding:4px 12px 4px 0;">Contacto</th>
            <th style="padding:4px 12px 4px 0;">Empresa</th>
            <th style="padding:4px 12px 4px 0;">Antigüedad</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:center;margin:32px 0;">
        <a href="${baseUrl}/admin/demo-requests"
           style="background-color:#1e40af;color:white;padding:12px 32px;
                  border-radius:6px;text-decoration:none;font-weight:600;">
          Gestionar leads →
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin-top:32px;"/>
      <p style="color:#999;font-size:12px;">Heredia · Recordatorio automático de leads sin contactar</p>
    </div>
  `;

  await sendEmail({
    to: notifyEmail,
    subject: `⚠️ ${stale.length} lead${stale.length > 1 ? "s" : ""} sin contactar — Heredia`,
    html,
  });

  return NextResponse.json({ ok: true, staleCount: stale.length });
}
